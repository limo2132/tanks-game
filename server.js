const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const rooms = {};

function makeRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function getRoomState(roomCode) {
  const room = rooms[roomCode];

  return {
    roomCode,
    players: room.players.map((player) => ({
      id: player.id,
      ready: player.ready
    }))
  };
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("createRoom", () => {
    let roomCode = makeRoomCode();

    while (rooms[roomCode]) {
      roomCode = makeRoomCode();
    }

    rooms[roomCode] = {
      players: [
        {
          id: socket.id,
          ready: false
        }
      ]
    };

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit("roomCreated", roomCode);
    io.to(roomCode).emit("roomState", getRoomState(roomCode));
  });

  socket.on("joinRoom", (roomCode) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];

    if (!room) {
      socket.emit("joinError", "Room does not exist");
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("joinError", "Room is full");
      return;
    }

    room.players.push({
      id: socket.id,
      ready: false
    });

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    io.to(roomCode).emit("bothPlayersJoined", roomCode);
    io.to(roomCode).emit("roomState", getRoomState(roomCode));
  });

  socket.on("toggleReady", () => {
    const roomCode = socket.data.roomCode;
    const room = rooms[roomCode];

    if (!room) {
      return;
    }

    const player = room.players.find((player) => player.id === socket.id);

    if (!player) {
      return;
    }

    player.ready = !player.ready;

    io.to(roomCode).emit("roomState", getRoomState(roomCode));

    const bothPlayersReady =
      room.players.length === 2 && room.players.every((player) => player.ready);

    if (bothPlayersReady) {
      io.to(roomCode).emit("gameStarting");
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    const roomCode = socket.data.roomCode;
    const room = rooms[roomCode];

    if (!room) {
      return;
    }

    room.players = room.players.filter((player) => player.id !== socket.id);

    if (room.players.length === 0) {
      delete rooms[roomCode];
      return;
    }

    io.to(roomCode).emit("roomState", getRoomState(roomCode));
  });
});

server.listen(PORT, () => {
  console.log(`Tanks game server running on port ${PORT}`);
});