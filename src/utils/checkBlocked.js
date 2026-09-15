import User from "../models/User.js";
import AppError from "./AppError.js";


const checkBlocked=async(userId,otherUserId)=>{
     const [user,otherUser]=await Promise.all([
            User.findById(userId),
            User.findById(otherUserId)
        ])
        if(!otherUser) return next(new AppError("User not found",404));
        const blockedByMe=user.blockedUsers.some((id)=>id.toString()===otherUserId.toString());
        const blockedMe=otherUser.blockedUsers.some((id)=>id.toString()===req.user.id.toString());
        if(blockedByMe||blockedMe) return next(new AppError("You cannot interact with this user",403));
}

export default checkBlocked