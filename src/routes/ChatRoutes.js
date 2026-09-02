import { Router } from "express";
import multer from "multer";
import { chatAuth } from "../middleware/chatAuth.js";
import {
  createDirectConversation,
  createGroup,
  getMessages,
  listConversations,
  markConversationRead,
} from "../controllers/ChatController.js";
import { streamChatFile, uploadChatFile } from "../controllers/ChatFileController.js";

const chatRoutes = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.CHAT_MAX_FILE_MB) || 50) * 1024 * 1024 },
});

chatRoutes.use(chatAuth);
chatRoutes.get("/conversations", listConversations);
chatRoutes.post("/conversations/direct", createDirectConversation);
chatRoutes.post("/groups", createGroup);
chatRoutes.get("/conversations/:conversationId/messages", getMessages);
chatRoutes.post("/conversations/:conversationId/read", markConversationRead);
chatRoutes.post("/upload", upload.single("file"), uploadChatFile);
chatRoutes.get("/files/:fileId", streamChatFile);

export { chatRoutes };
