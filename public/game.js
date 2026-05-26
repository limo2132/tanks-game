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
  showRoomPanel(room.roomCode);
  renderPlayers(room.players);

  const me = room.players.find((player) => player.id === socket.id);

  if (me) {
    isReady = me.ready;
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
    drawBattlefield();
  }, 800);
});

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

  // left base
  ctx.fillStyle = "#433326";
  ctx.fillRect(34, 92, 170, 368);
  ctx.strokeStyle = "#9b6a3a";
  ctx.lineWidth = 8;
  ctx.strokeRect(34, 92, 170, 368);

  // right base
  ctx.fillStyle = "#433326";
  ctx.fillRect(756, 92, 170, 368);
  ctx.strokeStyle = "#9b6a3a";
  ctx.lineWidth = 8;
  ctx.strokeRect(756, 92, 170, 368);

  // labels
  ctx.fillStyle = "#ffd28a";
  ctx.font = "bold 18px Arial";
  ctx.fillText("BASE A", 86, 286);
  ctx.fillText("BASE B", 808, 286);

  // player 1 tank
  drawTank(ctx, 250, 276, "#6ca36c", "right");

  // player 2 tank
  drawTank(ctx, 672, 276, "#c95f4a", "left");

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

function drawTank(ctx, x, y, color, direction) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#1b120d";
  ctx.lineWidth = 3;

  ctx.fillRect(x, y, 38, 28);
  ctx.strokeRect(x, y, 38, 28);

  ctx.fillStyle = "#1b120d";

  if (direction === "right") {
    ctx.fillRect(x + 28, y + 11, 28, 6);
  } else {
    ctx.fillRect(x - 18, y + 11, 28, 6);
  }
}