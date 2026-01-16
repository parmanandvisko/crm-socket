import { users } from "../utils/users.js";

export const handleLocationSocket = (io, socket) => {
  socket.on("location-update", (data) => {
    const {
      lt_user_id,
      lt_name,
      lt_latitude,
      lt_longitude,
      lt_app_time,
      lt_isInternetOn_Off,
      lt_locationOn_off,
      lt_location_permission,
    } = data;

    // Update user coordinates if user exists
    if (users[lt_user_id]) {
      users[lt_user_id].lt_latitude = lt_latitude;
      users[lt_user_id].lt_longitude = lt_longitude;
      users[lt_user_id].lastUpdated = Date.now();
    }

    // Broadcast updated location to all dashboards
    io.emit("user-location", data);
  });
};
