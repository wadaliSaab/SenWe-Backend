import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import { makeMessagesPrivate,unlockPrivateMessages,getPrivateChats,removePrivateGroup,removePrivateMessages } from "../controllers/privateMessageControllers.js";
const router = express.Router();
router.patch("/", authMiddleware, makeMessagesPrivate);
router.patch("/remove", authMiddleware,removePrivateMessages);
router.post("/unlock", authMiddleware,  unlockPrivateMessages);
router.post("/chats", authMiddleware, getPrivateChats);
router.delete("/groups/:groupId", authMiddleware, removePrivateGroup);

export default router;