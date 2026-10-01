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

if (!role || !room) {
  window.location.href = 'index.html';
}

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

function renderResources(resources, resourceKeys) {
  const panel = document.getElementById('resource-panel');
  panel.innerHTML = '';
  resourceKeys.forEach(key => {
    const value = resources[key];
    const item = document.createElement('div');
    item.className = 'resource-item';
    item.innerHTML = `
      <div class="resource-label"><span>${RESOURCE_LABELS[key] || key.toUpperCase()}</span><span class="resource-val">${value}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${value}%"></div></div>
    `;
    panel.appendChild(item);
  });
}

function renderEnding(payload) {
  const banner = document.getElementById('ending-banner');
  if (payload.campaignComplete && payload.ending) {
    banner.style.display = 'block';
    document.getElementById('ending-title').textContent = `🏁 CAMPAGNE TERMINÉE — FIN : ${payload.ending.title}`;
    document.getElementById('ending-text').textContent = payload.ending.text;
  } else {
    banner.style.display = 'none';
  }
}

function renderMissions(missions) {
  const list = document.getElementById('mission-list');
  list.innerHTML = '';

  missions.forEach(m => {
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
            </div>
          </div>
          <div class="mission-cta">
            <div class="status-chip done">TERMINÉE</div>
          </div>
        </div>`;
    } else if (m.status === 'available') {
      card.innerHTML = `
        <div class="mission-card-inner">
          <div class="mission-icon">${m.icon}</div>
          <div class="mission-body">
            <div class="mission-num">MISSION ${String(m.order).padStart(2, '0')} — ${m.codename}${m.isFinale ? ' — FINALE' : ''}</div>
            <div class="mission-name">${m.title}</div>
            <div class="mission-desc">${m.briefing}</div>
            <div class="mission-stats">
              <div class="stat-item">🧩 <span>${m.moduleCount} MODULES</span></div>
              <div class="stat-item">⚠ <span>DIFFICULTÉ ${m.difficulty}</span></div>
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
      card.innerHTML = `
        <div class="mission-card-inner">
          <div class="mission-icon">${m.icon}</div>
          <div class="mission-body">
            <div class="mission-num">MISSION ${String(m.order).padStart(2, '0')}</div>
            <div class="mission-name">??? ??? ???</div>
            <div class="mission-desc">████████ ████ ██████████ ████.<br>Accès restreint — Habilitation requise.</div>
            <div class="lock-hint">▸ COMPLÉTEZ LES MISSIONS PRÉREQUISES POUR DÉVERROUILLER</div>
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
  renderResources(payload.resources, payload.resourceKeys);
  renderEnding(payload);
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
    ending: payload.ending || null
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

  document.getElementById('btn-lobby').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Réinitialiser toute la progression de la campagne pour cette room ?')) {
      WS.send({ type: 'campaign:reset' });
    }
  });
});
