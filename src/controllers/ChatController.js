import mongoose from "mongoose";
import { ChatConversation } from "../models/ChatConversation.js";
import { ChatMessage } from "../models/ChatMessage.js";

const participantFromEmployee = (employee) => ({
  employeeId: String(employee.id),
  name: employee.name,
  photo: employee.photo || "",
  role: employee.role || "Employee",
});

const sanitizeParticipant = (participant = {}) => ({
  employeeId: String(participant.employeeId || participant.e_id || ""),
  name:
    participant.name ||
    [participant.e_first_name, participant.e_last_name].filter(Boolean).join(" ") ||
    "Employee",
  photo: participant.photo || participant.e_photo || "",
  role: participant.role || participant.e_designation || "Employee",
});

const isParticipant = (conversation, employeeId) =>
  conversation?.participants?.some(
    (participant) => String(participant.employeeId) === String(employeeId),
  );

const publishConversation = (req, conversation) => {
  const chatIo = req.app.get("chatIo");
  if (!chatIo || !conversation) return;
  conversation.participants.forEach((participant) => {
    const employeeRoom = `employee:${participant.employeeId}`;
    chatIo.in(employeeRoom).socketsJoin(`conversation:${conversation._id}`);
    chatIo.to(employeeRoom).emit("chat:conversation", conversation);
  });
};

export const listConversations = async (req, res) => {
  try {
    const conversations = await ChatConversation.find({
      "participants.employeeId": req.employee.id,
    })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ status: true, data: conversations });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const createDirectConversation = async (req, res) => {
  try {
    const other = sanitizeParticipant(req.body.participant);
    if (!other.employeeId || other.employeeId === req.employee.id) {
      return res.status(400).json({ status: false, message: "Select another employee" });
    }

    const directKey = [req.employee.id, other.employeeId].sort().join(":");
    let conversation = await ChatConversation.findOne({ directKey });

    if (!conversation) {
      conversation = await ChatConversation.create({
        type: "direct",
        directKey,
        participants: [participantFromEmployee(req.employee), other],
        admins: [],
      });
      publishConversation(req, conversation);
    }

    res.status(201).json({ status: true, data: conversation });
  } catch (error) {
    if (error.code === 11000) {
      const directKey = [req.employee.id, String(req.body.participant?.employeeId || req.body.participant?.e_id)].sort().join(":");
      const conversation = await ChatConversation.findOne({ directKey });
      return res.json({ status: true, data: conversation });
    }
    res.status(500).json({ status: false, message: error.message });
  }
};

export const createGroup = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const requestedParticipants = Array.isArray(req.body.participants)
      ? req.body.participants.map(sanitizeParticipant)
      : [];

    const unique = new Map();
    [participantFromEmployee(req.employee), ...requestedParticipants].forEach((participant) => {
      if (participant.employeeId) unique.set(participant.employeeId, participant);
    });

    if (name.length < 2) {
      return res.status(400).json({ status: false, message: "Group name is required" });
    }
    if (unique.size < 3) {
      return res.status(400).json({ status: false, message: "Select at least two employees" });
    }

    const conversation = await ChatConversation.create({
      type: "group",
      name,
      photo: req.body.photo || "",
      participants: Array.from(unique.values()),
      admins: [req.employee.id],
    });

    publishConversation(req, conversation);

    res.status(201).json({ status: true, data: conversation });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const conversation = await ChatConversation.findById(req.params.conversationId).lean();
    if (!isParticipant(conversation, req.employee.id)) {
      return res.status(403).json({ status: false, message: "Conversation access denied" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const query = { conversationId: conversation._id };
    if (req.query.before && mongoose.isValidObjectId(req.query.before)) {
      const beforeMessage = await ChatMessage.findById(req.query.before).select("createdAt").lean();
      if (beforeMessage) query.createdAt = { $lt: beforeMessage.createdAt };
    }

    const messages = await ChatMessage.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ status: true, data: messages.reverse() });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const markConversationRead = async (req, res) => {
  try {
    const conversation = await ChatConversation.findById(req.params.conversationId).lean();
    if (!isParticipant(conversation, req.employee.id)) {
      return res.status(403).json({ status: false, message: "Conversation access denied" });
    }

    await ChatMessage.updateMany(
      {
        conversationId: conversation._id,
        "sender.employeeId": { $ne: req.employee.id },
        "readBy.employeeId": { $ne: req.employee.id },
      },
      { $push: { readBy: { employeeId: req.employee.id, at: new Date() } } },
    );
    res.json({ status: true });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export { isParticipant };
