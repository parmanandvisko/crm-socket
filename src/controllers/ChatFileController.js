import mongoose from "mongoose";
import path from "path";
import { ChatConversation } from "../models/ChatConversation.js";
import { isParticipant } from "./ChatController.js";

const allowedTypes = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf", "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "application/csv",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip", "application/x-zip-compressed",
  "application/x-rar-compressed", "application/vnd.rar",
];

const allowedExtensions = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif",
  ".mp4", ".webm", ".mov", ".mkv", ".avi",
  ".pdf", ".txt", ".csv", ".doc", ".docx",
  ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods",
  ".zip", ".rar",
]);

const fileKind = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
};

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "chat_uploads" });

export const uploadChatFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ status: false, message: "Choose a file" });
    const extension = path.extname(req.file.originalname).toLowerCase();
    const allowedMime = req.file.mimetype.startsWith("video/") || allowedTypes.includes(req.file.mimetype);
    if (!allowedMime || !allowedExtensions.has(extension)) {
      return res.status(415).json({ status: false, message: "This file type is not allowed" });
    }

    const conversation = await ChatConversation.findById(req.body.conversationId).lean();
    if (!isParticipant(conversation, req.employee.id)) {
      return res.status(403).json({ status: false, message: "Conversation access denied" });
    }

    const uploadStream = bucket().openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
      metadata: { conversationId: String(conversation._id), uploadedBy: req.employee.id },
    });

    await new Promise((resolve, reject) => {
      uploadStream.on("error", reject);
      uploadStream.on("finish", resolve);
      uploadStream.end(req.file.buffer);
    });

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.status(201).json({
      status: true,
      data: {
        fileId: uploadStream.id,
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        kind: fileKind(req.file.mimetype),
        url: `${baseUrl}/api/chat/files/${uploadStream.id}`,
      },
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const streamChatFile = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId)) return res.sendStatus(404);
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const [file] = await bucket().find({ _id: fileId }).toArray();
    if (!file) return res.sendStatus(404);

    const conversation = await ChatConversation.findById(file.metadata?.conversationId).lean();
    if (!isParticipant(conversation, req.employee.id)) return res.sendStatus(403);

    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    bucket().openDownloadStream(fileId).on("error", () => res.sendStatus(404)).pipe(res);
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};
