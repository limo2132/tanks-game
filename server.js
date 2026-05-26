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
let nextExplosionId = 1;

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

function getStartingWalls() {
  return [
    // left base walls
    { x: 34, y: 92, width: 190, height: 24, health: 150, destroyed: false },
    { x: 34, y: 436, width: 190, height: 24, health: 150, destroyed: false },
    { x: 34, y: 92, width: 24, height: 368, health: 150, destroyed: false },
    { x: 200, y: 92, width: 24, height: 130, health: 150, destroyed: false },
    { x: 200, y: 330, width: 24, height: 130, health: 150, destroyed: false },

    // right base walls
    { x: 736, y: 92, width: 190, height: 24, health: 150, destroyed: false },
    { x: 736, y: 436, width: 190, height: 24, health: 150, destroyed: false },
    { x: 902, y: 92, width: 24, height: 368, health: 150, destroyed: false },
    { x: 736, y: 92, width: 24, height: 130, health: 150, destroyed: false },
    { x: 736, y: 330, width: 24, height: 130, health: 150, destroyed: false }
  ];
}

function getStartingFlags() {
  return [
    {
      owner: 1,
      x: 111,
      y: 276,
      status: "atBase",
      carrierId: null
    },
    {
      owner: 2,
      x: 849,
      y: 276,
      status: "atBase",
      carrierId: null
    }
  ];
}
function getFlagBasePosition(owner) {
  if (owner === 1) {
    return {
      x: 111,
      y: 276
    };
  }

  return {
    x: 849,
    y: 276
  };
}

function getStartingHeadquarters() {
  return [
    {
      owner: 1,
      x: 82,
      y: 238,
      width: 58,
      height: 76,
      health: 250,
      destroyed: false
    },
    {
      owner: 2,
      x: 820,
      y: 238,
      width: 58,
      height: 76,
      health: 250,
      destroyed: false
    }
  ];
}

function getStartingGates() {
  return [
    {
      x: 200,
      y: 222,
      width: 24,
      height: 108,
      owner: 1,
      health: 100,
      destroyed: false
    },
    {
      x: 736,
      y: 222,
      width: 24,
      height: 108,
      owner: 2,
      health: 100,
      destroyed: false
    }
  ];
}

function addExplosion(room, x, y, size) {
  room.explosions.push({
    id: nextExplosionId,
    x,
    y,
    size,
    createdAt: Date.now()
  });

  nextExplosionId += 1;
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
bullets: room.bullets,
gates: room.gates,
walls: room.walls,
headquarters: room.headquarters,
flags: room.flags,
explosions: room.explosions
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
bullets: [],
gates: getStartingGates(),
walls: getStartingWalls(),
headquarters: getStartingHeadquarters(),
flags: getStartingFlags(),
explosions: []
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
	
	room.flags.forEach((flag) => {
  if (flag.status !== "carried") {
    return;
  }

  const carrier = room.players.find((player) => player.id === flag.carrierId);

  if (!carrier) {
    return;
  }

  flag.x = carrier.tank.x + 19;
  flag.y = carrier.tank.y - 12;
});

room.players.forEach((player) => {
  if (player.respawnAt) {
    return;
  }

  const playerBox = tankBox(player.tank);

  room.flags.forEach((flag) => {
    const flagBox = {
      x: flag.x - 8,
      y: flag.y - 8,
      width: 16,
      height: 16
    };

    if (!rectanglesOverlap(playerBox, flagBox)) {
      return;
    }

    const isOwnFlag = flag.owner === player.playerNumber;

    if (isOwnFlag && flag.status === "dropped") {
      const basePosition = getFlagBasePosition(flag.owner);

      flag.status = "atBase";
      flag.carrierId = null;
      flag.x = basePosition.x;
      flag.y = basePosition.y;
      return;
    }

    if (!isOwnFlag && (flag.status === "atBase" || flag.status === "dropped")) {
      flag.status = "carried";
      flag.carrierId = player.id;
    }
  });
});
	
room.players.forEach((player) => {
  if (player.respawnAt && now >= player.respawnAt) {
    player.health = 200;
    player.respawnAt = null;
    player.tank = getSpawnForPlayer(player.playerNumber);
  }
});

room.explosions = room.explosions.filter((explosion) => {
  return now - explosion.createdAt < 700;
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

const hitWall = room.walls.find((wall) => {
  if (wall.destroyed) {
    return false;
  }

  return rectanglesOverlap(bulletBox(nextBullet), wall);
});

if (hitWall) {
  hitWall.health -= 17;
  addExplosion(room, nextBullet.x, nextBullet.y, 18);

  if (hitWall.health <= 0) {
    hitWall.health = 0;
    hitWall.destroyed = true;
    addExplosion(room, hitWall.x + hitWall.width / 2, hitWall.y + hitWall.height / 2, 42);
  }

  return;
}

const hitHeadquarters = room.headquarters.find((hq) => {
  if (hq.destroyed) {
    return false;
  }

  return rectanglesOverlap(bulletBox(nextBullet), hq);
});

if (hitHeadquarters) {
  hitHeadquarters.health -= 17;
  addExplosion(room, nextBullet.x, nextBullet.y, 18);

  if (hitHeadquarters.health <= 0) {
    hitHeadquarters.health = 0;
    hitHeadquarters.destroyed = true;
    addExplosion(
      room,
      hitHeadquarters.x + hitHeadquarters.width / 2,
      hitHeadquarters.y + hitHeadquarters.height / 2,
      58
    );
  }

  return;
}

const hitGate = room.gates.find((gate) => {
  if (gate.destroyed) {
    return false;
  }

  return rectanglesOverlap(bulletBox(nextBullet), gate);
});

if (hitGate) {
  hitGate.health -= 17;
  addExplosion(room, nextBullet.x, nextBullet.y, 18);

  if (hitGate.health <= 0) {
    hitGate.health = 0;
    hitGate.destroyed = true;
    addExplosion(room, hitGate.x + hitGate.width / 2, hitGate.y + hitGate.height / 2, 42);
  }

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
  addExplosion(room, nextBullet.x, nextBullet.y, 18);

if (hitPlayer.health <= 0) {
  hitPlayer.health = 0;
  addExplosion(room, hitPlayer.tank.x + 19, hitPlayer.tank.y + 14, 54);

  room.flags.forEach((flag) => {
    if (flag.carrierId === hitPlayer.id) {
      flag.status = "dropped";
      flag.carrierId = null;
      flag.x = hitPlayer.tank.x + 19;
      flag.y = hitPlayer.tank.y + 14;
    }
  });

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