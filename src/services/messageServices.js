

import Message from "../models/Message.js";
import User from "../models/User.js";
import SavedMessage from "../models/SavedMessage.js";
import AppError from "../utils/AppError.js";
import fs from "fs";
import { upload, deleteFile } from "./storageService.js";
import mongoose from "mongoose";
import PrivateGroup from "../models/PrivateGroups.js";
import Conversation from "../models/Conversation.js";
import ConversationParticipant from "../models/ConversationParticipant.js";
import { signMessagesAttachments, signUsersAvatar } from "./storageService.js";
import { emitToConversation, emitToUser } from "../socket/socket.js";
import { addCleanupJob } from "./cleanupService.js";
import { getCache, setCache, deleteCachePattern, cacheKeys, deleteCache } from "./cacheService.js";


export const sendMessageService = async (
  conversationId,
  senderId,
  text,
  files,
) => {
  if (!text?.trim() && (!files || files.length === 0)) {
    throw new AppError("Message is required", 400);
  }

  const conversationCheck = await Conversation.findById(conversationId).lean();
  if (!conversationCheck) {
    throw new AppError("Conversation not found", 404);
  }

  const receiverId = conversationCheck.participants.find(
    (p) => p.toString() !== senderId.toString(),
  );

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
    throw new AppError("You have blocked this user. Unblock to send messages.", 403);
  }
  if (receiverBlockedSender) {
    throw new AppError("You cannot send messages to this user", 403);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  const attachments = [];
  try {
    if (files) {
      for (const file of files) {
        const filePath = await upload(file);
        const category = file.mimetype.split("/")[0];
        let fileType =
          category === "image"
            ? "image"
            : category === "video"
              ? "video"
              : "file";

        attachments.push({
          filePath,
          fileName: file.originalname,
          type: fileType,
        });
      }
    }

    const conversation = await Conversation.findById(conversationId).session(session);
    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    await conversation.save({ session });
    const [message] = await Message.create(
      [
        {
          conversation: conversationId,
          sender: senderId,
          text,
          attachments,
        },
      ],
      { session },
    );
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save({ session });

    await session.commitTransaction();

    const populatedMessage = await broadcastMessage(
      message._id,
      senderId,
      conversationId,
    );

    return populatedMessage;
  } catch (error) {
    await session.abortTransaction();
    if (attachments.length > 0) {
      await addCleanupJob({
        type: "delete-files",
        paths: attachments.map((attachment) => attachment.filePath),
      });
    }
    throw error;
  } finally {
    await session.endSession();
    for (const file of files ?? []) {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  }
};
export const getMessagesService = async (
  userId,
  conversationId,
  page = 1,
  limit = 20,
) => {
  const key = cacheKeys.messages(conversationId, page, limit, userId);
  const cachedMessages = await getCache(key);
  if (cachedMessages) {
    return cachedMessages;
  }

 
  const myPrivateGroups = await PrivateGroup.find({
    owner: userId,
    conversation: conversationId,
  })
    .select("_id")
    .lean();
  const myPrivateGroupIds = myPrivateGroups.map((g) => g._id);

  const messages = await Message.find({
    conversation: conversationId,
    deletedFor: { $ne: userId }, 
    $or: [
      { isPrivate: { $ne: true } }, 
      { isPrivate: true, privateGroup: { $in: myPrivateGroupIds } }, 
    ],
  })
    .populate("sender", "avatar username email")
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  await signUsersAvatar(messages.map((message) => message.sender));
  await signMessagesAttachments(messages);
  await setCache(key, messages);
  return messages;
};


export const deleteMessageForMeService = async (userId, messageIds) => {
  if (!messageIds.length) throw new AppError("No messages selected", 400);

  const messages = await Message.find({ _id: { $in: messageIds } });
  if (messages.length === 0) throw new AppError("No messages found", 404);

  await Message.updateMany(
    { _id: { $in: messageIds } },
    { $addToSet: { deletedFor: userId } },
  );
     await SavedMessage.deleteMany({
    message: { $in: messageIds },
    user: userId,
  });
  const conversationId = messages[0].conversation;
  await deleteCachePattern(
    `${cacheKeys.conversationMessages(conversationId.toString())}:*`,
  );
    await deleteCache(cacheKeys.savedMessages(userId, conversationId.toString()));
  await deleteCache(cacheKeys.userSavedChats(userId));
  return { message: "Messages deleted for you" };
};


export const deleteMessageForEveryoneService = async (userId, messageIds) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!messageIds.length) throw new AppError("No messages selected", 400);
    const messages = await Message.find({
      _id: { $in: messageIds },
    }).session(session);
    if (messages.length === 0) throw new AppError("No messages found", 404);

    for (const message of messages) {
      if (message.sender.toString() !== userId)
        throw new AppError(
          "You are not allowed to delete this message for everyone",
          403,
        );
    }

    const paths = [];
    for (const message of messages) {
      for (const attachment of message.attachments) {
        paths.push(attachment.filePath);
      }
    }

    const privateGroups = [
      ...new Set(
        messages
          .filter((message) => message.privateGroup)
          .map((message) => message.privateGroup.toString()),
      ),
    ];

   
    const savedMessages = await SavedMessage.find({
      message: { $in: messageIds },
    }).session(session);
    const savedMessagesUserIds = [
      ...new Set(savedMessages.map((s) => s.user.toString())),
    ];

    await Message.deleteMany({ _id: { $in: messageIds } }, { session });

   
    await SavedMessage.deleteMany(
      { message: { $in: messageIds } },
      { session },
    );

    for (const groupId of privateGroups) {
      const remainingMessages = await Message.countDocuments({
        privateGroup: groupId,
      }).session(session);
      if (remainingMessages === 0) {
        await PrivateGroup.findByIdAndDelete(groupId, { session });
      }
    }

    await session.commitTransaction();
    if (paths.length > 0) {
      await addCleanupJob({ type: "delete-files", paths });
    }

    const conversationId = messages[0]?.conversation;
    await deleteCachePattern(
      `${cacheKeys.conversationMessages(conversationId.toString())}:*`,
    );

    
    for (const id of savedMessagesUserIds) {
      await deleteCache(cacheKeys.savedMessages(id, conversationId.toString()));
      await deleteCache(cacheKeys.userSavedChats(id));
    }
   
    emitToConversation(conversationId, "messages-deleted", messageIds);

    return { message: "Messages deleted for everyone" };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const reactToMessagesService = async (userId, messageId, emoji) => {
  if (!emoji?.trim()) throw new AppError("Emoji is required", 400);

  const message = await Message.findById(messageId);
  if (!message) throw new AppError("Message not found", 404);
  const existingReaction = message.reactions.find(
    (reaction) => reaction.user.toString() === userId,
  );
  if (existingReaction) {
    message.reactions = message.reactions.filter(
      (reaction) => reaction.user.toString() !== userId,
    );
    if (existingReaction.emoji !== emoji) {
      message.reactions.push({ user: userId, emoji });
    }
  } else {
    message.reactions.push({ user: userId, emoji });
  }
  await message.save();
  await deleteCachePattern(
    cacheKeys.conversationMessages(message.conversation.toString()),
  );
  emitToConversation(message.conversation, "message-reaction", {
    messageId: message._id,
    reactions: message.reactions,
  });
  return {
    message: " reacted successfully",
    reactions: message.reactions,  
  };
};

export const markAsReadService = async (userId, conversationId) => {
  await ConversationParticipant.findOneAndUpdate(
    { conversation: conversationId, user: userId },
    { unreadCount: 0, lastReadAt: new Date() },
  );
  await deleteCache(cacheKeys.userConversations(userId)); 
  emitToConversation(conversationId, "messagesRead", { conversationId, userId });

  return { message: "Messages marked as read successfully" };
};



export const searchMessagesService = async (userId, conversationId, query, page = 1, limit = 20) => {
  if (!query?.trim()) throw new AppError("Search query is required", 400);

  
  
 
  const myPrivateGroups = await PrivateGroup.find({
    owner: userId,
    conversation: conversationId,
  })
    .select("_id")
    .lean();
  const myPrivateGroupIds = myPrivateGroups.map((g) => g._id);

  const regex = new RegExp(
  query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  "i"
);

const messages = await Message.find({
  conversation: conversationId,
  deletedFor: { $ne: userId },
  text: regex,
  $or: [
    { isPrivate: { $ne: true } },
    { 
      isPrivate: true,
      privateGroup: { $in: myPrivateGroupIds }
    },
  ],
})
    .populate("sender", "avatar username email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  await signUsersAvatar(messages.map((message) => message.sender));
  await signMessagesAttachments(messages);

  return messages;
};






export const broadcastMessage = async (messageId, senderId, conversationId) => {
  
  await ConversationParticipant.updateMany(
    { conversation: conversationId, user: { $ne: senderId } },
    { $inc: { unreadCount: 1 }, $set: { isDeleted: false, deletedAt: null } },
  );

 
  await ConversationParticipant.updateOne(
    { conversation: conversationId, user: senderId },
    { $set: { isDeleted: false, deletedAt: null } },
  );

  await deleteCachePattern(`${cacheKeys.conversationMessages(conversationId)}:*`);

  const populatedMessage = await Message.findById(messageId)
    .populate("sender", "avatar username email name bio")
    .lean();

  await signUsersAvatar([populatedMessage.sender]);
  await signMessagesAttachments([populatedMessage]);

  emitToConversation(conversationId, "new-message", populatedMessage);

  const otherParticipants = await ConversationParticipant.find({
    conversation: conversationId,
    user: { $ne: senderId },
  })
    .select("user unreadCount")
    .lean();

  for (const participant of otherParticipants) {
    emitToUser(participant.user, "conversation-updated", {
      conversationId,
      lastMessage: populatedMessage,
      lastMessageAt: populatedMessage.createdAt,
      senderId,
      unreadCount: participant.unreadCount,
    });

    await deleteCache(cacheKeys.userConversations(participant.user.toString()));
  }

  return populatedMessage;
};