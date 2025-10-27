import { Server } from "socket.io";
import { users, addUser, removeUser } from "../utils/users.js";
import { handleLocationSocket } from "./location.js";
import { handleNotificationSocket } from "./notification.js";

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  io.on("connection", (socket) => {
    console.log(" Socket connected:", socket.id);

    // JOIN USER
    socket.on("join", ({ lt_user_id, lt_name }) => {
      addUser(lt_user_id, socket.id, lt_name);
      console.log(" Active Users:", Object.keys(users));
      io.emit("online-users", Object.values(users));
    });

    // 🔹 Attach feature modules
    handleLocationSocket(io, socket);
    handleNotificationSocket(io, socket);

    // DISCONNECT
    socket.on("disconnect", () => {
      const userId = removeUser(socket.id);
      console.log(` User disconnected: ${userId || socket.id}`);
      io.emit("online-users", Object.values(users));
    });
  });
};
