const socket = io();

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomCodeInput = document.getElementById("roomCodeInput");
const statusText = document.getElementById("statusText");
const roomPanel = document.getElementById("roomPanel");
const roomCodeText = document.getElementById("roomCodeText");
const playersList = document.getElementById("playersList");
const readyButton = document.getElementById("readyButton");

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
});

socket.on("joinError", (message) => {
  statusText.textContent = message;
});