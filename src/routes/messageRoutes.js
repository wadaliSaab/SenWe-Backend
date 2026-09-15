import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import conversationBlockMiddleware from "../middleware/conversationBlockMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";
import conversationParticipantMiddleware from "../middleware/conversationParticipantMiddleware.js";
import {
  sendMessage,
  getMessages,
  deleteMessagesForMe,
  deleteMessagesForEveryone,
  searchMessages,
  reactToMessages,
  markAsRead,
} from "../controllers/messageController.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  upload.array("files"),
  conversationBlockMiddleware,
  conversationParticipantMiddleware,
  sendMessage,
);

router.get(
  "/:conversationId",
  authMiddleware,
  conversationParticipantMiddleware,
  getMessages,
);


router.delete("/delete-for-me", authMiddleware, deleteMessagesForMe);
router.delete("/delete-for-everyone", authMiddleware, deleteMessagesForEveryone);
router.get("/:conversationId/search", authMiddleware,conversationParticipantMiddleware, searchMessages);
router.patch("/:messageId/reaction", authMiddleware, reactToMessages);

router.patch("/:conversationId/read", authMiddleware, markAsRead); 

export default router;