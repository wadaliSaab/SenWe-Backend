import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { savedMessage,getSavedChats,getSavedMessages,removeAllSavedMessage } from "../controllers/savedMessagesController.js";
const router = express.Router();
router.post("/", authMiddleware, savedMessage);
router.get("/", authMiddleware, getSavedChats);
router.get("/:conversationId", authMiddleware, getSavedMessages);
router.delete("/:conversationId", authMiddleware, removeAllSavedMessage);
export default router;