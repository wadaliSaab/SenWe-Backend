import {
    getBlockedUsersService,
    blockUserService,
    unblockUserService
} from "../services/blockService.js";

export const getBlockedUsers = async (req, res, next) => {
    try {
        const blockedUsers = await getBlockedUsersService(req.user.id);
        res.status(200).json(blockedUsers);
    } catch (error) {
        next(error);
    }
};

export const blockUser = async (req, res, next) => {
    try {
        const { blockedUserId } = req.body;
        const blockedUser = await blockUserService(req.user.id, blockedUserId);
        res.status(200).json(blockedUser);
    } catch (error) {
        next(error);
    }
};

export const unblockUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const result = await unblockUserService(req.user.id, userId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};