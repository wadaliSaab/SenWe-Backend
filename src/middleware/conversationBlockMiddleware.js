import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import Conversation from "../models/Conversation.js";
import  checkBlocked  from "../utils/checkBlocked.js";

const conversationBlockMiddleware = async (req, res, next) => {
    try {
        const  conversationId  = req.body.conversationId||req.params.conversationId
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
            return next(
                new AppError("Conversation not found", 404)
            )
        }
        const otherUserId = conversation.participants.find(
            (participant) => participant.toString() !== req.user.id
        )
       await checkBlocked(req.user.id,otherUserId);
        next();
    } catch (error) {
        next(error);
    }
}

export default conversationBlockMiddleware