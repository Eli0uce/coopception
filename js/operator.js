// ── Init ──
const role = 'operator';
let timerInterval = null;
let startTimestamp = null;
let lastPuzzleIndex = -1;
let seqState = [];
let finalState = { switch: null, code: '', levers: [], validate: false };
let timeLimit = 900;

GameDB.init();
const roomCode = sessionStorage.getItem('sz_room');
if (!roomCode) { location.href = 'index.html'; }

// Rétablir la présence Firebase et attendre avant de setup les listeners
GameDB.rejoinRoom(roomCode, 'operator').then(() => {
  AudioManager.init();
  AudioManager.boot();
  VoiceChat.init('operator', roomCode, GameDB.getDb());
  setupListeners();
});

// ── UI Helpers ──
function statusLog(text, color='var(--amber-dim)') {
  const el = document.getElementById('status-area');
  const d = document.createElement('div');
  d.style.color = color;
  d.textContent = '› ' + text;
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

function submitAction(action) {
  const result = validateAction(lastPuzzleIndex, action);
  GameDB.submitResult(lastPuzzleIndex, result.valid, result.message);
}

// ── Puzzle renderers ──
function showPuzzle(index) {
  if (index === lastPuzzleIndex) return;
  lastPuzzleIndex = index;
  seqState = [];
  finalState = { switch: null, code: '', levers: [], validate: false };
  const puzzle = PUZZLES[index];
  document.getElementById('module-name').textContent = puzzle.module;
  document.getElementById('footer-status').textContent = `PUZZLE ${index+1}/${PUZZLES.length}`;
  buildDots(PUZZLES.length, index);
  const area = document.getElementById('controls-area');
  area.innerHTML = '';
  const hdr = document.createElement('div');
  hdr.innerHTML = `<div style="font-family:'VT323',monospace;font-size:22px;color:var(--amber);letter-spacing:2px;margin-bottom:6px;">${puzzle.operatorData.title}</div>
    <div style="font-size:12px;color:var(--amber-dim);letter-spacing:1px;margin-bottom:20px;">${puzzle.operatorData.subtitle}</div>`;
  area.appendChild(hdr);
  switch(puzzle.type) {
    case 'cross_code':
    case 'symbol_code':     renderCrossCodeOp(area, puzzle.operatorData); break;
    case 'mirror_sequence': renderMirrorOp(area, puzzle.operatorData);    break;
    case 'cipher':          renderCipherOp(area, puzzle.operatorData);    break;
    case 'calibration':     renderCalibOp(area, puzzle.operatorData);     break;
    case 'wire_panel':      renderWireOp(area, puzzle.operatorData);      break;
    case 'final_protocol':  renderFinalOp(area, puzzle.operatorData);     break;
  }
  statusLog(`Module actif : ${puzzle.module}`, 'var(--green)');
}

function renderCrossCodeOp(area, d) {
  const entered = document.createElement('div');
  entered.id = 'entered-seq'; entered.className = 'current-seq';
  area.appendChild(entered);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;';
  d.buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'num-btn'; btn.style.width='60px'; btn.textContent = b;
    btn.onclick = () => {
      seqState.push(b);
      const chip = document.createElement('span'); chip.className='seq-chip'; chip.textContent=b;
      entered.appendChild(chip);
      statusLog(`Touche : ${b}`, 'var(--amber)');
    };
    grid.appendChild(btn);
  });
  area.appendChild(grid);
  const row = document.createElement('div'); row.style.cssText='display:flex;gap:10px;margin-top:10px;';
  const del = document.createElement('button'); del.className='btn danger'; del.textContent='⌫ EFFACER';
  del.onclick = () => { seqState.pop(); entered.lastChild && entered.removeChild(entered.lastChild); };
  const ok = document.createElement('button'); ok.className='btn primary'; ok.textContent='✔ VALIDER';
  ok.onclick = () => submitAction({ sequence: seqState });
  row.appendChild(del); row.appendChild(ok); area.appendChild(row);
}

function renderMirrorOp(area, d) {
  const pressed = document.createElement('div');
  pressed.id='mirror-pressed'; pressed.className='current-seq';
  area.appendChild(pressed);
  const grid = document.createElement('div'); grid.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;';
  d.buttons.forEach(b => {
    const btn = document.createElement('button'); btn.className=`seq-btn color-${b.color}`; btn.textContent=b.label;
    btn.onclick = () => {
      seqState.push(b.label);
      const chip = document.createElement('span'); chip.className='seq-chip';
      chip.style.background=b.color==='rouge'?'#ff4444':b.color==='bleu'?'#4488ff':b.color==='jaune'?'var(--amber)':'var(--green)';
      chip.textContent=b.label; pressed.appendChild(chip);
    };
    grid.appendChild(btn);
  });
  area.appendChild(grid);
  const row = document.createElement('div'); row.style.cssText='display:flex;gap:10px;margin-top:10px;';
  const del = document.createElement('button'); del.className='btn danger'; del.textContent='⌫ EFFACER';
  del.onclick = () => { seqState.pop(); pressed.lastChild && pressed.removeChild(pressed.lastChild); };
  const ok = document.createElement('button'); ok.className='btn primary'; ok.style.cssText='border-color:var(--amber);color:var(--amber);'; ok.textContent='✔ VALIDER';
  ok.onclick = () => submitAction({ sequence: seqState });
  row.appendChild(del); row.appendChild(ok); area.appendChild(row);
}

function renderCipherOp(area, d) {
  const cipher = document.createElement('div'); cipher.className='cipher-word'; cipher.textContent=d.cipherText;
  area.appendChild(cipher);
  const wrap = document.createElement('div'); wrap.className='cipher-input-wrap';
  wrap.innerHTML='<div style="font-size:12px;color:var(--amber-dim);letter-spacing:2px;margin-bottom:10px;">ENTREZ LE MOT DÉCHIFFRÉ :</div>';
  const inp = document.createElement('input'); inp.type='text'; inp.maxLength=d.inputLength;
  inp.style.cssText='text-align:center;font-size:28px;letter-spacing:8px;text-transform:uppercase;border-color:var(--amber-dim);color:var(--amber);width:100%;';
  inp.oninput = () => inp.value=inp.value.toUpperCase();
  const btn = document.createElement('button'); btn.className='validate-btn'; btn.style.marginTop='14px'; btn.textContent='✔ VALIDER';
  btn.onclick = () => submitAction({ word: inp.value.trim() });
  wrap.appendChild(inp); wrap.appendChild(btn); area.appendChild(wrap);
}

function renderCalibOp(area, d) {
  const vals = [50,50,50];
  d.sliders.forEach((s,i) => {
    const grp = document.createElement('div'); grp.className='slider-group';
    grp.innerHTML=`<div class="slider-label"><span>${s.label}</span><span class="slider-val" id="val-${s.id}">50</span></div><input type="range" id="${s.id}" min="${s.min}" max="${s.max}" value="50">`;
    area.appendChild(grp);
    setTimeout(() => {
      const slider = document.getElementById(s.id);
      const valEl = document.getElementById('val-'+s.id);
      slider.addEventListener('input', () => { vals[i]=parseInt(slider.value); valEl.textContent=slider.value; });
    }, 0);
  });
  const btn = document.createElement('button'); btn.className='validate-btn'; btn.textContent='✔ VALIDER CALIBRAGE';
  btn.onclick = () => { const v=d.sliders.map(s=>parseInt(document.getElementById(s.id).value)); submitAction({values:v}); };
  area.appendChild(btn);
}

function renderWireOp(area, d) {
  const wireColors = ['#ff5555','#5588ff','#55ff55','#ffcc00','#ff8800','#cc88ff'];
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-size:11px;color:var(--amber-dim);letter-spacing:2px;margin-bottom:14px;';
  hdr.textContent = 'CONNECTEZ CHAQUE FIL AU BON PORT :';
  area.appendChild(hdr);

  const selections = {};
  d.wires.forEach((wire, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px;';
    const lbl = document.createElement('div');
    lbl.style.cssText = `min-width:130px;font-size:13px;color:${wireColors[i%wireColors.length]};letter-spacing:1px;font-weight:bold;`;
    lbl.textContent = wire;
    const sel = document.createElement('select');
    sel.style.cssText = 'flex:1;background:var(--panel);border:1px solid var(--border);color:var(--amber);font-family:\'Share Tech Mono\',monospace;font-size:12px;padding:6px;';
    const def = document.createElement('option');
    def.value = ''; def.textContent = '— SÉLECTIONNER —';
    sel.appendChild(def);
    d.ports.forEach(port => {
      const opt = document.createElement('option');
      opt.value = port; opt.textContent = port;
      sel.appendChild(opt);
    });
    sel.onchange = () => { selections[wire] = sel.value; };
    row.appendChild(lbl); row.appendChild(sel);
    area.appendChild(row);
  });

  const btn = document.createElement('button');
  btn.className = 'validate-btn'; btn.style.marginTop = '14px';
  btn.textContent = '✔ VALIDER CÂBLAGE';
  btn.onclick = () => {
    const allSet = d.wires.every(w => selections[w]);
    if (!allSet) { statusLog('Tous les fils doivent être connectés !', 'var(--red)'); return; }
    submitAction({ connections: selections });
  };
  area.appendChild(btn);
}

function renderFinalOp(area, d) {
  const grid = document.createElement('div'); grid.style.cssText='display:flex;flex-direction:column;gap:14px;';

  // Switches
  const swGrp = document.createElement('div');
  swGrp.innerHTML='<div style="font-size:11px;color:var(--amber-dim);letter-spacing:2px;margin-bottom:8px;">INTERRUPTEURS</div>';
  const swRow = document.createElement('div'); swRow.className='switch-group';
  d.controls.filter(c=>c.type==='switch').forEach(c => {
    const btn = document.createElement('button'); btn.className='switch-btn'; btn.dataset.color=c.color; btn.id=c.id; btn.textContent=c.label;
    btn.onclick = () => { document.querySelectorAll('.switch-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); finalState.switch=c.id; };
    swRow.appendChild(btn);
  });
  swGrp.appendChild(swRow); grid.appendChild(swGrp);

  // Numpad
  const numGrp = document.createElement('div');
  numGrp.innerHTML='<div style="font-size:11px;color:var(--amber-dim);letter-spacing:2px;margin-bottom:8px;">CODE D\'ACCÈS</div>';
  const disp = document.createElement('div'); disp.className='num-display'; disp.id='fnumdisp'; disp.textContent='';
  numGrp.appendChild(disp);
  const numGrid = document.createElement('div'); numGrid.className='numpad-grid';
  ['7','8','9','4','5','6','1','2','3','⌫','0','—'].forEach(k => {
    const btn = document.createElement('button'); btn.className='num-btn'; btn.textContent=k;
    btn.onclick = () => {
      if (k==='⌫') { finalState.code=finalState.code.slice(0,-1); }
      else if (k!=='—' && finalState.code.length<6) { finalState.code+=k; }
      document.getElementById('fnumdisp').textContent=finalState.code;
    };
    numGrid.appendChild(btn);
  });
  numGrp.appendChild(numGrid); grid.appendChild(numGrp);

  // Levers
  const levGrp = document.createElement('div');
  levGrp.innerHTML='<div style="font-size:11px;color:var(--amber-dim);letter-spacing:2px;margin-bottom:8px;">LEVIERS</div>';
  const levRow = document.createElement('div'); levRow.className='levers-group';
  d.controls.filter(c=>c.type==='lever').forEach(c => {
    const btn = document.createElement('button'); btn.className='lever-btn'; btn.id=c.id; btn.textContent=c.label;
    btn.onclick = () => {
      if (!finalState.levers.includes(c.id)) { finalState.levers.push(c.id); btn.classList.add('active'); }
      else { finalState.levers=finalState.levers.filter(l=>l!==c.id); btn.classList.remove('active'); }
    };
    levRow.appendChild(btn);
  });
  levGrp.appendChild(levRow); grid.appendChild(levGrp);
  area.appendChild(grid);

  const validateBtn = document.createElement('button'); validateBtn.className='validate-btn'; validateBtn.style.marginTop='20px'; validateBtn.textContent='🔴 VALIDATION FINALE';
  validateBtn.onclick = () => { finalState.validate=true; submitAction({ finalState }); };
  area.appendChild(validateBtn);
}

// ── Firebase listeners ──
function setupListeners() {
  let introShown = false;

  GameDB.onStateChange(state => {
    if (state.phase === 'playing') {
      if (!introShown && state.startTimestamp) {
        introShown = true;
        if (state.timeLimit) timeLimit = state.timeLimit;
        document.getElementById('wait-overlay').style.display = 'none';
        document.getElementById('game-area').style.display = 'grid';
        if (state.puzzlesSeed && PUZZLES.length === 0) initPuzzles(state.puzzlesSeed);
        startTimestamp = state.startTimestamp;
        startTimerLoop();
        AudioManager.gameStart();
        Scenario.play('intro', () => { showPuzzle(0); });
        return;
      }

      const newIdx = state.currentPuzzle || 0;
      if (newIdx !== lastPuzzleIndex && lastPuzzleIndex >= 0 && newIdx > 0) {
        const cutId = 'cutscene_' + lastPuzzleIndex;
        AudioManager.puzzleNext();
        Scenario.play(cutId, () => { showPuzzle(newIdx); });
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
        const card = document.getElementById('end-card');
        overlay.classList.add('visible');
        card.className = state.win ? 'win' : 'lose';
        document.getElementById('end-title').textContent = state.win ? '🏆 VICTOIRE' : '💀 DÉFAITE';
        document.getElementById('end-reason').textContent = state.reason;
      });
    }
  });

  GameDB.onResult(result => {
    if (result.valid) { AudioManager.success(); showNotif('✅ ' + result.message, 'success'); statusLog(result.message, 'var(--green)'); }
    else              { AudioManager.error();   showNotif('❌ ' + result.message, 'error');   statusLog(result.message, 'var(--red)'); }
  });

  GameDB.onDisconnect(() => {
    AudioManager.disconnect();
    showNotif('⚠ Le Technicien s\'est déconnecté', 'error');
  });
}
