import User from "../models/User.js";
import bcrypt from "bcryptjs";
import AppError from "../utils/AppError.js";
import { upload, deleteFile } from "../services/storageService.js";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import PrivateGroup from "../models/PrivateGroups.js";
import FriendRequest from "../models/FriendRequest.js";
import RefreshToken from "../models/RefreshToken.js";
import SavedMessage from "../models/SavedMessage.js";
import ScheduledMessage from "../models/ScheduledMessage.js";
import { signAvatar , signUsersAvatar } from "./storageService.js";
import { deleteCache, getCache, setCache, cacheKeys , deleteCachePattern } from "./cacheService.js";
import { addCleanupJob } from "./cleanupService.js";



export const getProfileService = async (id) => {
 const key = cacheKeys.userProfile(id);
  const cachedUser = await getCache(key);
  if (cachedUser) {
    await signAvatar(cachedUser);   
    return cachedUser;
  }
  const user = await User.findById(id).select("-password").lean();
  if (!user) {
    throw new AppError("User not found", 404);
  }
  await setCache(key, user);   
  await signAvatar(user);    
  return user;
};

export const updateProfileService = async (id, data) => {
  const { username, email , } = data;
  if (email) {
    data.email = data.email.toLowerCase();
    const existingEmail = await User.findOne({ email });
    if (existingEmail && existingEmail._id.toString() !== id) {
      throw new AppError("Email already exists", 409);
    }
  }
  if (username) {
    const existingUsername = await User.findOne({ username });
    if (existingUsername && existingUsername._id.toString() !== id) {
      throw new AppError("Username already exists", 409);
    }
  }
  const user = await User.findByIdAndUpdate(id, data, { new: true }).select(
    "-password",
  );
   if(!user){
    throw new AppError("User not found", 404);
  }
  await deleteCache(cacheKeys.userProfile(id));
  await signAvatar(user);
  return user;
};

export const changePasswordService = async (
  id,
  currentPassword,
  newPassword,
) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  const isPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.password,
  );
  if (!isPasswordCorrect) {
    throw new AppError("Current password is incorrect", 401);
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();
  await RefreshToken.deleteMany({ user: id });
  return {
    message: "Password changed successfully",
  };
};

export const updateAvatarService = async (userId, file) => {
  if (!file) {
    throw new AppError("File is required", 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  let avatarPath = null;
  try {
    avatarPath = await upload(file);
    const oldAvatar = user.avatar;

    user.avatar = avatarPath;
    await user.save();
    await deleteCache(cacheKeys.userProfile(userId));
    if (oldAvatar) {
      await deleteFile(oldAvatar);
    }

    const updatedUser = user.toObject(); 
    delete updatedUser.password;         
    await signAvatar(updatedUser);        

    return updatedUser;
  } catch (error) {
    if (avatarPath) {
      await deleteFile(avatarPath);
    }
    throw error;
  }
};
export const deleteUserService = async (id) => {
  const session = await mongoose.startSession();
  session.startTransaction();

 

  try {
 const user = await User.findById(id).session(session);
  if (!user) throw new AppError("User not found", 404);
    
  const paths = [];
    if (user.avatar) {
      paths.push(user.avatar);
    }
    const messages = await Message.find({ sender: id }).session(session);
    for (const message of messages) {
      for (const attachment of message.attachments) {
        paths.push(attachment.filePath);
      }
    }

    const conversations = await Conversation.find({ participants: id }).session(session);
    const conversationIds = conversations.map(
      (conversation) => conversation._id,
    );
    await PrivateGroup.deleteMany(
      { conversation: { $in: conversationIds } },
      {
        session,
      },
    );
    await FriendRequest.deleteMany(
      { $or: [{ sender: id }, { receiver: id }] },
      {
        session,
      },
    );
    await User.updateMany(
      {
        blockedUsers: id,
      },
      {
        $pull: { blockedUsers: id },
      },
      {
        session,
      },
    );
    await User.updateMany(
      {
        friends: id,
      },
      {
        $pull: { friends: id },
      },
      {
        session,
      },
    );

    await Message.deleteMany(
      {
        conversation: {
          $in: conversationIds,
        },
      },
      {
        session,
      },
    );
    await Conversation.deleteMany(
      {
        _id: { $in: conversationIds }
      },
      {
        session,
      },
    );
    await SavedMessage.deleteMany(
      {
        $or: [{ user: id }, { sender: id }],
      },
      {
        session,
      },
    );
    await ScheduledMessage.deleteMany(
      {
        $or: [{ sender: id }, { receiver: id }],
      },
      {
        session,
      },
    );
    await RefreshToken.deleteMany(
      {
        user: id,
      },
      {
        session,
      },
    )
    await User.findByIdAndDelete(id, { session });


    await session.commitTransaction();
    if(paths.length >0){
      await addCleanupJob({type:"delete-files",paths});
     
    }
    await deleteCache(cacheKeys.userProfile(id));
    await deleteCache(cacheKeys.userFriends(id));
    await deleteCache(cacheKeys.userFriendRequests(id));
    await deleteCache(cacheKeys.userConversations(id));
    for(const conversationId of conversationIds){
      await deleteCachePattern(cacheKeys.conversationMessages(conversationId.toString()));
    }

    return {
      message: "Account deleted successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};




export const searchUsersService = async (userId, query, page = 1, limit = 20) => {
  if (!query?.trim()) throw new AppError("Search query is required", 400);

  const currentUser = await User.findById(userId).select("blockedUsers friends").lean();
  const blockedByMe = currentUser?.blockedUsers || [];
  const friendIds = new Set((currentUser?.friends || []).map((id) => id.toString()));

  const blockedMe = await User.find({ blockedUsers: userId }).select("_id").lean();
  const blockedMeIds = blockedMe.map((u) => u._id);

  const excludeIds = [...blockedByMe, ...blockedMeIds, userId];

  const safeQuery = query.trim();
  const regex = new RegExp(safeQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const users = await User.find({
    _id: { $nin: excludeIds },
    $or: [{ username: regex }, { email: regex }],
  })
    .select("username name email avatar bio isOnline isVerified")
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  await signUsersAvatar(users);


  const userIds = users.map((u) => u._id);
  const pendingSentRequests = await FriendRequest.find({
    sender: userId,
    receiver: { $in: userIds },
    status: "pending",
  })
    .select("receiver")
    .lean();

  const pendingSentIds = new Set(pendingSentRequests.map((r) => r.receiver.toString()));

  const usersWithStatus = users.map((u) => {
    const uid = u._id.toString();
    let status = "stranger";
    if (friendIds.has(uid)) status = "friend";
    else if (pendingSentIds.has(uid)) status = "pending";
    return { ...u, status };
  });

  return usersWithStatus;
};