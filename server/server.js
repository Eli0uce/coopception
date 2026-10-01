const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const campaignEngine = require('./campaign');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir les fichiers statiques du client
app.use(express.static(path.join(__dirname, '..', 'client')));

// Route Hub Spatial
app.get('/hub', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'hub.html'));
});

// Rooms: roomCode -> { players, campaign, phase, activeMission, timer, cleanupTimer }
const rooms = {};

// Délai de grâce avant suppression d'une room totalement désertée (reconnexion)
const DISCONNECT_GRACE_MS = 5 * 60 * 1000;
const MAX_CHAT_LENGTH = 500;

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

function sendError(ws, message) {
  sendTo(ws, { type: 'error', message });
}

function createRoom(code) {
  return {
    code,
    players: { technician: null, operator: null },
    campaign: campaignEngine.createCampaign(),
    phase: 'hub', // 'hub' | 'mission'
    activeMission: null,
    timer: null,
    cleanupTimer: null
  };
}

function isOpen(ws) {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

function bothConnected(room) {
  return isOpen(room.players.technician) && isOpen(room.players.operator);
}

function scheduleCleanup(code) {
  const room = rooms[code];
  if (!room) return;
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  room.cleanupTimer = setTimeout(() => {
    const r = rooms[code];
    if (!r) return;
    if (!isOpen(r.players.technician) && !isOpen(r.players.operator)) {
      if (r.timer) clearInterval(r.timer);
      delete rooms[code];
    }
  }, DISCONNECT_GRACE_MS);
}

function sendHubState(ws, room) {
  sendTo(ws, { type: 'hub:state', code: room.code, role: ws.role, ...campaignEngine.getHubPayload(room.campaign) });
}

function sendMissionResume(ws, room) {
  const mission = campaignEngine.findMission(room.activeMission.missionId);
  const puzzleIndex = room.activeMission.puzzleIndex;
  sendTo(ws, {
    type: 'mission:resume',
    code: room.code,
    role: ws.role,
    mission: { id: mission.id, title: mission.title, codename: mission.codename, briefing: mission.briefing, icon: mission.icon },
    puzzle: campaignEngine.getPuzzleForRole(mission, puzzleIndex, ws.role),
    puzzleIndex,
    totalPuzzles: mission.puzzles.length,
    timeLeft: room.activeMission.timeLeft,
    resources: room.campaign.resources
  });
}

function startMissionTimer(code) {
  const room = rooms[code];
  if (!room) return;
  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    const r = rooms[code];
    if (!r || r.phase !== 'mission' || !r.activeMission) {
      clearInterval(room.timer);
      return;
    }
    r.activeMission.timeLeft--;
    broadcast(r, { type: 'timer', timeLeft: r.activeMission.timeLeft });
    if (r.activeMission.timeLeft <= 0) {
      clearInterval(r.timer);
      finishMission(code, false);
    }
  }, 1000);
}

/** Termine la mission active (succès ou échec) et ramène la room au Hub. */
function finishMission(code, win) {
  const room = rooms[code];
  if (!room || !room.activeMission) return;
  if (room.timer) clearInterval(room.timer);

  const mission = campaignEngine.findMission(room.activeMission.missionId);
  const { result, newlyUnlocked, ending } = campaignEngine.completeMission(room.campaign, mission, room.activeMission, win);

  room.phase = 'hub';
  room.activeMission = null;

  if (win) {
    broadcast(room, {
      type: 'mission:complete',
      missionId: mission.id,
      stars: result.stars,
      timeLeft: result.timeLeft,
      debrief: mission.debrief.success,
      resourceReward: mission.resourceReward,
      resources: room.campaign.resources,
      newlyUnlocked,
      ending
    });
  } else {
    broadcast(room, {
      type: 'game:over',
      win: false,
      reason: 'TEMPS ÉCOULÉ',
      debrief: mission.debrief.fail,
      resources: room.campaign.resources
    });
  }
}

wss.on('connection', (ws) => {
  ws.id = uuidv4();
  ws.roomCode = null;
  ws.role = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {

      case 'room:create': {
        const code = generateRoomCode();
        rooms[code] = createRoom(code);
        rooms[code].players.technician = ws;
        ws.roomCode = code;
        ws.role = 'technician';
        ws.userId = typeof msg.userId === 'string' ? msg.userId.slice(0, 128) : null;
        sendTo(ws, { type: 'room:created', code, role: 'technician' });
        break;
      }

      case 'room:join': {
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms[code];
        if (!room) { sendError(ws, 'Code de room invalide'); return; }
        if (isOpen(room.players.operator)) { sendError(ws, 'Room déjà complète'); return; }
        room.players.operator = ws;
        ws.roomCode = code;
        ws.role = 'operator';
        ws.userId = typeof msg.userId === 'string' ? msg.userId.slice(0, 128) : null;
        sendTo(ws, { type: 'room:joined', code, role: 'operator' });
        broadcast(room, { type: 'room:ready', message: 'Les deux joueurs sont connectés !' });
        break;
      }

      case 'campaign:restore': {
        const room = rooms[ws.roomCode];
        if (!room || ws.role !== 'technician' || room.phase !== 'hub') return;
        if (Object.keys(room.campaign.completedMissions).length > 0) return;
        room.campaign = campaignEngine.sanitizeCampaign(msg.campaign);
        broadcast(room, { type: 'hub:state', code: room.code, ...campaignEngine.getHubPayload(room.campaign) });
        break;
      }

      // Reconnexion / reprise de session : envoyée par hub.html, technician.html
      // et operator.html au chargement, pour reconstruire l'état courant (hub
      // ou mission en cours) après une navigation ou un rechargement de page.
      case 'session:resume': {
        const code = (msg.code || '').toUpperCase().trim();
        const role = msg.role;
        if (role !== 'technician' && role !== 'operator') { sendError(ws, 'Rôle invalide'); return; }
        const room = rooms[code];
        if (!room) { sendTo(ws, { type: 'session:expired' }); return; }

        const previous = room.players[role];
        if (previous && previous !== ws && isOpen(previous)) {
          try { previous.close(); } catch { /* noop */ }
        }
        room.players[role] = ws;
        ws.roomCode = code;
        ws.role = role;
        ws.userId = typeof msg.userId === 'string' ? msg.userId.slice(0, 128) : null;
        if (room.cleanupTimer) { clearTimeout(room.cleanupTimer); room.cleanupTimer = null; }

        const other = role === 'technician' ? room.players.operator : room.players.technician;
        if (isOpen(other)) sendTo(other, { type: 'player:reconnected', role });

        if (room.phase === 'mission' && room.activeMission) {
          sendMissionResume(ws, room);
        } else {
          sendHubState(ws, room);
        }
        break;
      }

      case 'hub:request': {
        const room = rooms[ws.roomCode];
        if (!room) { sendError(ws, 'Room introuvable'); return; }
        sendHubState(ws, room);
        break;
      }

      case 'mission:start': {
        const room = rooms[ws.roomCode];
        if (!room) { sendError(ws, 'Room introuvable'); return; }
        if (room.phase !== 'hub') { sendError(ws, 'Une mission est déjà en cours'); return; }
        if (!bothConnected(room)) { sendError(ws, "En attente de l'autre joueur"); return; }
        const check = campaignEngine.canStartMission(room.campaign, msg.missionId);
        if (!check.ok) { sendError(ws, check.reason); return; }

        room.activeMission = campaignEngine.startMissionRuntime(check.mission);
        room.phase = 'mission';

        ['technician', 'operator'].forEach(role => {
          sendTo(room.players[role], {
            type: 'mission:started',
            mission: {
              id: check.mission.id,
              title: check.mission.title,
              codename: check.mission.codename,
              briefing: check.mission.briefing,
              icon: check.mission.icon
            },
            puzzle: campaignEngine.getPuzzleForRole(check.mission, 0, role),
            puzzleIndex: 0,
            totalPuzzles: check.mission.puzzles.length,
            timeLeft: room.activeMission.timeLeft,
            resources: room.campaign.resources
          });
        });
        startMissionTimer(ws.roomCode);
        break;
      }

      case 'hub:return': {
        const room = rooms[ws.roomCode];
        if (!room || room.phase !== 'mission') return;
        if (room.timer) clearInterval(room.timer);
        room.phase = 'hub';
        room.activeMission = null;
        broadcast(room, { type: 'mission:aborted' });
        break;
      }

      case 'campaign:reset': {
        const room = rooms[ws.roomCode];
        if (!room || room.phase !== 'hub') return;
        room.campaign = campaignEngine.createCampaign();
        broadcast(room, { type: 'campaign:reset' });
        ['technician', 'operator'].forEach(role => {
          if (isOpen(room.players[role])) sendHubState(room.players[role], room);
        });
        break;
      }

      case 'puzzle:action': {
        const room = rooms[ws.roomCode];
        if (!room || room.phase !== 'mission' || !room.activeMission) return;
        if (ws.role !== 'operator') { sendError(ws, "Seul l'Opérateur peut agir sur ce panneau"); return; }

        const mission = campaignEngine.findMission(room.activeMission.missionId);
        const puzzleIndex = room.activeMission.puzzleIndex;
        const puzzleState = room.activeMission.puzzleStates[puzzleIndex];
        if (!puzzleState || puzzleState.solved) return;

        const result = campaignEngine.validateAction(mission, puzzleIndex, msg.action);
        puzzleState.attempts++;
        room.activeMission.totalAttempts++;

        if (result.valid) {
          puzzleState.solved = true;

          if (result.consequence) {
            campaignEngine.applyConsequence(room.campaign, result.consequence);
            if (typeof result.consequence.timeDelta === 'number') {
              room.activeMission.timeLeft = Math.max(1, room.activeMission.timeLeft + result.consequence.timeDelta);
            }
            room.activeMission.choiceLog[mission.puzzles[puzzleIndex].id] = result.chosenOptionId;
          }

          broadcast(room, {
            type: 'puzzle:solved',
            message: result.message,
            puzzleIndex,
            resources: room.campaign.resources,
            timeLeft: room.activeMission.timeLeft
          });

          setTimeout(() => {
            const r = rooms[ws.roomCode];
            if (!r || !r.activeMission || r.activeMission.missionId !== mission.id) return;
            const next = puzzleIndex + 1;
            if (next >= mission.puzzles.length) {
              finishMission(ws.roomCode, true);
            } else {
              r.activeMission.puzzleIndex = next;
              ['technician', 'operator'].forEach(role => {
                sendTo(r.players[role], {
                  type: 'puzzle:next',
                  puzzle: campaignEngine.getPuzzleForRole(mission, next, role),
                  puzzleIndex: next,
                  totalPuzzles: mission.puzzles.length,
                  module: mission.puzzles[next].module,
                  timeLeft: r.activeMission.timeLeft
                });
              });
            }
          }, 2500);
        } else {
          broadcast(room, { type: 'puzzle:failed', message: result.message, puzzleIndex });
        }
        break;
      }

      case 'hint:request': {
        const room = rooms[ws.roomCode];
        if (!room || room.phase !== 'mission' || !room.activeMission) return;
        const mission = campaignEngine.findMission(room.activeMission.missionId);
        const puzzleIndex = room.activeMission.puzzleIndex;
        const puzzleState = room.activeMission.puzzleStates[puzzleIndex];
        if (!puzzleState) return;
        const hint = campaignEngine.getHint(mission, puzzleIndex, puzzleState.hintsUsed);
        if (hint.text) {
          puzzleState.hintsUsed++;
          room.activeMission.totalHints++;
          broadcast(room, { type: 'hint:response', puzzleIndex, text: hint.text, hintsRemaining: hint.hintsRemaining });
        } else {
          sendTo(ws, { type: 'hint:response', puzzleIndex, text: null, hintsRemaining: 0, message: 'Aucun indice supplémentaire disponible.' });
        }
        break;
      }

      case 'puzzle:progress': {
        const room = rooms[ws.roomCode];
        if (!room) return;
        const other = ws.role === 'technician' ? room.players.operator : room.players.technician;
        sendTo(other, { type: 'puzzle:progress', from: ws.role, data: msg.data });
        break;
      }

      case 'chat:message': {
        const room = rooms[ws.roomCode];
        if (!room) return;
        if (typeof msg.text !== 'string' || !msg.text.trim()) return;
        broadcast(room, {
          type: 'chat:message',
          from: ws.role,
          text: msg.text.slice(0, MAX_CHAT_LENGTH),
          timestamp: Date.now()
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    const room = rooms[ws.roomCode];
    if (!room) return;
    // Ignorer si ce socket a déjà été remplacé par une reconnexion
    if (room.players[ws.role] !== ws) return;
    room.players[ws.role] = null;
    broadcast(room, { type: 'player:disconnected', role: ws.role });
    scheduleCleanup(ws.roomCode);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Station Zéro - Serveur lancé sur http://localhost:${PORT}`);
});
