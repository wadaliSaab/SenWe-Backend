import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js'
import validateRequest from '../middleware/validateRequest.js'

import {registerSchema,loginSchema} from '../validators/authValidator.js'
import authRateLimiter from '../middleware/authRateLimiter.js'
import {registerUser,loginUser,refreshToken,logoutUser,logoutAllUser} from '../controllers/authController.js'
const router = express.Router();


router.post('/refresh-token' ,authRateLimiter,refreshToken)
router.post('/register', authRateLimiter, validateRequest(registerSchema),registerUser)
router.post('/login', authRateLimiter, validateRequest(loginSchema),loginUser)
router.post('/logout',logoutUser)
router.post('/logout-all', authMiddleware,logoutAllUser)

export default router