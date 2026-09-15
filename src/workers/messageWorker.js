import { Worker } from "bullmq";
import ScheduledMessage from "../models/ScheduledMessage.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import { broadcastMessage } from "../services/messageServices.js";
import {emitToUser} from "../socket/socket.js";

const messageWorker = new Worker(
  "scheduled-messages",
  async (job) => {
    
    const session = await mongoose.startSession();
    session.startTransaction();
    let createdMessage;
    let sender, conversation;
     let scheduledMessageId;
    try {
      const { scheduledMessageId:id } = job.data;
      scheduledMessageId = id;

      

      const scheduledMessage =
        await ScheduledMessage.findById(scheduledMessageId).session(session);

      if (!scheduledMessage) {
        await session.abortTransaction();
        return;
      }
      if (scheduledMessage.status !== "pending") {
        await session.abortTransaction();
        return;
      }

    
      ({ sender, conversation } = scheduledMessage);

      const conversationDoc = await Conversation.findById(conversation)
        .session(session)
        .lean();
      const receiverId = conversationDoc.participants.find(
        (p) => p.toString() !== sender.toString(),
      );

      const [senderUser, receiverUser] = await Promise.all([
        User.findById(sender).select("blockedUsers").session(session).lean(),
        User.findById(receiverId)
          .select("blockedUsers")
          .session(session)
          .lean(),
      ]);

      const isBlocked =
        senderUser?.blockedUsers?.some(
          (id) => id.toString() === receiverId?.toString(),
        ) ||
        receiverUser?.blockedUsers?.some(
          (id) => id.toString() === sender.toString(),
        );

      if (isBlocked) {
        scheduledMessage.status = "cancelled";
        await scheduledMessage.save({ session });
        await session.commitTransaction();
     
        return;
      }

      const { text, attachments } = scheduledMessage;

      const [message] = await Message.create(
        [{ sender, conversation, text, attachments }],
        { session },
      );
      createdMessage = message;

      await Conversation.findByIdAndUpdate(
        conversation,
        { $currentDate: { updatedAt: true } },
        { session },
      );

      await scheduledMessage.deleteOne({ session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    if (createdMessage) {
      await broadcastMessage(
        createdMessage._id,
        sender.toString(),
        conversation.toString(),
      );
        emitToUser(sender.toString(), "scheduled-message-sent", {
        scheduledMessageId,
      });
    
    }
    

    return createdMessage;
  },
  {
    connection: redis,
    prefix: "senwe",
  },
);

messageWorker.on("completed", async (job) => {
  console.log(`Job ${job.id} completed`);
});

messageWorker.on("failed", async (job, error) => {
  console.log(`Job ${job?.id} failed: ${error.message}`);
});

messageWorker.on("error", async (error) => {
  console.log(`Worker error: ${error.message}`);
});

export default messageWorker;