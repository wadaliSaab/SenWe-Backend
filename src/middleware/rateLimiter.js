import rateLimit from "express-rate-limit";

export const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    limit: 1000, 
    standardHeaders: true,
    legacyHeaders: false,
    
    message: "Too many requests from this IP, please try again after 15 minutes",
});
