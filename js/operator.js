const role = 'operator';
const RESOURCE_LABELS = { integrity: 'INTÉGRITÉ', trust: 'CONFIANCE', intel: 'RENSEIGNEMENT' };

let currentPuzzle = null;
let totalPuzzles = 1;
let puzzleIndex = 0;
let lastResources = null;
let currentMaxAttempts = null;
let currentHintCost = null;
let currentHintsTotal = 0;
let missionHintsRemainingCount = null;
// Poignées (handlers) du puzzle courant pour le support clavier : Entrée
// valide (si un envoi a du sens), Échap annule la sélection en cours —
// jamais les connexions/affectations déjà validées côté serveur.
let currentSubmitHandler = null;
let currentClearHandler = null;
const roomCode = sessionStorage.getItem('sz_room');

// State for each puzzle type
let seqState = [];
let finalState = { switch: null, code: '', levers: [], validate: false };
let wireConnections = [];
let wireSelected = null;
let logicAssignments = []; // [{row, col}, ...]
let valvePath = []; // [nodeId, ...]
let parityState = []; // [bool, ...]

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

function updateHintButtonState() {
  const btn = document.getElementById('btn-hint');
  if (!btn) return;
  if (currentHintsTotal <= 0) { btn.style.display = 'none'; return; }
  btn.style.display = 'inline-block';
  const parts = formatCostParts(currentHintCost);
  btn.textContent = `💡 INDICE${parts.length ? ' (' + parts.join(', ') + ')' : ' (gratuit)'}`;
  btn.disabled = missionHintsRemainingCount === 0;
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

// ── Clavier : Entrée valide le puzzle courant, Échap annule la sélection en
// cours. Jamais actif si le focus est dans le tchat (Enter y a déjà un sens). ──
document.addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.id === 'chat-input') return;
  if (e.key === 'Enter' && typeof currentSubmitHandler === 'function') {
    e.preventDefault();
    currentSubmitHandler();
  } else if (e.key === 'Escape' && typeof currentClearHandler === 'function') {
    e.preventDefault();
    currentClearHandler();
  }
});

function sendAction(action) {
  WS.send({ type: 'puzzle:action', action });
}

// ── Renderers ──
function renderPuzzle(puzzle) {
  currentPuzzle = puzzle;
  currentSubmitHandler = null;
  currentClearHandler = null;
  seqState = [];
  finalState = { switch: null, code: '', levers: [], validate: false };
  wireConnections = [];
  wireSelected = null;
  logicAssignments = [];
  valvePath = [];
  parityState = [];
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
    case 'logic_grid': renderLogicGridOp(area, puzzle.data); break;
    case 'valve_routing': renderValveRoutingOp(area, puzzle.data); break;
    case 'parity_checksum': renderParityChecksumOp(area, puzzle.data); break;
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

  currentSubmitHandler = () => sendAction({ sequence: seqState });
  currentClearHandler = () => { seqState = []; entered.innerHTML = ''; statusLog('Séquence effacée', 'var(--amber-dim)'); };
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

  currentSubmitHandler = () => sendAction({ sequence: seqState });
  currentClearHandler = () => { seqState = []; pressed.innerHTML = ''; statusLog('Séquence effacée', 'var(--amber-dim)'); };
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

  currentSubmitHandler = () => sendAction({ word: inp.value.trim() });
  currentClearHandler = () => { inp.value = ''; inp.focus(); };
  setTimeout(() => inp.focus(), 0);
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

  currentSubmitHandler = () => {
    const v = data.sliders.map(s => parseInt(document.getElementById(s.id).value, 10));
    sendAction({ values: v });
  };
  currentClearHandler = () => {
    data.sliders.forEach(s => {
      const slider = document.getElementById(s.id);
      const valEl = document.getElementById('val-' + s.id);
      if (slider) slider.value = 50;
      if (valEl) valEl.textContent = '50';
    });
    statusLog('Curseurs réinitialisés', 'var(--amber-dim)');
  };
}

// Puzzle 5 : protocole final
function renderFinalOp(area, data) {
  const hint = document.createElement('div');
  hint.className = 'affordance-hint';
  hint.textContent = 'Exécutez chaque commande dictée par le Technicien, dans l\'ordre. La VALIDATION FINALE demande une confirmation — relisez l\'état avant de confirmer.';
  area.appendChild(hint);

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
    btn.setAttribute('aria-pressed', 'false');
    btn.onclick = () => {
      document.querySelectorAll('.switch-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
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
    btn.setAttribute('aria-pressed', 'false');
    btn.onclick = () => {
      if (!finalState.levers.includes(c.id)) {
        finalState.levers.push(c.id);
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        statusLog(`${c.label} activé`, 'var(--amber)');
      } else {
        finalState.levers = finalState.levers.filter(l => l !== c.id);
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    };
    leverRow.appendChild(btn);
  });
  leverGrp.appendChild(leverRow);
  grid.appendChild(leverGrp);

  area.appendChild(grid);

  function submitFinal() {
    const summary = `Interrupteur : ${finalState.switch || 'aucun'}\nCode : ${finalState.code || '(vide)'}\nLeviers : ${finalState.levers.length ? finalState.levers.join(', ') : 'aucun'}`;
    if (!confirm(`Confirmer la VALIDATION FINALE ?\n${summary}`)) return;
    finalState.validate = true;
    sendAction({ finalState });
    statusLog('Validation envoyée !', 'var(--green)');
  }

  const validateBtn = document.createElement('button');
  validateBtn.className = 'validate-btn';
  validateBtn.style.marginTop = '20px';
  validateBtn.textContent = '🔴 VALIDATION FINALE';
  validateBtn.onclick = submitFinal;
  area.appendChild(validateBtn);

  currentSubmitHandler = submitFinal;
  currentClearHandler = () => {
    finalState = { switch: null, code: '', levers: [], validate: false };
    document.querySelectorAll('.switch-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    document.querySelectorAll('.lever-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const disp = document.getElementById('final-numdisp');
    if (disp) disp.textContent = '';
    statusLog('Protocole réinitialisé', 'var(--amber-dim)');
  };
}

// Puzzle 6 : panneau de câblage (wire_panel)
function renderWirePanelOp(area, data) {
  const hint = document.createElement('div');
  hint.className = 'affordance-hint';
  hint.textContent = '1. Cliquez un FIL (il s\'allume en ambre = sélectionné) → 2. Cliquez le PORT de destination dicté par le Technicien (il devient vert = connecté). Cliquez un fil déjà connecté pour le débrancher. Échap annule la sélection en cours.';
  area.appendChild(hint);

  const connDisplay = document.createElement('div');
  connDisplay.className = 'wire-connections';
  connDisplay.id = 'wire-connections-display';
  area.appendChild(connDisplay);

  function refreshConnDisplay() {
    connDisplay.innerHTML = wireConnections.length
      ? wireConnections.map(c => `<span class="conn-chip">✓ ${c.wire} → ${c.port}</span>`).join('')
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
    btn.setAttribute('aria-pressed', 'false');
    btn.onclick = () => {
      // Débrancher si déjà connecté
      const existing = wireConnections.find(c => c.wire === w);
      if (existing) {
        wireConnections = wireConnections.filter(c => c.wire !== w);
        btn.classList.remove('connected');
        btn.setAttribute('aria-pressed', 'false');
        refreshConnDisplay();
        refreshPorts();
        statusLog(`${w} débranché`, 'var(--amber)');
        return;
      }
      document.querySelectorAll('.wire-btn').forEach(b => { b.classList.remove('selected'); });
      wireSelected = w;
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
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
      wireBtns[wireSelected].setAttribute('aria-pressed', 'true');
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

  currentSubmitHandler = () => sendAction({ connections: wireConnections });
  // Échap : annule le fil en cours de sélection (armé, pas encore connecté) ;
  // s'il n'y en a pas, débranche la dernière connexion établie (annulation
  // incrémentale et réversible, jamais une remise à zéro brutale).
  currentClearHandler = () => {
    if (wireSelected) {
      const b = wireBtns[wireSelected];
      if (b) { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); }
      wireSelected = null;
      statusLog('Sélection de fil annulée', 'var(--amber-dim)');
      return;
    }
    const last = wireConnections.pop();
    if (last) {
      const b = wireBtns[last.wire];
      if (b) { b.classList.remove('connected'); b.setAttribute('aria-pressed', 'false'); }
      refreshConnDisplay();
      refreshPorts();
      statusLog(`${last.wire} débranché (annulation)`, 'var(--amber-dim)');
    }
  };
}

// Puzzle 8 : grille de déduction logique (logic_grid) — l'Opérateur ne voit
// que les catégories (lignes/colonnes), jamais les indices : c'est le
// Technicien qui a déduit la réponse et la dicte case par case.
function renderLogicGridOp(area, data) {
  const hint = document.createElement('div');
  hint.className = 'affordance-hint';
  hint.textContent = 'Le Technicien a déduit la grille : cochez UNE case par ligne (●) selon ses instructions. Cliquer une case cochée la décoche. Échap réinitialise toute la grille.';
  area.appendChild(hint);

  const legend = document.createElement('div');
  legend.style.cssText = 'font-size:10px;color:var(--amber-dim);letter-spacing:1px;margin-bottom:8px;';
  legend.textContent = '○ non coché  ·  ● coché (une seule case par ligne)';
  area.appendChild(legend);

  const display = document.createElement('div');
  display.className = 'wire-connections';
  area.appendChild(display);

  function refreshDisplay() {
    display.innerHTML = logicAssignments.length
      ? logicAssignments.map(a => `<span class="conn-chip">${a.row} → ${a.col}</span>`).join('')
      : '<span style="color:var(--amber-dim);">Aucune case cochée</span>';
  }
  refreshDisplay();

  const grid = document.createElement('div');
  grid.className = 'logic-grid-table';
  grid.style.cssText = 'display:grid;grid-template-columns:auto repeat(' + data.cols.length + ', 1fr);gap:6px;margin:14px 0;';

  grid.appendChild(document.createElement('div'));
  data.cols.forEach(col => {
    const h = document.createElement('div');
    h.className = 'logic-grid-head';
    h.textContent = col;
    grid.appendChild(h);
  });

  const cellsByRow = {};
  data.rows.forEach(row => {
    const rowLabel = document.createElement('div');
    rowLabel.className = 'logic-grid-head';
    rowLabel.textContent = row;
    grid.appendChild(rowLabel);

    cellsByRow[row] = [];
    data.cols.forEach(col => {
      const cell = document.createElement('button');
      cell.className = 'logic-grid-cell';
      cell.textContent = '○';
      cell.setAttribute('aria-pressed', 'false');
      cell.setAttribute('aria-label', `${row} → ${col}`);
      cell.onclick = () => {
        const already = logicAssignments.find(a => a.row === row && a.col === col);
        // Une seule case cochée par ligne : enlever toute autre case de cette ligne
        logicAssignments = logicAssignments.filter(a => a.row !== row);
        cellsByRow[row].forEach(c => { c.classList.remove('checked'); c.textContent = '○'; c.setAttribute('aria-pressed', 'false'); });
        if (!already) {
          logicAssignments.push({ row, col });
          cell.classList.add('checked');
          cell.textContent = '●';
          cell.setAttribute('aria-pressed', 'true');
          statusLog(`${row} → ${col}`, 'var(--amber)');
        }
        refreshDisplay();
      };
      cellsByRow[row].push(cell);
      grid.appendChild(cell);
    });
  });
  area.appendChild(grid);

  const btn = document.createElement('button');
  btn.className = 'validate-btn';
  btn.textContent = '✔ VALIDER LA GRILLE';
  btn.onclick = () => sendAction({ assignments: logicAssignments });
  area.appendChild(btn);

  currentSubmitHandler = () => sendAction({ assignments: logicAssignments });
  currentClearHandler = () => {
    logicAssignments = [];
    Object.values(cellsByRow).forEach(cells => cells.forEach(c => { c.classList.remove('checked'); c.textContent = '○'; c.setAttribute('aria-pressed', 'false'); }));
    refreshDisplay();
    statusLog('Grille réinitialisée', 'var(--amber-dim)');
  };
}

// Puzzle 9 : réseau de vannes/conduits (valve_routing) — l'Opérateur ne peut
// avancer que de nœud en nœud adjacent, guidé pas à pas par le Technicien.
function renderValveRoutingOp(area, data) {
  const hint = document.createElement('div');
  hint.className = 'affordance-hint';
  hint.textContent = 'Cliquez les nœuds un par un, en suivant uniquement les connexions dictées par le Technicien. Les nœuds accessibles depuis votre position actuelle sont surlignés en vert. Échap annule le dernier nœud.';
  area.appendChild(hint);

  const pathDisplay = document.createElement('div');
  pathDisplay.className = 'current-seq';
  area.appendChild(pathDisplay);

  function refreshPath() {
    pathDisplay.innerHTML = valvePath.length
      ? valvePath.map(n => `<span class="seq-chip">${n}</span>`).join('')
      : '<span style="color:var(--amber-dim);">Aucun nœud sélectionné</span>';
  }
  refreshPath();

  const info = document.createElement('div');
  info.style.cssText = 'font-size:12px;color:var(--amber-dim);letter-spacing:1px;margin-bottom:10px;';
  info.textContent = `ENTRÉE : ${data.start}  —  SORTIE : ${data.exit}`;
  area.appendChild(info);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;';
  const nodeBtns = {};

  // Surligne les nœuds accessibles en un pas depuis la position courante —
  // rend "ce qui est cliquable ensuite" évident sans devoir mémoriser le
  // schéma complet.
  function refreshValidNext() {
    const last = valvePath[valvePath.length - 1];
    data.nodes.forEach(node => {
      const btn = nodeBtns[node];
      if (!btn) return;
      const used = valvePath.includes(node);
      let isValidNext;
      if (valvePath.length === 0) isValidNext = node === data.start;
      else isValidNext = !used && data.edges.some(e => (e[0] === last && e[1] === node) || (e[0] === node && e[1] === last));
      btn.classList.toggle('valid-next', isValidNext);
    });
  }

  data.nodes.forEach(node => {
    const btn = document.createElement('button');
    btn.className = 'wire-btn';
    btn.textContent = node;
    btn.onclick = () => {
      const last = valvePath[valvePath.length - 1];
      if (valvePath.length === 0) {
        if (node !== data.start) { statusLog(`Le circuit doit démarrer à ${data.start}`, 'var(--red)'); return; }
      } else {
        const linked = data.edges.some(e => (e[0] === last && e[1] === node) || (e[0] === node && e[1] === last));
        if (!linked) { statusLog(`${last} n'est pas relié à ${node}`, 'var(--red)'); return; }
      }
      valvePath.push(node);
      refreshPath();
      refreshValidNext();
      statusLog(`Nœud ${node} ajouté au circuit`, 'var(--amber)');
    };
    nodeBtns[node] = btn;
    grid.appendChild(btn);
  });
  area.appendChild(grid);
  refreshValidNext();

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;margin-top:10px;';
  const btnDel = document.createElement('button');
  btnDel.className = 'btn danger';
  btnDel.textContent = '⌫ RETOUR';
  btnDel.onclick = () => { valvePath.pop(); refreshPath(); refreshValidNext(); };
  const btnSend = document.createElement('button');
  btnSend.className = 'btn primary';
  btnSend.textContent = '✔ VALIDER LE CIRCUIT';
  btnSend.onclick = () => sendAction({ path: valvePath });
  row.appendChild(btnDel);
  row.appendChild(btnSend);
  area.appendChild(row);

  currentSubmitHandler = () => sendAction({ path: valvePath });
  currentClearHandler = () => { valvePath.pop(); refreshPath(); refreshValidNext(); };
}

// Puzzle 10 : panneau de parité (parity_checksum) — l'Opérateur ne voit ni
// poids ni cible, seulement des commutateurs nus à actionner sur dictée.
function renderParityChecksumOp(area, data) {
  const hint = document.createElement('div');
  hint.className = 'affordance-hint';
  hint.textContent = 'Activez/désactivez chaque commutateur dicté par le Technicien (ON = vert, OFF = éteint). Lui seul connaît poids et cible — vous ne faites qu\'exécuter.';
  area.appendChild(hint);

  parityState = new Array(data.switchCount).fill(false);
  const grid = document.createElement('div');
  grid.className = 'switch-group';
  for (let i = 0; i < data.switchCount; i++) {
    const btn = document.createElement('button');
    btn.className = 'switch-btn';
    btn.dataset.color = 'green';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `#${i + 1}<span class="switch-state">OFF</span>`;
    btn.onclick = () => {
      parityState[i] = !parityState[i];
      btn.classList.toggle('active', parityState[i]);
      btn.setAttribute('aria-pressed', String(parityState[i]));
      btn.querySelector('.switch-state').textContent = parityState[i] ? 'ON' : 'OFF';
      statusLog(`Commutateur #${i + 1} → ${parityState[i] ? 'ON' : 'OFF'}`, 'var(--amber)');
    };
    grid.appendChild(btn);
  }
  area.appendChild(grid);

  const btn = document.createElement('button');
  btn.className = 'validate-btn';
  btn.style.marginTop = '20px';
  btn.textContent = '✔ VALIDER LA PARITÉ';
  btn.onclick = () => sendAction({ switches: parityState });
  area.appendChild(btn);

  currentSubmitHandler = () => sendAction({ switches: parityState });
  currentClearHandler = () => {
    parityState = parityState.map(() => false);
    grid.querySelectorAll('.switch-btn').forEach((b, i) => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
      const stateEl = b.querySelector('.switch-state');
      if (stateEl) stateEl.textContent = 'OFF';
    });
    statusLog('Commutateurs réinitialisés', 'var(--amber-dim)');
  };
}

// Puzzle 11 : décision (choice) — conséquences narratives réelles (ressources
// / drapeaux de campagne) : une confirmation est exigée pour ne jamais valider
// par inadvertance un simple clic.
function renderChoiceOp(area, data) {
  const hint = document.createElement('div');
  hint.className = 'affordance-hint';
  hint.textContent = 'Mettez-vous d\'accord avec le Technicien avant de cliquer — chaque option a des conséquences réelles et une confirmation vous sera demandée.';
  area.appendChild(hint);

  const group = document.createElement('div');
  group.className = 'choice-btn-group';
  data.options.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = o.label;
    btn.onclick = () => {
      if (!confirm(`Confirmer la décision : "${o.label}" ?\nCette action a des conséquences durables sur la campagne.`)) return;
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
  setObjectiveHeader(null, puzzleIndex, totalPuzzles);
  buildDots(totalPuzzles, puzzleIndex);
  currentHintCost = (msg.puzzle && msg.puzzle.hintCost) || null;
  currentHintsTotal = (msg.puzzle && Number.isFinite(msg.puzzle.hintsTotal)) ? msg.puzzle.hintsTotal : 0;
  setAttemptsDisplay(msg.attempts || 0, msg.puzzle && msg.puzzle.maxAttempts, false);
  setHintsDisplay(Number.isFinite(msg.missionHintsRemaining) ? msg.missionHintsRemaining : missionHintsRemainingCount);
  renderPuzzle(msg.puzzle);
  statusLog(`Nouveau module : ${msg.module}`, 'var(--green)');
});

WS.on('puzzle:solved', (msg) => {
  showNotif('✅ ' + msg.message, 'success');
  statusLog(msg.message, 'var(--green)');
  if (Number.isFinite(msg.attempts)) setAttemptsDisplay(msg.attempts, currentMaxAttempts, false);
  if (msg.resources) logResourceDiff(msg.resources);
});

WS.on('puzzle:failed', (msg) => {
  showNotif('❌ ' + msg.message, 'error');
  statusLog(msg.message, 'var(--red)');
  const hasPenalty = !!(msg.timePenalty || msg.resourcePenalty);
  if (msg.timePenalty) statusLog(`Pénalité de tentative : -${msg.timePenalty}s`, 'var(--red)');
  if (msg.resourcePenalty) {
    Object.entries(msg.resourcePenalty).forEach(([key, delta]) => {
      if (delta) statusLog(`Pénalité : ${RESOURCE_LABELS[key] || key.toUpperCase()} ${delta}`, 'var(--red)');
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
  if (Number.isFinite(msg.missionHintsRemaining)) setHintsDisplay(msg.missionHintsRemaining);
  if (msg.text) {
    const parts = formatCostParts(msg.cost);
    const costText = parts.length ? ` (coût : ${parts.join(', ')})` : '';
    statusLog('💡 ' + msg.text + costText, 'var(--green)');
    showNotif('💡 Indice reçu' + costText, 'success');
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
