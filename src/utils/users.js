// Map of connected users
export const users = {};

// Helper to add or update user
export const addUser = (userId, socketId, lt_name) => {
  users[userId] = {
    socketId,
    lt_name,
    lt_latitude: null,
    lt_longitude: null,
    lastUpdated: null,
  };
};

// Helper to remove user on disconnect
export const removeUser = (socketId) => {
  for (const [userId, user] of Object.entries(users)) {
    if (user.socketId === socketId) {
      delete users[userId];
      return userId;
    }
  }
  return null;
};

// Get socket ID by userId
export const getUserSocket = (userId) => {
  return users[userId]?.socketId || null;
};
