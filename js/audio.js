// ── Audio Manager — Web Audio API (tout est généré procéduralement) ──────────
const AudioManager = (() => {
  let ctx = null;
  let masterGain, sfxGain, musicGain;
  let sfxEnabled = true;
  let musicEnabled = false;
  let musicStarted = false;
  let musicNodes = [];
  let atmoTimeout = null;
  let alarmInterval = null;

  // ── Init (doit être appelé sur interaction utilisateur) ─────────────────────
  function init() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain(); masterGain.gain.value = 0.8;
    masterGain.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 1.0;
    sfxGain.connect(masterGain);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.0;
    musicGain.connect(masterGain);
    // Reverb léger via delay
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.25;
    const delayFb = ctx.createGain(); delayFb.gain.value = 0.2;
    delay.connect(delayFb); delayFb.connect(delay);
    delay.connect(musicGain);
  }

  // ── Utilitaire oscillateur ──────────────────────────────────────────────────
  function osc(freq, type, startTime, duration, peakVol, destination, freqEnd) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (freqEnd !== undefined) o.frequency.linearRampToValueAtTime(freqEnd, startTime + duration);
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(peakVol, startTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    o.connect(g); g.connect(destination || sfxGain);
    o.start(startTime); o.stop(startTime + duration + 0.02);
  }

  // ── Sons UI ─────────────────────────────────────────────────────────────────
  function hover() {
    if (!ctx || !sfxEnabled) return;
    osc(1800, 'sine', ctx.currentTime, 0.04, 0.06);
  }
  function click() {
    if (!ctx || !sfxEnabled) return;
    osc(600, 'square', ctx.currentTime, 0.06, 0.15);
    osc(300, 'square', ctx.currentTime + 0.03, 0.06, 0.08);
  }
  function beep(freq = 880) {
    if (!ctx || !sfxEnabled) return;
    osc(freq, 'square', ctx.currentTime, 0.08, 0.2);
  }

  // ── Sons gameplay ───────────────────────────────────────────────────────────
  function connect() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    osc(440, 'sine', t,       0.12, 0.3);
    osc(660, 'sine', t + 0.12, 0.18, 0.3);
  }
  function gameStart() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    [330, 415, 494, 659].forEach((f, i) => osc(f, 'sine', t + i*0.1, 0.2, 0.35));
  }
  function success() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => osc(f, 'sine', t + i*0.09, 0.22, 0.4));
  }
  function error() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    osc(200, 'sawtooth', t,       0.15, 0.4);
    osc(150, 'sawtooth', t + 0.12, 0.25, 0.35);
  }
  function countdown() {
    if (!ctx || !sfxEnabled) return;
    osc(880, 'square', ctx.currentTime, 0.07, 0.3);
  }
  function countdownUrgent() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    osc(1100, 'square', t, 0.06, 0.35);
    osc(1100, 'square', t + 0.12, 0.06, 0.3);
  }
  function victory() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    const melody = [523,659,784,659,784,1047,1319];
    melody.forEach((f, i) => osc(f, 'sine', t + i*0.14, i===6?0.6:0.2, 0.45));
    // Accord final
    [523,659,784,1047].forEach(f => osc(f, 'sine', t + melody.length*0.14, 0.8, 0.3));
  }
  function defeat() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    [392, 370, 330, 294, 220].forEach((f, i) => osc(f, 'sawtooth', t + i*0.18, 0.3, 0.3));
  }
  function disconnect() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    osc(440, 'sine', t, 0.1, 0.3);
    osc(220, 'sawtooth', t + 0.1, 0.4, 0.25);
  }
  function puzzleNext() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    osc(330, 'square', t,       0.08, 0.2);
    osc(494, 'square', t + 0.09, 0.1, 0.2);
  }
  function boot() {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    // Bruit blanc court (boot HDD)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * 0.3;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.buffer = buf; src.connect(filter); filter.connect(g); g.connect(sfxGain);
    src.start(t);
    // Bip de confirmation
    osc(440, 'square', t + 0.2, 0.1, 0.25);
    osc(880, 'square', t + 0.35, 0.15, 0.3);
  }

  // ── Alarme pulsante (timer < 60s) ───────────────────────────────────────────
  function startAlarm() {
    if (alarmInterval) return;
    alarmInterval = setInterval(() => {
      if (ctx && sfxEnabled) osc(660, 'square', ctx.currentTime, 0.06, 0.25);
    }, 500);
  }
  function stopAlarm() {
    if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
  }

  // ── Musique d'ambiance spatiale (procédurale) ───────────────────────────────
  function startMusic() {
    if (!ctx || musicStarted) return;
    musicStarted = true;
    musicGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 3);

    // Drone basse
    const d1 = ctx.createOscillator(); d1.type = 'sawtooth'; d1.frequency.value = 55;
    const d1f = ctx.createBiquadFilter(); d1f.type = 'lowpass'; d1f.frequency.value = 180;
    const d1g = ctx.createGain(); d1g.gain.value = 0.18;
    d1.connect(d1f); d1f.connect(d1g); d1g.connect(musicGain); d1.start();

    // Drone medium (légèrement désaccordé pour le battement)
    const d2 = ctx.createOscillator(); d2.type = 'sine'; d2.frequency.value = 110.4;
    const d2g = ctx.createGain(); d2g.gain.value = 0.12;
    d2.connect(d2g); d2g.connect(musicGain); d2.start();

    // Nappe haute filtrée
    const pad = ctx.createOscillator(); pad.type = 'sine'; pad.frequency.value = 220;
    const padf = ctx.createBiquadFilter(); padf.type = 'bandpass'; padf.frequency.value = 350; padf.Q.value = 1;
    const padg = ctx.createGain(); padg.gain.value = 0.07;
    pad.connect(padf); padf.connect(padg); padg.connect(musicGain); pad.start();

    // LFO tremolo lent
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15;
    const lfog = ctx.createGain(); lfog.gain.value = 0.06;
    lfo.connect(lfog); lfog.connect(d1g.gain); lfo.start();

    // Echo spatial
    const echo = ctx.createDelay(1.5); echo.delayTime.value = 0.75;
    const echoFb = ctx.createGain(); echoFb.gain.value = 0.35;
    const echoG = ctx.createGain(); echoG.gain.value = 0.15;
    padg.connect(echo); echo.connect(echoFb); echoFb.connect(echo);
    echo.connect(echoG); echoG.connect(musicGain);

    musicNodes = [d1, d2, pad, lfo];
    scheduleAtmoNote();
  }

  function stopMusic() {
    musicStarted = false;
    if (atmoTimeout) { clearTimeout(atmoTimeout); atmoTimeout = null; }
    musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    setTimeout(() => {
      musicNodes.forEach(n => { try { n.stop(); } catch(e){} });
      musicNodes = [];
    }, 2100);
  }

  // Notes atmosphériques aléatoires (gamme pentatonique spatiale)
  function scheduleAtmoNote() {
    if (!musicStarted) return;
    const scale = [165, 220, 261.6, 329.6, 392, 440, 523.25, 659.25];
    const freq = scale[Math.floor(Math.random() * scale.length)];
    const delay = 4000 + Math.random() * 9000;
    atmoTimeout = setTimeout(() => {
      if (!musicStarted || !ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      o.type = 'sine'; o.frequency.value = freq;
      f.type = 'lowpass'; f.frequency.value = 800;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.8);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4);
      o.connect(f); f.connect(g); g.connect(musicGain);
      o.start(); o.stop(ctx.currentTime + 4.5);
      scheduleAtmoNote();
    }, delay);
  }

  // ── Contrôles externes ──────────────────────────────────────────────────────
  function setSfxEnabled(val) {
    sfxEnabled = val;
    if (ctx) sfxGain.gain.value = val ? 1.0 : 0;
  }
  function setMusicEnabled(val) {
    musicEnabled = val;
    if (!ctx) return;
    if (val) startMusic();
    else stopMusic();
  }

  // ── API publique ────────────────────────────────────────────────────────────
  function play(name) {
    if (!ctx) return;
    const map = { hover, click, beep, connect, gameStart, success, error,
                  countdown, countdownUrgent, victory, defeat, disconnect,
                  puzzleNext, boot, startAlarm, stopAlarm };
    if (map[name]) map[name]();
  }

  return {
    init, play, startMusic, stopMusic, startAlarm, stopAlarm,
    setSfxEnabled, setMusicEnabled,
    // Raccourcis directs
    hover, click, beep, connect, gameStart, success, error,
    countdown, countdownUrgent, victory, defeat, disconnect, puzzleNext, boot
  };
})();

