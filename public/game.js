const socket = io();

const createRoomButton = document.getElementById("createRoomButton");
const lobbyActions = document.getElementById("lobbyActions");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomCodeInput = document.getElementById("roomCodeInput");
const statusText = document.getElementById("statusText");
const roomPanel = document.getElementById("roomPanel");
const roomCodeText = document.getElementById("roomCodeText");
const playersList = document.getElementById("playersList");
const readyButton = document.getElementById("readyButton");
const backButton = document.getElementById("backButton");
const copyRoomCodeButton = document.getElementById("copyRoomCodeButton");
const lobbyScreen = document.getElementById("lobbyScreen");
const gameScreen = document.getElementById("gameScreen");
const gameRoomText = document.getElementById("gameRoomText");
const healthText = document.getElementById("healthText");
const scoreText = document.getElementById("scoreText");
const winnerBanner = document.getElementById("winnerBanner");
const winnerText = document.getElementById("winnerText");
const rematchButton = document.getElementById("rematchButton");

let currentRoomCode = null;
let isReady = false;
let myPlayerNumber = null;
let latestRoomState = null;
let lastTankSendTime = 0;
let lastShotTime = 0;
let lastMineTime = 0;
let wasRespawning = false;

const smoothedTanks = {};

const keys = {};
let animationFrameId = null;

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

  baseFloors: [
    {
      owner: 1,
      x: 80,
      y: 250,
      width: 520,
      height: 620
    },

    {
      owner: 2,
      x: 1800,
      y: 250,
      width: 520,
      height: 620
	}
	],

flags: {
  blue: {
    x: 260,
    y: 500
  },

  red: {
    x: 2140,
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
]
};

const world = level.world;

const camera = {
  x: 0,
  y: 0
};

const localTank = {
  x: level.spawns.blue.x,
  y: level.spawns.blue.y,
  angle: level.spawns.blue.angle,
  speed: 2.5,
  roadSpeed: 2.75,
  turnSpeed: 0.05
};

const collisionBlocks = [
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
];

const gateBlocks = [
  {
    x: 572,
    y: 552,
    width: 28,
    height: 112,
    owner: 1,
    health: 100
  },
  {
    x: 1800,
    y: 552,
    width: 28,
    height: 112,
    owner: 2,
    health: 100
  }
];

const baseBuildings = [
  // left base, upper supply area
  { type: "ammo", owner: 1, x: 140, y: 330, width: 58, height: 38 },
  { type: "ammo", owner: 1, x: 250, y: 330, width: 58, height: 38 },
  { type: "fuel", owner: 1, x: 430, y: 330, width: 50, height: 58 },
  { type: "fuel", owner: 1, x: 500, y: 330, width: 50, height: 58 },

  // left base, lower support area
  { type: "hospital", owner: 1, x: 250, y: 710, width: 82, height: 50 },
  { type: "helipad", owner: 1, x: 400, y: 710, width: 92, height: 70 },
  { type: "ammo", owner: 1, x: 500, y: 730, width: 58, height: 38 },

  // left base turret positions
  { type: "turret", owner: 1, x: 552, y: 292, width: 32, height: 32 },
  { type: "turret", owner: 1, x: 552, y: 805, width: 32, height: 32 },
  { type: "turret", owner: 1, x: 432, y: 475, width: 32, height: 32 },
  { type: "turret", owner: 1, x: 432, y: 590, width: 32, height: 32 },

  // right base, upper supply area
  { type: "ammo", owner: 2, x: 2202, y: 330, width: 58, height: 38 },
  { type: "ammo", owner: 2, x: 2092, y: 330, width: 58, height: 38 },
  { type: "fuel", owner: 2, x: 1920, y: 330, width: 50, height: 58 },
  { type: "fuel", owner: 2, x: 1850, y: 330, width: 50, height: 58 },

  // right base, lower support area
  { type: "hospital", owner: 2, x: 2068, y: 710, width: 82, height: 50 },
  { type: "helipad", owner: 2, x: 1908, y: 710, width: 92, height: 70 },
  { type: "ammo", owner: 2, x: 1842, y: 730, width: 58, height: 38 },

  // right base turret positions
  { type: "turret", owner: 2, x: 1816, y: 292, width: 32, height: 32 },
  { type: "turret", owner: 2, x: 1816, y: 805, width: 32, height: 32 },
  { type: "turret", owner: 2, x: 1936, y: 475, width: 32, height: 32 },
  { type: "turret", owner: 2, x: 1936, y: 590, width: 32, height: 32 }
];

function updateCamera(canvas) {
  camera.x = localTank.x + 19 - canvas.width / 2;
  camera.y = localTank.y + 14 - canvas.height / 2;

  camera.x = Math.max(0, Math.min(world.width - canvas.width, camera.x));
  camera.y = Math.max(0, Math.min(world.height - canvas.height, camera.y));
}

function toScreenX(worldX) {
  return worldX - camera.x;
}

function toScreenY(worldY) {
  return worldY - camera.y;
}

function setStartingTankPosition() {
  if (myPlayerNumber === 1) {
    localTank.x = 170;
    localTank.y = 610;
    localTank.angle = 0;
  }

  if (myPlayerNumber === 2) {
    localTank.x = 2192;
    localTank.y = 610;
    localTank.angle = Math.PI;
  }
}

function showRoomPanel(roomCode) {
  currentRoomCode = roomCode;
  lobbyActions.classList.add("hidden");
  roomPanel.classList.remove("hidden");
  roomCodeText.textContent = `Room code: ${roomCode}`;
}

function renderPlayers(players) {
  playersList.innerHTML = "";

  players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "player-row";

    const name = document.createElement("span");
    name.textContent = player.id === socket.id ? `You` : `Player ${index + 1}`;

    const ready = document.createElement("span");
    ready.className = player.ready ? "ready" : "not-ready";
    ready.textContent = player.ready ? "Ready" : "Not ready";

    row.appendChild(name);
    row.appendChild(ready);
    playersList.appendChild(row);
  });
}

createRoomButton.addEventListener("click", () => {
  socket.emit("createRoom");
  statusText.textContent = "Creating game...";
});

joinRoomButton.addEventListener("click", () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();

  if (!roomCode) {
    statusText.textContent = "Type a room code first.";
    return;
  }

  socket.emit("joinRoom", roomCode);
  statusText.textContent = "Joining game...";
});

readyButton.addEventListener("click", () => {
  socket.emit("toggleReady");
});

backButton.addEventListener("click", () => {
  window.location.reload();
});

rematchButton.addEventListener("click", () => {
  socket.emit("rematch");
});

copyRoomCodeButton.addEventListener("click", async () => {
  if (!currentRoomCode) {
    statusText.textContent = "No room code yet.";
    return;
  }

  try {
    await navigator.clipboard.writeText(currentRoomCode);
    statusText.textContent = "Room code copied!";
  } catch {
    statusText.textContent = `Room code: ${currentRoomCode}`;
  }
});

window.addEventListener("keydown", (event) => {
  keys[event.key.toLowerCase()] = true;

  if (event.code === "Space") {
    const now = Date.now();

    if (now - lastShotTime > 600) {
      socket.emit("shoot");
      lastShotTime = now;
    }
  }
  if (event.key === "Shift") {
  const now = Date.now();

  if (now - lastMineTime > 5000) {
    socket.emit("placeMine");
    lastMineTime = now;
  }
}
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

socket.on("roomCreated", (roomCode) => {
  isReady = false;
  readyButton.textContent = "Ready";
  showRoomPanel(roomCode);
  statusText.textContent = `Game created. Give this code to your friend: ${roomCode}`;
});

socket.on("bothPlayersJoined", (roomCode) => {
  showRoomPanel(roomCode);
  statusText.textContent = `Both players joined room ${roomCode}.`;
});

socket.on("roomState", (room) => {
  latestRoomState = room;
  showRoomPanel(room.roomCode);
  renderPlayers(room.players);

  const me = room.players.find((player) => player.id === socket.id);

if (me) {
  isReady = me.ready;
  myPlayerNumber = me.playerNumber;
  readyButton.textContent = isReady ? "Not Ready" : "Ready";

  if (wasRespawning && !me.respawnAt && me.tank) {
    localTank.x = me.tank.x;
    localTank.y = me.tank.y;
    localTank.angle = me.tank.angle;
  }

  wasRespawning = Boolean(me.respawnAt);

  if (healthText) {
    healthText.textContent = `Health ${me.health}/200`;
  }
}

if (room.scores && scoreText) {
  scoreText.textContent = `Blue ${room.scores[1]} - Red ${room.scores[2]}`;
}

if (winnerBanner && winnerText) {
  if (room.winner) {
    winnerText.textContent = room.winner === 1 ? "Blue wins!" : "Red wins!";
    winnerBanner.classList.remove("hidden");
  } else {
    winnerBanner.classList.add("hidden");
  }
}

  if (room.players.length < 2) {
    statusText.textContent = "Waiting for second player...";
  } else {
    statusText.textContent = "Both players joined. Press Ready.";
  }
});

socket.on("gameStarting", () => {
  statusText.textContent = "Both players ready. Game starting...";
  readyButton.disabled = true;

  setTimeout(() => {
    lobbyScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    gameRoomText.textContent = `Room ${currentRoomCode}`;
	setStartingTankPosition();
		
	if (!animationFrameId) {
	gameLoop();
	}
  }, 800);
});

function rectanglesOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function tankCollisionBox(x, y) {
  return {
    x,
    y,
    width: 38,
    height: 28
  };
}

function isOnRoad(x, y) {
  return (
    x + 19 >= level.road.x &&
    x + 19 <= level.road.x + level.road.width &&
    y + 14 >= level.road.y &&
    y + 14 <= level.road.y + level.road.height
  );
}

function hitsCollisionBlock(x, y) {
  const box = tankCollisionBox(x, y);

const currentWalls = latestRoomState?.walls || collisionBlocks;

const hitsWall = currentWalls.some((wall) => {
  return !wall.destroyed && rectanglesOverlap(box, wall);
});

const currentHeadquarters = latestRoomState?.headquarters || [];

const hitsHeadquarters = currentHeadquarters.some((hq) => {
  return !hq.destroyed && rectanglesOverlap(box, hq);
});

const currentGates = latestRoomState?.gates || gateBlocks;

const hitsEnemyGate = currentGates.some((gate) => {
  const isOwnGate = gate.owner === myPlayerNumber;

  return !gate.destroyed && !isOwnGate && rectanglesOverlap(box, gate);
});

const opponent = latestRoomState?.players.find((player) => {
  return player.playerNumber !== myPlayerNumber;
});

const hitsOpponent =
  opponent?.tank &&
  !opponent.respawnAt &&
  rectanglesOverlap(box, tankCollisionBox(opponent.tank.x, opponent.tank.y));

  return hitsWall || hitsHeadquarters || hitsEnemyGate || hitsOpponent;
}

socket.on("joinError", (message) => {
  statusText.textContent = message;
});

function drawBattlefield() {
  const canvas = document.getElementById("gameCanvas");

  if (!canvas) {
    return;
  }

const ctx = canvas.getContext("2d");

updateCamera(canvas);

ctx.clearRect(0, 0, canvas.width, canvas.height);

// grass
ctx.fillStyle = "#314022";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// road
ctx.fillStyle = "#5f5d54";
ctx.fillRect(
  toScreenX(level.road.x),
  toScreenY(level.road.y),
  level.road.width,
  level.road.height
);

ctx.fillStyle = "#d7b36a";
for (let x = level.road.x; x < level.road.x + level.road.width; x += 56) {
  ctx.fillRect(
    toScreenX(x + 18),
    toScreenY(level.road.y + 45),
    28,
    6
  );
}


// base floors
ctx.fillStyle = "#433326";
level.baseFloors.forEach((baseFloor) => {
  ctx.fillRect(
    toScreenX(baseFloor.x),
    toScreenY(baseFloor.y),
    baseFloor.width,
    baseFloor.height
  );
});


// base gates
const currentGates = latestRoomState?.gates || gateBlocks;

currentGates.forEach((gate) => {
  if (gate.destroyed) {
    return;
  }

  const x = toScreenX(gate.x);
  const y = toScreenY(gate.y);
  const isOwnGate = gate.owner === myPlayerNumber;
  const healthPercent = gate.health / 100;

  ctx.fillStyle = isOwnGate ? "#2f6f4e" : "#8b3f2f";
  ctx.fillRect(x, y, gate.width, gate.height);

  ctx.strokeStyle = isOwnGate ? "#77d09a" : "#d9973f";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, gate.width, gate.height);

  ctx.fillStyle = "#1b120d";
  ctx.fillRect(x - 8, y - 10, gate.width + 16, 5);

  ctx.fillStyle = "#ffd28a";
  ctx.fillRect(x - 8, y - 10, (gate.width + 16) * healthPercent, 5);
});

// base buildings
baseBuildings.forEach((building) => {
  drawBaseBuilding(ctx, building);
});

// headquarters
const currentHeadquarters = latestRoomState?.headquarters || [];

currentHeadquarters.forEach((hq) => {
  if (hq.destroyed) {
    return;
  }

  drawHeadquarters(ctx, hq);
});

// base walls
const currentWalls = latestRoomState?.walls || collisionBlocks;

currentWalls.forEach((wall) => {
  if (wall.destroyed) {
    return;
  }

  drawWall(ctx, wall);
});

if (latestRoomState?.mines) {
  latestRoomState.mines.forEach((mine) => {
    drawMine(ctx, mine);
  });
}

const playerOne = latestRoomState?.players.find((player) => player.playerNumber === 1);
const playerTwo = latestRoomState?.players.find((player) => player.playerNumber === 2);

if (myPlayerNumber === 1) {
  drawTank(ctx, localTank.x, localTank.y, localTank.angle, "#3f7fd9", playerOne?.health ?? 200);

  if (playerTwo?.tank && !playerTwo.respawnAt) {
    const smoothPlayerTwo = getSmoothedTank(playerTwo);
    drawTank(ctx, smoothPlayerTwo.x, smoothPlayerTwo.y, smoothPlayerTwo.angle, "#c95f4a", playerTwo.health);
  }
}

if (myPlayerNumber === 2) {
  if (playerOne?.tank && !playerOne.respawnAt) {
    const smoothPlayerOne = getSmoothedTank(playerOne);
    drawTank(ctx, smoothPlayerOne.x, smoothPlayerOne.y, smoothPlayerOne.angle, "#3f7fd9", playerOne.health);
  }

  drawTank(ctx, localTank.x, localTank.y, localTank.angle, "#c95f4a", playerTwo?.health ?? 200);
}


if (latestRoomState?.bullets) {
  latestRoomState.bullets.forEach((bullet) => {
    drawBullet(ctx, bullet.x, bullet.y);
  });
}

if (latestRoomState?.flags) {
  latestRoomState.flags.forEach((flag) => {
    drawFlag(ctx, flag);
  });
}

if (latestRoomState?.explosions) {
  latestRoomState.explosions.forEach((explosion) => {
    drawExplosion(ctx, explosion);
  });
}

  // splash
  ctx.fillStyle = "#ffd28a";
  ctx.font = "bold 34px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Player 1 vs Player 2", canvas.width / 2, 58);

  ctx.fillStyle = "#ffe2b5";
  ctx.font = "18px Arial";
  ctx.fillText("Capture the enemy flag", canvas.width / 2, 86);

  ctx.textAlign = "left";
}

function drawBaseBuilding(ctx, building) {
  const x = toScreenX(building.x);
  const y = toScreenY(building.y);

  if (building.type === "ammo") {
    ctx.fillStyle = "#5b5f6a";
  } else if (building.type === "fuel") {
    ctx.fillStyle = "#8b3f2f";
  } else if (building.type === "hospital") {
    ctx.fillStyle = "#f0e4cf";
  } else if (building.type === "helipad") {
    ctx.fillStyle = "#4f5f64";
  } else {
    ctx.fillStyle = "#2b2520";
  }

  ctx.fillRect(x, y, building.width, building.height);

  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, building.width, building.height);

  ctx.fillStyle = "#ffd28a";
  ctx.font = "bold 12px Arial";

  if (building.type === "ammo") {
    ctx.fillText("AM", x + 14, y + 22);
  }

  if (building.type === "fuel") {
    ctx.fillText("F", x + 17, y + 29);
  }

  if (building.type === "hospital") {
    ctx.fillStyle = "#d95745";
    ctx.fillRect(x + 30, y + 10, 10, 24);
    ctx.fillRect(x + 23, y + 17, 24, 10);
  }

  if (building.type === "helipad") {
    ctx.strokeStyle = "#ffd28a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + building.width / 2, y + building.height / 2, 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ffd28a";
    ctx.font = "bold 16px Arial";
    ctx.fillText("H", x + 30, y + 32);
  }

  if (building.type === "turret") {
    ctx.fillStyle = building.owner === 1 ? "#3f7fd9" : "#c95f4a";
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#1b120d";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#1b120d";
    ctx.fillRect(x + 12, y + 9, 18, 6);
  }
}

function drawHeadquarters(ctx, hq) {
  const x = toScreenX(hq.x);
  const y = toScreenY(hq.y);

  const bodyColor = hq.owner === 1 ? "#274f8f" : "#8b3f2f";
  const roofColor = hq.owner === 1 ? "#3f7fd9" : "#c95f4a";

  ctx.fillStyle = bodyColor;
  ctx.fillRect(x, y, hq.width, hq.height);

  ctx.fillStyle = roofColor;
  ctx.fillRect(x + 8, y + 8, hq.width - 16, 18);

  ctx.fillStyle = "#1b120d";
  ctx.fillRect(x + 20, y + hq.height - 22, hq.width - 40, 22);

  ctx.strokeStyle = "#ffd28a";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, hq.width, hq.height);

  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, y + 8, hq.width - 16, 18);

  if (hq.health < 250) {
    const healthPercent = hq.health / 250;

    ctx.fillStyle = "#1b120d";
    ctx.fillRect(x, y - 8, hq.width, 5);

    ctx.fillStyle = "#ffd28a";
    ctx.fillRect(x, y - 8, hq.width * healthPercent, 5);
  }

  if (hq.health < 160) {
    ctx.strokeStyle = "#1b120d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 8);
    ctx.lineTo(x + hq.width - 8, y + hq.height - 8);
    ctx.stroke();
  }

  if (hq.health < 80) {
    ctx.beginPath();
    ctx.moveTo(x + hq.width - 8, y + 10);
    ctx.lineTo(x + 10, y + hq.height - 8);
    ctx.stroke();
  }
}

function drawWall(ctx, wall) {
  const x = toScreenX(wall.x);
  const y = toScreenY(wall.y);

  ctx.fillStyle = "#6f5944";
  ctx.fillRect(x, y, wall.width, wall.height);

  ctx.strokeStyle = "#c98a42";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, wall.width, wall.height);

  ctx.strokeStyle = "#24150e";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 5, y + 5, wall.width - 10, wall.height - 10);

  if (wall.health < 150) {
    const healthPercent = wall.health / 150;

    ctx.fillStyle = "#1b120d";
    ctx.fillRect(x, y - 8, wall.width, 5);

    ctx.fillStyle = "#ffd28a";
    ctx.fillRect(x, y - 8, wall.width * healthPercent, 5);
  }

  if (wall.health < 100) {
    ctx.strokeStyle = "#24150e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 6);
    ctx.lineTo(x + wall.width - 8, y + wall.height - 8);
    ctx.stroke();
  }

  if (wall.health < 50) {
    ctx.beginPath();
    ctx.moveTo(x + wall.width - 8, y + 7);
    ctx.lineTo(x + 8, y + wall.height - 7);
    ctx.stroke();
  }
}

function getSmoothedTank(player) {
  const tank = player.tank;

  if (!smoothedTanks[player.id]) {
    smoothedTanks[player.id] = {
      x: tank.x,
      y: tank.y,
      angle: tank.angle
    };
  }

  const smoothed = smoothedTanks[player.id];

  smoothed.x += (tank.x - smoothed.x) * 0.25;
  smoothed.y += (tank.y - smoothed.y) * 0.25;
  smoothed.angle += (tank.angle - smoothed.angle) * 0.25;

  return {
    x: smoothed.x,
    y: smoothed.y,
    angle: smoothed.angle
  };
}

function drawTank(ctx, x, y, angle, color, health) {
  const screenX = toScreenX(x);
  const screenY = toScreenY(y);

  ctx.save();
  ctx.translate(screenX + 19, screenY + 14);
  ctx.rotate(angle);

  ctx.fillStyle = color;
  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 3;

  ctx.fillRect(-19, -14, 38, 28);
  ctx.strokeRect(-19, -14, 38, 28);

  ctx.fillStyle = "#1b120d";
  ctx.fillRect(8, -3, 28, 6);

  ctx.restore();

  const healthPercent = Math.max(0, health) / 200;
  const barWidth = 42;
  const filledWidth = barWidth * healthPercent;

  ctx.fillStyle = "#1b120d";
  ctx.fillRect(screenX - 2, screenY - 12, barWidth, 6);

  if (health > 140) {
    ctx.fillStyle = "#7bd86f";
  } else if (health > 70) {
    ctx.fillStyle = "#ffd28a";
  } else {
    ctx.fillStyle = "#d95745";
  }

  ctx.fillRect(screenX - 2, screenY - 12, filledWidth, 6);
}

function updateLocalTank() {
  if (keys.a || keys.arrowleft) {
    localTank.angle -= localTank.turnSpeed;
  }

  if (keys.d || keys.arrowright) {
    localTank.angle += localTank.turnSpeed;
  }

  let moveDirection = 0;

  if (keys.w || keys.arrowup) {
    moveDirection = 1;
  }

  if (keys.s || keys.arrowdown) {
    moveDirection = -1;
  }

if (moveDirection !== 0) {
  const currentSpeed = isOnRoad(localTank.x, localTank.y)
    ? localTank.roadSpeed
    : localTank.speed;

  const nextX = localTank.x + Math.cos(localTank.angle) * currentSpeed * moveDirection;
  const nextY = localTank.y + Math.sin(localTank.angle) * currentSpeed * moveDirection;
  
  if (!hitsCollisionBlock(nextX, localTank.y)) {
    localTank.x = nextX;
  }

  if (!hitsCollisionBlock(localTank.x, nextY)) {
    localTank.y = nextY;
  }
}

localTank.x = Math.max(0, Math.min(world.width - 38, localTank.x));
localTank.y = Math.max(0, Math.min(world.height - 28, localTank.y));
}

function gameLoop() {
  const hasWinner = Boolean(latestRoomState?.winner);

  if (!hasWinner) {
    updateLocalTank();
  }

  const now = Date.now();

  if (!hasWinner && now - lastTankSendTime > 33) {
	  
    socket.emit("tankUpdate", {
      x: localTank.x,
      y: localTank.y,
      angle: localTank.angle
    });

    lastTankSendTime = now;
  }

  drawBattlefield();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function drawBullet(ctx, x, y) {
  const screenX = toScreenX(x);
  const screenY = toScreenY(y);

  ctx.fillStyle = "#ffd28a";
  ctx.beginPath();
  ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawMine(ctx, mine) {
  const x = toScreenX(mine.x);
  const y = toScreenY(mine.y);
  const isArmed = Date.now() >= mine.armedAt;

  ctx.fillStyle = isArmed ? "#d95745" : "#ffd28a";
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#1b120d";
  ctx.fillRect(x - 4, y - 1, 8, 2);
  ctx.fillRect(x - 1, y - 4, 2, 8);
}

function drawExplosion(ctx, explosion) {
  const x = toScreenX(explosion.x);
  const y = toScreenY(explosion.y);
  const age = Math.max(0, Date.now() - explosion.createdAt);
  const progress = Math.min(age / 700, 1);
  const radius = Math.max(1, explosion.size * progress);
  const alpha = Math.max(0, 1 - progress);

  ctx.fillStyle = `rgba(255, 210, 80, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(217, 87, 69, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlag(ctx, flag) {
  const x = toScreenX(flag.x);
  const y = toScreenY(flag.y);
  const color = flag.owner === 1 ? "#3f7fd9" : "#c95f4a";

  if (flag.status === "atBase") {
    ctx.fillStyle = "#1b120d";
    ctx.fillRect(x - 10, y + 12, 20, 6);

    ctx.strokeStyle = "#ffd28a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 10, y + 12, 20, 6);
  }

  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + 12);
  ctx.lineTo(x, y - 14);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.fillRect(x, y - 14, 18, 12);

  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y - 14, 18, 12);

  if (flag.status === "dropped") {
    ctx.fillStyle = "#ffd28a";
    ctx.beginPath();
    ctx.arc(x, y + 16, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}