import mongoose from "mongoose";

const privateGroupSchema = new mongoose.Schema({
   owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
   },
   conversation:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"Conversation",
      required:true
   },
   password: {
      type: String,
      required: true,
   },

   


}, { timestamps: true });

const PrivateGroup = mongoose.model("PrivateGroup", privateGroupSchema);
export default PrivateGroup;