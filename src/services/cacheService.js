import redis from "../config/redis.js";

export const getCache = async (key) => {
  const data = await redis.get(key);
  if (!data) {
    return null;
  }
  return JSON.parse(data);
};

export const setCache = async (key, value, ttl = 300) => {
  await redis.set(key, JSON.stringify(value), "EX", ttl);
};

export const deleteCache = async (key) => {
  await redis.del(key);
};

export const deleteCachePattern = async (pattern) => {
  const keys = await redis.keys(pattern);
  if (keys.length === 0) {
    return;
  }
  await redis.del(keys);
};

export const cacheKeys = {
  messages: (conversationId, page, limit) =>
    `messages:${conversationId}:${page}:${limit}`,
  conversationMessages: (conversationId) => `messages:${conversationId}`,
  userConversations: (userId) => `conversations:${userId}`,
  userFriends: (userId) => `friends:${userId}`,
  userFriendRequests: (userId) => `friendRequests:${userId}`, 
  userProfile: (userId) => `profile:${userId}`,
  userScheduledMessages: (userId) => `scheduledMessages:${userId}`,
  userPrivateChats: (userId, groupIdsKey) =>
    `privateChats:${userId}:${groupIdsKey}`,
  userPrivateChatsPattern: (userId) => `privateChats:${userId}:*`,
  userSavedChats: (userId, senderId) => `savedChats:${userId}`,
  savedMessages: (userId, senderId) => `savedMessages:${userId}:${senderId}`,
  blockedUsers: (userId) => `blockedUsers:${userId}`,
};