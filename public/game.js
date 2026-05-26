const socket = io();

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomCodeInput = document.getElementById("roomCodeInput");
const statusText = document.getElementById("statusText");
const roomPanel = document.getElementById("roomPanel");
const roomCodeText = document.getElementById("roomCodeText");
const playersList = document.getElementById("playersList");
const readyButton = document.getElementById("readyButton");
const lobbyScreen = document.getElementById("lobbyScreen");
const gameScreen = document.getElementById("gameScreen");
const gameRoomText = document.getElementById("gameRoomText");

let currentRoomCode = null;
let isReady = false;
let myPlayerNumber = null;
let latestRoomState = null;
let lastTankSendTime = 0;

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

window.addEventListener("keydown", (event) => {
  keys[event.key.toLowerCase()] = true;
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

  const hitsWall = collisionBlocks.some((block) => rectanglesOverlap(box, block));

  const hitsEnemyGate = gateBlocks.some((gate) => {
    const isOwnGate = gate.owner === myPlayerNumber;

    return !isOwnGate && rectanglesOverlap(box, gate);
  });

  const opponent = latestRoomState?.players.find((player) => {
    return player.playerNumber !== myPlayerNumber;
  });

  const hitsOpponent =
    opponent?.tank && rectanglesOverlap(box, tankCollisionBox(opponent.tank.x, opponent.tank.y));

  return hitsWall || hitsEnemyGate || hitsOpponent;
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
gateBlocks.forEach((gate) => {
  const isOwnGate = gate.owner === myPlayerNumber;

  ctx.fillStyle = isOwnGate ? "#2f6f4e" : "#8b3f2f";
  ctx.fillRect(gate.x, gate.y, gate.width, gate.height);

  ctx.strokeStyle = isOwnGate ? "#77d09a" : "#d9973f";
  ctx.lineWidth = 3;
  ctx.strokeRect(gate.x, gate.y, gate.width, gate.height);
});

// base wall highlight
ctx.strokeStyle = "#c98a42";
ctx.lineWidth = 3;

collisionBlocks.forEach((block) => {
  ctx.strokeRect(block.x, block.y, block.width, block.height);
});

ctx.strokeStyle = "#24150e";
ctx.lineWidth = 2;

collisionBlocks.forEach((block) => {
  ctx.strokeRect(block.x + 5, block.y + 5, block.width - 10, block.height - 10);
});

  // labels
  ctx.fillStyle = "#ffd28a";
  ctx.font = "bold 18px Arial";
  ctx.fillText("BASE A", 86, 286);
  ctx.fillText("BASE B", 808, 286);
  
  // base wall highlight
ctx.strokeStyle = "#c98a42";
ctx.lineWidth = 3;

collisionBlocks.forEach((block) => {
  ctx.strokeRect(block.x, block.y, block.width, block.height);
});

ctx.strokeStyle = "#24150e";
ctx.lineWidth = 2;

collisionBlocks.forEach((block) => {
  ctx.strokeRect(block.x + 5, block.y + 5, block.width - 10, block.height - 10);
});

const playerOne = latestRoomState?.players.find((player) => player.playerNumber === 1);
const playerTwo = latestRoomState?.players.find((player) => player.playerNumber === 2);

if (myPlayerNumber === 1) {
  drawTank(ctx, localTank.x, localTank.y, localTank.angle, "#6ca36c");

  if (playerTwo?.tank) {
    drawTank(ctx, playerTwo.tank.x, playerTwo.tank.y, playerTwo.tank.angle, "#c95f4a");
  }
}

if (myPlayerNumber === 2) {
  if (playerOne?.tank) {
    drawTank(ctx, playerOne.tank.x, playerOne.tank.y, playerOne.tank.angle, "#6ca36c");
  }

  drawTank(ctx, localTank.x, localTank.y, localTank.angle, "#c95f4a");
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

function drawTank(ctx, x, y, angle, color) {
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