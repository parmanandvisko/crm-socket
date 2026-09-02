import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ["image", "video", "file"], required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "chat_conversation", required: true, index: true },
    sender: {
      employeeId: { type: String, required: true },
      name: { type: String, required: true },
      photo: { type: String, default: "" },
    },
    type: { type: String, enum: ["text", "image", "video", "file", "mixed"], default: "text" },
    text: { type: String, trim: true, maxlength: 5000, default: "" },
    attachments: [attachmentSchema],
    deliveredTo: [{ employeeId: String, at: Date }],
    readBy: [{ employeeId: String, at: Date }],
    deletedForEveryone: { type: Boolean, default: false },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model("chat_message", messageSchema);
