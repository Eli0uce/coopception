// ── Init ──
const role = 'technician';
let timerInterval = null;
let startTimestamp = null;
let lastPuzzleIndex = -1;

GameDB.init();

const roomCode = sessionStorage.getItem('sz_room');
if (!roomCode) { location.href = 'index.html'; }

// Rétablir la présence Firebase et attendre avant de setup les listeners
GameDB.rejoinRoom(roomCode, 'technician').then(() => {
  AudioManager.init();
  AudioManager.boot();
  // Technicien = contrôleur des cinématiques
  Scenario.initSync(
    (sceneId, lineIdx) => GameDB.setCinematicLine(sceneId, lineIdx),
    (sceneId, cb)      => GameDB.onCinematicLine(sceneId, cb)
  );
  VoiceChat.init('technician', roomCode, GameDB.getDb());
  setupListeners();
});

// ── UI Helpers ──
function log(text, type='info') {
  const el = document.getElementById('log-content');
  const c = {info:'var(--green-dim)',ok:'var(--green)',error:'var(--red)',warn:'var(--amber)'};
  const p = {info:'[SYS]',ok:'[OK] ',error:'[ERR]',warn:'[WRN]'};
  const d = document.createElement('div');
  d.style.color = c[type]||c.info;
  d.textContent = `${p[type]||'[SYS]'} ${text}`;
  el.appendChild(d);
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
    d.className = 'progress-dot'+(i<current?' done':i===current?' current':'');
    el.appendChild(d);
  }
}

let timeLimit = 900;

// ...existing code...

function startTimerLoop() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!startTimestamp) return;
    const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    const left = timeLimit - elapsed;
    if (left <= 0) {
      clearInterval(timerInterval);
      setTimer(0);
      AudioManager.stopAlarm();
      GameDB.triggerTimeout();
    } else {
      setTimer(left);
      if (left === 60) AudioManager.startAlarm();
      if (left <= 10)  AudioManager.countdownUrgent();
      else if (left <= 30 && left % 5 === 0) AudioManager.countdown();
    }
  }, 1000);
}

// ── Puzzle renderers ──
function renderPuzzle(puzzle) {
  const panel = document.getElementById('puzzle-info');
  panel.innerHTML = '';
  const hdr = document.createElement('div');
  hdr.innerHTML = `<div style="font-family:'VT323',monospace;font-size:22px;color:var(--amber);letter-spacing:2px;margin-bottom:6px;">${puzzle.data.title}</div>
    <div style="font-size:12px;color:var(--green-dim);letter-spacing:1px;margin-bottom:20px;">${puzzle.data.subtitle}</div>`;
  panel.appendChild(hdr);
  switch(puzzle.type) {
    case 'cross_code':      renderCrossCode(panel, puzzle.data);    break;
    case 'symbol_code':     renderCrossCode(panel, puzzle.data);    break;
    case 'mirror_sequence': renderMirrorSeq(panel, puzzle.data);    break;
    case 'cipher':          renderCipher(panel, puzzle.data);       break;
    case 'calibration':     renderCalib(panel, puzzle.data);        break;
    case 'wire_panel':      renderWirePanel(panel, puzzle.data);    break;
    case 'final_protocol':  renderFinal(panel, puzzle.data);        break;
  }
}

function renderCrossCode(p, d) {
  const tbl = document.createElement('table');
  tbl.className = 'mapping-table';
  tbl.innerHTML = '<tr><th style="color:var(--amber);text-align:left;padding:6px 14px;border:1px solid var(--border)">SYMBOLE</th><th style="color:var(--green);text-align:left;padding:6px 14px;border:1px solid var(--border)">CODE</th></tr>';
  Object.entries(d.mapping).forEach(([sym,code]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${sym}</td><td>${code}</td>`;
    tbl.appendChild(tr);
  });
  p.appendChild(tbl);
  const seqDiv = document.createElement('div');
  seqDiv.style.marginTop='20px';
  seqDiv.innerHTML = '<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">SÉQUENCE À COMMUNIQUER :</div>';
  d.sequence.forEach((sym,i) => {
    const sp = document.createElement('span');
    sp.className = 'seq-item';
    sp.innerHTML = `<span style="color:var(--green-dim);font-size:12px;">${i+1}.</span> ${sym}`;
    seqDiv.appendChild(sp);
  });
  p.appendChild(seqDiv);
}

function renderMirrorSeq(p, d) {
  const div = document.createElement('div');
  div.innerHTML = '<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">ACTIVEZ DANS CET ORDRE :</div>';
  d.sequence.forEach((color,i) => {
    const sp = document.createElement('span');
    sp.className = `seq-item color-${color}`;
    sp.innerHTML = `<span style="font-size:12px;">${i+1}.</span> ${color.toUpperCase()}`;
    div.appendChild(sp);
  });
  p.appendChild(div);
}

function renderCipher(p, d) {
  const div = document.createElement('div');
  div.innerHTML = '<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:10px;">CLÉ : CHIFFRÉ → ORIGINAL</div>';
  const grid = document.createElement('div');
  grid.className = 'cipher-key';
  Object.entries(d.key).forEach(([plain, enc]) => {
    const pair = document.createElement('div');
    pair.className = 'cipher-pair';
    pair.innerHTML = `<div class="enc">${enc}</div><div class="plain">${plain}</div>`;
    grid.appendChild(pair);
  });
  div.appendChild(grid);
  p.appendChild(div);
}

function renderCalib(p, d) {
  const div = document.createElement('div');
  d.targets.forEach(t => {
    const item = document.createElement('div');
    item.className = 'target-item';
    item.innerHTML = `<div class="t-name">${t.name}</div><div><span class="t-val">${t.value}</span><span class="t-unit">${t.unit}</span></div>`;
    div.appendChild(item);
  });
  p.appendChild(div);
  log(`Calibrage requis: ${d.targets.map(t=>`${t.name}=${t.value}${t.unit}`).join(', ')}`, 'warn');
}

function renderFinal(p, d) {
  const div = document.createElement('div');
  d.steps.forEach((s,i) => {
    const item = document.createElement('div');
    item.className = 'step-item'+(i===0?' active':'');
    item.id = `step-${i}`;
    item.innerHTML = `<div class="step-num">ÉTAPE ${s.order}</div><div class="step-txt">${s.instruction}</div>`;
    div.appendChild(item);
  });
  p.appendChild(div);
}

function renderWirePanel(p, d) {
  const wireColors = ['#ff5555','#5588ff','#55ff55','#ffcc00','#ff8800','#cc88ff'];
  const div = document.createElement('div');
  div.innerHTML = '<div style="font-size:12px;color:var(--green-dim);letter-spacing:2px;margin-bottom:14px;">DICTEZ CES CONNEXIONS :</div>';
  const tbl = document.createElement('table');
  tbl.className = 'mapping-table';
  tbl.innerHTML = '<tr><th style="color:var(--amber)">FIL</th><th style="color:var(--green)">→ PORT</th></tr>';
  d.connections.forEach((c, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="color:${wireColors[i%wireColors.length]};font-weight:bold;">${c.wire}</td><td style="color:var(--amber)">${c.port}</td>`;
    tbl.appendChild(tr);
  });
  div.appendChild(tbl);
  p.appendChild(div);
}

function showPuzzle(index) {
  if (index === lastPuzzleIndex) return;
  lastPuzzleIndex = index;
  const puzzle = PUZZLES[index];
  document.getElementById('module-name').textContent = puzzle.module;
  document.getElementById('footer-status').textContent = `PUZZLE ${index+1}/${PUZZLES.length}`;
  buildDots(PUZZLES.length, index);
  renderPuzzle({ type: puzzle.type, data: puzzle.technicianData });
  log(`Module actif : ${puzzle.module}`, 'ok');
}

function setupListeners() {
  let introShown = false;
  let pauseStartTime = null;

  function pauseTimer() {
    clearInterval(timerInterval);
    pauseStartTime = Date.now();
  }
  function resumeTimer() {
    if (pauseStartTime) {
      startTimestamp += (Date.now() - pauseStartTime); // récupère le temps pausé
      pauseStartTime = null;
    }
    if (startTimestamp) startTimerLoop();
  }


  GameDB.onStateChange(state => {
    if (state.phase === 'playing') {
      if (!introShown && state.startTimestamp) {
        introShown = true;
        if (state.timeLimit) timeLimit = state.timeLimit;
        document.getElementById('start-overlay').style.display = 'none';
        document.getElementById('game-area').style.display = 'grid';
        if (state.puzzlesSeed && PUZZLES.length === 0) initPuzzles(state.puzzlesSeed);
        startTimestamp = state.startTimestamp;
        startTimerLoop();
        AudioManager.gameStart();
        Scenario.play('intro', () => { resumeTimer(); showPuzzle(0); },
          { isController: true, onStart: pauseTimer });
        return;
      }

      const newIdx = state.currentPuzzle || 0;
      if (newIdx !== lastPuzzleIndex && lastPuzzleIndex >= 0 && newIdx > 0) {
        AudioManager.puzzleNext();
        Scenario.play('cutscene_' + lastPuzzleIndex,
          () => { resumeTimer(); showPuzzle(newIdx); },
          { isController: true, onStart: pauseTimer });
        return;
      }
      if (newIdx !== lastPuzzleIndex) showPuzzle(newIdx);
    }

    if (state.phase === 'finished') {
      clearInterval(timerInterval);
      AudioManager.stopAlarm();
      const outroId = state.win ? 'outro_win' : 'outro_lose';
      state.win ? AudioManager.victory() : AudioManager.defeat();
      Scenario.play(outroId, () => {
        const overlay = document.getElementById('end-overlay');
        const card    = document.getElementById('end-card');
        overlay.classList.add('visible');
        card.className = state.win ? 'win' : 'lose';
        document.getElementById('end-title').textContent  = state.win ? '🏆 VICTOIRE' : '💀 DÉFAITE';
        document.getElementById('end-reason').textContent = state.reason;
      }, { isController: true });
    }
  });

  GameDB.onResult(result => {
    if (result.valid) { AudioManager.success(); showNotif('✅ ' + result.message, 'success'); log(result.message, 'ok'); }
    else              { AudioManager.error();   showNotif('❌ ' + result.message, 'error');   log(result.message, 'error'); }
  });

  GameDB.onDisconnect(() => {
    AudioManager.disconnect();
    showNotif('⚠ L\'Opérateur s\'est déconnecté', 'error');
    log('Opérateur déconnecté !', 'error');
  });
}

document.getElementById('btn-start').addEventListener('click', () => {
  GameDB.startGame();
});
