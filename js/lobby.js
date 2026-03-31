GameDB.init();

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t,i) =>
    t.classList.toggle('active', (name==='create'&&i===0)||(name==='join'&&i===1)));
  document.getElementById('tab-create').classList.toggle('active', name==='create');
  document.getElementById('tab-join').classList.toggle('active', name==='join');
}

async function createRoom() {
  const btn = document.querySelector('#create-init .btn');
  btn.textContent = '⏳ CRÉATION...'; btn.disabled = true;
  try {
    const code = await GameDB.createRoom();
    sessionStorage.setItem('sz_role', 'technician');
    sessionStorage.setItem('sz_room', code);
    document.getElementById('create-init').style.display = 'none';
    document.getElementById('create-waiting').style.display = 'block';
    document.getElementById('room-code-text').textContent = code;

    GameDB.onRoomReady(() => {
      document.getElementById('create-waiting').innerHTML +=
        '<div style="color:var(--green);margin-top:10px;font-size:13px;letter-spacing:2px;">✅ Opérateur connecté ! Redirection...</div>';
      setTimeout(() => { window.location.href = 'technician.html'; }, 800);
    });
  } catch(e) {
    btn.textContent = '⚡ CRÉER LA ROOM'; btn.disabled = false;
    showError('create-error', e.message);
  }
}

async function joinRoom() {
  const code = document.getElementById('input-code').value.toUpperCase().trim();
  if (code.length !== 4) { showError('error-msg', '⚠ Le code doit faire 4 caractères.'); return; }
  document.getElementById('error-msg').textContent = '';
  const btn = document.querySelector('#tab-join .btn');
  btn.textContent = '⏳ CONNEXION...'; btn.disabled = true;
  try {
    await GameDB.joinRoom(code);
    sessionStorage.setItem('sz_role', 'operator');
    sessionStorage.setItem('sz_room', code);
    window.location.href = 'operator.html';
  } catch(e) {
    btn.textContent = '🔗 REJOINDRE'; btn.disabled = false;
    showError('error-msg', '⚠ ' + e.message);
  }
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

document.getElementById('input-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinRoom();
  setTimeout(() => { e.target.value = e.target.value.toUpperCase(); }, 0);
});

