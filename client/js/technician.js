const role = 'technician';
let currentPuzzle = null;
let totalPuzzles = 5;
let puzzleIndex = 0;
let timerInterval = null;

WS.connect(() => {
  const room = sessionStorage.getItem('sz_room');
  if (!room) { location.href = '/'; return; }
  // Re-join via storage (page reload protection is minimal in this v1)
});

Chat.init(role);

// ── Helpers UI ──
function log(text, type='info') {
  const el = document.getElementById('log-content');
  const colors = { info: 'var(--green-dim)', ok: 'var(--green)', error: 'var(--red)', warn: 'var(--amber)' };
  const prefix = { info:'[SYS]', ok:'[OK] ', error:'[ERR]', warn:'[WRN]' };
  const line = document.createElement('div');
  line.style.color = colors[type] || colors.info;
  line.textContent = `${prefix[type]||'[SYS]'} ${text}`;
  el.appendChild(line);
  el.parentElement.scrollTop = el.parentElement.scrollHeight;
}

function showNotif(text, type='success') {
  const n = document.createElement('div');
  n.className = `notif ${type}`;
  n.textContent = text;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

function setTimer(seconds) {
  const m = String(Math.floor(seconds/60)).padStart(2,'0');
  const s = String(seconds%60).padStart(2,'0');
  const el = document.getElementById('timer-display');
  el.textContent = `${m}:${s}`;
  el.className = seconds<=60 ? 'danger' : seconds<=180 ? 'warning' : '';
}

function buildDots(total, current) {
  const el = document.getElementById('puzzle-dots');
  el.innerHTML = '';
  for (let i=0; i<total; i++) {
    const d = document.createElement('div');
    d.className = 'progress-dot' + (i<current?' done':i===current?' current':'');
    el.appendChild(d);
  }
}

// ── Rendu des puzzles ──
function renderPuzzle(puzzle) {
  currentPuzzle = puzzle;
  const panel = document.getElementById('puzzle-info');
  panel.innerHTML = '';

  const title = document.createElement('div');
  title.innerHTML = `<div style="font-family:'VT323',monospace;font-size:22px;color:var(--amber);letter-spacing:2px;margin-bottom:6px;">${puzzle.data.title}</div>
  <div style="font-size:12px;color:var(--green-dim);letter-spacing:1px;margin-bottom:20px;">${puzzle.data.subtitle}</div>`;
  panel.appendChild(title);

  switch(puzzle.type) {
    case 'cross_code':    renderCrossCode(panel, puzzle.data); break;
    case 'mirror_sequence': renderMirrorSeq(panel, puzzle.data); break;
    case 'cipher':        renderCipher(panel, puzzle.data); break;
    case 'calibration':   renderCalibration(panel, puzzle.data); break;
    case 'final_protocol':renderFinalProtocol(panel, puzzle.data); break;
  }
}

function renderCrossCode(panel, data) {
  const tbl = document.createElement('table');
  tbl.className = 'mapping-table';
  tbl.innerHTML = '<tr><th style="color:var(--amber);text-align:left;padding:6px 14px;border:1px solid var(--border);">SYMBOLE</th><th style="color:var(--green);text-align:left;padding:6px 14px;border:1px solid var(--border);">CODE</th></tr>';
  Object.entries(data.mapping).forEach(([sym,code]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${sym}</td><td>${code}</td>`;
    tbl.appendChild(tr);
  });
  panel.appendChild(tbl);

  const seqDiv = document.createElement('div');
  seqDiv.style.marginTop='20px';
  seqDiv.innerHTML = `<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">SÉQUENCE À COMMUNIQUER :</div>`;
  data.sequence.forEach((sym,i) => {
    const sp = document.createElement('span');
    sp.className = 'seq-item';
    sp.innerHTML = `<span style="color:var(--green-dim);font-size:12px;">${i+1}.</span> ${sym}`;
    seqDiv.appendChild(sp);
  });
  panel.appendChild(seqDiv);
}

function renderMirrorSeq(panel, data) {
  const div = document.createElement('div');
  div.innerHTML = '<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">ACTIVEZ DANS CET ORDRE :</div>';
  data.sequence.forEach((color,i) => {
    const sp = document.createElement('span');
    sp.className = `seq-item color-${color}`;
    sp.innerHTML = `<span style="font-size:12px;">${i+1}.</span> ${color.toUpperCase()}`;
    div.appendChild(sp);
  });
  panel.appendChild(div);
}

function renderCipher(panel, data) {
  const div = document.createElement('div');
  div.innerHTML = '<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">CLÉ : CHIFFRÉ → ORIGINAL</div>';
  const grid = document.createElement('div');
  grid.className = 'cipher-key';
  Object.entries(data.key).forEach(([plain, enc]) => {
    const pair = document.createElement('div');
    pair.className = 'cipher-pair';
    pair.innerHTML = `<div class="enc">${enc}</div><div class="plain">${plain}</div>`;
    grid.appendChild(pair);
  });
  div.appendChild(grid);
  panel.appendChild(div);
}

function renderCalibration(panel, data) {
  const div = document.createElement('div');
  data.targets.forEach(t => {
    const item = document.createElement('div');
    item.className = 'target-item';
    item.innerHTML = `<div class="t-name">${t.name}</div><div><span class="t-val">${t.value}</span><span class="t-unit">${t.unit}</span></div>`;
    div.appendChild(item);
  });
  panel.appendChild(div);
  log(`Calibrage requis: ${data.targets.map(t=>`${t.name}=${t.value}${t.unit}`).join(', ')}`, 'warn');
}

function renderFinalProtocol(panel, data) {
  const div = document.createElement('div');
  data.steps.forEach((s,i) => {
    const item = document.createElement('div');
    item.className = 'step-item' + (i===0?' active':'');
    item.id = `step-${i}`;
    item.innerHTML = `<div class="step-num">ÉTAPE ${s.order}</div><div class="step-txt">${s.instruction}</div>`;
    div.appendChild(item);
  });
  panel.appendChild(div);
  log('Protocole final initialisé. Lisez les étapes à l\'Opérateur.', 'warn');
}

// ── Events WebSocket ──
WS.on('game:started', (msg) => {
  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('game-area').style.display = 'grid';
  puzzleIndex = msg.puzzleIndex;
  totalPuzzles = msg.totalPuzzles;
  document.getElementById('module-name').textContent = msg.module;
  document.getElementById('footer-status').textContent = `PUZZLE ${puzzleIndex+1}/${totalPuzzles}`;
  buildDots(totalPuzzles, puzzleIndex);
  renderPuzzle(msg.puzzle);
  log(`Mission démarrée — ${msg.module}`, 'ok');
});

WS.on('puzzle:next', (msg) => {
  puzzleIndex = msg.puzzleIndex;
  document.getElementById('module-name').textContent = msg.module;
  document.getElementById('footer-status').textContent = `PUZZLE ${puzzleIndex+1}/${totalPuzzles}`;
  buildDots(totalPuzzles, puzzleIndex);
  renderPuzzle(msg.puzzle);
  log(`Nouveau module : ${msg.module}`, 'ok');
});

WS.on('puzzle:solved', (msg) => {
  showNotif('✅ ' + msg.message, 'success');
  log(msg.message, 'ok');
});

WS.on('puzzle:failed', (msg) => {
  showNotif('❌ ' + msg.message, 'error');
  log(msg.message, 'error');
});

WS.on('timer', (msg) => { setTimer(msg.timeLeft); });

WS.on('game:over', (msg) => {
  // Uniquement pour la défaite (temps écoulé)
  if (msg.win) return;
  const overlay = document.getElementById('end-overlay');
  const card = document.getElementById('end-card');
  overlay.classList.add('visible');
  card.className = 'lose';
  document.getElementById('end-title').textContent = '💀 DÉFAITE';
  document.getElementById('end-reason').textContent = msg.reason;
});

WS.on('mission:complete', () => {
  const overlay = document.getElementById('mission-complete-overlay');
  overlay.classList.add('visible');
  log('Mission accomplie ! Station réactivée.', 'ok');
  document.getElementById('btn-hub').addEventListener('click', () => {
    sessionStorage.setItem('sz_phase', 'hub');
    location.href = '/hub';
  });
});

WS.on('player:disconnected', () => {
  showNotif('⚠ L\'autre joueur s\'est déconnecté', 'error');
  log('Opérateur déconnecté !', 'error');
});

// ── Lancement ──
document.getElementById('btn-start').addEventListener('click', () => {
  WS.send({ type: 'game:start' });
});

