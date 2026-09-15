import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";
import RefreshToken from "../models/RefreshToken.js";

export const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "30d" });
};

export const refreshAccessTokenService = async (refreshToken) => {
 
  if (!refreshToken) {
    throw new AppError("Refresh token is required", 401, "NO_REFRESH_TOKEN");
  }

  const storedToken = await RefreshToken.findOne({ token: refreshToken });

  if (!storedToken) {
    throw new AppError("Invalid refresh token", 401 , "INVALID_REFRESH_TOKEN" );


  }
    let decoded ;
  try {
     decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
     await storedToken.deleteOne();
  } catch (error) {
    if(refreshToken){
      await storedToken.deleteOne();
    }

    throw new AppError("refresh token expired", 401 , "REFRESH_TOKEN_EXPIRED" );
  }


   const newRefreshToken = generateRefreshToken(decoded.id);
   const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
   await RefreshToken.create({ user: decoded.id, token: newRefreshToken ,expiresAt });

   const accessToken = generateAccessToken(decoded.id);

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}
export const registerService = async ({ username, email, password }) => {
  email=email.toLowerCase();
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });

  if (existingUser?.email === email) {
    throw new AppError("Email already exists", 409 , "EMAIL_ALREADY_EXISTS" , "email");
  }
  if (existingUser?.username === username) {
    throw new AppError("Username already exists", 409 , "USERNAME_ALREADY_EXISTS" , "username");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, password: hashedPassword });
  user.password = undefined;
  return {
    id: user._id,
    username: user.username,
    email: user.email,
  };
};

export const loginService = async (email, password) => {
  email=email.toLowerCase();
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Invalid credentials", 401 ,"INVALID_CREDENTIALS" );
  }
  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) {
    throw new AppError("Invalid credentials", 401 , "INVALID_CREDENTIALS" );
  }
  const accessToken = generateAccessToken(user._id);
   const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const refreshToken = generateRefreshToken(user._id);
  await RefreshToken.create({ user: user._id, token: refreshToken ,expiresAt });
  return {
    message: "login successful",
    accessToken,
    refreshToken,
    user:{
      _id:user._id,
      username:user.username,
      email:user.email,
      avatar:user.avatar,
      name:user.name,
      bio:user.bio

    }
  };
};



export const logoutService = async (refreshToken) => {
  
  if (!refreshToken) {
    return { message: "Logout successful" };
  }
  await RefreshToken.findOneAndDelete({ token: refreshToken });
  return {
    message: "Logout successful",
  };
};


export const logoutAllService = async (id) => {
  await RefreshToken.deleteMany({ user: id });
  return {
    message: "Logged out from all devices successfully",
  };
}