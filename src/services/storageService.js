import fs from "fs";

import { createClient } from "@supabase/supabase-js";
import logger from "../utils/logger.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export const bucket = supabase.storage.from("Senwe-Storage");

const getFolder = (mimeType) => {
  if (mimeType.startsWith("image/")) {
    return "images";
  }
  if (mimeType.startsWith("video/")) {
    return "videos";
  }
  if (mimeType.startsWith("application")) {
    return "documents";
  }
  return "others";
};

export const upload = async (file) => {
  if (!file) {
    throw new Error("File is required");
  }
  

  try {
    const fileBuffer = fs.readFileSync(file.path);
    const folder = getFolder(file.mimetype);
    const { data, error } = await bucket.upload(
      `${folder}/${file.filename}`,
      fileBuffer,
      { contentType: file.mimetype, upsert: false },
    );

    if (error) {
      throw new Error(error.message);
    }

    return data.path;
  } catch (error) {
    throw new Error(error.message);
  } finally {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
};

export const getSignedUrl = async (path) => {
  if (!path) {
    return null;
  }

  try {
    const { data, error } = await bucket.createSignedUrl(path, 3600);

    if (error) {
      console.error("Failed to sign:", path, error.message);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    logger.warn("Supabase Error:", error.message);
    return null;
  }
};

export const deleteFile = async (path) => {
  if (!path) {
    return true;
  }
  const { error } = await bucket.remove([path]);
  if (error) {
    throw new Error(error.message);
  }

  return true;
};

const isExternalUrl = (value) =>
  typeof value === "string" &&
  (value.startsWith("http://") || value.startsWith("https://"));

export const signAvatar = async (user) => {
  if (!user.avatar) return user;

  if (isExternalUrl(user.avatar)) {
    return user;  
  }

  user.avatar = await getSignedUrl(user.avatar);
  return user;
};

export const signUsersAvatar = async (users) => {
  if (!users || users.length === 0) {
    return users;
  }
  await Promise.all(users.map((user) => signAvatar(user)));
  return users;
};

export const signMessageAttachments = async (message) => {
  if (!message.attachments || message.attachments.length === 0) {
    return message;
  }
  await Promise.all(
    message.attachments.map(async (attachment) => {
      const signedUrl = await getSignedUrl(attachment.filePath);

      attachment.filePath = signedUrl;
      attachment.isAvailable = signedUrl !== null;
    }),
  );
  return message;
};

export const signMessagesAttachments = async (messages) => {
  if (!messages || messages.length === 0) {
    return messages;
  }
  await Promise.all(
    messages.map(async (message) => await signMessageAttachments(message)),
  );
  return messages;
};
