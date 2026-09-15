import { makeMessagesPrivateService,unlockPrivateMessageService,getPrivateChatsService,removePrivateMessagesService,removePrivateGroupService } from "../services/privateMessageService.js";


export const makeMessagesPrivate = async (req, res, next) => {
    try {
        const {messageIds,password}=req.body
      
        const result=await makeMessagesPrivateService(req.user.id,messageIds,password)
        res.status(200).json(result)

    } catch (error) {
        next(error)


    }

}

export const unlockPrivateMessages = async (req, res, next) => {
    try {
        const { conversationId, unlockToken } = req.body;
        const result = await unlockPrivateMessageService(req.user.id, conversationId, unlockToken);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getPrivateChats = async (req, res, next) => {
    try {

        const{password}=req.body

        const result=await getPrivateChatsService(req.user.id,password)
        res.status(200).json(result)

    } catch (error) {
        next(error)

    }

}

export const removePrivateMessages = async (req, res, next) => {
    try {
        const {messageIds}=req.body
        const result=await removePrivateMessagesService(req.user.id,messageIds)
        res.status(200).json(result)

    } catch (error) {
        next(error)

    }

}

export const removePrivateGroup = async (req, res, next) => {
    try {
        const {groupId}=req.params;
        const result=await removePrivateGroupService(req.user.id,groupId)
        res.status(200).json(result)

    } catch (error) {
        next(error)

    }

}