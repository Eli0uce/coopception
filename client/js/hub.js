/**
 * hub.js — Logique du Hub Spatial
 */

const MISSIONS = [
  {
    id: 1,
    num: 'MISSION 01',
    name: 'STATION ZÉRO',
    desc: 'Réactivation du générateur de secours de la station orbitale.<br>Cinq modules critiques ont été compromis.',
    icon: '⚡',
    status: 'done',
    statsKey: 'sz_mission1_stats'   // clé sessionStorage pour les stats futures
  },
  {
    id: 2,
    num: 'MISSION 02',
    name: '??? ??? ???',
    desc: '████████ ████ ██████████ ████.<br>Accès restreint — Habilitation requise.',
    icon: '🔒',
    status: 'locked'
  }
];

// ── Lecture du contexte session ──
const role = sessionStorage.getItem('sz_role') || 'technicien';
const room = sessionStorage.getItem('sz_room') || '----';

// ── Injection des badges ──
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

// ── Rendu des cartes missions ──
function renderMissions() {
  const list = document.getElementById('mission-list');
  list.innerHTML = '';

  MISSIONS.forEach(m => {
    const card = document.createElement('div');
    card.className = `mission-card ${m.status}`;
    card.dataset.id = m.id;

    if (m.status === 'done') {
      card.innerHTML = `
        <div class="mission-card-inner">
          <div class="mission-icon">${m.icon}</div>
          <div class="mission-body">
            <div class="mission-num">${m.num}</div>
            <div class="mission-name">${m.name}</div>
            <div class="mission-desc">${m.desc}</div>
            <div class="mission-stats">
              <div class="stat-item">✔ <span>TERMINÉE</span></div>
              <div class="stat-item">★★★ <span>3 / 3</span></div>
              <div class="stat-item">🧩 <span>5 MODULES</span></div>
            </div>
          </div>
          <div class="mission-cta">
            <div class="status-chip done">TERMINÉE</div>
            <button class="cta-btn" onclick="event.stopPropagation()">↺ REJOUER</button>
          </div>
        </div>`;

      // Clic sur la carte entière (sauf bouton)
      card.addEventListener('click', () => openMission(m.id));

    } else {
      card.innerHTML = `
        <div class="mission-card-inner">
          <div class="mission-icon">${m.icon}</div>
          <div class="mission-body">
            <div class="mission-num">${m.num}</div>
            <div class="mission-name">${m.name}</div>
            <div class="mission-desc">${m.desc}</div>
            <div class="lock-hint">▸ COMPLÉTEZ LA MISSION 01 POUR DÉVERROUILLER</div>
          </div>
          <div class="mission-cta">
            <div class="status-chip locked">VERROUILLÉE</div>
          </div>
        </div>`;
    }

    list.appendChild(card);
  });
}

// ── Navigation vers une mission ──
function openMission(id) {
  if (id === 1) {
    // Retour au lobby pour relancer une partie
    window.location.href = '/';
  }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initMeta();
  renderMissions();

  document.getElementById('btn-lobby').addEventListener('click', () => {
    window.location.href = '/';
  });
});

