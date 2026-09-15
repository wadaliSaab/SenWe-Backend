import Conversation from "../models/Conversation.js";
import AppError from "../utils/AppError.js";    

export const conversationParticipantMiddleware = async (req, res, next) => {

    try {

        const  conversationId  = req.body?.conversationId || req.params.conversationId
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
            return next(
                new AppError("Conversation not found", 404)
            )
        }
        const isParticipant = conversation.participants.some(
            (participant) => participant.toString() === req.user.id
        );
        if (!isParticipant) {
           return next(
                new AppError("Unauthorized", 403)
            )
        }
        req.conversation = conversation;
        next();
    } catch (error) {
        next(error);
    }
}

export default conversationParticipantMiddleware