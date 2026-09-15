import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";

const authMiddleware = (req, res, next) => {
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(new  AppError("Unauthorized", 401 ,"UNAUTHORIZEd"));
  }
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer" || !token) {
     return next(new  AppError("Unauthorized", 401 ,"UNAUTHORIZEd"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    next( new AppError("Invalid token", 401 ,"INVALID_TOKEN"));
  }
};

export default authMiddleware;
