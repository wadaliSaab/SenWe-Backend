import ScheduledMessage from "../models/ScheduledMessage.js";
import { upload, signUsersAvatar } from "./storageService.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { messageQueue } from "../queues/messageQueue.js";
import mongoose from "mongoose";
import fs from "fs";
import { getCache, setCache, deleteCache, cacheKeys } from "./cacheService.js";
import { addCleanupJob } from "./cleanupService.js";


export const scheduleMessageService = async (sender, receiver, text, files, sendAt) => {

  if (!receiver) {
    throw new AppError("Receiver is required", 400);
  }
  if (!sendAt) {
    throw new AppError("Send time is required", 400);
  }
  if (!text?.trim() && (!files || files.length === 0)) {
    throw new AppError("Message must contain text or attachments", 400);
  }

  const delay = new Date(sendAt).getTime() - Date.now();
  if (delay < 0) {
    throw new AppError("Send time must be in the future", 400);
  }

  const receiverUser = await User.findById(receiver);
  if (!receiverUser) {
    throw new AppError("Receiver not found", 404);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  const attachments = [];
  let scheduledMessage;

  try {
    if (files) {
      for (const file of files) {
        const filePath = await upload(file);
        const category = file.mimetype.split("/")[0];
        const fileType =
          category === "image" ? "image" : category === "video" ? "video" : "file";
        attachments.push({ filePath, fileName: file.originalname, type: fileType });
      }
    }


    let conversation = await Conversation.findOne({
      participants: { $all: [sender, receiver], $size: 2 },
    }).session(session);

    if (!conversation) {
     
      const [createdConversation] = await Conversation.create(
        [{ participants: [sender, receiver] }],
        { session }
      );
      conversation = createdConversation;
    }

    const [created] = await ScheduledMessage.create(
      [
        {
          sender,
          receiver,
          conversation: conversation._id,
          text,
          attachments,
          status: "pending",
          sendAt,
        },
      ],
      { session }
    );
    scheduledMessage = created;

    await session.commitTransaction();
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

  try {
    const job = await messageQueue.add(
      "scheduled-messages",
      { scheduledMessageId: scheduledMessage._id },
      { delay }
    );
    scheduledMessage.bullJobId = job.id;
    await scheduledMessage.save();
  } catch (error) {
    await ScheduledMessage.findByIdAndDelete(scheduledMessage._id);
    if (attachments.length > 0) {
      await addCleanupJob({
        type: "delete-files",
        paths: attachments.map((attachment) => attachment.filePath),
      });
    }
    throw error;
  }

  await deleteCache(cacheKeys.userScheduledMessages(sender.toString()));
  return scheduledMessage;
};

export const getScheduledMessagesService = async (userId) => {
  const key = cacheKeys.userScheduledMessages(userId);
  const cachedScheduledMessages = await getCache(key);
  if (cachedScheduledMessages) {
    await signUsersAvatar(cachedScheduledMessages.map((m) => m.receiver).filter(Boolean));
    return cachedScheduledMessages;
  }

  const scheduledMessages = await ScheduledMessage.find({ sender: userId, status: "pending" })
    .populate("receiver", "username email avatar")
    .sort({ sendAt: 1 })
    .lean();
  await setCache(key, scheduledMessages);

  await signUsersAvatar(scheduledMessages.map((m) => m.receiver).filter(Boolean));

  return scheduledMessages;
};

export const cancelScheduledMessageService = async (scheduledMessageId, userId) => {
  const scheduledMessage = await ScheduledMessage.findById(scheduledMessageId);
  if (!scheduledMessage) {
    throw new AppError("Scheduled message not found", 404);
  }
  if (scheduledMessage.sender.toString() !== userId) {
    throw new AppError("You are not authorized to cancel this scheduled message", 403);
  }
  const job = await messageQueue.getJob(scheduledMessage.bullJobId);

  if (!job) {
    throw new AppError("Scheduled message not found", 404);
  }
  await job.remove();

  scheduledMessage.status = "cancelled";
  await scheduledMessage.save();
  await deleteCache(cacheKeys.userScheduledMessages(userId));
  return {
    message: "Scheduled message cancelled successfully",
  };
};