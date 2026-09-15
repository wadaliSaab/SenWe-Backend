import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import checkBlocked from "../utils/checkBlocked.js";

const blockMiddleware = async (req, res, next) => {
    try {
        const otherUserId=req.params.userId||req.body.receiverId||req.body.blockedUserId;
        if(!otherUserId) return next();
        await checkBlocked(req.user.id,otherUserId);
        next();
        
        
    } catch (error) {
        next(error);
        
    }
};

export default blockMiddleware;