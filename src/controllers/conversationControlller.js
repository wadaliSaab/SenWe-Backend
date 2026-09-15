import { createConversationService ,getUserConversationsService ,deleteConversationService ,searchConversationsService , togglePinConversationService} from "../services/conversationServices.js";

export const createConversation = async (req, res, next) => {
    try {
        const {receiverId } = req.body;
        const conversation = await createConversationService(req.user.id, receiverId);
        res.status(201).json(conversation);
    } catch (error) {
        next(error);
    }
};

export const getUserConversations = async (req, res, next) => {
    try {
        const conversations = await getUserConversationsService(req.user.id);
        res.status(200).json(conversations);
    } catch (error) {
        next(error);
    }
};


export const deleteConversation = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const result = await deleteConversationService(req.user.id, conversationId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const searchConversation = async (req, res, next) => {
    try {
        const { query, filter, page, limit } = req.query;
        const conversations = await searchConversationsService(
            req.user.id,
            query,
            filter,
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined
        );
        res.status(200).json(conversations);
    } catch (error) {
        next(error);
    }
};

export const togglePinConversation = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const result = await togglePinConversationService(req.user.id, conversationId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};