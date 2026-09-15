const validateRequest = (schema) => async (req, res, next) => {
    const result=schema.safeParse(req.body);
    if(!result.success){
        return res.status(400).json({message:result.error.issues[0].message});
    }   
    req.body=result.data;
    next();
};

export default validateRequest;