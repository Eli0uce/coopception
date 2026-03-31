// Couche d'abstraction Firebase Realtime Database
const GameDB = (() => {
  const TIME_LIMIT = 900;
  let db = null;
  let roomCode = null;
  let myRole = null;

  function init() {
    if (FIREBASE_CONFIG.apiKey === 'VOTRE_API_KEY') {
      document.body.innerHTML = `<div style="font-family:monospace;color:#ff3333;background:#0a0a0a;padding:40px;font-size:16px;min-height:100vh;">
        <h2 style="color:#ffb000">⚠ FIREBASE NON CONFIGURÉ</h2><br>
        Ouvrez <code>js/firebase-config.js</code> et renseignez vos clés Firebase.<br><br>
        <a href="https://console.firebase.google.com" style="color:#00ff41" target="_blank">→ Créer un projet Firebase</a>
      </div>`;
      throw new Error('Firebase non configuré');
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  }

  async function createRoom() {
    let code, attempts = 0;
    do {
      code = genCode();
      const snap = await db.ref(`rooms/${code}/meta`).once('value');
      if (!snap.exists()) break;
    } while (++attempts < 10);

    await db.ref(`rooms/${code}`).set({
      meta: { technician: true, operator: false, ready: false, created: Date.now() },
      state: { phase: 'waiting', currentPuzzle: 0, startTimestamp: null, win: false, reason: '' }
    });
    db.ref(`rooms/${code}/meta/technician`).onDisconnect().set(false);
    roomCode = code; myRole = 'technician';
    return code;
  }

  async function joinRoom(code) {
    code = code.toUpperCase().trim();
    const snap = await db.ref(`rooms/${code}/meta`).once('value');
    if (!snap.exists()) throw new Error('Code de room invalide');
    const meta = snap.val();
    if (!meta.technician) throw new Error('Le Technicien n\'est pas connecté');
    if (meta.operator)    throw new Error('Room déjà complète');
    await db.ref(`rooms/${code}/meta`).update({ operator: true, ready: true });
    db.ref(`rooms/${code}/meta/operator`).onDisconnect().set(false);
    roomCode = code; myRole = 'operator';
    return 'operator';
  }

  async function startGame() {
    await db.ref(`rooms/${roomCode}/state`).update({
      phase: 'playing', currentPuzzle: 0, startTimestamp: Date.now()
    });
  }

  // Appelé par l'opérateur uniquement après validation locale
  async function submitResult(puzzleIndex, valid, message) {
    await db.ref(`rooms/${roomCode}/lastResult`).set({ puzzleIndex, valid, message, ts: Date.now() });
    if (valid) {
      const total = PUZZLES.length;
      if (puzzleIndex + 1 >= total) {
        await db.ref(`rooms/${roomCode}/state`).update({ phase:'finished', win:true, reason:'STATION RÉACTIVÉE' });
      } else {
        setTimeout(() => db.ref(`rooms/${roomCode}/state/currentPuzzle`).set(puzzleIndex + 1), 2500);
      }
    }
  }

  async function triggerTimeout() {
    const snap = await db.ref(`rooms/${roomCode}/state/phase`).once('value');
    if (snap.val() === 'playing') {
      await db.ref(`rooms/${roomCode}/state`).update({ phase:'finished', win:false, reason:'TEMPS ÉCOULÉ' });
    }
  }


  function onRoomReady(cb) {
    db.ref(`rooms/${roomCode}/meta/ready`).on('value', s => { if (s.val() === true) cb(); });
  }

  function onStateChange(cb) {
    db.ref(`rooms/${roomCode}/state`).on('value', s => { if (s.exists()) cb(s.val()); });
  }

  function onResult(cb) {
    db.ref(`rooms/${roomCode}/lastResult`).on('value', s => { if (s.exists()) cb(s.val()); });
  }

  function onChat(cb) {
    db.ref(`rooms/${roomCode}/chat`).on('child_added', s => { if (s.exists()) cb(s.val()); });
  }

  function onDisconnect(cb) {
    db.ref(`rooms/${roomCode}/meta`).on('value', s => {
      const m = s.val();
      if (m && (m.technician === false || m.operator === false) && m.ready === true) cb();
    });
  }

  function getDb()       { return db; }
  function getRole()     { return myRole; }
  function getCode()     { return roomCode; }
  function getTimeLimit(){ return TIME_LIMIT; }

  return { init, createRoom, joinRoom, startGame, submitResult, triggerTimeout, onRoomReady, onStateChange, onResult, onDisconnect, getDb, getRole, getCode, getTimeLimit };
})();

