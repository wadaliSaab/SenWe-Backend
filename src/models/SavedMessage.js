import mongoose from "mongoose";

const savedMessageSchema = new mongoose.Schema(
    {
       user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
       },
       message:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Message",
        required:true
       },
       conversation:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Conversation",
        required:true
       },
       sender:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
       }
    },
    { timestamps: true }
);
savedMessageSchema.index({ user: 1, message : 1 }, { unique: true });
const SavedMessage = mongoose.model("SavedMessage", savedMessageSchema);

export default SavedMessage;