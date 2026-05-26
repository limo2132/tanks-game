const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const rooms = {};
let nextBulletId = 1;

function makeRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function tankBox(tank) {
  return {
    x: tank.x,
    y: tank.y,
    width: 38,
    height: 28
  };
}

function bulletBox(bullet) {
  return {
    x: bullet.x - 5,
    y: bullet.y - 5,
    width: 10,
    height: 10
  };
}

function rectanglesOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function getSpawnForPlayer(playerNumber) {
  if (playerNumber === 1) {
    return {
      x: 250,
      y: 276,
      angle: 0
    };
  }

  return {
    x: 672,
    y: 276,
    angle: Math.PI
  };
}

function getRoomState(roomCode) {
  const room = rooms[roomCode];

  return {
    roomCode,
players: room.players.map((player) => ({
  id: player.id,
  playerNumber: player.playerNumber,
  ready: player.ready,
  health: player.health,
  respawnAt: player.respawnAt,
  tank: player.tank
})),
    bullets: room.bullets
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
  playerNumber: 1,
  ready: false,
  health: 200,
  respawnAt: null,
  tank: {
    x: 250,
    y: 276,
    angle: 0
  }
}
  ],
  bullets: []
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
  playerNumber: 2,
  ready: false,
  health: 200,
  respawnAt: null,
  tank: {
    x: 672,
    y: 276,
    angle: Math.PI
  }
});

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    io.to(roomCode).emit("bothPlayersJoined", roomCode);
    io.to(roomCode).emit("roomState", getRoomState(roomCode));
  });

socket.on("shoot", () => {
  const roomCode = socket.data.roomCode;
  const room = rooms[roomCode];

  if (!room) {
    return;
  }

  const player = room.players.find((player) => player.id === socket.id);

  if (!player || !player.tank) {
    return;
  }

  room.bullets.push({
    id: nextBulletId,
    ownerId: socket.id,
    x: player.tank.x + 19,
    y: player.tank.y + 14,
    angle: player.tank.angle,
    createdAt: Date.now()
  });

  nextBulletId += 1;

  io.to(roomCode).emit("roomState", getRoomState(roomCode));
});
socket.on("tankUpdate", (tank) => {
  const roomCode = socket.data.roomCode;
  const room = rooms[roomCode];

  if (!room) {
    return;
  }

  const player = room.players.find((player) => player.id === socket.id);

  if (!player) {
    return;
  }

  player.tank = {
    x: tank.x,
    y: tank.y,
    angle: tank.angle
  };

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

setInterval(() => {
  const now = Date.now();

  Object.keys(rooms).forEach((roomCode) => {
    const room = rooms[roomCode];
	
room.players.forEach((player) => {
  if (player.respawnAt && now >= player.respawnAt) {
    player.health = 200;
    player.respawnAt = null;
    player.tank = getSpawnForPlayer(player.playerNumber);
  }
});

const nextBullets = [];

room.bullets.forEach((bullet) => {
  const nextBullet = {
    ...bullet,
    x: bullet.x + Math.cos(bullet.angle) * 16,
    y: bullet.y + Math.sin(bullet.angle) * 16
  };

  const isInBounds =
    nextBullet.x >= 0 &&
    nextBullet.x <= 960 &&
    nextBullet.y >= 0 &&
    nextBullet.y <= 552;

  const isNotTooOld = now - nextBullet.createdAt < 1000;

  if (!isInBounds || !isNotTooOld) {
    return;
  }

  const hitPlayer = room.players.find((player) => {
    if (player.id === nextBullet.ownerId) {
      return false;
    }

    if (player.respawnAt) {
      return false;
    }

    return rectanglesOverlap(bulletBox(nextBullet), tankBox(player.tank));
  });

  if (hitPlayer) {
    hitPlayer.health -= 17;

    if (hitPlayer.health <= 0) {
      hitPlayer.health = 0;
      hitPlayer.respawnAt = now + 3000;
      hitPlayer.tank = getSpawnForPlayer(hitPlayer.playerNumber);
    }

    return;
  }

  nextBullets.push(nextBullet);
});

room.bullets = nextBullets;

    io.to(roomCode).emit("roomState", getRoomState(roomCode));
  });
}, 33);

server.listen(PORT, () => {
  console.log(`Tanks game server running on port ${PORT}`);
});