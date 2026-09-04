import mongoose from "mongoose";

const chatPrivacySettingSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, index: true },
    employeeName: { type: String, default: "Employee" },
    employeePhoto: { type: String, default: "" },
    roleId: { type: Number, default: null },
    cSuite: { type: Number, required: true, index: true },
    privateMode: { type: Boolean, default: false },
    lockedConversationIds: [{ type: String }],
    passwordHash: { type: String, default: "", select: false },
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

chatPrivacySettingSchema.index({ cSuite: 1, employeeName: 1 });

export const ChatPrivacySetting = mongoose.model("chat_privacy_setting", chatPrivacySettingSchema);
