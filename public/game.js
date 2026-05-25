const socket = io();

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomCodeInput = document.getElementById("roomCodeInput");
const statusText = document.getElementById("statusText");

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

socket.on("roomCreated", (roomCode) => {
  statusText.textContent = `Game created. Give this code to your friend: ${roomCode}`;
});

socket.on("bothPlayersJoined", (roomCode) => {
  statusText.textContent = `Both players joined room ${roomCode}. Game can start soon!`;
});

socket.on("joinError", (message) => {
  statusText.textContent = message;
});