import {
  sendMessageService,
  getMessagesService,
  deleteMessageForMeService,
  deleteMessageForEveryoneService,
  reactToMessagesService,
  markAsReadService,
  searchMessagesService
} from "../services/messageServices.js";

export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, text } = req.body;
    const message = await sendMessageService(
      conversationId,
      req.user.id,
      text,
      req.files,
    );
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const { conversationId } = req.params;
  
    const messages = await getMessagesService(
      req.user.id,
      conversationId,
      page,
      limit,
    );
    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

export const deleteMessagesForMe = async (req, res, next) => {
  try {
    const { messageIds } = req.body;
    const result = await deleteMessageForMeService(req.user.id, messageIds);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};


export const deleteMessagesForEveryone = async (req, res, next) => {
  try {
    const { messageIds } = req.body;
    const result = await deleteMessageForEveryoneService(req.user.id, messageIds);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const reactToMessages = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const result = await reactToMessagesService(req.user.id, messageId, emoji);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  const { conversationId } = req.params;
  try {
    const result = await markAsReadService(req.user.id, conversationId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};


export const searchMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { query } = req.query;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const messages = await searchMessagesService(
      req.user.id,
      conversationId,
      query,
      page,
      limit,
    );
    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};