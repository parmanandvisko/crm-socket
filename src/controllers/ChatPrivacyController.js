import { promisify } from "util";
import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import mongoose from "mongoose";
import { ChatConversation } from "../models/ChatConversation.js";
import { ChatPrivacyAudit } from "../models/ChatPrivacyAudit.js";
import { ChatPrivacySetting } from "../models/ChatPrivacySetting.js";

const scrypt = promisify(scryptCallback);

const publicSettings = (settings) => ({
  lockedConversationIds: (settings?.lockedConversationIds || []).map(String),
  privateMode: Boolean(settings?.privateMode),
  hasPassword: Boolean(settings?.passwordHash),
});

const passwordDigest = async (password, salt = randomBytes(16).toString("hex")) => {
  const derivedKey = await scrypt(String(password), salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
};

const passwordMatches = async (password, storedDigest = "") => {
  const [salt, savedKey] = storedDigest.split(":");
  if (!salt || !savedKey) return false;
  const candidate = Buffer.from((await passwordDigest(password, salt)).split(":")[1], "hex");
  const saved = Buffer.from(savedKey, "hex");
  return candidate.length === saved.length && timingSafeEqual(candidate, saved);
};

const employeeMetadata = (employee) => ({
  employeeName: employee.name,
  employeePhoto: employee.photo || "",
  roleId: Number.isFinite(Number(employee.roleId)) ? Number(employee.roleId) : null,
  cSuite: Number(employee.cSuite),
});

const ensureEmployeeDepartment = (req, res) => {
  if (!Number.isFinite(Number(req.employee.cSuite))) {
    res.status(403).json({ status: false, message: "Employee department is missing" });
    return false;
  }
  return true;
};

const findOrCreateSettings = async (employee, includePassword = false) => {
  const query = ChatPrivacySetting.findOneAndUpdate(
    { employeeId: employee.id },
    { $set: employeeMetadata(employee), $setOnInsert: { lockedConversationIds: [], privateMode: false } },
    { new: true, upsert: true },
  );
  if (includePassword) query.select("+passwordHash");
  return query;
};

const participantCanLock = async (conversationId, employeeId) => {
  if (!mongoose.isValidObjectId(conversationId)) return false;
  const conversation = await ChatConversation.findOne({
    _id: conversationId,
    "participants.employeeId": employeeId,
  }).select("_id").lean();
  return Boolean(conversation);
};

export const getPrivacySettings = async (req, res) => {
  try {
    if (!ensureEmployeeDepartment(req, res)) return;
    const settings = await findOrCreateSettings(req.employee, true);
    res.json({ status: true, data: publicSettings(settings) });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const updatePrivateMode = async (req, res) => {
  try {
    if (!ensureEmployeeDepartment(req, res)) return;
    const settings = await findOrCreateSettings(req.employee, true);
    settings.privateMode = Boolean(req.body.privateMode);
    await settings.save();
    res.json({ status: true, data: publicSettings(settings) });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const lockConversation = async (req, res) => {
  try {
    if (!ensureEmployeeDepartment(req, res)) return;
    const conversationId = String(req.body.conversationId || "");
    if (!conversationId || !(await participantCanLock(conversationId, req.employee.id))) {
      return res.status(403).json({ status: false, message: "Conversation access denied" });
    }
    const settings = await findOrCreateSettings(req.employee, true);
    if (!settings.passwordHash) {
      const password = String(req.body.password || "");
      if (password.length < 4) return res.status(400).json({ status: false, message: "Password must contain at least 4 characters" });
      settings.passwordHash = await passwordDigest(password);
      settings.passwordChangedAt = new Date();
    }
    if (!settings.lockedConversationIds.includes(conversationId)) settings.lockedConversationIds.push(conversationId);
    await settings.save();
    res.json({ status: true, data: publicSettings(settings) });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const verifyOrUnlockConversation = async (req, res) => {
  try {
    if (!ensureEmployeeDepartment(req, res)) return;
    const conversationId = String(req.body.conversationId || "");
    const settings = await findOrCreateSettings(req.employee, true);
    if (!(await passwordMatches(req.body.password || "", settings.passwordHash))) {
      return res.status(401).json({ status: false, message: "Incorrect password" });
    }
    if (!settings.lockedConversationIds.includes(conversationId)) {
      return res.status(404).json({ status: false, message: "Locked chat not found" });
    }
    if (req.body.action === "unlock") {
      settings.lockedConversationIds = settings.lockedConversationIds.filter((id) => id !== conversationId);
      if (!settings.lockedConversationIds.length) {
        settings.passwordHash = "";
        settings.passwordChangedAt = null;
      }
      await settings.save();
    }
    res.json({ status: true, data: publicSettings(settings) });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

const requireDepartmentAdmin = (req, res) => {
  if (Number(req.employee.roleId) !== 34 || !Number.isFinite(Number(req.employee.cSuite))) {
    res.status(403).json({ status: false, message: "Department admin access required" });
    return false;
  }
  return true;
};

export const listDepartmentPrivacy = async (req, res) => {
  try {
    if (!requireDepartmentAdmin(req, res)) return;
    const rows = await ChatPrivacySetting.find({ cSuite: Number(req.employee.cSuite) })
      .select("+passwordHash")
      .sort({ privateMode: -1, updatedAt: -1 })
      .lean();
    res.json({
      status: true,
      data: rows.map((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        employeePhoto: row.employeePhoto,
        roleId: row.roleId,
        cSuite: row.cSuite,
        privateMode: Boolean(row.privateMode),
        lockedChatCount: row.lockedConversationIds?.length || 0,
        hasPassword: Boolean(row.passwordHash),
        updatedAt: row.updatedAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const resetDepartmentPassword = async (req, res) => {
  try {
    if (!requireDepartmentAdmin(req, res)) return;
    const settings = await ChatPrivacySetting.findOne({
      employeeId: String(req.params.employeeId),
      cSuite: Number(req.employee.cSuite),
    }).select("+passwordHash");
    if (!settings) return res.status(404).json({ status: false, message: "Department employee privacy settings not found" });
    if (!settings.lockedConversationIds.length) return res.status(400).json({ status: false, message: "This employee has no locked chats" });

    const temporaryPassword = String(randomInt(100000, 1000000));
    settings.passwordHash = await passwordDigest(temporaryPassword);
    settings.passwordChangedAt = new Date();
    await settings.save();
    await ChatPrivacyAudit.create({
      action: "department_admin_password_reset",
      adminEmployeeId: req.employee.id,
      targetEmployeeId: settings.employeeId,
      cSuite: settings.cSuite,
    });
    res.json({ status: true, data: { temporaryPassword }, message: "Temporary PIN generated" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};
