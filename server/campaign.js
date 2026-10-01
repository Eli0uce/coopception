/**
 * campaign.js — Modèle de campagne serveur-autoritaire
 *
 * Gère l'état de progression d'une room à travers la campagne de missions :
 * déverrouillage, ressources, résultats de mission, indices, fins multiples.
 * Toute la logique de validation vit ici ; le serveur (server.js) ne fait que
 * router les messages WebSocket vers ces fonctions.
 */

const { MISSIONS, ENDINGS, RESOURCE_KEYS, INITIAL_RESOURCES } = require('./data/missions');

const MAX_HINTS_PER_PUZZLE = 3;

function findMission(missionId) {
  return MISSIONS.find(m => m.id === missionId) || null;
}

function clampResource(v) {
  return Math.max(0, Math.min(100, v));
}

/** Crée l'état de campagne initial pour une nouvelle room. */
function createCampaign() {
  return {
    resources: { ...INITIAL_RESOURCES },
    completedMissions: {}, // missionId -> { stars, timeLeft, attempts, hintsUsed, choices }
    flags: {},
    ending: null
  };
}

function sanitizeCampaign(input) {
  const campaign = createCampaign();
  if (!input || typeof input !== 'object') return campaign;
  RESOURCE_KEYS.forEach(key => {
    if (Number.isFinite(input.resources?.[key])) campaign.resources[key] = clampResource(input.resources[key]);
  });
  if (input.completedMissions && typeof input.completedMissions === 'object') {
    MISSIONS.forEach(mission => {
      const saved = input.completedMissions[mission.id];
      if (saved && Number.isInteger(saved.stars)) {
        campaign.completedMissions[mission.id] = { stars: Math.max(1, Math.min(3, saved.stars)) };
      }
    });
  }
  if (input.flags && typeof input.flags === 'object') {
    Object.keys(input.flags).slice(0, 50).forEach(flag => { campaign.flags[flag] = input.flags[flag] === true; });
  }
  const finale = MISSIONS.find(m => m.isFinale);
  if (finale && campaign.completedMissions[finale.id]) {
    campaign.ending = resolveEnding(campaign);
  }
  return campaign;
}

function isMissionUnlocked(campaign, mission) {
  return mission.unlockRequires.every(reqId => !!campaign.completedMissions[reqId]);
}

function missionStatus(campaign, mission) {
  if (campaign.completedMissions[mission.id]) return 'done';
  if (isMissionUnlocked(campaign, mission)) return 'available';
  return 'locked';
}

/** Construit le payload envoyé au client pour peupler le Hub. */
function getHubPayload(campaign) {
  const missions = MISSIONS.map(m => {
    const status = missionStatus(campaign, m);
    const result = campaign.completedMissions[m.id] || null;
    return {
      id: m.id,
      order: m.order,
      title: m.title,
      codename: m.codename,
      icon: m.icon,
      difficulty: m.difficulty,
      briefing: m.briefing,
      isFinale: m.isFinale,
      moduleCount: m.puzzles.length,
      status,
      stars: result ? result.stars : null,
      unlockRequires: m.unlockRequires
    };
  });

  return {
    resources: campaign.resources,
    resourceKeys: RESOURCE_KEYS,
    flags: { ...campaign.flags },
    missions,
    campaignComplete: !!campaign.ending,
    ending: campaign.ending
  };
}

function canStartMission(campaign, missionId) {
  const mission = findMission(missionId);
  if (!mission) return { ok: false, reason: 'Mission introuvable' };
  if (campaign.ending) return { ok: false, reason: 'La campagne est terminée' };
  if (campaign.completedMissions[missionId]) return { ok: false, reason: 'Mission déjà terminée' };
  if (!isMissionUnlocked(campaign, mission)) return { ok: false, reason: 'Mission verrouillée' };
  return { ok: true, mission };
}

/** Crée l'état d'exécution (runtime) d'une mission qui démarre. */
function startMissionRuntime(mission) {
  return {
    missionId: mission.id,
    puzzleIndex: 0,
    timeLeft: mission.timeLimit,
    puzzleStates: mission.puzzles.map(p => ({
      id: p.id,
      solved: false,
      attempts: 0,
      hintsUsed: 0
    })),
    totalAttempts: 0,
    totalHints: 0,
    choiceLog: {}
  };
}

function getPuzzleForRole(mission, puzzleIndex, role) {
  const puzzle = mission.puzzles[puzzleIndex];
  if (!puzzle) return null;
  return {
    id: puzzle.id,
    name: puzzle.name,
    module: puzzle.module,
    type: puzzle.type,
    data: role === 'technician' ? puzzle.technicianData : puzzle.operatorData
  };
}

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

function pairSetsEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const norm = arr => arr.map(p => `${p.wire}:${p.port}`).sort();
  const na = norm(a);
  const nb = norm(b);
  return na.every((v, i) => v === nb[i]);
}

/** Valide une action de puzzle. Retourne { valid, message, consequence?, timeDelta? } */
function validateAction(mission, puzzleIndex, action) {
  const puzzle = mission.puzzles[puzzleIndex];
  if (!puzzle) return { valid: false, message: 'Puzzle introuvable' };

  switch (puzzle.type) {
    case 'cross_code':
    case 'symbol_code':
    case 'mirror_sequence': {
      if (!action || !action.sequence) return { valid: false, message: 'Action invalide' };
      const match = arraysEqual(action.sequence, puzzle.solution);
      return { valid: match, message: match ? 'SÉQUENCE VALIDÉE' : 'SÉQUENCE INCORRECTE' };
    }
    case 'cipher': {
      if (!action || !action.word) return { valid: false, message: 'Action invalide' };
      const match = action.word.toUpperCase() === puzzle.solution;
      return { valid: match, message: match ? 'MOT CORRECT' : 'MOT INCORRECT' };
    }
    case 'calibration': {
      if (!action || !action.values) return { valid: false, message: 'Action invalide' };
      const sol = puzzle.solution;
      const tol = puzzle.tolerance;
      if (!Array.isArray(action.values) || action.values.length !== sol.length) {
        return { valid: false, message: 'CALIBRAGE INCOMPLET' };
      }
      const match = action.values.every((v, i) => typeof v === 'number' && Math.abs(v - sol[i]) <= tol);
      return { valid: match, message: match ? 'CALIBRAGE OK' : 'CALIBRAGE HORS TOLÉRANCE' };
    }
    case 'wire_panel': {
      if (!action || !action.connections) return { valid: false, message: 'Action invalide' };
      const match = pairSetsEqual(action.connections, puzzle.solution);
      return { valid: match, message: match ? 'CÂBLAGE CORRECT' : 'CÂBLAGE INCORRECT' };
    }
    case 'final_protocol': {
      if (!action || !action.finalState) return { valid: false, message: 'Action invalide' };
      const s = action.finalState;
      const sol = puzzle.solution;
      const switchOk = s.switch === sol.switch;
      const codeOk = s.code === sol.code;
      const leversOk = Array.isArray(s.levers) && sol.levers.every(l => s.levers.includes(l)) && s.levers.length === sol.levers.length;
      const validateOk = s.validate === true;
      const match = switchOk && codeOk && leversOk && validateOk;
      return { valid: match, message: match ? 'PROTOCOLE VALIDÉ' : 'PROTOCOLE INCOMPLET' };
    }
    case 'choice': {
      if (!action || !action.optionId) return { valid: false, message: 'Action invalide' };
      const option = puzzle.options.find(o => o.id === action.optionId);
      if (!option) return { valid: false, message: 'Option inconnue' };
      return {
        valid: true,
        message: option.resultText,
        consequence: option.consequence,
        chosenOptionId: option.id
      };
    }
    default:
      return { valid: false, message: 'Type de puzzle inconnu' };
  }
}

/** Retourne le prochain indice disponible pour le puzzle courant, ou null. */
function getHint(mission, puzzleIndex, hintsUsedSoFar) {
  const puzzle = mission.puzzles[puzzleIndex];
  if (!puzzle || !Array.isArray(puzzle.hints) || puzzle.hints.length === 0) {
    return { text: null, hintsRemaining: 0 };
  }
  if (hintsUsedSoFar >= puzzle.hints.length || hintsUsedSoFar >= MAX_HINTS_PER_PUZZLE) {
    return { text: null, hintsRemaining: 0 };
  }
  const text = puzzle.hints[hintsUsedSoFar];
  const hintsRemaining = Math.max(0, puzzle.hints.length - (hintsUsedSoFar + 1));
  return { text, hintsRemaining };
}

/** Applique les conséquences d'un choix aux ressources / flags de campagne. */
function applyConsequence(campaign, consequence) {
  if (!consequence) return;
  if (consequence.resourceDelta) {
    RESOURCE_KEYS.forEach(key => {
      if (typeof consequence.resourceDelta[key] === 'number') {
        campaign.resources[key] = clampResource(campaign.resources[key] + consequence.resourceDelta[key]);
      }
    });
  }
  if (consequence.flag) {
    campaign.flags[consequence.flag] = true;
  }
}

/** Calcule le nombre d'étoiles (1-3) obtenues pour une mission réussie. */
function computeStars(mission, runtime) {
  let stars = 3;
  const hintPenalty = runtime.totalHints > 0 ? 1 : 0;
  const attemptPenalty = runtime.totalAttempts > mission.puzzles.length * 2 ? 1 : 0;
  stars -= hintPenalty;
  stars -= attemptPenalty;
  return Math.max(1, Math.min(3, stars));
}

/** Détermine la fin de campagne parmi ENDINGS selon l'état courant. */
function resolveEnding(campaign) {
  const ctx = { resources: campaign.resources, flags: campaign.flags };
  const ending = ENDINGS.find(e => e.condition(ctx)) || ENDINGS[ENDINGS.length - 1];
  return { id: ending.id, title: ending.title, text: ending.text };
}

/**
 * Finalise une mission (succès ou échec), met à jour la campagne, calcule
 * les étoiles/récompenses et, si c'est la mission finale réussie, l'ending.
 */
function completeMission(campaign, mission, runtime, win) {
  let result = null;
  if (win) {
    const stars = computeStars(mission, runtime);
    result = {
      stars,
      timeLeft: runtime.timeLeft,
      attempts: runtime.totalAttempts,
      hintsUsed: runtime.totalHints,
      choices: runtime.choiceLog
    };
    campaign.completedMissions[mission.id] = result;
    RESOURCE_KEYS.forEach(key => {
      const delta = mission.resourceReward[key] || 0;
      campaign.resources[key] = clampResource(campaign.resources[key] + delta);
    });
    if (mission.isFinale) {
      campaign.ending = resolveEnding(campaign);
    }
  }

  const newlyUnlocked = MISSIONS
    .filter(m => !campaign.completedMissions[m.id] && isMissionUnlocked(campaign, m))
    .map(m => m.id);

  return { result, newlyUnlocked, ending: campaign.ending };
}

module.exports = {
  MISSIONS,
  findMission,
  createCampaign,
  sanitizeCampaign,
  isMissionUnlocked,
  missionStatus,
  getHubPayload,
  canStartMission,
  startMissionRuntime,
  getPuzzleForRole,
  validateAction,
  getHint,
  applyConsequence,
  completeMission,
  MAX_HINTS_PER_PUZZLE
};
