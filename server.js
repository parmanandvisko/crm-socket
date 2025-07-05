import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(express.json())
app.use(express.urlencoded({extended:true}))
const server = createServer(app);
const io = new Server(server, {
  
  cors: {
    origin: "http://192.168.1.40:3000",
  },
});

console.log("Server Connected");

// Socket connection
io.on("connection", (socket) => {
  console.log("User connecteddd:", socket.id);
  socket.emit("welcome", {
    socektId: socket.id,
    message: "Start your tracking",
  });

  socket.broadcast.emit("userInfotoAll", {
    message: `${socket.id} tracking`,
  });


 socket.on("startLocation", (data) => {
  console.log("starting location", data);
// const originalData = {
//   lt_user_id: data?.lt_user_id,
//   lt_name: data?.lt_name,
//   lt_start_desti: JSON.stringify(data?.lt_start_desti),
//   lt_end_desti: JSON.stringify(data?.lt_end_desti)
// };

// const payload = {
//   ...originalData,
//   socketId: socket.id
// };

// console.log(payload,"payload")

var start_desti= JSON.stringify(data?.lt_start_desti)
var end_desti=JSON.stringify(data?.lt_end_desti)

  // Example: Call your 'add data' API
  fetch('https://api.visko.group/api/crm/location/add-location', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    
    // body: JSON.stringify(payload),
    body: JSON.stringify({
  lt_user_id: data?.lt_user_id,
  lt_name: data?.lt_name,
  lt_start_desti:start_desti,
  lt_end_desti: end_desti,
  lt_current_location: JSON.stringify(data?.lt_current_location),
  lt_socket_id: socket.id
}),
  })
  .then(response => response.json())
  .then(result => console.log('API response:', result))
  .catch(error => console.error('Error calling API:', error));
});

  socket.on("locationUpdate", (loc) => {
    
    console.log("locationUpdatehh", loc);

    socket.emit("sendLocaton",loc)
  });

  // Socket disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id,);
  });
});

// Start server
server.listen(4000, () => {
  console.log("Server running at http://localhost:4000");
});
