function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t,i) => {
    t.classList.toggle('active', (name==='create' && i===0)||(name==='join' && i===1));
  });
  document.getElementById('tab-create').classList.toggle('active', name==='create');
  document.getElementById('tab-join').classList.toggle('active', name==='join');
}

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
  const role = sessionStorage.getItem('sz_role');
  setTimeout(() => {
    window.location.href = role === 'technician' ? 'technician.html' : 'operator.html';
  }, 800);
});

WS.on('error', (msg) => {
  document.getElementById('error-msg').textContent = '⚠ ' + msg.message;
});

function createRoom() {
  WS.send({ type: 'room:create' });
}

function joinRoom() {
  const code = document.getElementById('input-code').value.toUpperCase().trim();
  if (code.length !== 4) {
    document.getElementById('error-msg').textContent = '⚠ Le code doit faire 4 caractères.';
    return;
  }
  document.getElementById('error-msg').textContent = '';
  WS.send({ type: 'room:join', code });
}

// Permettre de rejoindre avec Entrée
document.getElementById('input-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinRoom();
  // Forcer majuscules
  setTimeout(() => { e.target.value = e.target.value.toUpperCase(); }, 0);
});

