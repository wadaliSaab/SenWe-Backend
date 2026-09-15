import {
  savedMessageService,
  getSavedChatsService,
  getSavedMessagesService,
  removeAllSavedMessageService,
} from "../services/savedMessageService.js";
import AppError from "../utils/AppError.js";
import Message from "../models/Message.js";

export const savedMessage = async (req, res, next) => {
  try {
    const { messageIds } = req.body; 
    const result = await savedMessageService(messageIds, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getSavedChats = async (req, res, next) => {
  try {
    const savedChats = await getSavedChatsService(req.user.id);
    res.status(200).json(savedChats);
  } catch (error) {
    next(error);
  }
};

export const getSavedMessages = async (req, res, next) => {
  try {
    const {  conversationId } = req.params;

    const savedMessages = await getSavedMessagesService(conversationId, req.user.id);
    res.status(200).json(savedMessages);
  } catch (error) {
    next(error);
  }
};

export const removeAllSavedMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;   
    const result = await removeAllSavedMessageService(req.user.id, conversationId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};