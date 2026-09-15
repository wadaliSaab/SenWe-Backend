import PrivateGroup from "../models/PrivateGroups.js";
import Message from "../models/Message.js";
import AppError from "../utils/AppError.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Conversation from "../models/Conversation.js";
import mongoose from "mongoose";
import { signMessagesAttachments, signUsersAvatar } from "./storageService.js";
import {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  cacheKeys,
} from "./cacheService.js";

export const makeMessagesPrivateService = async (userId, messageIds, password) => {
  if (!messageIds.length) throw new AppError("No messages selected", 400);
  if (!password) throw new AppError("Password is required", 400);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const messages = await Message.find({
      _id: { $in: messageIds },
    }).session(session);

    if (messages.length === 0) throw new AppError("No messages found", 404);

    const conversationId = messages[0].conversation;

    for (const message of messages) {
      if (message.conversation.toString() !== conversationId.toString())
        throw new AppError("All messages must belong to the same conversation", 400);
    }

   
    const conversation = await Conversation.findById(conversationId).session(session);
    if (!conversation) throw new AppError("Conversation not found", 404);
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant)
      throw new AppError("You are not a participant of this conversation", 403);

   
    const alreadyPrivateIds = messages
      .filter((m) => m.privateFor.some((entry) => entry.user.toString() === userId))
      .map((m) => m._id.toString());

    if (alreadyPrivateIds.length === messages.length)
      throw new AppError("These messages are already private for you", 400);

    const targetMessageIds = messages
      .filter((m) => !alreadyPrivateIds.includes(m._id.toString()))
      .map((m) => m._id);

    const groups = await PrivateGroup.find({
      owner: userId,
      
      conversation: conversationId,
    }).session(session);

    let privateGroup = null;

    for (const group of groups) {
      const isMatch = await bcrypt.compare(password, group.password);
      if (isMatch) {
        privateGroup = group;
        break;
      }
    }

    if (!privateGroup) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const [newGroup] = await PrivateGroup.create(
        [
          {
            owner: userId,
            conversation: conversationId,
            password: hashedPassword,
          },
        ],
        { session },
      );
      privateGroup = newGroup;
    }

    await Message.updateMany(
      { _id: { $in: targetMessageIds } },
      { $push: { privateFor: { user: userId, privateGroup: privateGroup._id } } },
      { session },
    );

    await session.commitTransaction();

    await deleteCachePattern(
      `${cacheKeys.conversationMessages(conversationId.toString())}:*`,
    );
    await deleteCachePattern(cacheKeys.userPrivateChatsPattern(userId));

    return { message: "Messages marked as private successfully" };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    await session.endSession();
  }
};

export const unlockPrivateMessageService = async (userId, conversationId, unlockToken) => {
  if (!unlockToken) throw new AppError("Unlock token is required", 401);

  let payload;
  try {
    payload = jwt.verify(unlockToken, process.env.JWT_SECRET);
  } catch {
    throw new AppError("Unlock session expired, please enter password again", 401);
  }

  if (payload.type !== "private_unlock" || payload.userId !== userId)
    throw new AppError("Invalid unlock token", 401);

  const groupEntry = payload.groups.find(
    (g) => g.conversationId === conversationId.toString(),
  );
  if (!groupEntry) throw new AppError("Not authorized for this conversation", 403);

  const privateMessages = await Message.find({
    conversation: conversationId,
    privateFor: { $elemMatch: { user: userId, privateGroup: groupEntry.groupId } },
  })
    .populate("sender", "avatar name username") 
    .sort({ createdAt: 1 })
    .lean(); 

  await signMessagesAttachments(privateMessages);
  await signUsersAvatar(privateMessages.map((m) => m.sender).filter(Boolean)); 
  return privateMessages;
};

export const getPrivateChatsService = async (userId, password) => {
  if (!password) throw new AppError("Password is required", 400);

  const groups = await PrivateGroup.find({ owner: userId });
  if (groups.length === 0) throw new AppError("No private groups found", 404);

  let matchedGroups = [];
  for (const group of groups) {
    const isMatch = await bcrypt.compare(password, group.password);
    if (isMatch) matchedGroups.push(group);
  }
  if (matchedGroups.length === 0) throw new AppError("Incorrect password", 401);

  const unlockToken = jwt.sign(
    {
      userId,
      groups: matchedGroups.map((g) => ({
        conversationId: g.conversation.toString(),
        groupId: g._id.toString(),
      })),
      type: "private_unlock",
    },
    process.env.JWT_SECRET,
    { expiresIn: "20m" }
  );

  const groupIdsKey = matchedGroups.map((g) => g._id.toString()).sort().join(",");
  const key = cacheKeys.userPrivateChats(userId, groupIdsKey);

  const cached = await getCache(key);
  if (cached) {
    await signUsersAvatar(cached.map((c) => c.user).filter(Boolean)); 
    return { privateChats: cached, unlockToken };
  }

  const conversationIds = matchedGroups.map((group) => group.conversation);
  const uniqueConversationIds = [...new Set(conversationIds.map((id) => id.toString()))];

  const conversations = await Conversation.find({ _id: { $in: uniqueConversationIds } })
    .populate("participants", "avatar name username email")
    .lean();

  const privateChats = conversations.map((conversation) => {
    const otherUser = conversation.participants.find((p) => p._id.toString() !== userId);
    const matchedGroup = matchedGroups.find(
      (g) => g.conversation.toString() === conversation._id.toString(),
    );
    return {
      conversationId: conversation._id,
      groupId: matchedGroup._id,
      user: otherUser || conversation.participants[0],
    };
  });

  await setCache(key, privateChats); 

  await signUsersAvatar(privateChats.map((c) => c.user).filter(Boolean)); 
  return { privateChats, unlockToken };
};


export const removePrivateMessagesService = async (userId, messageIds) => {
  if (!messageIds.length) throw new AppError("No messages selected", 400);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const messages = await Message.find({
      _id: { $in: messageIds },
    }).session(session);
    if (messages.length === 0) throw new AppError("No messages found", 404);

    const hasEntryFor = messages.filter((m) =>
      m.privateFor.some((entry) => entry.user.toString() === userId),
    );

    if (hasEntryFor.length === 0)
      throw new AppError("These messages are not private for you", 400);

    const targetMessageIds = hasEntryFor.map((m) => m._id);
    const conversationId = messages[0].conversation;

    await Message.updateMany(
      { _id: { $in: targetMessageIds } },
      { $pull: { privateFor: { user: userId } } },
      { session },
    );

    await session.commitTransaction();
    await deleteCachePattern(
      `${cacheKeys.conversationMessages(conversationId.toString())}:*`,
    );
    await deleteCachePattern(cacheKeys.userPrivateChatsPattern(userId));

    return { message: "Messages removed from private successfully" };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    await session.endSession();
  }
};

export const removePrivateGroupService = async (userId, groupId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const privateGroup = await PrivateGroup.findById(groupId).session(session);
    if (!privateGroup) throw new AppError("Private group not found", 404);
    if (privateGroup.owner.toString() !== userId)
      throw new AppError("You are not allowed to remove this private group", 401);

    
    await Message.updateMany(
      { "privateFor.privateGroup": groupId },
      { $pull: { privateFor: { privateGroup: groupId } } },
      { session },
    );
    await PrivateGroup.findByIdAndDelete(groupId, { session });

    await session.commitTransaction();
    await deleteCachePattern(
      `${cacheKeys.conversationMessages(privateGroup.conversation.toString())}:*`,
    );
    await deleteCachePattern(cacheKeys.userPrivateChatsPattern(userId));

    return { message: "Private group removed successfully" };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};