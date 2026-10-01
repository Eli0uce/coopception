const role = 'operator';
const RESOURCE_LABELS = { integrity: 'INTÉGRITÉ', trust: 'CONFIANCE', intel: 'RENSEIGNEMENT' };

let currentPuzzle = null;
let totalPuzzles = 1;
let puzzleIndex = 0;
let lastResources = null;
const roomCode = sessionStorage.getItem('sz_room');

// State for each puzzle type
let seqState = [];
let finalState = { switch: null, code: '', levers: [], validate: false };
let wireConnections = [];
let wireSelected = null;

if (!roomCode) { location.href = 'index.html'; }

WS.connect(() => {
  StationAuth.currentUser().then(user => {
    if (!user) { location.href = 'index.html'; return; }
    WS.send({ type: 'session:resume', code: roomCode, role, userId: user.uid });
  }).catch(() => { location.href = 'index.html'; });
});
Chat.init(role);

function statusLog(text, color = 'var(--amber-dim)') {
  const el = document.getElementById('status-area');
  const line = document.createElement('div');
  line.style.color = color;
  line.textContent = '› ' + text;
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
      statusLog(`${label} ${delta > 0 ? '+' : ''}${delta} (→ ${resources[key]})`, delta > 0 ? 'var(--green)' : 'var(--red)');
    }
  });
  lastResources = { ...resources };
}

function setMissionBanner(mission) {
  const el = document.getElementById('mission-banner');
  el.innerHTML = `<span class="mb-title">${mission.icon || ''} ${mission.title}</span>${mission.briefing}`;
}

function sendAction(action) {
  WS.send({ type: 'puzzle:action', action });
}

// ── Renderers ──
function renderPuzzle(puzzle) {
  currentPuzzle = puzzle;
  seqState = [];
  finalState = { switch: null, code: '', levers: [], validate: false };
  wireConnections = [];
  wireSelected = null;
  const area = document.getElementById('controls-area');
  area.innerHTML = '';

  const header = document.createElement('div');
  header.innerHTML = `<div style="font-family:'VT323',monospace;font-size:22px;color:var(--amber);letter-spacing:2px;margin-bottom:6px;">${puzzle.data.title}</div>
  <div style="font-size:12px;color:var(--amber-dim);letter-spacing:1px;margin-bottom:20px;">${puzzle.data.subtitle}</div>`;
  area.appendChild(header);

  switch (puzzle.type) {
    case 'cross_code':
    case 'symbol_code': renderCrossCodeOp(area, puzzle.data); break;
    case 'mirror_sequence': renderMirrorOp(area, puzzle.data); break;
    case 'cipher': renderCipherOp(area, puzzle.data); break;
    case 'calibration': renderCalibOp(area, puzzle.data); break;
    case 'final_protocol': renderFinalOp(area, puzzle.data); break;
    case 'wire_panel': renderWirePanelOp(area, puzzle.data); break;
    case 'choice': renderChoiceOp(area, puzzle.data); break;
  }
}

// Puzzle 1 : numpad pour entrer la séquence (cross_code / symbol_code)
function renderCrossCodeOp(area, data) {
  const entered = document.createElement('div');
  entered.id = 'entered-seq';
  entered.className = 'current-seq';
  area.appendChild(entered);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;';
  data.buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'num-btn';
    btn.style.width = '60px';
    btn.textContent = b;
    btn.onclick = () => {
      seqState.push(b);
      const chip = document.createElement('span');
      chip.className = 'seq-chip';
      chip.textContent = b;
      entered.appendChild(chip);
      statusLog(`Touche pressée : ${b}`, 'var(--amber)');
    };
    grid.appendChild(btn);
  });
  area.appendChild(grid);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;margin-top:10px;';

  const btnDel = document.createElement('button');
  btnDel.className = 'btn danger';
  btnDel.textContent = '⌫ EFFACER';
  btnDel.onclick = () => { seqState.pop(); entered.lastChild && entered.removeChild(entered.lastChild); };

  const btnSend = document.createElement('button');
  btnSend.className = 'btn primary';
  btnSend.textContent = '✔ VALIDER SÉQUENCE';
  btnSend.onclick = () => sendAction({ sequence: seqState });

  row.appendChild(btnDel);
  row.appendChild(btnSend);
  area.appendChild(row);
}

// Puzzle 2 : boutons colorés
function renderMirrorOp(area, data) {
  const pressed = document.createElement('div');
  pressed.id = 'mirror-pressed';
  pressed.className = 'current-seq';
  area.appendChild(pressed);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;';

  data.buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = `seq-btn color-${b.color}`;
    btn.textContent = b.label;
    btn.onclick = () => {
      seqState.push(b.label);
      const chip = document.createElement('span');
      chip.className = 'seq-chip';
      chip.style.background = b.color === 'rouge' ? '#ff4444' : b.color === 'bleu' ? '#4488ff' : b.color === 'jaune' ? 'var(--amber)' : 'var(--green)';
      chip.textContent = b.label;
      pressed.appendChild(chip);
      statusLog(`${b.label} activé`, b.color === 'rouge' ? '#ff4444' : 'var(--amber)');
    };
    grid.appendChild(btn);
  });
  area.appendChild(grid);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;margin-top:10px;';
  const btnDel = document.createElement('button');
  btnDel.className = 'btn danger';
  btnDel.textContent = '⌫ EFFACER';
  btnDel.onclick = () => { seqState.pop(); pressed.lastChild && pressed.removeChild(pressed.lastChild); };
  const btnSend = document.createElement('button');
  btnSend.className = 'btn primary';
  btnSend.style.borderColor = 'var(--amber)'; btnSend.style.color = 'var(--amber)';
  btnSend.textContent = '✔ VALIDER';
  btnSend.onclick = () => sendAction({ sequence: seqState });
  row.appendChild(btnDel);
  row.appendChild(btnSend);
  area.appendChild(row);
}

// Puzzle 3 : texte chiffré + input
function renderCipherOp(area, data) {
  const cipher = document.createElement('div');
  cipher.className = 'cipher-word';
  cipher.textContent = data.cipherText;
  area.appendChild(cipher);

  const wrap = document.createElement('div');
  wrap.className = 'cipher-input-wrap';
  wrap.innerHTML = `<div style="font-size:12px;color:var(--amber-dim);letter-spacing:2px;margin-bottom:10px;">ENTREZ LE MOT DÉCHIFFRÉ :</div>`;

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.maxLength = data.inputLength;
  inp.style.cssText = 'text-align:center;font-size:28px;letter-spacing:8px;text-transform:uppercase;border-color:var(--amber-dim);color:var(--amber);width:100%;';
  inp.oninput = () => { inp.value = inp.value.toUpperCase(); };

  const btn = document.createElement('button');
  btn.className = 'validate-btn';
  btn.style.marginTop = '14px';
  btn.textContent = '✔ VALIDER';
  btn.onclick = () => sendAction({ word: inp.value.trim() });

  wrap.appendChild(inp);
  wrap.appendChild(btn);
  area.appendChild(wrap);
}

// Puzzle 4 : curseurs
function renderCalibOp(area, data) {
  data.sliders.forEach((s) => {
    const grp = document.createElement('div');
    grp.className = 'slider-group';
    grp.innerHTML = `
      <div class="slider-label">
        <span>${s.label}</span>
        <span class="slider-val" id="val-${s.id}">50</span>
      </div>
      <input type="range" id="${s.id}" min="${s.min}" max="${s.max}" value="50">
    `;
    area.appendChild(grp);
    setTimeout(() => {
      const slider = document.getElementById(s.id);
      const valEl = document.getElementById('val-' + s.id);
      slider.addEventListener('input', () => {
        valEl.textContent = slider.value;
        statusLog(`${s.label} → ${slider.value}`, 'var(--amber)');
      });
    }, 0);
  });

  const btn = document.createElement('button');
  btn.className = 'validate-btn';
  btn.textContent = '✔ VALIDER CALIBRAGE';
  btn.onclick = () => {
    const v = data.sliders.map(s => parseInt(document.getElementById(s.id).value, 10));
    sendAction({ values: v });
  };
  area.appendChild(btn);
}

// Puzzle 5 : protocole final
function renderFinalOp(area, data) {
  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

  const switchGrp = document.createElement('div');
  switchGrp.innerHTML = '<div style="font-size:11px;color:var(--amber-dim);letter-spacing:2px;margin-bottom:8px;">INTERRUPTEURS</div>';
  const switchRow = document.createElement('div');
  switchRow.className = 'switch-group';
  data.controls.filter(c => c.type === 'switch').forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'switch-btn';
    btn.dataset.color = c.color;
    btn.id = c.id;
    btn.textContent = c.label;
    btn.onclick = () => {
      document.querySelectorAll('.switch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      finalState.switch = c.id;
      statusLog(`Interrupteur ${c.label} activé`, 'var(--amber)');
    };
    switchRow.appendChild(btn);
  });
  switchGrp.appendChild(switchRow);
  grid.appendChild(switchGrp);

  const numGrp = document.createElement('div');
  numGrp.innerHTML = '<div style="font-size:11px;color:var(--amber-dim);letter-spacing:2px;margin-bottom:8px;">CODE D\'ACCÈS</div>';
  const display = document.createElement('div');
  display.className = 'num-display';
  display.id = 'final-numdisp';
  display.textContent = '';
  numGrp.appendChild(display);
  const numGrid = document.createElement('div');
  numGrid.className = 'numpad-grid';
  ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', '✔'].forEach(k => {
    const btn = document.createElement('button');
    btn.className = 'num-btn';
    btn.textContent = k;
    btn.onclick = () => {
      if (k === '⌫') { finalState.code = finalState.code.slice(0, -1); }
      else if (k === '✔') { /* ignore, validate button handles */ }
      else if (finalState.code.length < 6) { finalState.code += k; }
      document.getElementById('final-numdisp').textContent = finalState.code;
      statusLog(`Code → ${finalState.code}`, 'var(--amber)');
    };
    numGrid.appendChild(btn);
  });
  numGrp.appendChild(numGrid);
  grid.appendChild(numGrp);

  const leverGrp = document.createElement('div');
  leverGrp.innerHTML = '<div style="font-size:11px;color:var(--amber-dim);letter-spacing:2px;margin-bottom:8px;">LEVIERS</div>';
  const leverRow = document.createElement('div');
  leverRow.className = 'levers-group';
  data.controls.filter(c => c.type === 'lever').forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'lever-btn';
    btn.id = c.id;
    btn.textContent = c.label;
    btn.onclick = () => {
      if (!finalState.levers.includes(c.id)) {
        finalState.levers.push(c.id);
        btn.classList.add('active');
        statusLog(`${c.label} activé`, 'var(--amber)');
      } else {
        finalState.levers = finalState.levers.filter(l => l !== c.id);
        btn.classList.remove('active');
      }
    };
    leverRow.appendChild(btn);
  });
  leverGrp.appendChild(leverRow);
  grid.appendChild(leverGrp);

  area.appendChild(grid);

  const validateBtn = document.createElement('button');
  validateBtn.className = 'validate-btn';
  validateBtn.style.marginTop = '20px';
  validateBtn.textContent = '🔴 VALIDATION FINALE';
  validateBtn.onclick = () => {
    finalState.validate = true;
    sendAction({ finalState });
    statusLog('Validation envoyée !', 'var(--green)');
  };
  area.appendChild(validateBtn);
}

// Puzzle 6 : panneau de câblage (wire_panel)
function renderWirePanelOp(area, data) {
  const connDisplay = document.createElement('div');
  connDisplay.className = 'wire-connections';
  connDisplay.id = 'wire-connections-display';
  area.appendChild(connDisplay);

  function refreshConnDisplay() {
    connDisplay.innerHTML = wireConnections.length
      ? wireConnections.map(c => `<span class="conn-chip">${c.wire} → ${c.port}</span>`).join('')
      : '<span style="color:var(--amber-dim);">Aucune connexion établie</span>';
  }
  refreshConnDisplay();

  const grid = document.createElement('div');
  grid.className = 'wire-panel-grid';

  const wireCol = document.createElement('div');
  wireCol.className = 'wire-col';
  const wireBtns = {};
  data.wires.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'wire-btn';
    btn.textContent = w;
    btn.onclick = () => {
      // Débrancher si déjà connecté
      const existing = wireConnections.find(c => c.wire === w);
      if (existing) {
        wireConnections = wireConnections.filter(c => c.wire !== w);
        btn.classList.remove('connected');
        refreshConnDisplay();
        refreshPorts();
        statusLog(`${w} débranché`, 'var(--amber)');
        return;
      }
      document.querySelectorAll('.wire-btn').forEach(b => b.classList.remove('selected'));
      wireSelected = w;
      btn.classList.add('selected');
      statusLog(`Fil ${w} sélectionné — choisissez un port`, 'var(--amber)');
    };
    wireBtns[w] = btn;
    wireCol.appendChild(btn);
  });
  grid.appendChild(wireCol);

  const portCol = document.createElement('div');
  portCol.className = 'port-col';
  const portBtns = {};
  function refreshPorts() {
    data.ports.forEach(p => {
      const taken = wireConnections.some(c => c.port === p);
      portBtns[p].classList.toggle('taken', taken);
    });
  }
  data.ports.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'port-btn';
    btn.textContent = p;
    btn.onclick = () => {
      if (!wireSelected) { statusLog('Sélectionnez un fil en premier', 'var(--red)'); return; }
      if (wireConnections.some(c => c.port === p)) { statusLog('Port déjà utilisé', 'var(--red)'); return; }
      wireConnections.push({ wire: wireSelected, port: p });
      wireBtns[wireSelected].classList.remove('selected');
      wireBtns[wireSelected].classList.add('connected');
      statusLog(`${wireSelected} connecté à ${p}`, 'var(--green)');
      wireSelected = null;
      refreshConnDisplay();
      refreshPorts();
    };
    portBtns[p] = btn;
    portCol.appendChild(btn);
  });
  grid.appendChild(portCol);
  area.appendChild(grid);

  const btn = document.createElement('button');
  btn.className = 'validate-btn';
  btn.textContent = '✔ VALIDER LE CÂBLAGE';
  btn.onclick = () => sendAction({ connections: wireConnections });
  area.appendChild(btn);
}

// Puzzle 7 : décision (choice)
function renderChoiceOp(area, data) {
  const group = document.createElement('div');
  group.className = 'choice-btn-group';
  data.options.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = o.label;
    btn.onclick = () => {
      document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('chosen'));
      btn.classList.add('chosen');
      statusLog(`Décision sélectionnée : ${o.label}`, 'var(--green)');
      sendAction({ optionId: o.id });
    };
    group.appendChild(btn);
  });
  area.appendChild(group);
}

// ── Application de l'état de mission (démarrage ou reprise) ──
function applyMissionState(msg) {
  document.getElementById('wait-overlay').style.display = 'none';
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

// ── WS Events ──
WS.on('hub:state', () => {
  window.location.href = 'hub.html';
});

WS.on('session:expired', () => {
  sessionStorage.clear();
  window.location.href = 'index.html';
});

WS.on('mission:resume', (msg) => {
  applyMissionState(msg);
  statusLog(`Session reprise — ${msg.puzzle.module}`, 'var(--green)');
});

WS.on('mission:started', (msg) => {
  applyMissionState(msg);
  statusLog(`Mission démarrée — ${msg.puzzle.module}`, 'var(--green)');
});

WS.on('puzzle:next', (msg) => {
  puzzleIndex = msg.puzzleIndex;
  document.getElementById('module-name').textContent = msg.module;
  document.getElementById('footer-status').textContent = `PUZZLE ${puzzleIndex + 1}/${totalPuzzles}`;
  buildDots(totalPuzzles, puzzleIndex);
  renderPuzzle(msg.puzzle);
  statusLog(`Nouveau module : ${msg.module}`, 'var(--green)');
});

WS.on('puzzle:solved', (msg) => {
  showNotif('✅ ' + msg.message, 'success');
  statusLog(msg.message, 'var(--green)');
  if (msg.resources) logResourceDiff(msg.resources);
});

WS.on('puzzle:failed', (msg) => {
  showNotif('❌ ' + msg.message, 'error');
  statusLog(msg.message, 'var(--red)');
});

WS.on('hint:response', (msg) => {
  if (msg.text) {
    statusLog('💡 ' + msg.text, 'var(--green)');
    showNotif('💡 Indice reçu', 'success');
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
  statusLog('Mission accomplie ! Station réactivée.', 'var(--green)');
});

WS.on('mission:aborted', () => {
  window.location.href = 'hub.html';
});

WS.on('player:disconnected', () => {
  showNotif('⚠ Le Technicien s\'est déconnecté', 'error');
});

WS.on('player:reconnected', () => {
  showNotif('✅ Le Technicien est reconnecté', 'success');
});

WS.on('error', (msg) => {
  showNotif('⚠ ' + msg.message, 'error');
});

// ── Actions locales ──
document.getElementById('btn-hub').addEventListener('click', () => { location.href = 'hub.html'; });
document.getElementById('btn-end-hub').addEventListener('click', () => { location.href = 'hub.html'; });
document.getElementById('btn-hint').addEventListener('click', () => { WS.send({ type: 'hint:request' }); });
document.getElementById('btn-abandon').addEventListener('click', () => {
  if (confirm('Abandonner la mission en cours et revenir au Hub ?')) {
    WS.send({ type: 'hub:return' });
  }
});
