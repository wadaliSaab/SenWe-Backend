import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import SavedMessage from "../models/SavedMessage.js";
import AppError from "../utils/AppError.js";
import { cacheKeys, deleteCache, getCache, setCache } from "./cacheService.js";
import { signUsersAvatar, signMessagesAttachments } from "./storageService.js";

export const savedMessageService = async (messageIds, userId) => {

  const ids = Array.isArray(messageIds) ? messageIds : [messageIds];

  const messages = await Message.find({ _id: { $in: ids } });
  if (messages.length === 0) throw new AppError("No messages found", 404);

  const existingSaved = await SavedMessage.find({
    message: { $in: ids },
    user: userId,
  });
  const existingSavedMap = new Map(
    existingSaved.map((s) => [s.message.toString(), s._id]),
  );

  const toRemoveIds = []; 
  const toSaveMessages = []; 

  for (const message of messages) {
    const msgId = message._id.toString();
    if (existingSavedMap.has(msgId)) {
      toRemoveIds.push(existingSavedMap.get(msgId));
    } else {
      toSaveMessages.push(message);
    }
  }

  if (toRemoveIds.length > 0) {
    await SavedMessage.deleteMany({ _id: { $in: toRemoveIds } });
  }

  if (toSaveMessages.length > 0) {
    await SavedMessage.insertMany(
      toSaveMessages.map((m) => ({
        message: m._id,
        user: userId,
        sender: m.sender,
        conversation: m.conversation,
      })),
    );
  }

  const conversationId = messages[0].conversation.toString();
  await deleteCache(cacheKeys.savedMessages(userId, conversationId));
  await deleteCache(cacheKeys.userSavedChats(userId));

  return {
    saved: toSaveMessages.length,
    removed: toRemoveIds.length,
    message: `${toSaveMessages.length} saved, ${toRemoveIds.length} removed`,
  };
};

export const getSavedChatsService = async (userId) => {
  const key = cacheKeys.userSavedChats(userId);
  const cachedSavedChats = await getCache(key);
  if (cachedSavedChats) {
    return cachedSavedChats;
  }
  const savedMessages = await SavedMessage.find({ user: userId })
    .populate({
      path: "conversation",
      populate: {
        path: "participants",
        select: "username email avatar name bio",
      },
    })
    .lean();

  
  const validSavedMessages = savedMessages.filter((saved) => saved.conversation);

  const users = [];
  validSavedMessages.forEach((saved) => {
    users.push(...saved.conversation.participants);
  });

  await signUsersAvatar(users);

  const chatMap = new Map();
  for (const saved of validSavedMessages) {
    const conversationId = saved.conversation._id.toString();

    if (!chatMap.has(conversationId)) {
      const otherUser = saved.conversation.participants.find(
        (participant) => participant._id.toString() !== userId,
      );
    
      chatMap.set(conversationId, {
        _id: saved.conversation._id,
        otherUser,
        count: 1,
      });
    } else {
      chatMap.get(conversationId).count += 1;
    }
  }
  const chats = [...chatMap.values()];
  await setCache(key, chats);

  return chats;
};

export const getSavedMessagesService = async (conversationId, userId) => {
  const key = cacheKeys.savedMessages(userId, conversationId);
  const cachedSavedMessages = await getCache(key);
  if (cachedSavedMessages) {
    return cachedSavedMessages;
  }
  const savedMessages = await SavedMessage.find({
    user: userId,
    conversation: conversationId,
  })
    .populate({
      path: "message",
      select: "text attachments sender createdAt reactions isPrivate",
      populate: {
        path: "sender",
        select: "username email avatar name bio",
      },
    })
    .sort({ createdAt: 1 })
    .lean();

  const validSavedMessages = savedMessages.filter(
    (savedMessage) => savedMessage.message,
  );

  await signMessagesAttachments(
    validSavedMessages.map((saved) => saved.message),
  );

  const response = validSavedMessages.map((saved) => ({
    ...saved.message,
    savedMessageId: saved._id,
  }));

  await setCache(key, response);

  return response;
};

export const removeAllSavedMessageService = async (userId, conversationId) => {
  const result = await SavedMessage.deleteMany({
    user: userId,
    conversation: conversationId,
  });
  if (result.deletedCount === 0) {
    throw new AppError("No saved messages found", 404);
  }

  await deleteCache(cacheKeys.savedMessages(userId, conversationId));
  await deleteCache(cacheKeys.userSavedChats(userId));

  return {
    message: "All saved messages removed successfully",
  };
};