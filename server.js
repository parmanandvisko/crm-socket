import express from "express";
import fs from "fs";
import db from "./src/config/dbconnect.js";
// import http from "http";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { userRoutes } from "./src/routes/UserRoutes.js";
import dotenv from "dotenv";

dotenv.config();
const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
   pingTimeout: 20000,   
  pingInterval: 10000,  
});

app.use("/api/user/", userRoutes);

const users = {}; // username: socketId

io.on("connection", (socket) => {
  console.log("socket connected",socket.id);
  

   // JOIN USER
  socket.on("join", ({ lt_user_id, lt_name ,task_id}) => {
    console.log("Active Users:", users);

    users[lt_user_id] = {
      socketId: socket.id,
      lt_name,
      lt_latitude: null,
      lt_longitude: null,
      lastUpdated: null,
    };
    

  //  join task room for comment
  if (task_id) {
    socket.join(`task_${task_id}`);
    console.log(`${lt_name} joined task_${task_id}`);
  }

    console.log("Active Users:", users);
    io.emit("online-users", Object.values(users)); 
    
  });

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

  // broadcast location update to all dashboards
        io.emit("user-location", {
          lt_user_id,
          lt_name,
          lt_latitude,
          lt_longitude,
          lt_app_time,
          lt_isInternetOn_Off,
          lt_locationOn_off,
          lt_location_permission,  
        });
  });
 
  socket.on("send-notification", (data) => {
    const { e_id, notification_message, isBroadcast ,redirect } = data;
    console.log(" Notification event received:", data);

// Broadcast sabhi ko jo jo connect he users
    if (isBroadcast) {
    io.emit("receive-notification", {
      message: notification_message,
      from: "Management Team1",
      redirect:redirect,
      time: new Date(),
    });
    console.log("Broadcast sabhi ko chala jaega");
  }else{
//  specific user message 
    const targetUser = users[e_id];
    if (targetUser && targetUser.socketId) {
      io.to(targetUser.socketId).emit("receive-notification", {
        message: notification_message,
        from: socket.id,
        time: new Date(),
      });
      console.log(`Notification sent to user ${e_id}`);
    } else {
      console.log(` User ${e_id} not connected`);
    }
  }
  });


  //======================SEND MESSAGE ON TASK==============START

//======================SEND COMMENT ON TASK======================START



//======================SEND COMMENT ON TASK========================END


socket.on("send-comment", (data) => {
  console.log(data,"123456789")
  const { task_id, tc_comment, e_id } = data;

  // send to everyone in task room (including sender)
  io.to(`task_${task_id}`).emit("receive-comment", {
    task_id,
    message: tc_comment,
    from: e_id,
    time: new Date(),
  });

  // console.log(`Comment sent to task_${task_id}`);
});



  //======================SEND MESSAGE ON TASK==============END




  socket.on("disconnect", () => {
    for (const [user_id, userObj] of Object.entries(users)) {
      if (userObj.socketId === socket.id) {
        delete users[user_id];
        break;
      }
    }
      io.emit("online-users", Object.values(users));
  });
  });

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});




















//============================================================================================================================================

// import express from "express";
// import db from "./src/config/dbconnect.js";
// import http from "http";
// import cors from "cors";
// import { Server } from "socket.io";
// import { userRoutes } from "./src/routes/UserRoutes.js";
// import dotenv from "dotenv";

// dotenv.config();
// const PORT = process.env.PORT || 5000;

// const app = express();
// app.use(cors());
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: "*", // allow all, change in prod to specific domain(s)
//     methods: ["GET", "POST"],
//   },
// });

// app.use("/api/user/", userRoutes);

// // cache of active users
// const users = {};
// // buffer for batching location inserts
// let locationBuffer = [];

// io.on("connection", (socket) => {
//   console.log("Socket connected:", socket.id);

//   // JOIN USER
//   socket.on("join", ({ lt_user_id, lt_name }) => {
//     users[lt_user_id] = {
//       socketId: socket.id,
//       lt_name,
//       lt_latitude: null,
//       lt_longitude: null,
//       lastUpdated: null,
//     };

//     console.log("Active Users:", Object.keys(users));
//     io.emit("online-users", Object.values(users));
//   });

//   // LOCATION UPDATE (buffered inserts)
//   socket.on("location-update", (data, ack) => {
//     const {
//       lt_user_id,
//       lt_name,
//       lt_latitude,
//       lt_longitude,
//       lt_app_time,
//       lt_isInternetOn_Off,
//       lt_locationOn_off,
//       lt_location_permission,
//     } = data;

//     // Push into buffer for later DB insert
//     locationBuffer.push({
//       lt_user_id,
//       lt_name,
//       lt_latitude,
//       lt_longitude,
//       lt_app_time,
//       lt_isInternetOn_Off,
//       lt_locationOn_off,
//       lt_location_permission,
//     });

//     // Update in-memory cache for live tracking
//     if (users[lt_user_id]) {
//       users[lt_user_id].lt_latitude = lt_latitude;
//       users[lt_user_id].lt_longitude = lt_longitude;
//       users[lt_user_id].lastUpdated = Date.now();
//     }

//     // Acknowledge back to sender
//     if (ack) {
//       ack({
//         status: "success",
//         message: "Location queued for DB insert",
//         userId: lt_user_id,
//         lat: lt_latitude,
//         lng: lt_longitude,
//       });
//     }

//     // Broadcast instantly to all dashboards
//     io.emit("user-location", data);
//   });

//   // DISCONNECT USER
//   socket.on("disconnect", () => {
//     for (const [user_id, userObj] of Object.entries(users)) {
//       if (userObj.socketId === socket.id) {
//         delete users[user_id];
//         break;
//       }
//     }
//     io.emit("online-users", Object.values(users));
//     console.log("Socket disconnected:", socket.id);
//   });
// });

// // 🔹 Batch insert every 5 seconds
// setInterval(() => {
//   if (locationBuffer.length === 0) return;

//   // const sql = `
//   //   INSERT INTO location_tracker 
//   //   (lt_user_id, lt_name, lt_latitude, lt_longitude, lt_app_time, lt_isInternetOn_Off, lt_locationOn_off, lt_location_permission) 
//   //   VALUES ?
//   // `;

//   const values = locationBuffer.map((d) => [
//     d.lt_user_id,
//     d.lt_name,
//     d.lt_latitude,
//     d.lt_longitude,
//     d.lt_app_time,
//     d.lt_isInternetOn_Off,
//     d.lt_locationOn_off,
//     d.lt_location_permission,
//   ]);

//   // db.query(sql, [values], (err) => {
//   //   if (err) {
//   //     console.error("Batch DB Insert Error:", err);
//   //   } else {
//   //     console.log(`Inserted ${values.length} location records`);
//   //   }
//   // });

//   // clear buffer after insert
//   locationBuffer = [];
// }, 5000);

// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });















// import express from "express";
// import http from "http";
// import cors from "cors";
// import dotenv from "dotenv";
// import db from "./src/config/dbconnect.js";
// import { userRoutes } from "./src/routes/UserRoutes.js";
// import { initializeSocket } from "./src/sockets/index.js";

// dotenv.config();
// const PORT = process.env.PORT || 5000;

// const app = express();
// app.use(cors());
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());
// app.use("/api/user/", userRoutes);

// const server = http.createServer(app);

// //  Initialize socket system
// initializeSocket(server);

// server.listen(PORT, () => {
//   console.log(` Server running on port ${PORT}`);
// });

