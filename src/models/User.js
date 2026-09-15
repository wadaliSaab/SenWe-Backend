import mongoose from "mongoose";

import { defaultAvatarPlugin } from "../utils/defaultAvatarPlugin.js";

const userSchema = new mongoose.Schema({
    avatar: {
        type: String,
        default:null
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        trim: true,
        default: function () {
        return this.username;
    }
    },
    bio: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
    },
    friends: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
           
        }
    ],
    blockedUsers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            
        }
    ],
    isOnline: {
  type: Boolean,
  default: false,
},
lastSeenAt: {
  type: Date,
  default: null,
},
isVerified: {
  type: Boolean,
  default: false
}
}, { timestamps: true });

userSchema.index({ username: "text", name: "text" });

userSchema.plugin(defaultAvatarPlugin, { nameField: "username" });

const User = mongoose.model("User", userSchema);
export default User