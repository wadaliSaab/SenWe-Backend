import mongoose from "mongoose";

const conversationParticipantSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
  type: Boolean,
  default: false,
},
deletedAt: {
  type: Date,
  default: null,
},
      isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);


conversationParticipantSchema.index(
  { conversation: 1, user: 1 },
  { unique: true }
);

const ConversationParticipant = mongoose.model(
  "ConversationParticipant",
  conversationParticipantSchema
);
export default ConversationParticipant;