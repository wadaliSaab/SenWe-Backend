import {registerService,loginService,refreshAccessTokenService,logoutService,logoutAllService} from '../services/authService.js'

import { refreshCookieOptions } from '../config/cookie.js'



export const refreshToken=async(req,res,next)=>{
  try{
    const token=req.cookies.refreshToken;
    const result=await refreshAccessTokenService(token)
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

    res.status(200).json({accessToken:result.accessToken});
  }catch(error){
    next(error)
  }
}

export const registerUser = async (req, res,next) => {

  try {
     const { username, email, password } = req.body;


    const result = await registerService({ username, email, password });
    res.status(201).json(result);
  } catch(error) {
   next(error)
  }
};



export const loginUser = async (req, res,next) => {

  try {
     const { email, password } = req.body;

    const result=await loginService(email,password);
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

    res.status(200).json({
      message: result.message,
      accessToken: result.accessToken,
      user: result.user
    });
  } catch(error) {
   next(error)
  }
};


export const logoutUser=async(req,res,next)=>{
  try{
   
    const token = req.cookies.refreshToken;
    const result=await logoutService(token)
    res.clearCookie("refreshToken" , refreshCookieOptions);
    res.status(200).json(result)
  }catch(error){
    next(error)
  }
}


export const logoutAllUser=async(req,res,next)=>{
  try{
    const result=await logoutAllService( req.user.id)
    res.status(200).json(result)
  }catch(error){
    next(error)
  }
}