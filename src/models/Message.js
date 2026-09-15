import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    text: { type: String, trim: true },
    attachments: [
      {
        type: { type: String, enum: ["image", "video", "file"], required: true },
        filePath: { type: String, required: true },
        fileName: { type: String, required: true },
      },
    ],

   
   privateFor: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        privateGroup: { type: mongoose.Schema.Types.ObjectId, ref: "PrivateGroup", required: true },
      },
    ],
   
    deletedFor: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    ],

   
    deletedForEveryone: { type: Boolean, default: false },

    privateGroup: { type: mongoose.Schema.Types.ObjectId, ref: "PrivateGroup" },

    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        emoji: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;