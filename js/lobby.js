function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t,i) => {
    t.classList.toggle('active', (name==='create' && i===0)||(name==='join' && i===1));
  });
  document.getElementById('tab-create').classList.toggle('active', name==='create');
  document.getElementById('tab-join').classList.toggle('active', name==='join');
}

let authenticated = false;
let pending = false; // vrai pendant room:create / room:join en attente de réponse

function setAuthStatus(text, error = false) {
  const el = document.getElementById('auth-status');
  el.textContent = text;
  el.style.color = error ? 'var(--red)' : 'var(--green)';
}

function requireAuth(action) {
  if (!authenticated) {
    setAuthStatus('⚠ Connectez-vous avant de créer ou rejoindre une room.', true);
    return;
  }
  action();
}

function setConnStatus(state, text) {
  const el = document.getElementById('conn-status');
  const label = document.getElementById('conn-status-text');
  if (!el) return;
  el.classList.remove('online', 'offline', 'pending');
  el.classList.add(state);
  label.textContent = text;
}

function setStateLine(id, text, active = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('active-state', active);
}

function setPending(isPending) {
  pending = isPending;
  const createBtn = document.getElementById('btn-create-room');
  const joinBtn = document.getElementById('btn-join-room');
  if (createBtn) createBtn.disabled = isPending;
  if (joinBtn) joinBtn.disabled = isPending;
}

Onboarding.init();

StationAuth.init().then(user => {
  authenticated = !!user;
  if (user) {
    document.getElementById('auth-form').style.display = 'none';
    document.getElementById('auth-user').style.display = 'block';
    document.getElementById('auth-email-label').textContent = `CONNECTÉ : ${user.displayName || user.email}`;
  }
}).catch(error => setAuthStatus(StationAuth.errorMessage(error), true));

document.getElementById('auth-login').addEventListener('click', async () => {
  setAuthStatus('Ouverture de la fenêtre Google…');
  try {
    const result = await StationAuth.signInWithGoogle();
    // null = bascule en redirection, la page va se recharger d'elle-même
    if (result) location.reload();
  } catch (error) { setAuthStatus(StationAuth.errorMessage(error), true); }
});

document.getElementById('auth-logout').addEventListener('click', () => StationAuth.signOut().then(() => location.reload()));

WS.connect();

// ── Statut de connexion Firebase Realtime Database (`.info/connected`) ──
// Purement indicatif pour l'utilisateur : n'affecte jamais le protocole WS.
try {
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  setConnStatus('pending', 'CONNEXION…');
  firebase.database().ref('.info/connected').on('value', snap => {
    if (snap.val() === true) setConnStatus('online', 'CONNECTÉ');
    else setConnStatus('offline', 'HORS LIGNE — RECONNEXION…');
  });
} catch (e) {
  setConnStatus('offline', 'FIREBASE INDISPONIBLE');
}

WS.on('room:created', (msg) => {
  setPending(false);
  setStateLine('create-state-line', '');
  document.getElementById('create-init').style.display = 'none';
  document.getElementById('create-waiting').style.display = 'block';
  document.getElementById('room-code-text').textContent = msg.code;
  sessionStorage.setItem('sz_role', 'technician');
  sessionStorage.setItem('sz_room', msg.code);
});

WS.on('room:joined', (msg) => {
  setPending(false);
  setStateLine('join-state-line', '✅ Room rejointe — synchronisation avec le Technicien…', true);
  sessionStorage.setItem('sz_role', 'operator');
  sessionStorage.setItem('sz_room', msg.code);
});

WS.on('room:ready', () => {
  setStateLine('join-state-line', '🚀 Les deux joueurs sont connectés — lancement…', true);
  const waitingText = document.getElementById('waiting-text');
  if (waitingText) waitingText.textContent = '🚀 Opérateur connecté ! Lancement de la mission…';
  setTimeout(() => {
    window.location.href = 'hub.html';
  }, 800);
});

WS.on('error', (msg) => {
  setPending(false);
  setStateLine('create-state-line', '');
  setStateLine('join-state-line', '');
  document.getElementById('error-msg').textContent = '⚠ ' + msg.message;
});

function createRoom() {
  if (pending) return;
  requireAuth(() => {
    setPending(true);
    setStateLine('create-state-line', 'Création de la room…', true);
    StationAuth.currentUser().then(user => WS.send({ type: 'room:create', userId: user.uid }));
  });
}

function joinRoom() {
  if (pending) return;
  const code = document.getElementById('input-code').value.toUpperCase().trim();
  if (code.length !== 4) {
    document.getElementById('error-msg').textContent = '⚠ Le code doit faire 4 caractères.';
    return;
  }
  document.getElementById('error-msg').textContent = '';
  requireAuth(() => {
    setPending(true);
    setStateLine('join-state-line', 'Connexion à la room…', true);
    StationAuth.currentUser().then(user => WS.send({ type: 'room:join', code, userId: user.uid }));
  });
}

// Permettre de rejoindre avec Entrée
document.getElementById('input-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinRoom();
  // Forcer majuscules
  setTimeout(() => { e.target.value = e.target.value.toUpperCase(); }, 0);
});

// ── Copier le code de room dans le presse-papiers ──
document.getElementById('btn-copy-code').addEventListener('click', async () => {
  const code = document.getElementById('room-code-text').textContent.trim();
  const btn = document.getElementById('btn-copy-code');
  try {
    await navigator.clipboard.writeText(code);
  } catch (e) {
    // Repli si l'API Clipboard est indisponible (contexte non sécurisé, permissions…)
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
    document.body.removeChild(ta);
  }
  const original = btn.textContent;
  btn.textContent = '✔ COPIÉ !';
  btn.classList.add('copied');
  setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1800);
});
