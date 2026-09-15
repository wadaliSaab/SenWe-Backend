import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { blockUser, unblockUser, getBlockedUsers } from "../controllers/blockController.js";
const router = express.Router();

router.post("/", authMiddleware, blockUser);
router.delete("/:userId", authMiddleware, unblockUser);
router.get("/", authMiddleware, getBlockedUsers);
export default router;