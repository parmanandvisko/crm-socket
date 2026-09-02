import { ChatConversation } from "../models/ChatConversation.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { getSocketEmployee } from "../middleware/chatAuth.js";
import mongoose from "mongoose";

const safeAck = (ack, payload) => {
  if (typeof ack === "function") ack(payload);
};

const getEmployee = (socket) => {
  if (socket.data.chatEmployee) return socket.data.chatEmployee;
  const employee = getSocketEmployee(socket);
  socket.data.chatEmployee = employee;
  return employee;
};

const hasAccess = (conversation, employeeId) =>
  conversation?.participants?.some(
    (participant) => String(participant.employeeId) === String(employeeId),
  );

export const registerChatSocket = async (socket) => {
  const employee = getEmployee(socket);
  socket.join(`employee:${employee.id}`);

  const conversations = await ChatConversation.find({
    "participants.employeeId": employee.id,
  }).select("_id").lean();
  conversations.forEach((conversation) => socket.join(`conversation:${conversation._id}`));
  return employee;
};

export const handleChatSocket = (io, socket) => {
  socket.on("chat:register", async (_payload, ack) => {
    try {
      const employee = await registerChatSocket(socket);
      safeAck(ack, { status: true, employeeId: employee.id });
    } catch (error) {
      safeAck(ack, { status: false, message: error.message });
    }
  });

  socket.on("chat:join-conversation", async ({ conversationId } = {}, ack) => {
    try {
      const employee = getEmployee(socket);
      const conversation = await ChatConversation.findById(conversationId).lean();
      if (!hasAccess(conversation, employee.id)) throw new Error("Conversation access denied");
      socket.join(`conversation:${conversationId}`);
      safeAck(ack, { status: true });
    } catch (error) {
      safeAck(ack, { status: false, message: error.message });
    }
  });

  socket.on("chat:send", async ({ conversationId, text = "", attachments = [] } = {}, ack) => {
    try {
      const employee = getEmployee(socket);
      const conversation = await ChatConversation.findById(conversationId);
      if (!hasAccess(conversation, employee.id)) throw new Error("Conversation access denied");

      const cleanText = String(text).trim().slice(0, 5000);
      const requestedAttachments = Array.isArray(attachments) ? attachments.slice(0, 10) : [];
      const requestedIds = requestedAttachments
        .map((attachment) => attachment.fileId)
        .filter((fileId) => mongoose.isValidObjectId(fileId))
        .map((fileId) => new mongoose.Types.ObjectId(fileId));
      const storedFiles = requestedIds.length
        ? await mongoose.connection.db.collection("chat_uploads.files").find({
            _id: { $in: requestedIds },
            "metadata.conversationId": String(conversation._id),
          }).toArray()
        : [];
      const cleanAttachments = storedFiles.map((file) => {
        const kind = file.contentType?.startsWith("image/")
          ? "image"
          : file.contentType?.startsWith("video/")
            ? "video"
            : "file";
        return {
          fileId: file._id,
          name: file.filename,
          mimeType: file.contentType || "application/octet-stream",
          size: file.length,
          kind,
          url: `/api/chat/files/${file._id}`,
        };
      });
      if (!cleanText && cleanAttachments.length === 0) throw new Error("Message is empty");

      let type = "text";
      if (cleanText && cleanAttachments.length) type = "mixed";
      else if (cleanAttachments.length === 1) type = cleanAttachments[0].kind || "file";
      else if (cleanAttachments.length > 1) type = "mixed";

      const message = await ChatMessage.create({
        conversationId: conversation._id,
        sender: { employeeId: employee.id, name: employee.name, photo: employee.photo },
        type,
        text: cleanText,
        attachments: cleanAttachments,
        deliveredTo: [{ employeeId: employee.id, at: new Date() }],
        readBy: [{ employeeId: employee.id, at: new Date() }],
      });

      conversation.lastMessage = {
        text: cleanText || cleanAttachments[0]?.name || "Attachment",
        type,
        senderId: employee.id,
        createdAt: message.createdAt,
      };
      await conversation.save();

      const payload = message.toObject();
      conversation.participants.forEach((participant) => {
        io.to(`employee:${participant.employeeId}`).emit("chat:message", payload);
      });
      safeAck(ack, { status: true, data: payload });
    } catch (error) {
      safeAck(ack, { status: false, message: error.message });
    }
  });

  socket.on("chat:typing", async ({ conversationId, isTyping } = {}) => {
    try {
      const employee = getEmployee(socket);
      const conversation = await ChatConversation.findById(conversationId).lean();
      if (!hasAccess(conversation, employee.id)) return;
      socket.to(`conversation:${conversationId}`).emit("chat:typing", {
        conversationId,
        employeeId: employee.id,
        name: employee.name,
        isTyping: Boolean(isTyping),
      });
    } catch (_error) {
      // Invalid/expired sessions are ignored without leaking conversation data.
    }
  });

  socket.on("chat:read", async ({ conversationId } = {}, ack) => {
    try {
      const employee = getEmployee(socket);
      const conversation = await ChatConversation.findById(conversationId).lean();
      if (!hasAccess(conversation, employee.id)) throw new Error("Conversation access denied");
      const readAt = new Date();
      await ChatMessage.updateMany(
        {
          conversationId,
          "sender.employeeId": { $ne: employee.id },
          "readBy.employeeId": { $ne: employee.id },
        },
        { $push: { readBy: { employeeId: employee.id, at: readAt } } },
      );
      socket.to(`conversation:${conversationId}`).emit("chat:read", {
        conversationId,
        employeeId: employee.id,
        readAt,
      });
      safeAck(ack, { status: true });
    } catch (error) {
      safeAck(ack, { status: false, message: error.message });
    }
  });
};
