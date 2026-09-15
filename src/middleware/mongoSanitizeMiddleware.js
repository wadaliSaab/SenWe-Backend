const sanitize = (value)=>{
    if(!value || typeof value !== "object") return ;

    for(const key of Object.keys(value)){
        if(key.startsWith("$") || key.includes(".")){
            delete value[key];
            continue;
        } 
        sanitize(value[key]);
    }
    
}
const mongoSanitizeMiddleware = (req, res, next)=>{
    sanitize(req.body);
    sanitize(req.query);
    sanitize(req.params);
    next();
}

export default mongoSanitizeMiddleware
