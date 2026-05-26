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

let currentRoomCode = null;
let isReady = false;
let myPlayerNumber = null;
let latestRoomState = null;
let lastTankSendTime = 0;
let lastShotTime = 0;

const keys = {};
let animationFrameId = null;

const localTank = {
  x: 250,
  y: 276,
  angle: 0,
  speed: 2.5,
  turnSpeed: 0.05
};
const collisionBlocks = [
  // left base walls
  { x: 34, y: 92, width: 190, height: 24 },
  { x: 34, y: 436, width: 190, height: 24 },
  { x: 34, y: 92, width: 24, height: 368 },
  { x: 200, y: 92, width: 24, height: 130 },
  { x: 200, y: 330, width: 24, height: 130 },

  // right base walls
  { x: 736, y: 92, width: 190, height: 24 },
  { x: 736, y: 436, width: 190, height: 24 },
  { x: 902, y: 92, width: 24, height: 368 },
  { x: 736, y: 92, width: 24, height: 130 },
  { x: 736, y: 330, width: 24, height: 130 }
];
const gateBlocks = [
  {
    x: 200,
    y: 222,
    width: 24,
    height: 108,
    owner: 1,
    health: 100
  },
  {
    x: 736,
    y: 222,
    width: 24,
    height: 108,
    owner: 2,
    health: 100
  }
];

function setStartingTankPosition() {
  if (myPlayerNumber === 1) {
    localTank.x = 250;
    localTank.y = 276;
    localTank.angle = 0;
  }

  if (myPlayerNumber === 2) {
    localTank.x = 672;
    localTank.y = 276;
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

  if (healthText) {
    healthText.textContent = `Health ${me.health}/200`;
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
    opponent?.tank && rectanglesOverlap(box, tankCollisionBox(opponent.tank.x, opponent.tank.y));

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

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // grass
  ctx.fillStyle = "#314022";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // road
  ctx.fillStyle = "#5f5d54";
  ctx.fillRect(0, 238, canvas.width, 82);

  ctx.fillStyle = "#d7b36a";
  for (let x = 0; x < canvas.width; x += 56) {
    ctx.fillRect(x + 18, 276, 28, 6);
  }

// base floors
ctx.fillStyle = "#433326";
ctx.fillRect(34, 92, 190, 368);
ctx.fillRect(736, 92, 190, 368);

// base gates
const currentGates = latestRoomState?.gates || gateBlocks;

currentGates.forEach((gate) => {
  if (gate.destroyed) {
    return;
  }

  const isOwnGate = gate.owner === myPlayerNumber;
  const healthPercent = gate.health / 100;

  ctx.fillStyle = isOwnGate ? "#2f6f4e" : "#8b3f2f";
  ctx.fillRect(gate.x, gate.y, gate.width, gate.height);

  ctx.strokeStyle = isOwnGate ? "#77d09a" : "#d9973f";
  ctx.lineWidth = 3;
  ctx.strokeRect(gate.x, gate.y, gate.width, gate.height);

  ctx.fillStyle = "#1b120d";
  ctx.fillRect(gate.x - 8, gate.y - 10, gate.width + 16, 5);

  ctx.fillStyle = "#ffd28a";
  ctx.fillRect(gate.x - 8, gate.y - 10, (gate.width + 16) * healthPercent, 5);
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

const playerOne = latestRoomState?.players.find((player) => player.playerNumber === 1);
const playerTwo = latestRoomState?.players.find((player) => player.playerNumber === 2);

if (myPlayerNumber === 1) {
  drawTank(ctx, localTank.x, localTank.y, localTank.angle, "#3f7fd9", playerOne?.health ?? 200);

  if (playerTwo?.tank && !playerTwo.respawnAt) {
    drawTank(ctx, playerTwo.tank.x, playerTwo.tank.y, playerTwo.tank.angle, "#c95f4a", playerTwo.health);
  }
}

if (myPlayerNumber === 2) {
  if (playerOne?.tank && !playerOne.respawnAt) {
    drawTank(ctx, playerOne.tank.x, playerOne.tank.y, playerOne.tank.angle, "#3f7fd9", playerOne.health);
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

function drawHeadquarters(ctx, hq) {
const bodyColor = hq.owner === 1 ? "#274f8f" : "#8b3f2f";
const roofColor = hq.owner === 1 ? "#3f7fd9" : "#c95f4a";

ctx.fillStyle = bodyColor;
ctx.fillRect(hq.x, hq.y, hq.width, hq.height);

ctx.fillStyle = roofColor;
ctx.fillRect(hq.x + 8, hq.y + 8, hq.width - 16, 18);

ctx.fillStyle = "#1b120d";
ctx.fillRect(hq.x + 20, hq.y + hq.height - 22, hq.width - 40, 22);

ctx.strokeStyle = "#ffd28a";
ctx.lineWidth = 3;
ctx.strokeRect(hq.x, hq.y, hq.width, hq.height);

ctx.strokeStyle = "#1b120d";
ctx.lineWidth = 2;
ctx.strokeRect(hq.x + 8, hq.y + 8, hq.width - 16, 18);

  if (hq.health < 250) {
    const healthPercent = hq.health / 250;

    ctx.fillStyle = "#1b120d";
    ctx.fillRect(hq.x, hq.y - 8, hq.width, 5);

    ctx.fillStyle = "#ffd28a";
    ctx.fillRect(hq.x, hq.y - 8, hq.width * healthPercent, 5);
  }

  if (hq.health < 160) {
    ctx.strokeStyle = "#1b120d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hq.x + 8, hq.y + 8);
    ctx.lineTo(hq.x + hq.width - 8, hq.y + hq.height - 8);
    ctx.stroke();
  }

  if (hq.health < 80) {
    ctx.beginPath();
    ctx.moveTo(hq.x + hq.width - 8, hq.y + 10);
    ctx.lineTo(hq.x + 10, hq.y + hq.height - 8);
    ctx.stroke();
  }
}

function drawWall(ctx, wall) {
  ctx.fillStyle = "#6f5944";
  ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

  ctx.strokeStyle = "#c98a42";
  ctx.lineWidth = 3;
  ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);

  ctx.strokeStyle = "#24150e";
  ctx.lineWidth = 2;
  ctx.strokeRect(wall.x + 5, wall.y + 5, wall.width - 10, wall.height - 10);

  if (wall.health < 150) {
    const healthPercent = wall.health / 150;

    ctx.fillStyle = "#1b120d";
    ctx.fillRect(wall.x, wall.y - 8, wall.width, 5);

    ctx.fillStyle = "#ffd28a";
    ctx.fillRect(wall.x, wall.y - 8, wall.width * healthPercent, 5);
  }

  if (wall.health < 100) {
    ctx.strokeStyle = "#24150e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wall.x + 6, wall.y + 6);
    ctx.lineTo(wall.x + wall.width - 8, wall.y + wall.height - 8);
    ctx.stroke();
  }

  if (wall.health < 50) {
    ctx.beginPath();
    ctx.moveTo(wall.x + wall.width - 8, wall.y + 7);
    ctx.lineTo(wall.x + 8, wall.y + wall.height - 7);
    ctx.stroke();
  }
}

function drawTank(ctx, x, y, angle, color, health) {
  ctx.save();
  ctx.translate(x + 19, y + 14);
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
  ctx.fillRect(x - 2, y - 12, barWidth, 6);

  if (health > 140) {
    ctx.fillStyle = "#7bd86f";
  } else if (health > 70) {
    ctx.fillStyle = "#ffd28a";
  } else {
    ctx.fillStyle = "#d95745";
  }

  ctx.fillRect(x - 2, y - 12, filledWidth, 6);
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
  const nextX = localTank.x + Math.cos(localTank.angle) * localTank.speed * moveDirection;
  const nextY = localTank.y + Math.sin(localTank.angle) * localTank.speed * moveDirection;

  if (!hitsCollisionBlock(nextX, localTank.y)) {
    localTank.x = nextX;
  }

  if (!hitsCollisionBlock(localTank.x, nextY)) {
    localTank.y = nextY;
  }
}

  localTank.x = Math.max(0, Math.min(922, localTank.x));
  localTank.y = Math.max(0, Math.min(524, localTank.y));
}

function gameLoop() {
  updateLocalTank();

  const now = Date.now();

  if (now - lastTankSendTime > 33) {
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
  ctx.fillStyle = "#ffd28a";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawExplosion(ctx, explosion) {
  const age = Math.max(0, Date.now() - explosion.createdAt);
  const progress = Math.min(age / 700, 1);
  const radius = Math.max(1, explosion.size * progress);
  const alpha = Math.max(0, 1 - progress);

  ctx.fillStyle = `rgba(255, 210, 80, ${alpha})`;
  ctx.beginPath();
  ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(217, 87, 69, ${alpha})`;
  ctx.beginPath();
  ctx.arc(explosion.x, explosion.y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlag(ctx, flag) {
  const color = flag.owner === 1 ? "#3f7fd9" : "#c95f4a";

  if (flag.status === "atBase") {
    ctx.fillStyle = "#1b120d";
    ctx.fillRect(flag.x - 10, flag.y + 12, 20, 6);

    ctx.strokeStyle = "#ffd28a";
    ctx.lineWidth = 2;
    ctx.strokeRect(flag.x - 10, flag.y + 12, 20, 6);
  }

  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(flag.x, flag.y + 12);
  ctx.lineTo(flag.x, flag.y - 14);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.fillRect(flag.x, flag.y - 14, 18, 12);

  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 2;
  ctx.strokeRect(flag.x, flag.y - 14, 18, 12);

  if (flag.status === "dropped") {
    ctx.fillStyle = "#ffd28a";
    ctx.beginPath();
    ctx.arc(flag.x, flag.y + 16, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}