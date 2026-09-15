import mongoose from "mongoose";


const scheduledMessageSchema = new mongoose.Schema(
    {
       sender:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
       },
       receiver:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
       },
       
       conversation:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Conversation",
        required:true
       },
       text:{
        type:String,
       
       },
        attachments: [
      {
        type: { type: String, enum: ["image", "video", "file"], required: true },
        filePath: { type: String, required: true },
        fileName: { type: String, required: true },
      },
    ],
       sendAt:{
        type:Date,
        required:true
       },
       bullJobId:{
        type:String
       },
       status:{
        type:String,
        enum:["pending","sent","failed","cancelled"],
        default:"pending"
       }
    },
    { timestamps: true }
);
scheduledMessageSchema.index({ sender: 1, status: 1 });
const ScheduledMessage = mongoose.model(
    "ScheduledMessage",
    scheduledMessageSchema
);
export default ScheduledMessage;