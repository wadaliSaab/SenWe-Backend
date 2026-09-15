import mongoose from "mongoose";
import { removeFriendship } from "./friendRequestService.js";
import AppError from "../utils/AppError.js";
import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import { signUsersAvatar } from "./storageService.js";
import { deleteCache, cacheKeys, getCache, setCache } from "./cacheService.js"; 

export const blockUserService = async (userId, blockedUserId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (userId === blockedUserId)
      throw new AppError("You cannot block yourself", 400);
    const blockedUser = await User.findById(blockedUserId).session(session);
    if (!blockedUser) throw new AppError("User not found", 404);
    const user = await User.findById(userId).session(session);
    const alreadyBlocked = user.blockedUsers.some(
      (id) => id.toString() === blockedUserId,
    );
    if (alreadyBlocked) throw new AppError("User already blocked", 400);

    await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: { blockedUsers: blockedUserId },
      },
      {
        session,
      },
    );

    const isFriend = user.friends.some((id) => id.toString() === blockedUserId);
    if (isFriend) {
      await removeFriendship(userId, blockedUserId, session); 
    } else {
      
      await FriendRequest.updateOne(
        {
          $or: [
            { sender: userId, receiver: blockedUserId },
            { sender: blockedUserId, receiver: userId },
          ],
          status: "pending",
        },
        { status: "removed" },
        { session },
      );
    }

    await session.commitTransaction(); 

    
    await deleteCache(cacheKeys.blockedUsers(userId.toString()));
    if (isFriend) {
      await deleteCache(cacheKeys.userFriends(userId.toString()));
      await deleteCache(cacheKeys.userFriends(blockedUserId.toString()));
    }
  
    await deleteCache(cacheKeys.userFriendRequests(userId.toString()));
    await deleteCache(cacheKeys.userFriendRequests(blockedUserId.toString()));

    return {
      message: "User blocked successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const unblockUserService = async (userId, blockedUserId) => {
  const blockedUser = await User.findById(blockedUserId);
  if (!blockedUser) throw new AppError("User not found", 404);
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  const isBlocked = user.blockedUsers.some(
    (id) => id.toString() === blockedUserId,
  );
  if (!isBlocked) throw new AppError("User is not blocked", 400);

  await User.findByIdAndUpdate(userId, {
    $pull: { blockedUsers: blockedUserId },
  });

  await deleteCache(cacheKeys.blockedUsers(userId.toString()));
  return {
    message: "User unblocked successfully",
  };
};

export const getBlockedUsersService = async (userId) => {
  const key = cacheKeys.blockedUsers(userId);
  const cachedBlockedUsers = await getCache(key);
  if (cachedBlockedUsers) {
    return cachedBlockedUsers;
  }
  const user = await User.findById(userId)
    .populate("blockedUsers", "avatar username email")
    .lean();
  if (!user) throw new AppError("User not found", 404);
  await signUsersAvatar(user.blockedUsers);
  await setCache(key, user.blockedUsers);
  return user.blockedUsers;
};