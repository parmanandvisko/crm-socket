import mongoose from "mongoose";

const chatPrivacyAuditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    adminEmployeeId: { type: String, required: true, index: true },
    targetEmployeeId: { type: String, required: true, index: true },
    cSuite: { type: Number, required: true, index: true },
  },
  { timestamps: true },
);

export const ChatPrivacyAudit = mongoose.model("chat_privacy_audit", chatPrivacyAuditSchema);
