const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const rooms = {};

const level = {
  world: {
    width: 2400,
    height: 1200
  },

  road: {
    x: 0,
    y: 560,
    width: 2400,
    height: 96
  },

  spawns: {
    blue: {
      x: 170,
      y: 610,
      angle: 0
    },

    red: {
      x: 2192,
      y: 610,
      angle: Math.PI
    }
  },

  flags: {
    blue: {
      x: 485,
      y: 500
    },

    red: {
      x: 1915,
      y: 500
    }
  },

  hqs: [
    {
      owner: 1,
      x: 140,
      y: 700,
      width: 78,
      height: 86
    },

    {
      owner: 2,
      x: 2182,
      y: 700,
      width: 78,
      height: 86
    }
  ],
      gates: [
    {
      owner: 1,
      x: 572,
      y: 552,
      width: 28,
      height: 112
    },

    {
      owner: 2,
      x: 1800,
      y: 552,
      width: 28,
      height: 112
    }
  ],

  walls: [
    // left outer walls
    { x: 80, y: 250, width: 520, height: 28 },
    { x: 80, y: 842, width: 520, height: 28 },
    { x: 80, y: 250, width: 28, height: 620 },
    { x: 572, y: 250, width: 28, height: 302 },
    { x: 572, y: 664, width: 28, height: 206 },

    // left flag room
    { x: 405, y: 445, width: 150, height: 24 },
    { x: 405, y: 535, width: 150, height: 24 },
    { x: 405, y: 445, width: 24, height: 114 },
    { x: 531, y: 445, width: 24, height: 48 },
    { x: 531, y: 511, width: 24, height: 48 },

    // left rear divider walls, do not block central lane
    { x: 130, y: 660, width: 220, height: 24 },
    { x: 360, y: 660, width: 24, height: 120 },

    // right outer walls
    { x: 1800, y: 250, width: 520, height: 28 },
    { x: 1800, y: 842, width: 520, height: 28 },
    { x: 2292, y: 250, width: 28, height: 620 },
    { x: 1800, y: 250, width: 28, height: 302 },
    { x: 1800, y: 664, width: 28, height: 206 },

    // right flag room
    { x: 1845, y: 445, width: 150, height: 24 },
    { x: 1845, y: 535, width: 150, height: 24 },
    { x: 1971, y: 445, width: 24, height: 114 },
    { x: 1845, y: 445, width: 24, height: 48 },
    { x: 1845, y: 511, width: 24, height: 48 },

    // right rear divider walls, do not block central lane
    { x: 2050, y: 660, width: 220, height: 24 },
    { x: 2016, y: 660, width: 24, height: 120 }
  ]
};

const WORLD_WIDTH = level.world.width;
const WORLD_HEIGHT = level.world.height;

let nextBulletId = 1;
let nextExplosionId = 1;
let nextMineId = 1;

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
  return level.walls.map((wall) => ({
    ...wall,
    health: 150,
    destroyed: false
  }));
}

function getStartingFlags() {
  return [
    {
      owner: 1,
      x: level.flags.blue.x,
      y: level.flags.blue.y,
      status: "atBase",
      carrierId: null
    },
    {
      owner: 2,
      x: level.flags.red.x,
      y: level.flags.red.y,
      status: "atBase",
      carrierId: null
    }
  ];
}

function getFlagBasePosition(owner) {
  if (owner === 1) {
    return {
      x: level.flags.blue.x,
      y: level.flags.blue.y
    };
  }

  return {
    x: level.flags.red.x,
    y: level.flags.red.y
  };
}

function getStartingHeadquarters() {
  return level.hqs.map((hq) => ({
    ...hq,
    health: 250,
    destroyed: false
  }));
}

function getStartingGates() {
  return level.gates.map((gate) => ({
    ...gate,
    health: 100,
    destroyed: false
  }));
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
      x: level.spawns.blue.x,
      y: level.spawns.blue.y,
      angle: level.spawns.blue.angle
    };
  }

  return {
    x: level.spawns.red.x,
    y: level.spawns.red.y,
    angle: level.spawns.red.angle
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
mines: room.mines,
gates: room.gates,
walls: room.walls,
headquarters: room.headquarters,
flags: room.flags,
scores: room.scores,
winner: room.winner,
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
	  tank: getSpawnForPlayer(1)
    }
  ],
bullets: [],
mines: [],
gates: getStartingGates(),
walls: getStartingWalls(),
headquarters: getStartingHeadquarters(),
flags: getStartingFlags(),
scores: {
  1: 0,
  2: 0
},
winner: null,
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
  tank: getSpawnForPlayer(2)
});

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    io.to(roomCode).emit("bothPlayersJoined", roomCode);
    io.to(roomCode).emit("roomState", getRoomState(roomCode));
  });

socket.on("placeMine", () => {
  const roomCode = socket.data.roomCode;
  const room = rooms[roomCode];

  if (!room) {
    return;
  }

  const player = room.players.find((player) => player.id === socket.id);

  if (!player || !player.tank || player.respawnAt) {
    return;
  }

  const activePlayerMines = room.mines.filter((mine) => {
    return mine.ownerId === socket.id;
  });

  if (activePlayerMines.length >= 3) {
    return;
  }

  room.mines.push({
    id: nextMineId,
    ownerId: socket.id,
    x: player.tank.x + 19 - Math.cos(player.tank.angle) * 34,
    y: player.tank.y + 14 - Math.sin(player.tank.angle) * 34,
    armedAt: Date.now() + 1000,
    createdAt: Date.now()
  });

  nextMineId += 1;

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

  if (!player || player.respawnAt) {
    return;
  }

  player.tank = {
    x: tank.x,
    y: tank.y,
    angle: tank.angle
  };

  io.to(roomCode).emit("roomState", getRoomState(roomCode));
});

socket.on("rematch", () => {
  const roomCode = socket.data.roomCode;
  const room = rooms[roomCode];

  if (!room) {
    return;
  }

  room.players.forEach((player) => {
    player.health = 200;
    player.respawnAt = null;
    player.ready = true;
    player.tank = getSpawnForPlayer(player.playerNumber);
  });

  room.bullets = [];
  room.gates = getStartingGates();
  room.walls = getStartingWalls();
  room.headquarters = getStartingHeadquarters();
  room.flags = getStartingFlags();
  room.scores = {
    1: 0,
    2: 0
  };
  room.winner = null;
  room.explosions = [];

  io.to(roomCode).emit("roomState", getRoomState(roomCode));
  io.to(roomCode).emit("gameStarting");
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
  if (player.respawnAt || room.winner) {
    return;
  }

  const carriedEnemyFlag = room.flags.find((flag) => {
    return flag.carrierId === player.id && flag.owner !== player.playerNumber;
  });

  if (!carriedEnemyFlag) {
    return;
  }

  const ownFlag = room.flags.find((flag) => flag.owner === player.playerNumber);

  if (!ownFlag || ownFlag.status !== "atBase") {
    return;
  }

  const ownFlagBase = getFlagBasePosition(player.playerNumber);

const ownCaptureZone = {
  x: ownFlagBase.x - 18,
  y: ownFlagBase.y - 18,
  width: 36,
  height: 36
};

const playerBox = tankBox(player.tank);

if (!rectanglesOverlap(playerBox, ownCaptureZone)) {
  return;
}

  room.scores[player.playerNumber] += 1;

  const enemyFlagBase = getFlagBasePosition(carriedEnemyFlag.owner);
  carriedEnemyFlag.status = "atBase";
  carriedEnemyFlag.carrierId = null;
  carriedEnemyFlag.x = enemyFlagBase.x;
  carriedEnemyFlag.y = enemyFlagBase.y;

  addExplosion(room, ownFlagBase.x, ownFlagBase.y, 42);

  if (room.scores[player.playerNumber] >= 3) {
    room.winner = player.playerNumber;
  }
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

const remainingMines = [];

room.mines.forEach((mine) => {
  const isArmed = now >= mine.armedAt;
  const isExpired = now - mine.createdAt > 30000;

  if (isExpired) {
    return;
  }

  if (!isArmed) {
    remainingMines.push(mine);
    return;
  }

  const mineBox = {
    x: mine.x - 14,
    y: mine.y - 14,
    width: 28,
    height: 28
  };

  const hitPlayer = room.players.find((player) => {
    if (player.id === mine.ownerId) {
      return false;
    }

    if (player.respawnAt) {
      return false;
    }

    return rectanglesOverlap(mineBox, tankBox(player.tank));
  });

  if (hitPlayer) {
    hitPlayer.health -= 70;
    addExplosion(room, mine.x, mine.y, 62);

    if (hitPlayer.health <= 0) {
      hitPlayer.health = 0;

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

  remainingMines.push(mine);
});

room.mines = remainingMines;

const nextBullets = [];

room.bullets.forEach((bullet) => {
  const nextBullet = {
    ...bullet,
    x: bullet.x + Math.cos(bullet.angle) * 16,
    y: bullet.y + Math.sin(bullet.angle) * 16
  };

  const isInBounds =
nextBullet.x >= 0 &&
nextBullet.x <= WORLD_WIDTH &&
nextBullet.y >= 0 &&
nextBullet.y <= WORLD_HEIGHT;

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