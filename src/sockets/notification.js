import { users, getUserSocket } from "../utils/users.js";

export const handleNotificationSocket = (io, socket) => {
  socket.on("send-notification", (data) => {
    const { e_id, notification_message, isBroadcast, redirect } = data;
    console.log(" Notification event received:", data);

    if (isBroadcast) {
      // Broadcast to all connected users
      io.emit("receive-notification", {
        message: notification_message,
        redirect,
        from: "Management Team",
        time: new Date(),
      });
      console.log(" Broadcast sent to all connected users");
    } else {
      // Send to specific user
      const targetSocketId = getUserSocket(e_id);
      if (targetSocketId) {
        io.to(targetSocketId).emit("receive-notification", {
          message: notification_message,
          from: "Server",
          time: new Date(),
        });
        console.log(` Notification sent to user ${e_id}`);
      } else {
        console.log(` User ${e_id} not connected`);
      }
    }
  });
};
