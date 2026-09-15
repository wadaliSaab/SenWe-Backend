import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import blockMiddleware from "../middleware/blockMiddleware.js";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  getFriendRequests,
  getFriends,
  removeFriend,
} from "../controllers/friendRequestController.js";

const router = express.Router();

router.post("/", authMiddleware, blockMiddleware, sendFriendRequest);
router.patch("/:otherUserId/accept", authMiddleware, acceptFriendRequest);
router.patch("/:otherUserId/reject", authMiddleware, rejectFriendRequest);
router.delete("/:otherUserId/cancel", authMiddleware, cancelFriendRequest);


router.get("/requests", authMiddleware, getFriendRequests);

router.get("/", authMiddleware, getFriends);
router.delete("/:friendId", authMiddleware, removeFriend);

export default router;