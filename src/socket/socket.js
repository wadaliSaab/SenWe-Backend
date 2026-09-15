import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";
import User from "../models/User.js";
let io;
const onlineUsers = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new AppError("Unauthorized", 401));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;

      next();
    } catch (error) {
      return next(new AppError("Unauthorized", 401));
    }
  });
io.on("connection", async (socket) => {
  const userId = socket.user.id;

  let userSockets = onlineUsers.get(userId);

  if (!userSockets) {
    userSockets = new Set();
    onlineUsers.set(userId, userSockets);
  }

 
  userSockets.add(socket.id);

  socket.join(userId);

 

  
  if (userSockets.size === 1) {
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
      }).exec();

      socket.broadcast.emit("userOnline", {
        userId,
      });
    } catch (error) {
      console.error(
        "Failed to update user online status:",
        error
      );
    }
  }

  socket.on("join-conversation", (conversationId) => {
    socket.join(conversationId);
  });

  socket.on("leave-conversation", (conversationId) => {
    socket.leave(conversationId);
  });

  socket.on("disconnect", async () => {
    console.log("a user disconnected", socket.id);

    const userSockets = onlineUsers.get(userId);

    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size > 0) {
      return;
    }

    
    onlineUsers.delete(userId);

    const lastSeenAt = new Date();

    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeenAt,
      });

      socket.broadcast.emit("userOffline", {
        userId,
        lastSeenAt,
      });
    } catch (error) {
      console.error(
        "Failed to update user offline status:",
        error
      );
    }
  });
});

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket is not initialized");
  }
  return io;
};

export const emitToUser = (userId, event, data) => {
  io.to(userId.toString()).emit(event, data);
};

export const emitToConversation = (conversationId, event, data) => {
  io.to(conversationId.toString()).emit(event, data);
};

export const getUserSocketId = (userId) => {
  return onlineUsers.get(userId);
};

export const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

export const getOnlineUsers = () => {
  return onlineUsers;
};