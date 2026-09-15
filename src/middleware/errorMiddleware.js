import logger from "../utils/logger.js";


const errorMiddleware = (err, req, res, next) => {
    logger.error({
    err,
    method : req.method,
    url:req.originalUrl,
    userId:req.user?.id,
    ip:req.ip
},
    err.message
);
    const statusCode = err.statusCode || 500;
    const code = err.code || "INTERNAL_SERVER_ERROR";
    const field = err.field || null;
    const message =err.isOperational ? err.message : "Internal Server Error";

    const response={
        success: false,
        code,
        field,
        message
    }
    if(process.env.NODE_ENV === "development"){
        response.stack = err.stack
    }

    res.status(statusCode).json(response); 
};

export default errorMiddleware