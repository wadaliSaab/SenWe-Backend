import Conversation from "../models/Conversation.js";
import ConversationParticipant from "../models/ConversationParticipant.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import PrivateGroup from "../models/PrivateGroups.js";
import AppError from "../utils/AppError.js";
import Message from "../models/Message.js";
import SavedMessage from "../models/SavedMessage.js"; 
import { signUsersAvatar } from "./storageService.js";
import { addCleanupJob } from "./cleanupService.js";
import {
  cacheKeys,
  deleteCache,
  deleteCachePattern,
  getCache,
  setCache,
} from "./cacheService.js";

export const createConversationService = async (senderId, receiverId) => {
   const [sender, receiver] = await Promise.all([
    User.findById(senderId).select("blockedUsers").lean(),
    User.findById(receiverId).select("blockedUsers").lean(),
  ]);

  const senderBlockedReceiver = sender?.blockedUsers?.some(
    (id) => id.toString() === receiverId.toString(),
  );
  const receiverBlockedSender = receiver?.blockedUsers?.some(
    (id) => id.toString() === senderId.toString(),
  );

  if (senderBlockedReceiver) {
    throw new AppError("You have blocked this user", 403);
  }
  if (receiverBlockedSender) {
    throw new AppError("You cannot start a conversation with this user", 403);
  }
  const existingConversation = await Conversation.findOne({
    participants: { $all: [senderId, receiverId] },
  })
    .populate("participants", "avatar username email name bio")
    .lean();

 if (existingConversation) {
  await signUsersAvatar(existingConversation.participants);
  await ConversationParticipant.updateOne(
    { conversation: existingConversation._id, user: senderId },
    { isDeleted: false, deletedAt: null }
  );
  await deleteCache(cacheKeys.userConversations(senderId));
  return mapConversation(existingConversation, senderId);
}
  const session = await mongoose.startSession();

  try {
    let conversation;

    await session.withTransaction(async () => {

      const conversationExists = await Conversation.findOne({
        participants: { $all: [senderId, receiverId] },
      }).session(session);

      if (conversationExists) {
        conversation = conversationExists;
        return;
      }

      [conversation] = await Conversation.create(
        [
          {
            participants: [senderId, receiverId],
          },
        ],
        { session }
      );

      await ConversationParticipant.insertMany(
        conversation.participants.map((userId) => ({
          conversation: conversation._id,
          user: userId,
        })),
        { session }
      );
    });

    const populatedConversation = await Conversation.findById(
      conversation._id
    )
      .populate("participants", "avatar username email name bio")
      .lean();

    await signUsersAvatar(populatedConversation.participants);

    await deleteCache(cacheKeys.userConversations(senderId));
    await deleteCache(cacheKeys.userConversations(receiverId));

    return mapConversation(populatedConversation, senderId);
  } finally {
    await session.endSession();
  }
};

const mapConversation = (conversation, loggedUserId) => {
  const otherUser = conversation.participants.find(
    (participant) =>
      participant._id.toString() !== loggedUserId.toString()
  );

  return {
    _id: conversation._id,
    otherUser,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastMessage: conversation.lastMessage ?? null,
    lastMessageAt: conversation.lastMessageAt ?? null,
  };
};

export const getUserConversationsService = async (userId) => {
  const key = cacheKeys.userConversations(userId);

  const cachedConversations = await getCache(key);
  if (cachedConversations) {
    return cachedConversations;
  }

  const participantStates = await ConversationParticipant.find({
    user: userId,
    isDeleted: { $ne: true },
  }).lean();

  const conversationIds = participantStates.map((p) => p.conversation);

  const conversations = await Conversation.find({
    _id: { $in: conversationIds },
  })
    .populate("participants", "avatar username email name bio")
    .populate("lastMessage")
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  await signUsersAvatar(
    conversations.flatMap((conversation) => conversation.participants)
  );

  const participantMap = new Map(
    participantStates.map((state) => [state.conversation.toString(), state])
  );

  const mappedConversations = conversations.map((conversation) => {
    const mapped = mapConversation(conversation, userId);
    const participant = participantMap.get(conversation._id.toString());

    return {
      ...mapped,
      unreadCount: participant?.unreadCount ?? 0,
      isPinned: participant?.isPinned ?? false,
      pinnedAt: participant?.pinnedAt ?? null,
    };
  });

  mappedConversations.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.isPinned && b.isPinned) {
      return new Date(b.pinnedAt) - new Date(a.pinnedAt);
    }
    return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
  });

  await setCache(key, mappedConversations);
  return mappedConversations;
};



export const deleteConversationService = async (userId, conversationId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  const isParticipant = conversation.participants.some(
    (participant) => participant.toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("Unauthorized", 403);
  }

  const participant = await ConversationParticipant.findOneAndUpdate(
    { conversation: conversationId, user: userId },
    { isDeleted: true, deletedAt: new Date(), unreadCount: 0 },
    { new: true }
  );
  if (!participant) {
    throw new AppError("Conversation not found", 404);
  }

 
  await SavedMessage.deleteMany({ user: userId, conversation: conversationId });
  await deleteCache(cacheKeys.savedMessages(userId, conversationId.toString()));
  await deleteCache(cacheKeys.userSavedChats(userId));

  await deleteCache(cacheKeys.userConversations(userId));

  const allParticipantStates = await ConversationParticipant.find({
    conversation: conversationId,
  }).lean();

  const allDeleted =
    allParticipantStates.length > 0 &&
    allParticipantStates.every((p) => p.isDeleted);

  if (allDeleted) {
    await hardDeleteConversation(conversationId, conversation.participants);
  }

  return { message: "Conversation deleted for you" };
};

const hardDeleteConversation = async (conversationId, participantIds) => {
  const session = await mongoose.startSession();
  let paths = [];

  try {
    await session.withTransaction(async () => {
      const messages = await Message.find({
        conversation: conversationId,
      }).session(session);

      for (const message of messages) {
        for (const attachment of message.attachments) {
          paths.push(attachment.filePath);
        }
      }

      await Message.deleteMany({ conversation: conversationId }, { session });
      await ConversationParticipant.deleteMany(
        { conversation: conversationId },
        { session }
      );
      await PrivateGroup.deleteMany({ conversation: conversationId }, { session });
      await Conversation.deleteOne({ _id: conversationId }, { session });
    });

    if (paths.length > 0) {
      await addCleanupJob({ type: "delete-files", paths });
    }

    await deleteCachePattern(`${cacheKeys.conversationMessages(conversationId)}:*`);
    for (const participantId of participantIds) {
      await deleteCache(cacheKeys.userConversations(participantId.toString()));
    }
  } finally {
    await session.endSession();
  }
};


export const searchConversationsService = async (
  userId,
  query,
  filter = "all",
  page = 1,
  limit = 20
) => {
  if (!query?.trim()) throw new AppError("Search query is required", 400);

  const searchRegex = new RegExp(
    query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i"
  );
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const pipeline = [
    { $match: { participants: userObjectId } },
    {
      $lookup: {
        from: "users",
        localField: "participants",
        foreignField: "_id",
        as: "participantDetails",
      },
    },
    {
      $addFields: {
        otherUser: {
          $first: {
            $filter: {
              input: "$participantDetails",
              cond: { $ne: ["$$this._id", userObjectId] },
            },
          },
        },
      },
    },
    {
      $match: {
        $or: [
          { "otherUser.username": searchRegex },
          { "otherUser.name": searchRegex },
        ],
      },
    },
    {
      $lookup: {
        from: "conversationparticipants",
        let: { convId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$conversation", "$$convId"] },
                  { $eq: ["$user", userObjectId] },
                ],
              },
            },
          },
        ],
        as: "myState",
      },
    },
    {
      $addFields: {
        unreadCount: { $ifNull: [{ $first: "$myState.unreadCount" }, 0] },
      },
    },

    {
      $lookup: {
        from: "messages", 
        localField: "lastMessage",
        foreignField: "_id",
        as: "lastMessageDetails",
      },
    },
    {
      $addFields: {
        lastMessage: { $first: "$lastMessageDetails" },
      },
    },
  ];

  if (filter === "unread") {
    pipeline.push({ $match: { unreadCount: { $gt: 0 } } });
  }

  if (filter === "saved") {
    pipeline.push(
      {
        $lookup: {
          from: "savedmessages",
          let: { convId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$conversation", "$$convId"] },
                    { $eq: ["$user", userObjectId] },
                  ],
                },
              },
            },
          ],
          as: "savedMatches",
        },
      },
      { $match: { "savedMatches.0": { $exists: true } } }
    );
  }

  pipeline.push(
    { $sort: { lastMessageAt: -1, updatedAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit }
  );

  const results = await Conversation.aggregate(pipeline);

  await signUsersAvatar(results.map((r) => r.otherUser).filter(Boolean));

  return results.map((r) => ({
    _id: r._id,
    otherUser: r.otherUser,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lastMessage: r.lastMessage ?? null,
    lastMessageAt: r.lastMessageAt ?? null,
    unreadCount: r.unreadCount,
  }));
};

export const togglePinConversationService = async (userId, conversationId) => {
  const participant = await ConversationParticipant.findOne({
    conversation: conversationId,
    user: userId,
  });

  if (!participant) {
    throw new AppError("Conversation not found", 404);
  }

  participant.isPinned = !participant.isPinned;
  participant.pinnedAt = participant.isPinned ? new Date() : null;
  await participant.save();

  await deleteCache(cacheKeys.userConversations(userId));

  return { message: participant.isPinned ? "Conversation pinned" : "Conversation unpinned",
    isPinned: participant.isPinned,      
    conversationId,     
   };
};