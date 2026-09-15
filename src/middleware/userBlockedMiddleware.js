import AppError from "../utils/AppError.js";
import checkBlocked from "../utils/checkBlocked.js";

const userBlockedMiddleware = async (req, res, next) => {
  try {
    const receiverId = req.body.receiver;
    if (!receiverId) {
      return next(new AppError("Receiver is required", 400));
    }
    await checkBlocked(req.user.id, receiverId);
    next();
  } catch (error) {
    next(error);
  }
};

export default userBlockedMiddleware;