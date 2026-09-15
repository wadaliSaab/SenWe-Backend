import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
        user:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User",
            required:true
        },
        token:{
            type:String,
            required:true,
            unique:true
        },
        expiresAt:{
            type:Date,
            required:true,
            expires:0
        }
        

  },{
      timestamps:true
  }
);
refreshTokenSchema.index({ user: 1});

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
export default RefreshToken