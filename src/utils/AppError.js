class AppError extends Error {
        constructor(message, statusCode ,code ,field = null) {
            super(message);
            this.statusCode = statusCode;
            this.code = code;
            this.field=field
            this.isOperational = true
            
    
            Error.captureStackTrace(this, this.constructor);
        }
}

export default AppError