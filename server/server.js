const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createGameState, getPuzzleForRole, validateAction } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir les fichiers statiques du client
app.use(express.static(path.join(__dirname, '..', 'client')));

// Rooms: roomCode -> { players: {technician, operator}, gameState, timer }
const rooms = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms[code] ? generateRoomCode() : code;
}

function broadcast(room, data) {
  const msg = JSON.stringify(data);
  ['technician', 'operator'].forEach(role => {
    const ws = room.players[role];
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

function sendTo(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function startTimer(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.timer = setInterval(() => {
    if (!room.gameState.started || room.gameState.finished) {
      clearInterval(room.timer);
      return;
    }
    room.gameState.timeLeft--;
    broadcast(room, { type: 'timer', timeLeft: room.gameState.timeLeft });
    if (room.gameState.timeLeft <= 0) {
      clearInterval(room.timer);
      room.gameState.finished = true;
      room.gameState.win = false;
      broadcast(room, { type: 'game:over', win: false, reason: 'TEMPS ÉCOULÉ' });
    }
  }, 1000);
}

wss.on('connection', (ws) => {
  ws.id = uuidv4();
  ws.roomCode = null;
  ws.role = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'room:create': {
        const code = generateRoomCode();
        rooms[code] = {
          players: { technician: ws, operator: null },
          gameState: createGameState(code),
          timer: null
        };
        ws.roomCode = code;
        ws.role = 'technician';
        sendTo(ws, { type: 'room:created', code, role: 'technician' });
        break;
      }

      case 'room:join': {
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms[code];
        if (!room) { sendTo(ws, { type: 'error', message: 'Code de room invalide' }); return; }
        if (room.players.operator) { sendTo(ws, { type: 'error', message: 'Room déjà complète' }); return; }
        room.players.operator = ws;
        ws.roomCode = code;
        ws.role = 'operator';
        sendTo(ws, { type: 'room:joined', code, role: 'operator' });
        broadcast(room, { type: 'room:ready', message: 'Les deux joueurs sont connectés !' });
        break;
      }

      case 'game:start': {
        const room = rooms[ws.roomCode];
        if (!room || !room.players.technician || !room.players.operator) return;
        if (ws.role !== 'technician') return;
        room.gameState.started = true;
        const puzzleIndex = room.gameState.currentPuzzle;
        sendTo(room.players.technician, {
          type: 'game:started',
          puzzle: getPuzzleForRole(puzzleIndex, 'technician'),
          puzzleIndex,
          totalPuzzles: room.gameState.totalPuzzles,
          module: require('./puzzles.json')[puzzleIndex].module
        });
        sendTo(room.players.operator, {
          type: 'game:started',
          puzzle: getPuzzleForRole(puzzleIndex, 'operator'),
          puzzleIndex,
          totalPuzzles: room.gameState.totalPuzzles,
          module: require('./puzzles.json')[puzzleIndex].module
        });
        broadcast(room, { type: 'timer', timeLeft: room.gameState.timeLeft });
        startTimer(ws.roomCode);
        break;
      }

      case 'puzzle:action': {
        const room = rooms[ws.roomCode];
        if (!room || !room.gameState.started) return;
        const puzzleIndex = room.gameState.currentPuzzle;
        const result = validateAction(room.gameState, puzzleIndex, msg.action);
        room.gameState.puzzleStates[puzzleIndex].attempts++;

        if (result.valid) {
          room.gameState.puzzleStates[puzzleIndex].solved = true;
          broadcast(room, { type: 'puzzle:solved', message: result.message, puzzleIndex });

          setTimeout(() => {
            const next = puzzleIndex + 1;
            if (next >= room.gameState.totalPuzzles) {
              clearInterval(room.timer);
              room.gameState.finished = true;
              room.gameState.win = true;
              broadcast(room, { type: 'game:over', win: true, reason: 'STATION RÉACTIVÉE' });
            } else {
              room.gameState.currentPuzzle = next;
              const puzzles = require('./puzzles.json');
              sendTo(room.players.technician, {
                type: 'puzzle:next',
                puzzle: getPuzzleForRole(next, 'technician'),
                puzzleIndex: next,
                totalPuzzles: room.gameState.totalPuzzles,
                module: puzzles[next].module
              });
              sendTo(room.players.operator, {
                type: 'puzzle:next',
                puzzle: getPuzzleForRole(next, 'operator'),
                puzzleIndex: next,
                totalPuzzles: room.gameState.totalPuzzles,
                module: puzzles[next].module
              });
            }
          }, 2500);
        } else {
          broadcast(room, { type: 'puzzle:failed', message: result.message, puzzleIndex });
        }
        break;
      }

      case 'puzzle:progress': {
        const room = rooms[ws.roomCode];
        if (!room) return;
        // Relayer la progression à l'autre joueur
        const other = ws.role === 'technician' ? room.players.operator : room.players.technician;
        sendTo(other, { type: 'puzzle:progress', from: ws.role, data: msg.data });
        break;
      }

      case 'chat:message': {
        const room = rooms[ws.roomCode];
        if (!room) return;
        broadcast(room, {
          type: 'chat:message',
          from: ws.role,
          text: msg.text,
          timestamp: Date.now()
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    const room = rooms[ws.roomCode];
    if (!room) return;
    if (room.timer) clearInterval(room.timer);
    broadcast(room, { type: 'player:disconnected', role: ws.role });
    delete rooms[ws.roomCode];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Station Zéro - Serveur lancé sur http://localhost:${PORT}`);
});

