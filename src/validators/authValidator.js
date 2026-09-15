import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.email(),
  password: z.string().min(6).max(50),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(50),
});

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  email: z.email().optional(),
  name: z.string().min(3).max(50).optional(),
  bio: z.string().min(3).max(100).optional(),
});

export const changePasswordSchema=z.object({currentPassword:z.string().min(6).max(50),newPassword:z.string().min(6).max(50)});