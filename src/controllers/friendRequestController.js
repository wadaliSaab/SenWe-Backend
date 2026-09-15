import {
  sendFriendRequestService,
  acceptFriendRequestService,
  rejectFriendRequestService,
  cancelFriendRequestService,
  getAllFriendRequestsService,
  getFriendsService,
  removeFriendService,
} from "../services/friendRequestService.js";

export const sendFriendRequest = async (req, res, next) => {
  try {
    const { receiverId } = req.body;
    const request = await sendFriendRequestService(req.user.id, receiverId);
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
};

export const acceptFriendRequest = async (req, res, next) => {
  try {
    const { otherUserId } = req.params;
    const request = await acceptFriendRequestService(otherUserId, req.user.id);
    res.status(200).json(request);
  } catch (error) {
    next(error);
  }
};

export const rejectFriendRequest = async (req, res, next) => {
  try {
    const { otherUserId } = req.params;
    const request = await rejectFriendRequestService(otherUserId, req.user.id);
    res.status(200).json(request);
  } catch (error) {
    next(error);
  }
};

export const cancelFriendRequest = async (req, res, next) => {
  try {
    const { otherUserId } = req.params;
    
    const result = await cancelFriendRequestService(otherUserId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getFriendRequests = async (req, res, next) => {
  try {
    const requests = await getAllFriendRequestsService(req.user.id);
    res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
};

export const getFriends = async (req, res, next) => {
  try {
    const friends = await getFriendsService(req.user.id);
    res.status(200).json(friends);
  } catch (error) {
    next(error);
  }
};

export const removeFriend = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const friend = await removeFriendService(req.user.id, friendId);
    res.status(200).json(friend);
  } catch (error) {
    next(error);
  }
};