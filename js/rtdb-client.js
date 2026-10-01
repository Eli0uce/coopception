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
 *  rooms/{code}/campaign         état de campagne (sanitizeCampaign) — inclut
 *                                 désormais `ngPlus` (cycle New Game+) et
 *                                 `bestStars` (record d'étoiles par mission,
 *                                 survit aux rejeux complets)
 *  rooms/{code}/phase            'hub' | 'mission'
 *  rooms/{code}/mission          runtime de la mission active (autorité
 *                                 Technicien), y compris `isReplay` (rejeu
 *                                 d'une mission déjà terminée : pas de double
 *                                 récompense/conséquence, voir CampaignEngine)
 *                                 et `ngPlus` (cycle au moment du démarrage)
 *                                 + `lastEvent` pour les notifications
 *                                 ponctuelles (puzzle résolu/raté — avec
 *                                 pénalité de tentative éventuelle —, indice
 *                                 — avec coût éventuel —, avancée de puzzle,
 *                                 démarrage)
 *  rooms/{code}/result           résultat de fin de mission (succès/échec)
 *  rooms/{code}/roomEvent        notifications hors-mission (room:ready,
 *                                 mission:aborted, campaign:reset,
 *                                 campaign:replayed [New Game+], erreurs
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
    return {
      id: mission.id, title: mission.title, codename: mission.codename, briefing: mission.briefing, icon: mission.icon,
      difficulty: mission.difficulty, timeLimit: mission.timeLimit, maxHintsPerMission: Number.isFinite(mission.maxHintsPerMission) ? mission.maxHintsPerMission : null,
      puzzleCount: mission.puzzles.length
    };
  }

  /** Indices restants au niveau de la mission (budget global, voir
   * mission.maxHintsPerMission) à un instant donné — null si la mission n'a
   * pas de plafond. Utilisé pour afficher "indices restants" côté UI sans
   * dupliquer la logique de budget déjà imposée par CampaignEngine.getHint. */
  function missionHintsRemaining(mission, totalHintsUsed) {
    if (!Number.isFinite(mission.maxHintsPerMission)) return null;
    return Math.max(0, mission.maxHintsPerMission - (totalHintsUsed || 0));
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
      if (type === 'campaign:reset' || type === 'campaign:restored' || type === 'campaign:replayed') {
        if (type === 'campaign:reset') emit('campaign:reset', {});
        if (type === 'campaign:replayed') emit('campaign:replay', {});
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
  function attachOperatorMissionListener(seedEventSeq, seedTimeLeft) {
    // Ordonnancement par compteur monotone (`seq`), pas par `ts` : deux
    // événements d'autorité rapprochés peuvent partager la même milliseconde
    // Date.now(), ce qui ferait ignorer silencieusement un événement côté
    // Opérateur si l'on comparait seulement des timestamps (`>` strict).
    //
    // `seq` est remis à zéro à CHAQUE nouveau départ de mission (y compris un
    // rejeu de la même mission) par `CampaignEngine.startMissionRuntime` : un
    // événement `kind: 'started'` doit donc toujours être traité, même si sa
    // valeur `seq` est numériquement inférieure au dernier événement vu de
    // l'exécution précédente — sans quoi un rejeu de mission resterait bloqué
    // côté Opérateur (la mission ne démarre jamais visuellement). `lastKey`
    // (missionId+seq) protège contre un double-traitement si Firebase (ou un
    // reconnect) refait feu l'événement 'value' avec des données inchangées.
    let lastEventSeq = seedEventSeq || 0;
    let lastKey = null;
    let lastTimeLeft = seedTimeLeft;
    roomRef('mission').on('value', snap => {
      const m = snap.val();
      if (!m) return; // phase repassée au hub : géré via result/roomEvent
      const rawMission = CampaignEngine.findMission(m.missionId);
      if (!rawMission) return;
      // Version effective (durcie NG+, voir getEffectiveMission) : les champs
      // de difficulté ajoutés à getPuzzleForRole (maxAttempts, pénalités,
      // coût des indices…) doivent refléter le MÊME cycle que celui utilisé
      // par l'autorité Technicien, pas la version de base.
      const mission = CampaignEngine.getEffectiveMission(rawMission, m.ngPlus || 0);

      const ev = m.lastEvent;
      if (ev && typeof ev.seq === 'number') {
        const key = m.missionId + ':' + ev.seq;
        const isFreshStart = ev.kind === 'started';
        if (key !== lastKey && (ev.seq > lastEventSeq || isFreshStart)) {
          lastKey = key;
          lastEventSeq = ev.seq;
          dispatchMissionEvent(m, mission, ev);
          lastTimeLeft = m.timeLeft;
          return;
        }
      }
      if (typeof m.timeLeft === 'number' && m.timeLeft !== lastTimeLeft) {
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
          resources: m.resources,
          attempts: 0, hintsUsed: 0,
          missionHintsUsed: m.totalHints || 0,
          missionHintsRemaining: missionHintsRemaining(mission, m.totalHints || 0)
        });
        break;
      case 'next':
        emit('puzzle:next', {
          puzzle: CampaignEngine.getPuzzleForRole(mission, m.puzzleIndex, role),
          puzzleIndex: m.puzzleIndex,
          totalPuzzles: m.totalPuzzles,
          module: mission.puzzles[m.puzzleIndex].module,
          timeLeft: m.timeLeft,
          attempts: 0, hintsUsed: 0,
          missionHintsUsed: m.totalHints || 0,
          missionHintsRemaining: missionHintsRemaining(mission, m.totalHints || 0)
        });
        break;
      case 'solved':
        emit('puzzle:solved', {
          message: ev.message, puzzleIndex: ev.puzzleIndex, resources: m.resources, timeLeft: m.timeLeft,
          attempts: Number.isFinite(ev.attempts) ? ev.attempts : null
        });
        break;
      case 'failed':
        emit('puzzle:failed', {
          message: ev.message, puzzleIndex: ev.puzzleIndex,
          timePenalty: ev.timePenalty || 0, resourcePenalty: ev.resourcePenalty || null,
          timeLeft: ev.timeLeft, resources: ev.resources,
          attempts: Number.isFinite(ev.attempts) ? ev.attempts : null,
          maxAttempts: Number.isFinite(ev.maxAttempts) ? ev.maxAttempts : null
        });
        break;
      case 'hint':
        if (ev.forRole && ev.forRole !== role) return;
        if (ev.text) emit('hint:response', {
          puzzleIndex: ev.puzzleIndex, text: ev.text, hintsRemaining: ev.hintsRemaining, cost: ev.cost || null, timeLeft: ev.timeLeft, resources: ev.resources,
          missionHintsUsed: Number.isFinite(ev.missionHintsUsed) ? ev.missionHintsUsed : null,
          missionHintsRemaining: Number.isFinite(ev.missionHintsRemaining) ? ev.missionHintsRemaining : null
        });
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
          resourceReward: r.resourceReward, resources: r.resources, newlyUnlocked: r.newlyUnlocked, ending: r.ending, isReplay: !!r.isReplay
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
      case 'campaign:replay': return authorityCampaignReplay(requesterRole, isLocal);
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

  // ── Compteur monotone pour l'ordonnancement fiable de `lastEvent` (voir
  // attachOperatorMissionListener) ──
  function bumpEvent(kind, extra) {
    techRuntime.eventSeq = (techRuntime.eventSeq || 0) + 1;
    return { kind, ts: Date.now(), seq: techRuntime.eventSeq, ...(extra || {}) };
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
      totalTimePenalty: techRuntime.totalTimePenalty || 0,
      choiceLog: techRuntime.choiceLog,
      isReplay: !!techRuntime.isReplay,
      ngPlus: techRuntime.ngPlus || 0,
      eventSeq: techRuntime.eventSeq || 0,
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

      // `techMissionDef` est la version « effective » de la mission : les
      // leviers de difficulté (minuteur, tolérance, tentatives, coût des
      // indices…) sont durcis selon `campaign.ngPlus` (voir
      // CampaignEngine.getEffectiveMission). Les données envoyées à
      // l'Opérateur/Technicien (texte, mapping, schéma…) restent identiques.
      techMissionDef = CampaignEngine.getEffectiveMission(check.mission, campaign.ngPlus);
      techRuntime = CampaignEngine.startMissionRuntime(techMissionDef, check.isReplay);
      techRuntime.resources = campaign.resources;
      techRuntime.ngPlus = campaign.ngPlus || 0;
      techRuntime.lastEvent = bumpEvent('started');

      await roomRef().update({ phase: 'mission' });
      await persistMissionRuntime();
      startTechnicianTimer();

      emit('mission:started', {
        mission: missionSummary(techMissionDef),
        puzzle: CampaignEngine.getPuzzleForRole(techMissionDef, 0, 'technician'),
        puzzleIndex: 0,
        totalPuzzles: techMissionDef.puzzles.length,
        timeLeft: techRuntime.timeLeft,
        resources: campaign.resources,
        isReplay: check.isReplay,
        attempts: 0, hintsUsed: 0,
        missionHintsUsed: 0,
        missionHintsRemaining: missionHintsRemaining(techMissionDef, 0)
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

  /**
   * « REJOUER LA CAMPAGNE » / New Game+ — uniquement disponible depuis le Hub
   * une fois la campagne terminée (`campaign.ending` défini). Contrairement à
   * `campaign:reset` (remise à zéro totale, cycle 0, utilisée par le bouton de
   * développement/débogage), `campaign:replay` incrémente `ngPlus` et conserve
   * `bestStars` (record historique) — voir CampaignEngine.restartCampaign.
   */
  async function authorityCampaignReplay(requesterRole, isLocal) {
    try {
      const phaseSnap = await roomRef('phase').once('value');
      if (phaseSnap.val() !== 'hub') return authorityError('Impossible de rejouer en pleine mission', requesterRole, isLocal);
      const currentSnap = await roomRef('campaign').once('value');
      const current = CampaignEngine.sanitizeCampaign(currentSnap.val());
      if (!current.ending) return authorityError("La campagne n'est pas encore terminée", requesterRole, isLocal);
      const campaign = CampaignEngine.restartCampaign(current);
      await roomRef().update({
        campaign,
        roomEvent: { type: 'campaign:replayed', ts: Date.now(), onlyRole: null }
      });
      emit('campaign:replay', { ngPlus: campaign.ngPlus });
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
      const hint = CampaignEngine.getHint(techMissionDef, puzzleIndex, puzzleState.hintsUsed, techRuntime.totalHints);
      if (hint.text) {
        puzzleState.hintsUsed++;
        techRuntime.totalHints++;
        // Coût concret de l'indice : temps de mission et/ou ressources de
        // campagne, en plus de la pénalité d'étoiles déjà induite par
        // totalHints > 0 dans CampaignEngine.computeStars.
        let resourcesAfterCost = techRuntime.resources;
        if (hint.cost) {
          if (Number.isFinite(hint.cost.time) && hint.cost.time > 0) {
            techRuntime.timeLeft = Math.max(1, techRuntime.timeLeft - hint.cost.time);
          }
          if (hint.cost.resourceDelta) {
            const campaignSnap = await roomRef('campaign').once('value');
            const campaign = CampaignEngine.sanitizeCampaign(campaignSnap.val());
            CampaignEngine.applyResourceDelta(campaign, hint.cost.resourceDelta);
            await roomRef('campaign').set(campaign);
            techRuntime.resources = campaign.resources;
            resourcesAfterCost = campaign.resources;
          }
        }
        techRuntime.lastEvent = bumpEvent('hint', {
          puzzleIndex, text: hint.text, hintsRemaining: hint.hintsRemaining,
          cost: hint.cost || null, timeLeft: techRuntime.timeLeft, resources: resourcesAfterCost, forRole: null,
          missionHintsUsed: techRuntime.totalHints,
          missionHintsRemaining: missionHintsRemaining(techMissionDef, techRuntime.totalHints)
        });
        await persistMissionRuntime();
        emit('hint:response', {
          puzzleIndex, text: hint.text, hintsRemaining: hint.hintsRemaining, cost: hint.cost || null, timeLeft: techRuntime.timeLeft, resources: resourcesAfterCost,
          missionHintsUsed: techRuntime.totalHints,
          missionHintsRemaining: missionHintsRemaining(techMissionDef, techRuntime.totalHints)
        });
      } else {
        techRuntime.lastEvent = bumpEvent('hint', { puzzleIndex, text: null, message: 'Aucun indice supplémentaire disponible.', forRole: requesterRole });
        await persistMissionRuntime();
        if (isLocal) emit('hint:response', { puzzleIndex, text: null, hintsRemaining: 0, message: 'Aucun indice supplémentaire disponible.' });
      }
    } catch (e) { /* ignore */ }
  }

  async function authorityPuzzleAction(action, requesterRole, isLocal) {
    if (!techRuntime || !techMissionDef) return;
    if (requesterRole !== 'operator') return authorityError("Seul l'Opérateur peut agir sur ce panneau", requesterRole, isLocal);

    const puzzleIndex = techRuntime.puzzleIndex;
    const puzzle = techMissionDef.puzzles[puzzleIndex];
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
          // Rejeu de mission : la conséquence narrative (ressources/flags) ne
          // doit s'appliquer qu'à la toute première réussite — voir la règle
          // documentée sur CampaignEngine.canStartMission/completeMission.
          // Le timeDelta, lui, reste un simple ajustement du minuteur de
          // CETTE exécution de mission : il s'applique toujours.
          if (!techRuntime.isReplay) CampaignEngine.applyConsequence(campaign, result.consequence);
          if (typeof result.consequence.timeDelta === 'number') {
            techRuntime.timeLeft = Math.max(1, techRuntime.timeLeft + result.consequence.timeDelta);
          }
          techRuntime.choiceLog[puzzle.id] = result.chosenOptionId;
        }
        await roomRef('campaign').set(campaign);
        techRuntime.resources = campaign.resources;
        techRuntime.lastEvent = bumpEvent('solved', { puzzleIndex, message: result.message, attempts: puzzleState.attempts });
        await persistMissionRuntime();

        emit('puzzle:solved', { message: result.message, puzzleIndex, resources: campaign.resources, timeLeft: techRuntime.timeLeft, attempts: puzzleState.attempts });

        const missionIdAtSolve = techMissionDef.id;
        setTimeout(async () => {
          if (!techRuntime || !techMissionDef || techMissionDef.id !== missionIdAtSolve) return;
          const next = puzzleIndex + 1;
          if (next >= techMissionDef.puzzles.length) {
            await finishMission(true);
          } else {
            techRuntime.puzzleIndex = next;
            techRuntime.lastEvent = bumpEvent('next', { puzzleIndex: next });
            await persistMissionRuntime();
            emit('puzzle:next', {
              puzzle: CampaignEngine.getPuzzleForRole(techMissionDef, next, 'technician'),
              puzzleIndex: next,
              totalPuzzles: techMissionDef.puzzles.length,
              module: techMissionDef.puzzles[next].module,
              timeLeft: techRuntime.timeLeft,
              attempts: 0, hintsUsed: 0,
              missionHintsUsed: techRuntime.totalHints,
              missionHintsRemaining: missionHintsRemaining(techMissionDef, techRuntime.totalHints)
            });
          }
        }, 2500);
      } else {
        // ── Pénalité de tentative erronée (temps et/ou ressources) ──
        // Configurable par puzzle dans missions-data.js (`attemptTimePenalty`,
        // `attemptResourcePenalty`), durcie par New Game+ (voir
        // CampaignEngine.getEffectiveMission). Surfacée aux DEUX joueurs via
        // `puzzle:failed`.
        let timePenalty = 0;
        let resourcePenalty = null;
        let resourcesAfterPenalty = techRuntime.resources;
        if (Number.isFinite(puzzle.attemptTimePenalty) && puzzle.attemptTimePenalty > 0) {
          timePenalty = puzzle.attemptTimePenalty;
          techRuntime.timeLeft = Math.max(1, techRuntime.timeLeft - timePenalty);
        }
        if (puzzle.attemptResourcePenalty) {
          const campaignSnap = await roomRef('campaign').once('value');
          const campaign = CampaignEngine.sanitizeCampaign(campaignSnap.val());
          CampaignEngine.applyResourceDelta(campaign, puzzle.attemptResourcePenalty);
          await roomRef('campaign').set(campaign);
          techRuntime.resources = campaign.resources;
          resourcesAfterPenalty = campaign.resources;
          resourcePenalty = puzzle.attemptResourcePenalty;
        }

        // ── Nombre de tentatives maximal dépassé : échec immédiat de la mission ──
        if (Number.isFinite(puzzle.maxAttempts) && puzzleState.attempts >= puzzle.maxAttempts) {
          techRuntime.lastEvent = bumpEvent('failed', {
            puzzleIndex, message: result.message,
            timePenalty, resourcePenalty, timeLeft: techRuntime.timeLeft, resources: resourcesAfterPenalty,
            attempts: puzzleState.attempts, maxAttempts: puzzle.maxAttempts
          });
          await persistMissionRuntime();
          emit('puzzle:failed', {
            message: result.message, puzzleIndex, timePenalty, resourcePenalty, timeLeft: techRuntime.timeLeft, resources: resourcesAfterPenalty,
            attempts: puzzleState.attempts, maxAttempts: puzzle.maxAttempts
          });
          await finishMission(false, 'TROP DE TENTATIVES SUR CE MODULE');
          return;
        }

        techRuntime.lastEvent = bumpEvent('failed', {
          puzzleIndex, message: result.message,
          timePenalty, resourcePenalty, timeLeft: techRuntime.timeLeft, resources: resourcesAfterPenalty,
          attempts: puzzleState.attempts, maxAttempts: Number.isFinite(puzzle.maxAttempts) ? puzzle.maxAttempts : null
        });
        await persistMissionRuntime();
        emit('puzzle:failed', {
          message: result.message, puzzleIndex, timePenalty, resourcePenalty, timeLeft: techRuntime.timeLeft, resources: resourcesAfterPenalty,
          attempts: puzzleState.attempts, maxAttempts: Number.isFinite(puzzle.maxAttempts) ? puzzle.maxAttempts : null
        });
      }
    } catch (e) { /* ignore */ }
  }

  async function finishMission(win, failReason) {
    stopTechnicianTimer();
    const mission = techMissionDef;
    if (!mission) return;
    try {
      const campaignSnap = await roomRef('campaign').once('value');
      const campaign = CampaignEngine.sanitizeCampaign(campaignSnap.val());
      const { result, newlyUnlocked, ending } = CampaignEngine.completeMission(campaign, mission, techRuntime, win);

      const resultNode = win
        ? { kind: 'complete', missionId: mission.id, stars: result.stars, timeLeft: result.timeLeft, debrief: mission.debrief.success, resourceReward: mission.resourceReward, resources: campaign.resources, newlyUnlocked, ending, isReplay: result.isReplay, ts: Date.now() }
        : { kind: 'gameover', missionId: mission.id, reason: failReason || 'TEMPS ÉCOULÉ', debrief: mission.debrief.fail, resources: campaign.resources, ts: Date.now() };

      await roomRef().update({ phase: 'hub', mission: null, campaign, result: resultNode });

      techRuntime = null; techMissionDef = null;

      if (win) {
        emit('mission:complete', { missionId: mission.id, stars: result.stars, timeLeft: result.timeLeft, debrief: mission.debrief.success, resourceReward: mission.resourceReward, resources: campaign.resources, newlyUnlocked, ending, isReplay: result.isReplay });
      } else {
        emit('game:over', { win: false, reason: failReason || 'TEMPS ÉCOULÉ', debrief: mission.debrief.fail, resources: campaign.resources });
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
          // Recalcule la version « effective » (NG+) de la mission à partir du
          // cycle enregistré au démarrage de CETTE exécution (`missionNode.ngPlus`),
          // pas du cycle courant de la campagne — ils coïncident toujours en
          // pratique (campaign:replay n'est permis qu'en phase 'hub'), mais on
          // reste défensif en cas d'état RTDB partiellement écrit.
          const rawMission = CampaignEngine.findMission(missionNode.missionId);
          techMissionDef = CampaignEngine.getEffectiveMission(rawMission, missionNode.ngPlus || 0);
          techRuntime = {
            puzzleIndex: missionNode.puzzleIndex,
            timeLeft: missionNode.timeLeft,
            resources: missionNode.resources,
            puzzleStates: missionNode.puzzleStates || [],
            totalAttempts: missionNode.totalAttempts || 0,
            totalHints: missionNode.totalHints || 0,
            totalTimePenalty: missionNode.totalTimePenalty || 0,
            choiceLog: missionNode.choiceLog || {},
            isReplay: !!missionNode.isReplay,
            ngPlus: missionNode.ngPlus || 0,
            eventSeq: missionNode.eventSeq || 0,
            lastEvent: missionNode.lastEvent || null
          };
          attachRequestsListener();
          startTechnicianTimer();
        } else {
          attachOperatorMissionListener((missionNode.lastEvent && missionNode.lastEvent.seq) || 0, missionNode.timeLeft);
        }
        attachResultListener();

        const mission = techMissionDef || CampaignEngine.getEffectiveMission(CampaignEngine.findMission(missionNode.missionId), missionNode.ngPlus || 0);
        const resumePuzzleState = (missionNode.puzzleStates || [])[missionNode.puzzleIndex] || null;
        emit('mission:resume', {
          code, role,
          mission: missionSummary(mission),
          puzzle: CampaignEngine.getPuzzleForRole(mission, missionNode.puzzleIndex, role),
          puzzleIndex: missionNode.puzzleIndex,
          totalPuzzles: missionNode.totalPuzzles,
          timeLeft: missionNode.timeLeft,
          resources: missionNode.resources,
          attempts: resumePuzzleState ? (resumePuzzleState.attempts || 0) : 0,
          hintsUsed: resumePuzzleState ? (resumePuzzleState.hintsUsed || 0) : 0,
          missionHintsUsed: missionNode.totalHints || 0,
          missionHintsRemaining: missionHintsRemaining(mission, missionNode.totalHints || 0)
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

      case 'campaign:replay':
        return role === 'technician'
          ? processAuthorityRequest('campaign:replay', {}, 'technician', true)
          : enqueueRequest('campaign:replay', {});

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
