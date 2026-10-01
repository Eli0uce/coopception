const role = 'technician';
const RESOURCE_LABELS = { integrity: 'INTÉGRITÉ', trust: 'CONFIANCE', intel: 'RENSEIGNEMENT' };

let currentPuzzle = null;
let totalPuzzles = 1;
let puzzleIndex = 0;
let lastResources = null;
let currentMaxAttempts = null;
let currentHintCost = null;
let currentHintsTotal = 0;
let missionHintsRemainingCount = null;
const roomCode = sessionStorage.getItem('sz_room');

if (!roomCode) { location.href = 'index.html'; }

Chat.init(role);

WS.connect(() => {
  StationAuth.currentUser().then(user => {
    if (!user) { location.href = 'index.html'; return; }
    WS.send({ type: 'session:resume', code: roomCode, role, userId: user.uid });
  }).catch(() => { location.href = 'index.html'; });
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

// ── Barre d'objectif : mission / puzzle N sur total / tentatives / indices ──
function setObjectiveHeader(missionTitle, pIndex, total) {
  const mEl = document.getElementById('obj-mission-title');
  const pEl = document.getElementById('obj-puzzle-progress');
  if (mEl && missionTitle != null) mEl.textContent = missionTitle;
  if (pEl) pEl.textContent = `${pIndex + 1} / ${total}`;
}

function setAttemptsDisplay(attempts, maxAttempts, flash) {
  currentMaxAttempts = Number.isFinite(maxAttempts) ? maxAttempts : null;
  const wrap = document.getElementById('obj-attempts-wrap');
  const el = document.getElementById('obj-attempts');
  if (!wrap || !el) return;
  if (currentMaxAttempts == null && !attempts) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  el.textContent = currentMaxAttempts != null ? `${attempts} / ${currentMaxAttempts}` : `${attempts}`;
  wrap.classList.remove('attempts-warning', 'attempts-danger', 'just-penalized');
  if (currentMaxAttempts != null) {
    const remaining = currentMaxAttempts - attempts;
    if (remaining <= 0) wrap.classList.add('attempts-danger');
    else if (remaining <= 1) wrap.classList.add('attempts-warning');
  }
  if (flash) {
    requestAnimationFrame(() => {
      wrap.classList.add('just-penalized');
      setTimeout(() => wrap.classList.remove('just-penalized'), 600);
    });
  }
}

function setHintsDisplay(missionHintsRemaining) {
  missionHintsRemainingCount = Number.isFinite(missionHintsRemaining) ? missionHintsRemaining : null;
  const wrap = document.getElementById('obj-hints-wrap');
  const el = document.getElementById('obj-hints');
  if (wrap && el) {
    if (missionHintsRemainingCount == null) {
      wrap.style.display = 'none';
    } else {
      wrap.style.display = 'flex';
      el.textContent = `${missionHintsRemainingCount} restant${missionHintsRemainingCount > 1 ? 's' : ''}`;
    }
  }
  updateHintButtonState();
}

function flashPenalty() {
  document.body.classList.add('penalty-flash');
  setTimeout(() => document.body.classList.remove('penalty-flash'), 650);
}

function formatCostParts(cost) {
  const parts = [];
  if (!cost) return parts;
  if (cost.time) parts.push(`-${cost.time}s`);
  if (cost.resourceDelta) {
    Object.entries(cost.resourceDelta).forEach(([key, delta]) => {
      if (delta) parts.push(`${RESOURCE_LABELS[key] || key.toUpperCase()} ${delta}`);
    });
  }
  return parts;
}

// Met à jour le libellé/état du bouton INDICE à partir du puzzle courant
// (coût affiché AVANT toute demande — l'Opérateur comme le Technicien ne
// doivent jamais découvrir le prix après coup).
function updateHintButtonState() {
  const btn = document.getElementById('btn-hint');
  if (!btn) return;
  if (currentHintsTotal <= 0) { btn.style.display = 'none'; return; }
  btn.style.display = 'inline-block';
  const parts = formatCostParts(currentHintCost);
  btn.textContent = `💡 INDICE${parts.length ? ' (' + parts.join(', ') + ')' : ' (gratuit)'}`;
  btn.disabled = missionHintsRemainingCount === 0;
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
    case 'logic_grid': renderLogicGrid(panel, puzzle.data); break;
    case 'valve_routing': renderValveRouting(panel, puzzle.data); break;
    case 'parity_checksum': renderParityChecksum(panel, puzzle.data); break;
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

// Déduction logique : contrairement aux autres types, le Technicien NE reçoit
// PAS la réponse toute faite — seulement des indices textuels. C'est à lui de
// déduire la grille avant de la dicter à l'Opérateur.
function renderLogicGrid(panel, data) {
  const intro = document.createElement('div');
  intro.style.cssText = 'font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;';
  intro.textContent = `CATÉGORIES : ${data.rows.join(' / ')} — ${data.cols.join(' / ')}`;
  panel.appendChild(intro);

  const list = document.createElement('ol');
  list.style.cssText = 'margin:0 0 16px 0;padding-left:22px;line-height:1.9;';
  data.clues.forEach(clue => {
    const li = document.createElement('li');
    li.style.cssText = 'color:var(--green);font-size:14px;';
    li.textContent = clue;
    list.appendChild(li);
  });
  panel.appendChild(list);
  log('Déduisez la grille à partir des indices, puis dictez chaque affectation à l\'Opérateur.', 'warn');
}

// Réseau de vannes/conduits : le Technicien reçoit le schéma complet (nœuds +
// connexions) ainsi que le chemin correct à dicter nœud par nœud.
function renderValveRouting(panel, data) {
  const intro = document.createElement('div');
  intro.style.cssText = 'font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;';
  intro.textContent = `SCHÉMA (ENTRÉE ${data.start} → SORTIE ${data.exit}) :`;
  panel.appendChild(intro);

  const schemaDiv = document.createElement('div');
  schemaDiv.style.cssText = 'font-size:13px;color:var(--green-dim);margin-bottom:16px;line-height:1.8;';
  schemaDiv.textContent = data.edges.map(([a, b]) => `${a} ↔ ${b}`).join('   ·   ');
  panel.appendChild(schemaDiv);

  const seqDiv = document.createElement('div');
  seqDiv.innerHTML = '<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">CHEMIN À DICTER, NŒUD PAR NŒUD :</div>';
  data.path.forEach((node, i) => {
    const sp = document.createElement('span');
    sp.className = 'seq-item';
    sp.innerHTML = `<span style="color:var(--green-dim);font-size:12px;">${i + 1}.</span> ${node}`;
    seqDiv.appendChild(sp);
  });
  panel.appendChild(seqDiv);
}

// Checksum de parité : le Technicien reçoit les poids (puissances de deux) et
// la cible — à lui de calculer mentalement quels commutateurs doivent être
// actifs (décomposition binaire), l'Opérateur ne voit ni poids ni cible.
function renderParityChecksum(panel, data) {
  const div = document.createElement('div');
  div.innerHTML = `<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">CIBLE : ${data.target}</div>`;
  const tbl = document.createElement('table');
  tbl.className = 'mapping-table';
  tbl.innerHTML = '<tr><th style="color:var(--amber);text-align:left;padding:6px 14px;border:1px solid var(--border);">COMMUTATEUR</th><th style="color:var(--green);text-align:left;padding:6px 14px;border:1px solid var(--border);">POIDS</th></tr>';
  data.weights.forEach((w, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>#${i + 1}</td><td>${w}</td>`;
    tbl.appendChild(tr);
  });
  div.appendChild(tbl);
  panel.appendChild(div);
  if (data.note) {
    const note = document.createElement('div');
    note.style.cssText = 'margin-top:12px;font-size:12px;color:var(--amber);line-height:1.6;';
    note.textContent = data.note;
    panel.appendChild(note);
  }
  log('Calculez quels commutateurs doivent être actifs pour atteindre la cible.', 'warn');
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
  setObjectiveHeader(msg.mission && msg.mission.title, puzzleIndex, totalPuzzles);
  buildDots(totalPuzzles, puzzleIndex);
  currentHintCost = (msg.puzzle && msg.puzzle.hintCost) || null;
  currentHintsTotal = (msg.puzzle && Number.isFinite(msg.puzzle.hintsTotal)) ? msg.puzzle.hintsTotal : 0;
  setAttemptsDisplay(msg.attempts || 0, msg.puzzle && msg.puzzle.maxAttempts, false);
  setHintsDisplay(Number.isFinite(msg.missionHintsRemaining) ? msg.missionHintsRemaining : null);
  renderPuzzle(msg.puzzle);
  if (msg.resources) { lastResources = { ...msg.resources }; }
  setTimer(msg.timeLeft);
}

// ── Events WebSocket ──
WS.on('hub:state', () => {
  // Pas de mission en cours pour cette room : retour au hub.
  window.location.href = 'hub.html';
});

WS.on('session:expired', () => {
  sessionStorage.clear();
  window.location.href = 'index.html';
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
  setObjectiveHeader(null, puzzleIndex, totalPuzzles);
  buildDots(totalPuzzles, puzzleIndex);
  currentHintCost = (msg.puzzle && msg.puzzle.hintCost) || null;
  currentHintsTotal = (msg.puzzle && Number.isFinite(msg.puzzle.hintsTotal)) ? msg.puzzle.hintsTotal : 0;
  setAttemptsDisplay(msg.attempts || 0, msg.puzzle && msg.puzzle.maxAttempts, false);
  setHintsDisplay(Number.isFinite(msg.missionHintsRemaining) ? msg.missionHintsRemaining : missionHintsRemainingCount);
  renderPuzzle(msg.puzzle);
  log(`Nouveau module : ${msg.module}`, 'ok');
});

WS.on('puzzle:solved', (msg) => {
  showNotif('✅ ' + msg.message, 'success');
  log(msg.message, 'ok');
  if (Number.isFinite(msg.attempts)) setAttemptsDisplay(msg.attempts, currentMaxAttempts, false);
  if (msg.resources) logResourceDiff(msg.resources);
});

WS.on('puzzle:failed', (msg) => {
  showNotif('❌ ' + msg.message, 'error');
  log(msg.message, 'error');
  const hasPenalty = !!(msg.timePenalty || msg.resourcePenalty);
  if (msg.timePenalty) log(`Pénalité de tentative : -${msg.timePenalty}s`, 'warn');
  if (msg.resourcePenalty) {
    Object.entries(msg.resourcePenalty).forEach(([key, delta]) => {
      if (delta) log(`Pénalité : ${RESOURCE_LABELS[key] || key.toUpperCase()} ${delta}`, 'warn');
    });
  }
  if (Number.isFinite(msg.attempts)) {
    setAttemptsDisplay(msg.attempts, Number.isFinite(msg.maxAttempts) ? msg.maxAttempts : currentMaxAttempts, true);
  }
  if (hasPenalty) flashPenalty();
  if (msg.resources) logResourceDiff(msg.resources);
  if (msg.timeLeft != null) setTimer(msg.timeLeft);
});

WS.on('hint:response', (msg) => {
  const container = document.getElementById('hint-container');
  if (Number.isFinite(msg.missionHintsRemaining)) setHintsDisplay(msg.missionHintsRemaining);
  if (!container) return;
  if (msg.text) {
    const box = document.createElement('div');
    box.className = 'hint-box';
    const parts = formatCostParts(msg.cost);
    const costText = parts.length ? ` (coût : ${parts.join(', ')})` : '';
    box.textContent = '💡 ' + msg.text + costText;
    container.appendChild(box);
    log('Indice révélé.' + costText, 'warn');
    if (msg.resources) logResourceDiff(msg.resources);
    if (msg.timeLeft != null) setTimer(msg.timeLeft);
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
  window.location.href = 'hub.html';
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
document.getElementById('btn-hub').addEventListener('click', () => { location.href = 'hub.html'; });
document.getElementById('btn-end-hub').addEventListener('click', () => { location.href = 'hub.html'; });
document.getElementById('btn-hint').addEventListener('click', () => {
  const btn = document.getElementById('btn-hint');
  if (btn.disabled) return;
  const parts = formatCostParts(currentHintCost).map(p => p.replace(/^-/, '')).join(', ');
  const costMsg = parts || 'aucun coût';
  const budgetMsg = missionHintsRemainingCount != null
    ? `\nIndices restants pour cette mission après celui-ci : ${Math.max(0, missionHintsRemainingCount - 1)}`
    : '';
  if (!confirm(`Révéler un indice ?\nCoût : ${costMsg}${budgetMsg}`)) return;
  WS.send({ type: 'hint:request' });
});
document.getElementById('btn-abandon').addEventListener('click', () => {
  if (confirm('Abandonner la mission en cours et revenir au Hub ?')) {
    WS.send({ type: 'hub:return' });
  }
});
