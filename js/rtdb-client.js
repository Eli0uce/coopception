/**
 * rtdb-client.js — Transport temps réel basé sur Firebase Realtime Database.
 *
 * Remplace l'ancien client WebSocket (js/ws-client.js, supprimé) tout en
 * conservant EXACTEMENT la même API publique : WS.connect / WS.send / WS.on /
 * WS.off, et les mêmes noms de messages que l'ancien protocole WebSocket
 * (room:create, hub:state, mission:started, puzzle:solved, …). Ainsi
 * lobby.js, hub.js, technician.js et operator.js fonctionnent sans
 * modification de leur logique métier.
 *
 * ── Modèle d'autorité ──────────────────────────────────────────────────────
 * Il n'y a plus de serveur Node : le TECHNICIEN de chaque room fait office
 * d'hôte/autorité. C'est son navigateur qui exécute CampaignEngine
 * (validation des puzzles, minuteur de mission, conséquences, étoiles,
 * fins de campagne) et qui réplique le résultat dans Firebase Realtime
 * Database sous `rooms/{code}/…`. L'OPÉRATEUR n'exécute jamais la logique de
 * jeu : il envoie ses actions dans une file d'attente RTDB (`requests`) que
 * le Technicien consomme, et il réagit aux changements d'état répliqués.
 *
 * ── Schéma Realtime Database ───────────────────────────────────────────────
 *  rooms/{code}/meta             { technicianUid, operatorUid,
 *                                  technicianOnline, operatorOnline, createdAt }
 *  rooms/{code}/campaign         état de campagne (sanitizeCampaign)
 *  rooms/{code}/phase            'hub' | 'mission'
 *  rooms/{code}/mission          runtime de la mission active (autorité
 *                                 Technicien) + `lastEvent` pour les
 *                                 notifications ponctuelles (puzzle résolu/
 *                                 raté, indice, avancée de puzzle, démarrage)
 *  rooms/{code}/result           résultat de fin de mission (succès/échec)
 *  rooms/{code}/roomEvent        notifications hors-mission (room:ready,
 *                                 mission:aborted, campaign:reset, erreurs
 *                                 ciblées) — un seul slot, horodaté
 *  rooms/{code}/requests/{id}    file d'actions Opérateur → Technicien,
 *                                 consommée (puis supprimée) par le Technicien
 *  rooms/{code}/chat/{id}        messages de tchat (journal)
 *  rooms/{code}/progress         dernier message puzzle:progress (passthrough)
 *
 * Toutes les écritures/lectures requièrent un utilisateur Firebase Auth
 * authentifié (StationAuth, email/mot de passe) — voir les règles RTDB dans
 * le README.
 */
const WS = (() => {
  let db = null;
  let code = null;
  let role = null;
  let myUid = null;
  const handlers = {};

  // État d'autorité (uniquement peuplé/utilisé côté Technicien)
  let techMissionDef = null;
  let techRuntime = null;
  let techTimerHandle = null;
  let requestsListenerAttached = false;

  let sharedListenersAttached = false;

  // ── Dispatch local ──
  function emit(type, payload) {
    const data = payload || {};
    const fn = handlers[type];
    if (fn) fn(data);
    const anyFn = handlers['*'];
    if (anyFn) anyFn({ type, ...data });
  }

  function on(type, fn) { handlers[type] = fn; }
  function off(type) { delete handlers[type]; }

  // ── Connexion ──
  function connect(onOpen) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
      if (onOpen) onOpen();
    } catch (error) {
      emit('error', { message: "Connexion à Firebase Realtime Database impossible." });
    }
  }

  // ── Utilitaires ──
  function genRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function roomRef(path) {
    return path ? db.ref(`rooms/${code}/${path}`) : db.ref(`rooms/${code}`);
  }

  function missionSummary(mission) {
    return { id: mission.id, title: mission.title, codename: mission.codename, briefing: mission.briefing, icon: mission.icon };
  }

  function emitHubStateFromCampaign(rawCampaign) {
    const campaign = CampaignEngine.sanitizeCampaign(rawCampaign);
    emit('hub:state', { code, role, ...CampaignEngine.getHubPayload(campaign) });
  }

  // ── Écouteurs partagés (présence, événements de room, tchat, progress) ──
  function attachSharedListeners() {
    if (sharedListenersAttached) return;
    sharedListenersAttached = true;
    attachPresenceListener();
    attachRoomEventListener();
    attachChatListener();
    attachProgressListener();
  }

  function attachPresenceListener() {
    const otherRole = role === 'technician' ? 'operator' : 'technician';
    let primed = false;
    let lastOnline = null;
    roomRef(`meta/${otherRole}Online`).on('value', snap => {
      const online = snap.val() === true;
      if (!primed) { primed = true; lastOnline = online; return; }
      if (online === lastOnline) return;
      lastOnline = online;
      emit(online ? 'player:reconnected' : 'player:disconnected', { role: otherRole });
    });
  }

  function attachRoomEventListener() {
    let primed = false;
    let lastTs = 0;
    roomRef('roomEvent').on('value', async snap => {
      const ev = snap.val();
      if (!primed) { primed = true; lastTs = (ev && ev.ts) || 0; return; }
      if (!ev || !ev.ts || ev.ts <= lastTs) return;
      lastTs = ev.ts;
      if (ev.onlyRole && ev.onlyRole !== role) return;
      const { type, ts, onlyRole, ...rest } = ev;
      if (type === 'campaign:reset' || type === 'campaign:restored') {
        if (type === 'campaign:reset') emit('campaign:reset', {});
        try {
          const campaignSnap = await roomRef('campaign').once('value');
          emitHubStateFromCampaign(campaignSnap.val());
        } catch (e) { /* ignore */ }
        return;
      }
      emit(type, rest);
    });
  }

  function attachChatListener() {
    const startTs = Date.now() - 1000;
    roomRef('chat').orderByChild('ts').startAt(startTs).on('child_added', snap => {
      const m = snap.val();
      if (!m) return;
      emit('chat:message', { from: m.from, text: m.text, timestamp: m.ts });
    });
  }

  function attachProgressListener() {
    let primed = false;
    roomRef('progress').on('value', snap => {
      const p = snap.val();
      if (!primed) { primed = true; return; }
      if (!p || p.from === role) return;
      emit('puzzle:progress', { from: p.from, data: p.data });
    });
  }

  // ── rooms/{code}/mission : écouteur côté Opérateur ──
  function attachOperatorMissionListener(seedEventTs, seedTimeLeft) {
    let lastEventTs = seedEventTs || 0;
    let lastTimeLeft = seedTimeLeft;
    roomRef('mission').on('value', snap => {
      const m = snap.val();
      if (!m) return; // phase repassée au hub : géré via result/roomEvent
      const mission = CampaignEngine.findMission(m.missionId);
      if (!mission) return;

      if (m.lastEvent && m.lastEvent.ts > lastEventTs) {
        lastEventTs = m.lastEvent.ts;
        dispatchMissionEvent(m, mission, m.lastEvent);
      } else if (typeof m.timeLeft === 'number' && m.timeLeft !== lastTimeLeft) {
        emit('timer', { timeLeft: m.timeLeft });
      }
      lastTimeLeft = m.timeLeft;
    });
  }

  function dispatchMissionEvent(m, mission, ev) {
    switch (ev.kind) {
      case 'started':
        emit('mission:started', {
          mission: missionSummary(mission),
          puzzle: CampaignEngine.getPuzzleForRole(mission, m.puzzleIndex, role),
          puzzleIndex: m.puzzleIndex,
          totalPuzzles: m.totalPuzzles,
          timeLeft: m.timeLeft,
          resources: m.resources
        });
        break;
      case 'next':
        emit('puzzle:next', {
          puzzle: CampaignEngine.getPuzzleForRole(mission, m.puzzleIndex, role),
          puzzleIndex: m.puzzleIndex,
          totalPuzzles: m.totalPuzzles,
          module: mission.puzzles[m.puzzleIndex].module,
          timeLeft: m.timeLeft
        });
        break;
      case 'solved':
        emit('puzzle:solved', { message: ev.message, puzzleIndex: ev.puzzleIndex, resources: m.resources, timeLeft: m.timeLeft });
        break;
      case 'failed':
        emit('puzzle:failed', { message: ev.message, puzzleIndex: ev.puzzleIndex });
        break;
      case 'hint':
        if (ev.forRole && ev.forRole !== role) return;
        if (ev.text) emit('hint:response', { puzzleIndex: ev.puzzleIndex, text: ev.text, hintsRemaining: ev.hintsRemaining });
        else emit('hint:response', { puzzleIndex: ev.puzzleIndex, text: null, hintsRemaining: 0, message: ev.message });
        break;
    }
  }

  // ── rooms/{code}/result : mission:complete / game:over (les deux rôles) ──
  function attachResultListener() {
    let primed = false;
    let lastTs = 0;
    roomRef('result').on('value', snap => {
      const r = snap.val();
      if (!primed) { primed = true; lastTs = (r && r.ts) || 0; return; }
      if (!r || !r.ts || r.ts <= lastTs) return;
      lastTs = r.ts;
      if (r.kind === 'complete') {
        emit('mission:complete', {
          missionId: r.missionId, stars: r.stars, timeLeft: r.timeLeft, debrief: r.debrief,
          resourceReward: r.resourceReward, resources: r.resources, newlyUnlocked: r.newlyUnlocked, ending: r.ending
        });
      } else if (r.kind === 'gameover') {
        emit('game:over', { win: false, reason: r.reason, debrief: r.debrief, resources: r.resources });
      }
    });
  }

  // ── File de requêtes Opérateur → Technicien ──
  function enqueueRequest(type, payload) {
    return roomRef('requests').push({ type, from: role, payload: payload || null, ts: Date.now() }).catch(() => {
      emit('error', { message: 'Impossible de transmettre votre action au Technicien.' });
    });
  }

  function attachRequestsListener() {
    if (requestsListenerAttached) return;
    requestsListenerAttached = true;
    const reqRef = roomRef('requests');
    reqRef.on('child_added', snap => {
      const req = snap.val();
      const key = snap.key;
      reqRef.child(key).remove();
      if (!req || !req.type) return;
      processAuthorityRequest(req.type, req.payload, req.from, false);
    });
  }

  function processAuthorityRequest(type, payload, requesterRole, isLocal) {
    payload = payload || {};
    switch (type) {
      case 'mission:start': return authorityMissionStart(payload.missionId, requesterRole, isLocal);
      case 'hub:return': return authorityHubReturn(requesterRole, isLocal);
      case 'campaign:reset': return authorityCampaignReset(requesterRole, isLocal);
      case 'campaign:restore': return authorityCampaignRestore(payload.campaign, requesterRole, isLocal);
      case 'puzzle:action': return authorityPuzzleAction(payload.action, requesterRole, isLocal);
      case 'hint:request': return authorityHintRequest(requesterRole, isLocal);
      default: return undefined;
    }
  }

  // ── Erreurs ciblées (équivalent de sendError) ──
  async function authorityError(message, requesterRole, isLocal) {
    if (isLocal) { emit('error', { message }); return; }
    try { await roomRef('roomEvent').set({ type: 'error', message, ts: Date.now(), onlyRole: requesterRole }); } catch (e) { /* ignore */ }
  }

  // ── Persistance du runtime de mission (Technicien) ──
  async function persistMissionRuntime() {
    await roomRef('mission').set({
      missionId: techMissionDef.id,
      puzzleIndex: techRuntime.puzzleIndex,
      timeLeft: techRuntime.timeLeft,
      totalPuzzles: techMissionDef.puzzles.length,
      resources: techRuntime.resources,
      puzzleStates: techRuntime.puzzleStates,
      totalAttempts: techRuntime.totalAttempts,
      totalHints: techRuntime.totalHints,
      choiceLog: techRuntime.choiceLog,
      lastEvent: techRuntime.lastEvent || null
    });
  }

  function stopTechnicianTimer() {
    if (techTimerHandle) { clearInterval(techTimerHandle); techTimerHandle = null; }
  }

  function startTechnicianTimer() {
    stopTechnicianTimer();
    techTimerHandle = setInterval(() => {
      if (!techRuntime) { stopTechnicianTimer(); return; }
      techRuntime.timeLeft--;
      roomRef('mission/timeLeft').set(techRuntime.timeLeft).catch(() => {});
      emit('timer', { timeLeft: techRuntime.timeLeft });
      if (techRuntime.timeLeft <= 0) {
        stopTechnicianTimer();
        finishMission(false);
      }
    }, 1000);
  }

  // ── Actions d'autorité (exécutées uniquement par le navigateur Technicien) ──
  async function authorityMissionStart(missionId, requesterRole, isLocal) {
    try {
      const [campaignSnap, phaseSnap, metaSnap] = await Promise.all([
        roomRef('campaign').once('value'),
        roomRef('phase').once('value'),
        roomRef('meta').once('value')
      ]);
      const campaign = CampaignEngine.sanitizeCampaign(campaignSnap.val());
      if (phaseSnap.val() === 'mission') return authorityError('Une mission est déjà en cours', requesterRole, isLocal);
      const meta = metaSnap.val() || {};
      if (!(meta.technicianOnline && meta.operatorOnline)) return authorityError("En attente de l'autre joueur", requesterRole, isLocal);
      const check = CampaignEngine.canStartMission(campaign, missionId);
      if (!check.ok) return authorityError(check.reason, requesterRole, isLocal);

      techMissionDef = check.mission;
      techRuntime = CampaignEngine.startMissionRuntime(check.mission);
      techRuntime.resources = campaign.resources;
      techRuntime.lastEvent = { kind: 'started', ts: Date.now() };

      await roomRef().update({ phase: 'mission' });
      await persistMissionRuntime();
      startTechnicianTimer();

      emit('mission:started', {
        mission: missionSummary(check.mission),
        puzzle: CampaignEngine.getPuzzleForRole(check.mission, 0, 'technician'),
        puzzleIndex: 0,
        totalPuzzles: check.mission.puzzles.length,
        timeLeft: techRuntime.timeLeft,
        resources: campaign.resources
      });
    } catch (e) {
      authorityError('Impossible de démarrer la mission.', requesterRole, isLocal);
    }
  }

  async function authorityHubReturn(requesterRole, isLocal) {
    if (!techRuntime) return;
    stopTechnicianTimer();
    techRuntime = null; techMissionDef = null;
    try {
      await roomRef().update({
        phase: 'hub',
        mission: null,
        roomEvent: { type: 'mission:aborted', ts: Date.now(), onlyRole: null }
      });
    } catch (e) { /* ignore */ }
    emit('mission:aborted', {});
  }

  async function authorityCampaignReset(requesterRole, isLocal) {
    try {
      const phaseSnap = await roomRef('phase').once('value');
      if (phaseSnap.val() !== 'hub') return;
      const campaign = CampaignEngine.createCampaign();
      await roomRef().update({
        campaign,
        roomEvent: { type: 'campaign:reset', ts: Date.now(), onlyRole: null }
      });
      emit('campaign:reset', {});
      emitHubStateFromCampaign(campaign);
    } catch (e) { /* ignore */ }
  }

  async function authorityCampaignRestore(savedCampaign, requesterRole, isLocal) {
    try {
      const phaseSnap = await roomRef('phase').once('value');
      if (phaseSnap.val() !== 'hub') return;
      const currentSnap = await roomRef('campaign').once('value');
      const current = CampaignEngine.sanitizeCampaign(currentSnap.val());
      if (Object.keys(current.completedMissions).length > 0) return;
      const campaign = CampaignEngine.sanitizeCampaign(savedCampaign);
      await roomRef().update({
        campaign,
        roomEvent: { type: 'campaign:restored', ts: Date.now(), onlyRole: null }
      });
      emitHubStateFromCampaign(campaign);
    } catch (e) { /* ignore */ }
  }

  async function authorityHintRequest(requesterRole, isLocal) {
    if (!techRuntime || !techMissionDef) return;
    try {
      const puzzleIndex = techRuntime.puzzleIndex;
      const puzzleState = techRuntime.puzzleStates[puzzleIndex];
      if (!puzzleState) return;
      const hint = CampaignEngine.getHint(techMissionDef, puzzleIndex, puzzleState.hintsUsed);
      if (hint.text) {
        puzzleState.hintsUsed++;
        techRuntime.totalHints++;
        techRuntime.lastEvent = { kind: 'hint', ts: Date.now(), puzzleIndex, text: hint.text, hintsRemaining: hint.hintsRemaining, forRole: null };
        await persistMissionRuntime();
        emit('hint:response', { puzzleIndex, text: hint.text, hintsRemaining: hint.hintsRemaining });
      } else {
        techRuntime.lastEvent = { kind: 'hint', ts: Date.now(), puzzleIndex, text: null, message: 'Aucun indice supplémentaire disponible.', forRole: requesterRole };
        await persistMissionRuntime();
        if (isLocal) emit('hint:response', { puzzleIndex, text: null, hintsRemaining: 0, message: 'Aucun indice supplémentaire disponible.' });
      }
    } catch (e) { /* ignore */ }
  }

  async function authorityPuzzleAction(action, requesterRole, isLocal) {
    if (!techRuntime || !techMissionDef) return;
    if (requesterRole !== 'operator') return authorityError("Seul l'Opérateur peut agir sur ce panneau", requesterRole, isLocal);

    const puzzleIndex = techRuntime.puzzleIndex;
    const puzzleState = techRuntime.puzzleStates[puzzleIndex];
    if (!puzzleState || puzzleState.solved) return;

    try {
      const result = CampaignEngine.validateAction(techMissionDef, puzzleIndex, action);
      puzzleState.attempts++;
      techRuntime.totalAttempts++;

      if (result.valid) {
        puzzleState.solved = true;
        const campaignSnap = await roomRef('campaign').once('value');
        const campaign = CampaignEngine.sanitizeCampaign(campaignSnap.val());
        if (result.consequence) {
          CampaignEngine.applyConsequence(campaign, result.consequence);
          if (typeof result.consequence.timeDelta === 'number') {
            techRuntime.timeLeft = Math.max(1, techRuntime.timeLeft + result.consequence.timeDelta);
          }
          techRuntime.choiceLog[techMissionDef.puzzles[puzzleIndex].id] = result.chosenOptionId;
        }
        await roomRef('campaign').set(campaign);
        techRuntime.resources = campaign.resources;
        techRuntime.lastEvent = { kind: 'solved', ts: Date.now(), puzzleIndex, message: result.message };
        await persistMissionRuntime();

        emit('puzzle:solved', { message: result.message, puzzleIndex, resources: campaign.resources, timeLeft: techRuntime.timeLeft });

        const missionIdAtSolve = techMissionDef.id;
        setTimeout(async () => {
          if (!techRuntime || !techMissionDef || techMissionDef.id !== missionIdAtSolve) return;
          const next = puzzleIndex + 1;
          if (next >= techMissionDef.puzzles.length) {
            await finishMission(true);
          } else {
            techRuntime.puzzleIndex = next;
            techRuntime.lastEvent = { kind: 'next', ts: Date.now(), puzzleIndex: next };
            await persistMissionRuntime();
            emit('puzzle:next', {
              puzzle: CampaignEngine.getPuzzleForRole(techMissionDef, next, 'technician'),
              puzzleIndex: next,
              totalPuzzles: techMissionDef.puzzles.length,
              module: techMissionDef.puzzles[next].module,
              timeLeft: techRuntime.timeLeft
            });
          }
        }, 2500);
      } else {
        techRuntime.lastEvent = { kind: 'failed', ts: Date.now(), puzzleIndex, message: result.message };
        await persistMissionRuntime();
        emit('puzzle:failed', { message: result.message, puzzleIndex });
      }
    } catch (e) { /* ignore */ }
  }

  async function finishMission(win) {
    stopTechnicianTimer();
    const mission = techMissionDef;
    if (!mission) return;
    try {
      const campaignSnap = await roomRef('campaign').once('value');
      const campaign = CampaignEngine.sanitizeCampaign(campaignSnap.val());
      const { result, newlyUnlocked, ending } = CampaignEngine.completeMission(campaign, mission, techRuntime, win);

      const resultNode = win
        ? { kind: 'complete', missionId: mission.id, stars: result.stars, timeLeft: result.timeLeft, debrief: mission.debrief.success, resourceReward: mission.resourceReward, resources: campaign.resources, newlyUnlocked, ending, ts: Date.now() }
        : { kind: 'gameover', missionId: mission.id, reason: 'TEMPS ÉCOULÉ', debrief: mission.debrief.fail, resources: campaign.resources, ts: Date.now() };

      await roomRef().update({ phase: 'hub', mission: null, campaign, result: resultNode });

      techRuntime = null; techMissionDef = null;

      if (win) {
        emit('mission:complete', { missionId: mission.id, stars: result.stars, timeLeft: result.timeLeft, debrief: mission.debrief.success, resourceReward: mission.resourceReward, resources: campaign.resources, newlyUnlocked, ending });
      } else {
        emit('game:over', { win: false, reason: 'TEMPS ÉCOULÉ', debrief: mission.debrief.fail, resources: campaign.resources });
      }
    } catch (e) { /* ignore */ }
  }

  // ── Entrées protocole (room:create / room:join / session:resume) ──
  async function handleRoomCreate(msg) {
    try {
      let candidate = null;
      for (let attempts = 0; attempts < 10 && !candidate; attempts++) {
        const tryCode = genRoomCode();
        const snap = await db.ref(`rooms/${tryCode}/meta`).once('value');
        if (!snap.exists()) candidate = tryCode;
      }
      if (!candidate) { emit('error', { message: 'Impossible de générer un code de room, réessayez.' }); return; }

      code = candidate; role = 'technician'; myUid = msg.userId || null;

      await db.ref(`rooms/${code}`).set({
        meta: { technicianUid: myUid, operatorUid: null, technicianOnline: true, operatorOnline: false, createdAt: Date.now() },
        phase: 'hub',
        campaign: CampaignEngine.createCampaign()
      });
      roomRef('meta/technicianOnline').onDisconnect().set(false);

      attachSharedListeners();
      attachRequestsListener();

      emit('room:created', { code, role: 'technician' });
    } catch (e) {
      emit('error', { message: 'Création de room impossible.' });
    }
  }

  async function handleRoomJoin(msg) {
    try {
      const joinCode = (msg.code || '').toUpperCase().trim();
      if (joinCode.length !== 4) { emit('error', { message: 'Le code doit faire 4 caractères.' }); return; }
      const snap = await db.ref(`rooms/${joinCode}/meta`).once('value');
      if (!snap.exists()) { emit('error', { message: 'Code de room invalide' }); return; }
      const meta = snap.val();
      if (meta.operatorOnline) { emit('error', { message: 'Room déjà complète' }); return; }

      code = joinCode; role = 'operator'; myUid = msg.userId || null;

      attachSharedListeners();

      await db.ref(`rooms/${code}/meta`).update({ operatorUid: myUid, operatorOnline: true });
      roomRef('meta/operatorOnline').onDisconnect().set(false);

      emit('room:joined', { code, role: 'operator' });
      await roomRef('roomEvent').set({ type: 'room:ready', message: 'Les deux joueurs sont connectés !', ts: Date.now(), onlyRole: null });
    } catch (e) {
      emit('error', { message: 'Impossible de rejoindre la room.' });
    }
  }

  async function handleSessionResume(msg) {
    try {
      const resumeCode = (msg.code || '').toUpperCase().trim();
      const resumeRole = msg.role;
      if (resumeRole !== 'technician' && resumeRole !== 'operator') { emit('error', { message: 'Rôle invalide' }); return; }

      const metaSnap = await db.ref(`rooms/${resumeCode}/meta`).once('value');
      if (!metaSnap.exists()) { emit('session:expired', {}); return; }

      code = resumeCode; role = resumeRole; myUid = msg.userId || null;

      attachSharedListeners();

      await roomRef('meta').update({ [`${role}Uid`]: myUid, [`${role}Online`]: true });
      roomRef(`meta/${role}Online`).onDisconnect().set(false);

      const [phaseSnap, missionSnap, campaignSnap] = await Promise.all([
        roomRef('phase').once('value'),
        roomRef('mission').once('value'),
        roomRef('campaign').once('value')
      ]);

      const phase = phaseSnap.val() || 'hub';
      const missionNode = missionSnap.val();

      if (phase === 'mission' && missionNode) {
        if (role === 'technician') {
          techMissionDef = CampaignEngine.findMission(missionNode.missionId);
          techRuntime = {
            puzzleIndex: missionNode.puzzleIndex,
            timeLeft: missionNode.timeLeft,
            resources: missionNode.resources,
            puzzleStates: missionNode.puzzleStates || [],
            totalAttempts: missionNode.totalAttempts || 0,
            totalHints: missionNode.totalHints || 0,
            choiceLog: missionNode.choiceLog || {},
            lastEvent: missionNode.lastEvent || null
          };
          attachRequestsListener();
          startTechnicianTimer();
        } else {
          attachOperatorMissionListener((missionNode.lastEvent && missionNode.lastEvent.ts) || 0, missionNode.timeLeft);
        }
        attachResultListener();

        const mission = techMissionDef || CampaignEngine.findMission(missionNode.missionId);
        emit('mission:resume', {
          code, role,
          mission: missionSummary(mission),
          puzzle: CampaignEngine.getPuzzleForRole(mission, missionNode.puzzleIndex, role),
          puzzleIndex: missionNode.puzzleIndex,
          totalPuzzles: missionNode.totalPuzzles,
          timeLeft: missionNode.timeLeft,
          resources: missionNode.resources
        });
      } else {
        if (role === 'technician') attachRequestsListener();
        else attachOperatorMissionListener(0, null);
        attachResultListener();
        emitHubStateFromCampaign(campaignSnap.val());
      }
    } catch (e) {
      emit('error', { message: 'Reprise de session impossible.' });
    }
  }

  async function handleHubRequest() {
    try {
      const campaignSnap = await roomRef('campaign').once('value');
      emitHubStateFromCampaign(campaignSnap.val());
    } catch (e) { /* ignore */ }
  }

  // ── Routage d'envoi ──
  //
  // Les handlers sont asynchrones (lectures/écritures RTDB). Pour reproduire
  // la garantie d'ordre du serveur Node d'origine (une seule boucle
  // d'événements traitant les messages d'une connexion strictement dans
  // l'ordre de réception — important par ex. pour hub.js qui enchaîne
  // `session:resume` puis `campaign:restore` sans attendre la première),
  // chaque appel à send() est mis en file et exécuté après la résolution du
  // précédent, plutôt que d'être lancé en parallèle.
  let sendChain = Promise.resolve();
  function send(msg) {
    sendChain = sendChain.then(() => dispatchSend(msg)).catch(() => {});
  }

  function dispatchSend(msg) {
    if (!msg || typeof msg.type !== 'string') return undefined;
    switch (msg.type) {
      case 'room:create': return handleRoomCreate(msg);
      case 'room:join': return handleRoomJoin(msg);
      case 'session:resume': return handleSessionResume(msg);
      case 'hub:request': return handleHubRequest();

      case 'mission:start':
        return role === 'technician'
          ? processAuthorityRequest('mission:start', { missionId: msg.missionId }, 'technician', true)
          : enqueueRequest('mission:start', { missionId: msg.missionId });

      case 'hub:return':
        return role === 'technician'
          ? processAuthorityRequest('hub:return', {}, 'technician', true)
          : enqueueRequest('hub:return', {});

      case 'campaign:reset':
        return role === 'technician'
          ? processAuthorityRequest('campaign:reset', {}, 'technician', true)
          : enqueueRequest('campaign:reset', {});

      case 'campaign:restore':
        // Toujours envoyé par le Technicien (hub.js ne l'envoie que si role === 'technician').
        return processAuthorityRequest('campaign:restore', { campaign: msg.campaign }, 'technician', true);

      case 'puzzle:action':
        return role === 'technician'
          ? processAuthorityRequest('puzzle:action', { action: msg.action }, 'technician', true)
          : enqueueRequest('puzzle:action', { action: msg.action });

      case 'hint:request':
        return role === 'technician'
          ? processAuthorityRequest('hint:request', {}, 'technician', true)
          : enqueueRequest('hint:request', {});

      case 'puzzle:progress':
        return roomRef('progress').set({ from: role, data: msg.data, ts: Date.now() }).catch(() => {});

      case 'chat:message':
        if (typeof msg.text === 'string' && msg.text.trim()) {
          return roomRef('chat').push({ from: role, text: msg.text.slice(0, 500), ts: Date.now() }).catch(() => {});
        }
        return undefined;

      default:
        return undefined;
    }
  }

  return { connect, send, on, off };
})();
