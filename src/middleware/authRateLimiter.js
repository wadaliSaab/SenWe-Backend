import rateLimit from "express-rate-limit";

const rateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, 
    limit: 8000, 
    standardHeaders: true,
    legacyHeaders: false,
    
    message: "Too many requests from this IP, please try again after 15 minutes",
});

export default rateLimiter;