const role = 'technician';
const RESOURCE_LABELS = { integrity: 'INTÉGRITÉ', trust: 'CONFIANCE', intel: 'RENSEIGNEMENT' };

let currentPuzzle = null;
let totalPuzzles = 1;
let puzzleIndex = 0;
let lastResources = null;
const roomCode = sessionStorage.getItem('sz_room');

if (!roomCode) { location.href = '/'; }

Chat.init(role);

WS.connect(() => {
  StationAuth.currentUser().then(user => {
    if (!user) { location.href = '/'; return; }
    WS.send({ type: 'session:resume', code: roomCode, role, userId: user.uid });
  }).catch(() => { location.href = '/'; });
});

// ── Helpers UI ──
function log(text, type = 'info') {
  const el = document.getElementById('log-content');
  const colors = { info: 'var(--green-dim)', ok: 'var(--green)', error: 'var(--red)', warn: 'var(--amber)' };
  const prefix = { info: '[SYS]', ok: '[OK] ', error: '[ERR]', warn: '[WRN]' };
  const line = document.createElement('div');
  line.style.color = colors[type] || colors.info;
  line.textContent = `${prefix[type] || '[SYS]'} ${text}`;
  el.appendChild(line);
  el.parentElement.scrollTop = el.parentElement.scrollHeight;
}

function showNotif(text, type = 'success') {
  const n = document.createElement('div');
  n.className = `notif ${type}`;
  n.textContent = text;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

function setTimer(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  const el = document.getElementById('timer-display');
  el.textContent = `${m}:${s}`;
  el.className = seconds <= 60 ? 'danger' : seconds <= 180 ? 'warning' : '';
}

function buildDots(total, current) {
  const el = document.getElementById('puzzle-dots');
  el.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'progress-dot' + (i < current ? ' done' : i === current ? ' current' : '');
    el.appendChild(d);
  }
}

function logResourceDiff(resources) {
  if (!lastResources) { lastResources = { ...resources }; return; }
  Object.keys(resources).forEach(key => {
    const delta = resources[key] - lastResources[key];
    if (delta !== 0) {
      const label = RESOURCE_LABELS[key] || key.toUpperCase();
      log(`${label} ${delta > 0 ? '+' : ''}${delta} (→ ${resources[key]})`, delta > 0 ? 'ok' : 'warn');
    }
  });
  lastResources = { ...resources };
}

function setMissionBanner(mission) {
  const el = document.getElementById('mission-banner');
  el.innerHTML = `<span class="mb-title">${mission.icon || ''} ${mission.title}</span>${mission.briefing}`;
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

  switch (puzzle.type) {
    case 'cross_code':
    case 'symbol_code': renderCrossCode(panel, puzzle.data); break;
    case 'mirror_sequence': renderMirrorSeq(panel, puzzle.data); break;
    case 'cipher': renderCipher(panel, puzzle.data); break;
    case 'calibration': renderCalibration(panel, puzzle.data); break;
    case 'final_protocol': renderFinalProtocol(panel, puzzle.data); break;
    case 'wire_panel': renderWirePanel(panel, puzzle.data); break;
    case 'choice': renderChoice(panel, puzzle.data); break;
  }

  const hintBox = document.createElement('div');
  hintBox.id = 'hint-container';
  panel.appendChild(hintBox);
}

function renderCrossCode(panel, data) {
  const tbl = document.createElement('table');
  tbl.className = 'mapping-table';
  tbl.innerHTML = '<tr><th style="color:var(--amber);text-align:left;padding:6px 14px;border:1px solid var(--border);">SYMBOLE</th><th style="color:var(--green);text-align:left;padding:6px 14px;border:1px solid var(--border);">CODE</th></tr>';
  Object.entries(data.mapping).forEach(([sym, code]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${sym}</td><td>${code}</td>`;
    tbl.appendChild(tr);
  });
  panel.appendChild(tbl);

  const seqDiv = document.createElement('div');
  seqDiv.style.marginTop = '20px';
  seqDiv.innerHTML = `<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">SÉQUENCE À COMMUNIQUER :</div>`;
  data.sequence.forEach((sym, i) => {
    const sp = document.createElement('span');
    sp.className = 'seq-item';
    sp.innerHTML = `<span style="color:var(--green-dim);font-size:12px;">${i + 1}.</span> ${sym}`;
    seqDiv.appendChild(sp);
  });
  panel.appendChild(seqDiv);
}

function renderMirrorSeq(panel, data) {
  const div = document.createElement('div');
  div.innerHTML = '<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">ACTIVEZ DANS CET ORDRE :</div>';
  data.sequence.forEach((color, i) => {
    const sp = document.createElement('span');
    sp.className = `seq-item color-${color}`;
    sp.innerHTML = `<span style="font-size:12px;">${i + 1}.</span> ${color.toUpperCase()}`;
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
  log(`Calibrage requis: ${data.targets.map(t => `${t.name}=${t.value}${t.unit}`).join(', ')}`, 'warn');
}

function renderFinalProtocol(panel, data) {
  const div = document.createElement('div');
  data.steps.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'step-item' + (i === 0 ? ' active' : '');
    item.id = `step-${i}`;
    item.innerHTML = `<div class="step-num">ÉTAPE ${s.order}</div><div class="step-txt">${s.instruction}</div>`;
    div.appendChild(item);
  });
  panel.appendChild(div);
  log('Protocole final initialisé. Lisez les étapes à l\'Opérateur.', 'warn');
}

function renderWirePanel(panel, data) {
  const intro = document.createElement('div');
  intro.style.cssText = 'font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;';
  intro.textContent = 'SCHÉMA DE CÂBLAGE — DICTEZ CHAQUE PAIRE :';
  panel.appendChild(intro);

  const tbl = document.createElement('table');
  tbl.className = 'mapping-table';
  tbl.innerHTML = '<tr><th style="color:var(--amber);text-align:left;padding:6px 14px;border:1px solid var(--border);">FIL</th><th style="color:var(--green);text-align:left;padding:6px 14px;border:1px solid var(--border);">PORT</th></tr>';
  data.schema.forEach(({ wire, port }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${wire}</td><td>${port}</td>`;
    tbl.appendChild(tr);
  });
  panel.appendChild(tbl);
}

function renderChoice(panel, data) {
  const narrative = document.createElement('div');
  narrative.className = 'choice-narrative';
  narrative.textContent = data.narrative;
  panel.appendChild(narrative);

  const list = document.createElement('div');
  data.options.forEach(o => {
    const row = document.createElement('div');
    row.className = 'choice-option-row';
    row.innerHTML = `<span class="opt-label">${o.label}</span><span class="opt-hint">${o.hint || ''}</span>`;
    list.appendChild(row);
  });
  panel.appendChild(list);
  log('Décision requise : discutez avec l\'Opérateur avant validation.', 'warn');
}

// ── Application de l'état de mission (démarrage ou reprise) ──
function applyMissionState(msg) {
  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('game-area').style.display = 'grid';
  puzzleIndex = msg.puzzleIndex;
  totalPuzzles = msg.totalPuzzles;
  if (msg.mission) setMissionBanner(msg.mission);
  document.getElementById('module-name').textContent = msg.puzzle.module;
  document.getElementById('footer-status').textContent = `PUZZLE ${puzzleIndex + 1}/${totalPuzzles}`;
  buildDots(totalPuzzles, puzzleIndex);
  renderPuzzle(msg.puzzle);
  if (msg.resources) { lastResources = { ...msg.resources }; }
  setTimer(msg.timeLeft);
}

// ── Events WebSocket ──
WS.on('hub:state', () => {
  // Pas de mission en cours pour cette room : retour au hub.
  window.location.href = '/hub';
});

WS.on('session:expired', () => {
  sessionStorage.clear();
  window.location.href = '/';
});

WS.on('mission:resume', (msg) => {
  applyMissionState(msg);
  log(`Session reprise — ${msg.puzzle.module}`, 'ok');
});

WS.on('mission:started', (msg) => {
  applyMissionState(msg);
  log(`Mission démarrée — ${msg.puzzle.module}`, 'ok');
});

WS.on('puzzle:next', (msg) => {
  puzzleIndex = msg.puzzleIndex;
  document.getElementById('module-name').textContent = msg.module;
  document.getElementById('footer-status').textContent = `PUZZLE ${puzzleIndex + 1}/${totalPuzzles}`;
  buildDots(totalPuzzles, puzzleIndex);
  renderPuzzle(msg.puzzle);
  log(`Nouveau module : ${msg.module}`, 'ok');
});

WS.on('puzzle:solved', (msg) => {
  showNotif('✅ ' + msg.message, 'success');
  log(msg.message, 'ok');
  if (msg.resources) logResourceDiff(msg.resources);
});

WS.on('puzzle:failed', (msg) => {
  showNotif('❌ ' + msg.message, 'error');
  log(msg.message, 'error');
});

WS.on('hint:response', (msg) => {
  const container = document.getElementById('hint-container');
  if (!container) return;
  if (msg.text) {
    const box = document.createElement('div');
    box.className = 'hint-box';
    box.textContent = '💡 ' + msg.text;
    container.appendChild(box);
    log('Indice révélé.', 'warn');
  } else {
    showNotif(msg.message || 'Aucun indice disponible', 'error');
  }
});

WS.on('timer', (msg) => { setTimer(msg.timeLeft); });

WS.on('game:over', (msg) => {
  if (msg.win) return;
  const overlay = document.getElementById('end-overlay');
  const card = document.getElementById('end-card');
  overlay.classList.add('visible');
  card.className = 'lose';
  document.getElementById('end-title').textContent = '💀 DÉFAITE';
  document.getElementById('end-reason').textContent = msg.reason;
  document.getElementById('end-debrief').textContent = msg.debrief || '';
});

WS.on('mission:complete', (msg) => {
  const overlay = document.getElementById('mission-complete-overlay');
  overlay.classList.add('visible');
  document.getElementById('mc-stars').textContent = '★'.repeat(msg.stars) + '☆'.repeat(3 - msg.stars);
  document.getElementById('mc-debrief').textContent = msg.debrief;
  const endingEl = document.getElementById('mc-ending');
  if (msg.ending) {
    endingEl.style.display = 'block';
    endingEl.textContent = `🏁 FIN DE CAMPAGNE : ${msg.ending.title} — ${msg.ending.text}`;
  } else {
    endingEl.style.display = 'none';
  }
  log('Mission accomplie ! Station réactivée.', 'ok');
});

WS.on('mission:aborted', () => {
  window.location.href = '/hub';
});

WS.on('player:disconnected', () => {
  showNotif('⚠ L\'autre joueur s\'est déconnecté', 'error');
  log('Opérateur déconnecté !', 'error');
});

WS.on('player:reconnected', () => {
  showNotif('✅ L\'autre joueur est reconnecté', 'success');
});

WS.on('error', (msg) => {
  showNotif('⚠ ' + msg.message, 'error');
});

// ── Actions locales ──
document.getElementById('btn-hub').addEventListener('click', () => { location.href = '/hub'; });
document.getElementById('btn-end-hub').addEventListener('click', () => { location.href = '/hub'; });
document.getElementById('btn-hint').addEventListener('click', () => { WS.send({ type: 'hint:request' }); });
document.getElementById('btn-abandon').addEventListener('click', () => {
  if (confirm('Abandonner la mission en cours et revenir au Hub ?')) {
    WS.send({ type: 'hub:return' });
  }
});
