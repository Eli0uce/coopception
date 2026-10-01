function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t,i) => {
    t.classList.toggle('active', (name==='create' && i===0)||(name==='join' && i===1));
  });
  document.getElementById('tab-create').classList.toggle('active', name==='create');
  document.getElementById('tab-join').classList.toggle('active', name==='join');
}

let authenticated = false;

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

StationAuth.init().then(user => {
  authenticated = !!user;
  if (user) {
    document.getElementById('auth-form').style.display = 'none';
    document.getElementById('auth-user').style.display = 'block';
    document.getElementById('auth-email-label').textContent = `CONNECTÉ : ${user.email}`;
  }
}).catch(error => setAuthStatus(StationAuth.errorMessage(error), true));

document.getElementById('auth-login').addEventListener('click', async () => {
  try {
    await StationAuth.signIn(document.getElementById('auth-email').value.trim(), document.getElementById('auth-password').value);
    location.reload();
  } catch (error) { setAuthStatus(StationAuth.errorMessage(error), true); }
});

document.getElementById('auth-register').addEventListener('click', async () => {
  try {
    await StationAuth.signUp(document.getElementById('auth-email').value.trim(), document.getElementById('auth-password').value);
    location.reload();
  } catch (error) { setAuthStatus(StationAuth.errorMessage(error), true); }
});

document.getElementById('auth-logout').addEventListener('click', () => StationAuth.signOut().then(() => location.reload()));

WS.connect();

WS.on('room:created', (msg) => {
  document.getElementById('create-init').style.display = 'none';
  document.getElementById('create-waiting').style.display = 'block';
  document.getElementById('room-code-text').textContent = msg.code;
  sessionStorage.setItem('sz_role', 'technician');
  sessionStorage.setItem('sz_room', msg.code);
});

WS.on('room:joined', (msg) => {
  sessionStorage.setItem('sz_role', 'operator');
  sessionStorage.setItem('sz_room', msg.code);
});

WS.on('room:ready', () => {
  setTimeout(() => {
    window.location.href = 'hub.html';
  }, 800);
});

WS.on('error', (msg) => {
  document.getElementById('error-msg').textContent = '⚠ ' + msg.message;
});

function createRoom() {
  requireAuth(() => StationAuth.currentUser().then(user => WS.send({ type: 'room:create', userId: user.uid })));
}

function joinRoom() {
  const code = document.getElementById('input-code').value.toUpperCase().trim();
  if (code.length !== 4) {
    document.getElementById('error-msg').textContent = '⚠ Le code doit faire 4 caractères.';
    return;
  }
  document.getElementById('error-msg').textContent = '';
  requireAuth(() => StationAuth.currentUser().then(user => WS.send({ type: 'room:join', code, userId: user.uid })));
}

// Permettre de rejoindre avec Entrée
document.getElementById('input-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinRoom();
  // Forcer majuscules
  setTimeout(() => { e.target.value = e.target.value.toUpperCase(); }, 0);
});
