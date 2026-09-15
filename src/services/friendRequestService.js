import AppError from "../utils/AppError.js";
import mongoose from "mongoose";
import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";
import { signUsersAvatar } from "./storageService.js";
import { deleteCache, cacheKeys, setCache, getCache } from "./cacheService.js";

export const sendFriendRequestService = async (senderId, receiverId) => {
  if (receiverId === senderId)
    throw new AppError("Cannot send friend request to yourself", 400);
  const receiver = await User.findById(receiverId);

  if (!receiver) throw new AppError("User not found", 404);

  const existingRequest = await FriendRequest.findOne({
    $or: [
      { sender: senderId, receiver: receiverId },
      { sender: receiverId, receiver: senderId },
    ],
  });
  if (existingRequest) {
    if (existingRequest.status === "pending") {
      if (
        existingRequest.sender.toString() === receiverId &&
        existingRequest.receiver.toString() === senderId
      ) {
        return await acceptFriendship(existingRequest);
      }
      throw new AppError("Friend request already sent", 400);
    }
    if (existingRequest.status === "accepted")
      throw new AppError("You are already friends", 400);
    if (
      existingRequest.status === "rejected" ||
      existingRequest.status === "removed"
    ) {
      existingRequest.sender = senderId;
      existingRequest.receiver = receiverId;
      existingRequest.status = "pending";
      await existingRequest.save();

    
      await deleteCache(cacheKeys.userFriendRequests(senderId));
      await deleteCache(cacheKeys.userFriendRequests(receiverId));
      return existingRequest;
    }
  }

  const request = await FriendRequest.create({
    sender: senderId,
    receiver: receiverId,
  });

  await deleteCache(cacheKeys.userFriendRequests(senderId));
  await deleteCache(cacheKeys.userFriendRequests(receiverId));
  return request;
};

const acceptFriendship = async (friendRequest) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    friendRequest.status = "accepted";
    await User.findByIdAndUpdate(
      friendRequest.sender,
      {
        $addToSet: { friends: friendRequest.receiver },
      },
      {
        session,
      },
    );

    await User.findByIdAndUpdate(
      friendRequest.receiver,
      {
        $addToSet: { friends: friendRequest.sender },
      },
      {
        session,
      },
    );
    await friendRequest.save({ session });
    await session.commitTransaction();

    await deleteCache(
      cacheKeys.userFriendRequests(friendRequest.sender.toString()),
    );
    await deleteCache(
      cacheKeys.userFriendRequests(friendRequest.receiver.toString()),
    );
    await deleteCache(cacheKeys.userFriends(friendRequest.sender.toString()));
    await deleteCache(cacheKeys.userFriends(friendRequest.receiver.toString()));
    return friendRequest;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const acceptFriendRequestService = async (otherUserId, userId) => {
  
  const request = await FriendRequest.findOne({
    sender: otherUserId,
    receiver: userId,
    status: "pending",
  });

  if (!request) throw new AppError("Friend request not found", 404);

  return await acceptFriendship(request);
};

export const rejectFriendRequestService = async (otherUserId, userId) => {
  const request = await FriendRequest.findOne({
    sender: otherUserId,
    receiver: userId,
    status: "pending",
  });

  if (!request) throw new AppError("Friend request not found", 404);

  request.status = "rejected";
  await request.save();

  await deleteCache(cacheKeys.userFriendRequests(otherUserId));
  await deleteCache(cacheKeys.userFriendRequests(userId));

  return request;
};

export const cancelFriendRequestService = async (otherUserId, userId) => {
    const request = await FriendRequest.findOneAndDelete({
    sender: userId,
    receiver: otherUserId,
    status: "pending",
  });

  if (!request) throw new AppError("Friend request not found", 404);
 
  
  await deleteCache(cacheKeys.userFriendRequests(userId));
  await deleteCache(cacheKeys.userFriendRequests(otherUserId));

  return { message: "Friend request cancelled" };
};

export const getAllFriendRequestsService = async (userId) => {
  const key = cacheKeys.userFriendRequests(userId);
  const cachedRequests = await getCache(key);
  if (cachedRequests) return cachedRequests;

  const requests = await FriendRequest.find({
    status: "pending",
    $or: [{ sender: userId }, { receiver: userId }],
  })
    .populate("sender", "avatar username name email isVerified isOnline")
    .populate("receiver", "avatar username name email isVerified isOnline")
    .lean();

  await signUsersAvatar(requests.map((r) => r.sender));
  await signUsersAvatar(requests.map((r) => r.receiver));

  await setCache(key, requests);
  return requests;
};

export const getFriendsService = async (userId) => {
  const key = cacheKeys.userFriends(userId);
  const cachedFriends = await getCache(key);
  if (cachedFriends) {
    return cachedFriends;
  }
  const user = await User.findById(userId)
    .populate("friends", "avatar username name email isVerified isOnline")
    .lean();

  if (!user) throw new AppError("User not found", 404);
  await signUsersAvatar(user.friends);

  await setCache(key, user.friends);
  return user.friends;
};

export const removeFriendship = async (userId, friendId, session) => {
  await User.findByIdAndUpdate(
    userId,
    {
      $pull: { friends: friendId },
    },
    {
      session,
    },
  );
  await User.findByIdAndUpdate(
    friendId,
    { $pull: { friends: userId } },
    {
      session,
    },
  );

  const friendRequest = await FriendRequest.findOne({
    $or: [
      { sender: userId, receiver: friendId },
      { sender: friendId, receiver: userId },
    ],
  }).session(session);
  if (friendRequest) {
    friendRequest.status = "removed";
    await friendRequest.save({ session });
  }
};

export const removeFriendService = async (userId, friendId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const friend = await User.findById(friendId).session(session);
    if (!friend) throw new AppError("User not found", 404);

    const user = await User.findById(userId).session(session);
    const isFriend = user.friends.some((id) => id.toString() === friendId);
    if (!isFriend) throw new AppError("You are not friends ", 404);

    await removeFriendship(userId, friendId, session);
    await session.commitTransaction();

    await deleteCache(cacheKeys.userFriends(userId.toString()));
    await deleteCache(cacheKeys.userFriends(friendId.toString()));

    return {
      message: "Friend removed successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};