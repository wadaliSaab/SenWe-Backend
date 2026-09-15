import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  getProfile,
  updateProfile,
  changePassword,
  updateAvatar,
  deleteUser,
  searchUsers, 
} from "../controllers/userController.js";
import validateRequest from "../middleware/validateRequest.js";
import { updateProfileSchema, changePasswordSchema } from "../validators/authValidator.js";

const router = express.Router();

router.get("/profile", authMiddleware, getProfile);
router.get("/search", authMiddleware, searchUsers); 
router.patch("/profile", authMiddleware, validateRequest(updateProfileSchema), updateProfile);
router.patch("/change-password", authMiddleware, validateRequest(changePasswordSchema), changePassword);
router.patch("/avatar", authMiddleware, upload.single("avatar"), updateAvatar);
router.delete("/", authMiddleware, deleteUser);

export default router;