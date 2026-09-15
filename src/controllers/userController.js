import {
  getProfileService,
  updateProfileService,
  changePasswordService,
  updateAvatarService,
  deleteUserService,
  searchUsersService, 
} from "../services/userService.js";

export const getProfile = async (req, res, next) => {
  try {
    const user = await getProfileService(req.user.id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await updateProfileService(req.user.id, req.body);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await changePasswordService(req.user.id, currentPassword, newPassword);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateAvatar = async (req, res, next) => {
  try {
    const result = await updateAvatarService(req.user.id, req.file);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const result = await deleteUserService(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};


export const searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const users = await searchUsersService(req.user.id, query, page, limit);
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};