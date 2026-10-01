/**
 * hub.js — Hub Spatial piloté par le serveur (état de campagne autoritaire)
 */

const role = sessionStorage.getItem('sz_role');
const room = sessionStorage.getItem('sz_room');

const RESOURCE_LABELS = {
  integrity: 'INTÉGRITÉ',
  trust: 'CONFIANCE',
  intel: 'RENSEIGNEMENT'
};

const RESOURCE_DESCRIPTIONS = {
  integrity: "Intégrité structurelle de la station. Chute sous 40 → la station se disloque (fin EFFONDREMENT). Baisse sur certains choix et pénalités d'échec.",
  trust: "Confiance de l'équipage envers vous. Influence le ton des dialogues et conditionne plusieurs fins (ALLIANCE, RÉDEMPTION, ASCENSION…).",
  intel: "Renseignement accumulé sur la station et ses mystères. Débloque des options narratives et certaines fins (SYMBIOSE, TRANSCENDANCE…)."
};

const MAX_DIFFICULTY = 6;

// État local de présentation (pas de logique de jeu ici — uniquement du rendu) :
let lastResources = null;     // pour calculer un delta affiché sur chaque ressource
let lastMissions = [];        // dernière liste de missions reçue (pour filtre + redraw du graphe)
let lastMissionById = {};     // id -> mission (toutes statuts confondus, pour noms de prérequis)
let lastBestStars = {};
let currentFilter = 'all';
let graphResizeHandle = null;

if (!role || !room) {
  window.location.href = 'index.html';
}

Onboarding.init();

function initMeta() {
  const roleEl = document.getElementById('meta-role');
  const roomEl = document.getElementById('meta-room');
  if (role === 'technician') {
    roleEl.textContent = 'TECHNICIEN';
    roleEl.classList.add('role-badge');
  } else {
    roleEl.textContent = 'OPÉRATEUR';
    roleEl.classList.add('role-badge', 'amber');
  }
  roomEl.textContent = `ROOM : ${room}`;
}

function showNotif(text, type = 'success') {
  const n = document.createElement('div');
  n.className = `notif ${type}`;
  n.textContent = text;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

function formatMmSs(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderResources(resources, resourceKeys) {
  const panel = document.getElementById('resource-panel');
  panel.innerHTML = '';
  resourceKeys.forEach(key => {
    const value = resources[key];
    const prevValue = lastResources ? lastResources[key] : value;
    const delta = value - prevValue;
    let deltaHtml = '';
    if (delta !== 0) {
      const cls = delta > 0 ? 'positive' : 'negative';
      deltaHtml = `<span class="resource-delta ${cls}">${delta > 0 ? '+' : ''}${delta}</span>`;
    }
    const item = document.createElement('div');
    item.className = 'resource-item';
    item.tabIndex = 0;
    item.innerHTML = `
      <div class="resource-label"><span>${RESOURCE_LABELS[key] || key.toUpperCase()}</span><span class="resource-val">${value}${deltaHtml}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${value}%"></div></div>
      <div class="resource-tooltip">${RESOURCE_DESCRIPTIONS[key] || ''}</div>
    `;
    panel.appendChild(item);
  });
  lastResources = { ...resources };
}

function renderEnding(payload) {
  const banner = document.getElementById('ending-banner');
  if (payload.campaignComplete && payload.ending) {
    banner.style.display = 'block';
    document.getElementById('ending-title').textContent = `🏁 CAMPAGNE TERMINÉE — FIN : ${payload.ending.title}`;
    document.getElementById('ending-text').textContent = payload.ending.text;
    const replayBtn = document.getElementById('btn-replay');
    replayBtn.style.display = 'inline-block';

    const doneMissions = payload.missions.filter(m => m.status === 'done');
    const totalStars = doneMissions.reduce((sum, m) => sum + (m.stars || 0), 0);
    const maxStars = payload.missions.length * 3;
    const summary = document.getElementById('ending-summary');
    if (summary) {
      summary.innerHTML = `
        <div class="ending-stat">MISSIONS TERMINÉES<b>${doneMissions.length} / ${payload.missions.length}</b></div>
        <div class="ending-stat">ÉTOILES TOTALES<b>${totalStars} / ${maxStars}</b></div>
        <div class="ending-stat">CYCLE NEW GAME+<b>${payload.ngPlus || 0}</b></div>
      `;
    }
  } else {
    banner.style.display = 'none';
  }

  const ngPlusBadge = document.getElementById('ngplus-badge');
  if (payload.ngPlus > 0) {
    ngPlusBadge.className = 'ngplus-pill';
    ngPlusBadge.style.display = 'inline-block';
    ngPlusBadge.textContent = `🔁 NEW GAME+ — CYCLE ${payload.ngPlus}`;
    ngPlusBadge.title = 'Minuteurs, pénalités et coût des indices sont durcis à chaque cycle de rejeu complet.';
  } else {
    ngPlusBadge.style.display = 'none';
  }
}

// ══════════════════════════════════════════
// Graphe de progression (arbre de déverrouillage)
// ══════════════════════════════════════════

/** Calcule le "palier" (profondeur topologique) de chaque mission à partir de
 * `unlockRequires`, pour regrouper en lignes les missions jouables en
 * parallèle (ex: m2 et m3 dépendent toutes deux uniquement de m1 → même
 * palier). Mémoïsé ; robuste même si l'ordre de MISSIONS change. */
function computeTiers(missions, byId) {
  const cache = {};
  function tierOf(id) {
    if (cache[id] !== undefined) return cache[id];
    const m = byId[id];
    if (!m || !Array.isArray(m.unlockRequires) || m.unlockRequires.length === 0) return (cache[id] = 0);
    cache[id] = 0; // garde-fou anti-cycle
    const t = 1 + Math.max(...m.unlockRequires.map(tierOf));
    cache[id] = t;
    return t;
  }
  const tiers = {};
  missions.forEach(m => {
    const t = tierOf(m.id);
    (tiers[t] = tiers[t] || []).push(m);
  });
  return tiers;
}

function renderGraph(missions) {
  const byId = {};
  missions.forEach(m => { byId[m.id] = m; });
  lastMissionById = byId;

  const graphEl = document.getElementById('mission-graph');
  if (!graphEl) return;
  graphEl.innerHTML = '';

  const tiers = computeTiers(missions, byId);
  const tierKeys = Object.keys(tiers).map(Number).sort((a, b) => a - b);

  tierKeys.forEach(t => {
    const row = document.createElement('div');
    row.className = 'graph-tier';
    tiers[t].slice().sort((a, b) => a.order - b.order).forEach(m => {
      const node = document.createElement('div');
      node.className = `graph-node ${m.status}${m.isFinale ? ' finale' : ''}`;
      node.id = `gnode-${m.id}`;
      node.dataset.id = m.id;

      const reqNames = (m.unlockRequires || [])
        .map(id => byId[id] ? (byId[id].codename || byId[id].title) : null)
        .filter(Boolean);

      let metaHtml = '';
      if (m.status === 'done') metaHtml = `${'★'.repeat(m.stars || 0)}${'☆'.repeat(3 - (m.stars || 0))}`;
      else if (m.status === 'available') metaHtml = `DIFF. ${m.difficulty}/${MAX_DIFFICULTY}`;
      else metaHtml = 'VERROUILLÉE';

      node.innerHTML = `
        <div class="gn-icon">${m.status === 'locked' ? '🔒' : m.icon}</div>
        <div class="gn-title">${m.status === 'locked' ? '??? ??? ???' : m.title}</div>
        <div class="gn-meta">${metaHtml}</div>
        ${m.status === 'locked' && reqNames.length ? `<div class="gn-req">Requiert : ${reqNames.join(', ')}</div>` : ''}
      `;

      if (m.status === 'available' || m.status === 'done') {
        node.tabIndex = 0;
        node.setAttribute('role', 'button');
        node.setAttribute('aria-label', `${m.status === 'done' ? 'Rejouer' : 'Lancer'} ${m.title}`);
        node.addEventListener('click', () => startMission(m.id));
        node.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startMission(m.id); }
        });
      }
      row.appendChild(node);
    });
    graphEl.appendChild(row);
  });

  requestAnimationFrame(() => drawGraphLinks(missions, byId));
}

/** Dessine les arêtes du graphe (SVG superposé) entre chaque mission et ses
 * prérequis directs, en mesurant la position réelle des cartes dans le DOM.
 * Recalculé après chaque rendu et au redimensionnement de la fenêtre. */
function drawGraphLinks(missions, byId) {
  const wrap = document.getElementById('mission-graph-wrap');
  const svg = document.getElementById('graph-links');
  if (!wrap || !svg) return;
  const wrapRect = wrap.getBoundingClientRect();
  svg.setAttribute('width', String(wrapRect.width));
  svg.setAttribute('height', String(wrapRect.height));
  svg.setAttribute('viewBox', `0 0 ${wrapRect.width} ${wrapRect.height}`);
  svg.innerHTML = '';

  missions.forEach(m => {
    (m.unlockRequires || []).forEach(reqId => {
      const fromEl = document.getElementById(`gnode-${reqId}`);
      const toEl = document.getElementById(`gnode-${m.id}`);
      if (!fromEl || !toEl) return;
      const fr = fromEl.getBoundingClientRect();
      const tr = toEl.getBoundingClientRect();
      const x1 = fr.left + fr.width / 2 - wrapRect.left;
      const y1 = fr.bottom - wrapRect.top;
      const x2 = tr.left + tr.width / 2 - wrapRect.left;
      const y2 = tr.top - wrapRect.top;
      const midY = (y1 + y2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
      path.setAttribute('fill', 'none');
      const color = m.status === 'done' ? 'rgba(0,255,65,0.45)' : m.status === 'available' ? 'rgba(79,195,247,0.4)' : 'rgba(255,176,0,0.18)';
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '1.5');
      svg.appendChild(path);
    });
  });
}

function redrawGraphLinks() {
  if (lastMissions.length) drawGraphLinks(lastMissions, lastMissionById);
}

window.addEventListener('resize', () => {
  clearTimeout(graphResizeHandle);
  graphResizeHandle = setTimeout(redrawGraphLinks, 150);
});

// ══════════════════════════════════════════
// Liste détaillée des missions (filtrable)
// ══════════════════════════════════════════

function diffDotsHtml(difficulty) {
  let html = '<span class="diff-dots">';
  for (let i = 1; i <= MAX_DIFFICULTY; i++) {
    html += `<span class="${i <= difficulty ? 'lit' : ''}"></span>`;
  }
  return html + '</span>';
}

function renderMissions(missions) {
  const list = document.getElementById('mission-list');
  list.innerHTML = '';

  const filtered = missions.filter(m => currentFilter === 'all' || m.status === currentFilter);

  if (!filtered.length) {
    list.innerHTML = '<div class="mission-empty-filter">◌ AUCUNE MISSION DANS CETTE CATÉGORIE</div>';
    return;
  }

  filtered.forEach(m => {
    const card = document.createElement('div');
    card.className = `mission-card ${m.status}`;
    card.dataset.id = m.id;

    if (m.status === 'done') {
      card.innerHTML = `
        <div class="mission-card-inner">
          <div class="mission-icon">${m.icon}</div>
          <div class="mission-body">
            <div class="mission-num">MISSION ${String(m.order).padStart(2, '0')} — ${m.codename}</div>
            <div class="mission-name">${m.title}</div>
            <div class="mission-desc">${m.briefing}</div>
            <div class="mission-stats">
              <div class="stat-item">✔ <span>TERMINÉE</span></div>
              <div class="stat-item">${'★'.repeat(m.stars)}${'☆'.repeat(3 - m.stars)} <span>${m.stars} / 3</span></div>
              <div class="stat-item">🧩 <span>${m.moduleCount} MODULES</span></div>
              <div class="stat-item">⚠ ${diffDotsHtml(m.difficulty)} <span>DIFF. ${m.difficulty}</span></div>
              <div class="stat-item">⏱ <span>~${formatMmSs(m.timeLimit)}</span></div>
            </div>
          </div>
          <div class="mission-cta">
            <div class="status-chip done">TERMINÉE</div>
            <button class="cta-btn start" data-id="${m.id}">⟳ REJOUER</button>
          </div>
        </div>`;
      card.querySelector('.cta-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        startMission(m.id);
      });
    } else if (m.status === 'available') {
      const record = lastBestStars && Number.isInteger(lastBestStars[m.id]) ? lastBestStars[m.id] : null;
      card.innerHTML = `
        <div class="mission-card-inner">
          <div class="mission-icon">${m.icon}</div>
          <div class="mission-body">
            <div class="mission-num">MISSION ${String(m.order).padStart(2, '0')} — ${m.codename}${m.isFinale ? ' — FINALE' : ''}</div>
            <div class="mission-name">${m.title}</div>
            <div class="mission-desc">${m.briefing}</div>
            <div class="mission-stats">
              <div class="stat-item">🧩 <span>${m.moduleCount} MODULES</span></div>
              <div class="stat-item">⚠ ${diffDotsHtml(m.difficulty)} <span>DIFF. ${m.difficulty}</span></div>
              <div class="stat-item">⏱ <span>~${formatMmSs(m.timeLimit)}</span></div>
              ${record ? `<div class="stat-item">🏆 <span>RECORD : ${'★'.repeat(record)}${'☆'.repeat(3 - record)}</span></div>` : ''}
            </div>
          </div>
          <div class="mission-cta">
            <div class="status-chip available">DISPONIBLE</div>
            <button class="cta-btn start" data-id="${m.id}">▶ LANCER</button>
          </div>
        </div>`;
      card.querySelector('.cta-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        startMission(m.id);
      });
    } else {
      const reqNames = (m.unlockRequires || [])
        .map(id => lastMissionById[id] ? `${lastMissionById[id].icon || ''} ${lastMissionById[id].title}`.trim() : null)
        .filter(Boolean);
      card.innerHTML = `
        <div class="mission-card-inner">
          <div class="mission-icon">${m.icon}</div>
          <div class="mission-body">
            <div class="mission-num">MISSION ${String(m.order).padStart(2, '0')}</div>
            <div class="mission-name">??? ??? ???</div>
            <div class="mission-desc">████████ ████ ██████████ ████.<br>Accès restreint — Habilitation requise.</div>
            <div class="lock-hint">▸ REQUIERT : ${reqNames.length ? reqNames.join(' ET ') : 'MISSION(S) PRÉALABLE(S)'}</div>
          </div>
          <div class="mission-cta">
            <div class="status-chip locked">VERROUILLÉE</div>
          </div>
        </div>`;
    }

    list.appendChild(card);
  });
}

function renderHub(payload) {
  lastMissions = payload.missions;
  lastBestStars = payload.bestStars || {};
  renderResources(payload.resources, payload.resourceKeys);
  renderEnding(payload);
  renderGraph(payload.missions);
  renderMissions(payload.missions);
}

function startMission(missionId) {
  WS.send({ type: 'mission:start', missionId });
}

WS.connect(() => {
  StationAuth.currentUser().then(async user => {
    if (!user) { window.location.href = 'index.html'; return; }
    WS.send({ type: 'session:resume', code: room, role, userId: user.uid });
    if (role === 'technician') {
      const saved = await StationAuth.loadCampaign(room);
      if (saved && saved.completedMissions) {
        WS.send({ type: 'campaign:restore', campaign: saved });
      }
    }
  }).catch(() => { window.location.href = 'index.html'; });
});

WS.on('hub:state', payload => {
  renderHub(payload);
  StationAuth.saveCampaign(room, {
    resources: payload.resources,
    completedMissions: payload.missions.filter(m => m.status === 'done').reduce((out, mission) => {
      out[mission.id] = { stars: mission.stars };
      return out;
    }, {}),
    flags: payload.flags || {},
    ending: payload.ending || null,
    ngPlus: payload.ngPlus || 0,
    bestStars: payload.bestStars || {}
  }).catch(() => showNotif('⚠ Sauvegarde Firebase indisponible', 'error'));
});

WS.on('session:expired', () => {
  sessionStorage.clear();
  window.location.href = 'index.html';
});

WS.on('mission:started', () => {
  window.location.href = role === 'technician' ? 'technician.html' : 'operator.html';
});

WS.on('campaign:reset', () => {
  showNotif('↺ Campagne réinitialisée', 'success');
});

WS.on('campaign:replay', (msg) => {
  showNotif(`⟳ Nouvelle campagne lancée — New Game+ cycle ${msg && msg.ngPlus ? msg.ngPlus : ''}`.trim(), 'success');
});

WS.on('error', (msg) => {
  showNotif('⚠ ' + msg.message, 'error');
});

WS.on('player:disconnected', (msg) => {
  showNotif(`⚠ ${msg.role === 'technician' ? 'Le Technicien' : "L'Opérateur"} s'est déconnecté`, 'error');
});

WS.on('player:reconnected', (msg) => {
  showNotif(`✅ ${msg.role === 'technician' ? 'Le Technicien' : "L'Opérateur"} est reconnecté`, 'success');
});

document.addEventListener('DOMContentLoaded', () => {
  initMeta();

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderMissions(lastMissions);
    });
  });

  document.getElementById('btn-lobby').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Réinitialiser toute la progression de la campagne pour cette room ?')) {
      WS.send({ type: 'campaign:reset' });
    }
  });

  document.getElementById('btn-replay').addEventListener('click', () => {
    if (confirm('Rejouer la campagne depuis le début, en New Game+ (plus difficile) ? Votre meilleur score par mission est conservé comme record.')) {
      WS.send({ type: 'campaign:replay' });
    }
  });
});
