import jwt from "jsonwebtoken";

const getToken = (authorization = "") => {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

export const normalizeEmployee = (payload = {}) => ({
  id: String(payload.e_id || payload.id || payload.employeeId || ""),
  name:
    [payload.e_first_name, payload.e_last_name].filter(Boolean).join(" ") ||
    payload.e_username ||
    payload.name ||
    "Employee",
  photo: payload.e_photo || payload.photo || "",
  role: payload.e_designation || payload.role || "Employee",
  roleId: payload.e_role ?? payload.r_id ?? payload.roleId ?? null,
  cSuite: payload.e_c_suit ?? payload.e_c_suite ?? payload.cSuite ?? null,
});

export const verifyChatToken = (token) => {
  if (!process.env.JWT_SECRET) throw new Error("Chat authentication is not configured");
  if (!token) throw new Error("Authentication token is required");
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const employee = normalizeEmployee(payload);
  if (!employee.id) throw new Error("Employee ID is missing in token");
  return employee;
};

export const chatAuth = (req, res, next) => {
  try {
    req.employee = verifyChatToken(getToken(req.headers.authorization));
    next();
  } catch (error) {
    res.status(401).json({ status: false, message: error.message });
  }
};

export const getSocketEmployee = (socket) =>
  verifyChatToken(socket.handshake.auth?.token);
