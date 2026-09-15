import { scheduleMessageService,getScheduledMessagesService,cancelScheduledMessageService } from "../services/scheduledMessageService.js";


export const scheduleMessage=async(req,res,next)=>{
    try {
        const{receiver,text,sendAt}=req.body
        const scheduledMessage=await scheduleMessageService(req.user.id,receiver,text,req.files,sendAt);
        res.status(201).json(scheduledMessage);
    } catch (error) {
        next(error);
    }
}

export const getScheduledMessages=async(req,res,next)=>{
    try {
        const scheduledMessages=await getScheduledMessagesService(req.user.id)
        res.status(200).json(scheduledMessages)
    } catch (error) {
        next(error)
    }
}

export const cancelScheduledMessage=async(req,res,next)=>{
    try {
        const {scheduledMessageId}=req.params
        const result=await cancelScheduledMessageService(scheduledMessageId,req.user.id)
        res.status(200).json(result)
    } catch (error) {
        next(error)
    }
}