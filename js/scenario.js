// ── Moteur de cinématiques + scénario complet ──────────────────────────────
const Scenario = (() => {
  const CHAR_DELAY = 28;

  // ── Données du scénario ──────────────────────────────────────────────────
  const SCENES = {
    intro: {
      location: 'STATION ZÉRO — ORBITE EUROPA — 03:47 UTC',
      bg: 'space',
      lines: [
        { speaker:'SYSTÈME',  role:'system', text:'ALERTE CRITIQUE NIVEAU 5 — DÉFAILLANCE EN CASCADE DÉTECTÉE SUR TOUS LES MODULES.' },
        { speaker:'SYSTÈME',  role:'system', text:'ÉVACUATION COMPLÈTE. PERSONNEL RESTANT : 2 — PROTOCOLE DE SURVIE ACTIVÉ.' },
        { speaker:'ARIA',     role:'tech',   text:'Cole ! Tu m\'entends ? La salle de données est encore en ligne mais pour combien de temps...' },
        { speaker:'COLE',     role:'oper',   text:'Ouais, je t\'entends. Salle des machines. La moitié des systèmes est grillée. C\'est quoi ce chaos ?' },
        { speaker:'ARIA',     role:'tech',   text:'Un pic d\'énergie massif dans le réacteur principal. Fusion imminente. On a exactement 15 minutes.' },
        { speaker:'COLE',     role:'oper',   text:'15 minutes pour quoi exactement ?' },
        { speaker:'ARIA',     role:'tech',   text:'Réactiver manuellement les 5 modules critiques. Moi j\'ai les manuels numériques — toi tu as les panneaux de contrôle.' },
        { speaker:'COLE',     role:'oper',   text:'Donc on fait ça ensemble. Sans se voir. Parfait.' },
        { speaker:'ARIA',     role:'tech',   text:'On n\'a pas le choix. Commence par le module réacteur. Je te lis la table de codes...' },
      ]
    },

    cutscene_1: {
      location: 'MODULE RÉACTEUR — STABILISÉ',
      bg: 'green',
      lines: [
        { speaker:'COLE',  role:'oper', text:'Réacteur stabilisé ! Je sens encore la chaleur mais les voyants passent au vert.' },
        { speaker:'ARIA',  role:'tech', text:'Bien joué. Mais regarde les niveaux de CO2 dans les couloirs... l\'atmosphère décroche.' },
        { speaker:'COLE',  role:'oper', text:'Ces pannes en série... ça me semble pas accidentel.' },
        { speaker:'ARIA',  role:'tech', text:'Je pense la même chose. On enquête après. Module atmosphère maintenant.' },
      ]
    },

    cutscene_2: {
      location: 'MODULE ATMOSPHÈRE — NORMALISÉ',
      bg: 'green',
      lines: [
        { speaker:'COLE',  role:'oper', text:'Atmosphère normalisée. Je peux enfin respirer...' },
        { speaker:'ARIA',  role:'tech', text:'Cole. J\'ai trouvé quelque chose dans les logs système. Les sécurités ont été désactivées depuis l\'intérieur.' },
        { speaker:'COLE',  role:'oper', text:'Sabotage ? Qui serait encore sur cette station ?' },
        { speaker:'ARIA',  role:'tech', text:'Je ne sais pas. Mais les communications partielles sont rétablies. Si on les restaure complètement, on pourrait retrouver qui a fait ça.' },
      ]
    },

    cutscene_3: {
      location: 'MODULE COMMUNICATIONS — RÉTABLI',
      bg: 'amber',
      lines: [
        { speaker:'ARIA',  role:'tech', text:'J\'ai décodé le message d\'urgence crypté. Tu vas pas aimer ça.' },
        { speaker:'COLE',  role:'oper', text:'Balance.' },
        { speaker:'ARIA',  role:'tech', text:'L\'évacuation a été déclenchée manuellement depuis le module central. Par quelqu\'un qui voulait nous laisser seuls ici.' },
        { speaker:'COLE',  role:'oper', text:'Nous laisser mourir, tu veux dire.' },
        { speaker:'ARIA',  role:'tech', text:'Les données sont enregistrées. Pour l\'instant — propulsion. On rentre à la maison.' },
      ]
    },

    cutscene_4: {
      location: 'MODULE PROPULSION — OPÉRATIONNEL',
      bg: 'green',
      lines: [
        { speaker:'COLE',  role:'oper', text:'Moteurs en ligne. On peut partir quand tu veux.' },
        { speaker:'ARIA',  role:'tech', text:'Pas encore. Le protocole central a été verrouillé manuellement avec un code d\'urgence.' },
        { speaker:'COLE',  role:'oper', text:'Tu as les instructions ?' },
        { speaker:'ARIA',  role:'tech', text:'J\'ai tout. Écoute-moi attentivement. C\'est notre dernière chance.' },
        { speaker:'COLE',  role:'oper', text:'Toujours là. On le fait.' },
      ]
    },

    outro_win: {
      location: 'STATION ZÉRO — TOUS MODULES OPÉRATIONNELS',
      bg: 'win',
      lines: [
        { speaker:'SYSTÈME', role:'system', text:'PROTOCOLE DE SURVIE COMPLÉTÉ — ÉVACUATION AUTORISÉE — CAPSULES EN ROUTE.' },
        { speaker:'COLE',    role:'oper',   text:'Aria... on l\'a vraiment fait.' },
        { speaker:'ARIA',    role:'tech',   text:'Je n\'arrive pas à y croire. 15 minutes. Pile.' },
        { speaker:'COLE',    role:'oper',   text:'Les données du saboteur sont enregistrées ?' },
        { speaker:'ARIA',    role:'tech',   text:'Tout est là. Les autorités terrestres s\'en occuperont. On rentre.' },
        { speaker:'COLE',    role:'oper',   text:'Tu m\'avais promis un café.' },
        { speaker:'ARIA',    role:'tech',   text:'Je t\'en offre deux.' },
      ]
    },

    outro_lose: {
      location: 'STATION ZÉRO — PROTOCOLE ÉCHOUÉ',
      bg: 'lose',
      lines: [
        { speaker:'SYSTÈME', role:'system', text:'TEMPS ÉCOULÉ — RÉACTEUR CRITIQUE — SÉQUENCE D\'AUTODESTRUCTION INITIÉE.' },
        { speaker:'ARIA',    role:'tech',   text:'Non... non non non. Cole, je suis désolée.' },
        { speaker:'COLE',    role:'oper',   text:'On était si proches. Il devait y avoir un moyen.' },
        { speaker:'ARIA',    role:'tech',   text:'Il y en avait un. Le temps nous a manqué.' },
        { speaker:'SYSTÈME', role:'system', text:'FIN DE TRANSMISSION — STATION ZÉRO — 2157.03.15 — 04:02 UTC.' },
      ]
    }
  };

  // ── État interne ──────────────────────────────────────────────────────────
  let overlay = null;
  let currentLines = [];
  let currentIdx = 0;
  let typeTimer = null;
  let onComplete = null;
  let canAdvance = false;
  let skipBeep = 0;

  // ── CSS injecté ───────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cin-styles')) return;
    const s = document.createElement('style');
    s.id = 'cin-styles';
    s.textContent = `
      #cin-overlay {
        position:fixed;inset:0;z-index:9000;
        background:rgba(0,0,0,0.97);
        display:none;flex-direction:column;align-items:center;justify-content:center;
        font-family:'Share Tech Mono',monospace;
        transition:opacity .3s;
      }
      #cin-overlay.bg-amber { background:rgba(5,3,0,0.97); }
      #cin-overlay.bg-win   { background:rgba(0,5,0,0.97); }
      #cin-overlay.bg-lose  { background:rgba(5,0,0,0.97); }

      .cin-scanline {
        position:absolute;inset:0;pointer-events:none;
        background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,65,0.015) 3px,rgba(0,255,65,0.015) 4px);
      }
      .cin-header {
        width:min(760px,95vw);
        display:flex;justify-content:space-between;align-items:center;
        padding:8px 16px;
        border:1px solid var(--border);
        margin-bottom:16px;
        font-size:11px;letter-spacing:2px;color:var(--green-dim);
      }
      .cin-location { color:var(--amber); }

      .cin-box {
        width:min(760px,95vw);
        border:1px solid var(--green);
        background:rgba(0,10,0,0.9);
        box-shadow:0 0 30px rgba(0,255,65,0.15);
        position:relative;
      }
      .cin-box.amber-theme { border-color:var(--amber); box-shadow:0 0 30px rgba(255,176,0,0.15); }

      .cin-body {
        display:flex;align-items:flex-start;gap:20px;padding:24px;min-height:130px;
      }
      .cin-portrait {
        display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0;
      }
      .cin-avatar {
        width:64px;height:64px;border:2px solid;
        display:flex;align-items:center;justify-content:center;
        font-size:26px;position:relative;overflow:hidden;
      }
      .cin-avatar::before {
        content:'';position:absolute;inset:0;
        background:linear-gradient(135deg,rgba(255,255,255,0.05),transparent);
      }
      .cin-avatar.tech  { border-color:var(--green); background:rgba(0,255,65,0.08); color:var(--green); }
      .cin-avatar.tech::after  { content:'🖥'; font-size:30px; }
      .cin-avatar.oper  { border-color:var(--amber); background:rgba(255,176,0,0.08); color:var(--amber); }
      .cin-avatar.oper::after  { content:'⚙'; font-size:30px; }
      .cin-avatar.system{ border-color:var(--red); background:rgba(255,51,51,0.08); color:var(--red); animation:cin-alert .5s step-end infinite; }
      .cin-avatar.system::after{ content:'⚠'; font-size:30px; }
      @keyframes cin-alert { 0%,100%{opacity:1} 50%{opacity:0.4} }

      .cin-name {
        font-size:11px;letter-spacing:3px;
        padding:2px 8px;border:1px solid;
      }
      .cin-avatar.tech  ~ .cin-name { color:var(--green); border-color:var(--green); }
      .cin-avatar.oper  ~ .cin-name { color:var(--amber); border-color:var(--amber); }
      .cin-avatar.system~ .cin-name { color:var(--red);   border-color:var(--red); }

      .cin-dialogue { flex:1; }
      .cin-text {
        font-size:16px;color:#e8e8e8;line-height:1.7;
        min-height:80px;letter-spacing:0.5px;
      }
      .cin-cursor {
        display:inline-block;color:var(--green);
        animation:blink .7s step-end infinite;margin-left:2px;
      }

      .cin-footer {
        display:flex;align-items:center;justify-content:space-between;
        padding:10px 24px;border-top:1px solid var(--border);
        background:rgba(0,0,0,0.5);
      }
      .cin-progress { font-size:11px;color:var(--green-dim);letter-spacing:2px; }
      .cin-controls { display:flex;gap:10px; }
      .cin-btn {
        background:transparent;font-family:'Share Tech Mono',monospace;
        font-size:12px;letter-spacing:2px;padding:6px 14px;cursor:pointer;
        transition:all .15s;
      }
      .cin-btn-next {
        border:1px solid var(--green);color:var(--green);
      }
      .cin-btn-next:hover { background:var(--green);color:#000;box-shadow:var(--glow); }
      .cin-btn-skip {
        border:1px solid var(--border);color:var(--green-dim);
      }
      .cin-btn-skip:hover { border-color:var(--red);color:var(--red); }

      /* Barre de progression */
      .cin-progress-bar {
        height:2px;background:var(--border);
      }
      .cin-progress-fill {
        height:100%;background:var(--green);
        transition:width .4s ease;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Construction de l'overlay ─────────────────────────────────────────────
  function buildOverlay() {
    if (overlay) return;
    injectStyles();
    overlay = document.createElement('div');
    overlay.id = 'cin-overlay';
    overlay.innerHTML = `
      <div class="cin-scanline"></div>
      <div class="cin-header">
        <span class="cin-location">—</span>
        <span class="cin-date">2157.03.15</span>
      </div>
      <div class="cin-box" id="cin-box">
        <div class="cin-progress-bar"><div class="cin-progress-fill" id="cin-bar" style="width:0%"></div></div>
        <div class="cin-body">
          <div class="cin-portrait">
            <div class="cin-avatar tech" id="cin-avatar"></div>
            <div class="cin-name" id="cin-name">—</div>
          </div>
          <div class="cin-dialogue">
            <div class="cin-text" id="cin-text"></div>
            <span class="cin-cursor" id="cin-cursor" style="display:none">▊</span>
          </div>
        </div>
        <div class="cin-footer">
          <span class="cin-progress" id="cin-prog">1 / 1</span>
          <div class="cin-controls">
            <button class="cin-btn cin-btn-skip" id="cin-skip">PASSER</button>
            <button class="cin-btn cin-btn-next" id="cin-next">CONTINUER ›</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('cin-next').addEventListener('click', nextLine);
    document.getElementById('cin-skip').addEventListener('click', skipScene);
    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (!overlay || overlay.style.display === 'none') return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); nextLine(); }
    if (e.code === 'Escape') skipScene();
  }

  // ── Lecture d'une scène ───────────────────────────────────────────────────
  function play(sceneId, cb) {
    const scene = SCENES[sceneId];
    if (!scene) { if (cb) cb(); return; }
    buildOverlay();
    onComplete = cb;
    currentLines = scene.lines;
    currentIdx = 0;

    // Thème de fond
    const bg = scene.bg || 'space';
    overlay.className = bg === 'amber' ? 'bg-amber' : bg === 'win' ? 'bg-win' : bg === 'lose' ? 'bg-lose' : '';
    document.getElementById('cin-box').className = 'cin-box' + (bg === 'amber' ? ' amber-theme' : '');

    overlay.querySelector('.cin-location').textContent = scene.location;
    overlay.querySelector('.cin-date').textContent = '2157.03.15';
    overlay.style.display = 'flex';
    showLine(0);
  }

  function showLine(idx) {
    if (idx >= currentLines.length) { finishScene(); return; }
    canAdvance = false;
    currentIdx = idx;
    const line = currentLines[idx];

    document.getElementById('cin-avatar').className = `cin-avatar ${line.role}`;
    document.getElementById('cin-name').textContent = line.speaker;
    document.getElementById('cin-prog').textContent = `${idx + 1} / ${currentLines.length}`;
    document.getElementById('cin-bar').style.width = `${((idx + 1) / currentLines.length) * 100}%`;
    document.getElementById('cin-cursor').style.display = 'none';

    const textEl = document.getElementById('cin-text');
    textEl.textContent = '';
    let i = 0;
    clearInterval(typeTimer);
    typeTimer = setInterval(() => {
      if (i < line.text.length) {
        textEl.textContent += line.text[i++];
        // Son de frappe discret (1 char sur 4)
        if (i % 4 === 0 && typeof AudioManager !== 'undefined') {
          AudioManager.play('typeBeep');
        }
      } else {
        clearInterval(typeTimer);
        document.getElementById('cin-cursor').style.display = 'inline-block';
        setTimeout(() => { canAdvance = true; }, 300);
      }
    }, CHAR_DELAY);
  }

  function nextLine() {
    if (typeof AudioManager !== 'undefined') AudioManager.click();
    if (!canAdvance) {
      // Affiche le texte complet immédiatement
      clearInterval(typeTimer);
      document.getElementById('cin-text').textContent = currentLines[currentIdx].text;
      document.getElementById('cin-cursor').style.display = 'inline-block';
      canAdvance = true;
      return;
    }
    showLine(currentIdx + 1);
  }

  function skipScene() {
    clearInterval(typeTimer);
    overlay.style.display = 'none';
    if (onComplete) { const cb = onComplete; onComplete = null; cb(); }
  }

  function finishScene() {
    setTimeout(() => {
      overlay.style.display = 'none';
      if (onComplete) { const cb = onComplete; onComplete = null; cb(); }
    }, 400);
  }

  // ── API publique ──────────────────────────────────────────────────────────
  return { play, skip: skipScene };
})();

