import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    name: { type: String, required: true },
    photo: { type: String, default: "" },
    role: { type: String, default: "Employee" },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["direct", "group"], required: true },
    name: { type: String, trim: true, default: "" },
    photo: { type: String, default: "" },
    participants: {
      type: [participantSchema],
      validate: [(value) => value.length >= 2, "At least two participants are required"],
    },
    admins: [{ type: String }],
    directKey: { type: String, index: true, unique: true, sparse: true },
    lastMessage: {
      text: { type: String, default: "" },
      type: { type: String, default: "text" },
      senderId: { type: String, default: "" },
      createdAt: { type: Date },
    },
  },
  { timestamps: true },
);

conversationSchema.index({ "participants.employeeId": 1, updatedAt: -1 });

export const ChatConversation = mongoose.model("chat_conversation", conversationSchema);
