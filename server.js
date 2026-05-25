const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("createRoom", () => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    socket.join(roomCode);
    socket.emit("roomCreated", roomCode);
  });

  socket.on("joinRoom", (roomCode) => {
    const room = io.sockets.adapter.rooms.get(roomCode);

    if (!room) {
      socket.emit("joinError", "Room does not exist");
      return;
    }

    if (room.size >= 2) {
      socket.emit("joinError", "Room is full");
      return;
    }

    socket.join(roomCode);
    io.to(roomCode).emit("bothPlayersJoined", roomCode);
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Tanks game server running on port ${PORT}`);
});