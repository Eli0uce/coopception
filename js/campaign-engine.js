/**
 * campaign-engine.js — Modèle de campagne autoritaire (exécuté navigateur)
 *
 * Gère l'état de progression d'une room à travers la campagne de missions :
 * déverrouillage, ressources, résultats de mission, indices, fins multiples.
 * Toute la logique de validation vit ici ; c'est le Technicien (hôte/autorité
 * de la room, voir js/rtdb-client.js) qui invoque ces fonctions pures et
 * réplique le résultat vers Firebase Realtime Database.
 *
 * Exposé comme variable globale `CampaignEngine`, dépend du global
 * `MissionsData` (voir js/missions-data.js, à charger avant ce script).
 */
const CampaignEngine = (() => {

const { MISSIONS, ENDINGS, RESOURCE_KEYS, INITIAL_RESOURCES } = MissionsData;

const MAX_HINTS_PER_PUZZLE = 3;

// ── New Game+ (rejeu après la fin de campagne) ──────────────────────────────
// Chaque cycle de rejeu complet (`restartCampaign`) incrémente `ngPlus` et
// durcit la mission via `getEffectiveMission` : minuteur raccourci, tolérance
// de calibrage resserrée, tentatives maximales réduites, pénalités de temps
// alourdies, coût des indices renchéri, budget d'indices par mission réduit.
const NGPLUS_MAX_CYCLES = 20;
const NGPLUS_TIME_FACTOR = 0.88;       // minuteur : -12 % par cycle (plancher ci-dessous)
const NGPLUS_TIME_FLOOR_RATIO = 0.55;  // le minuteur ne descend jamais sous 55 % de sa valeur de base
const NGPLUS_ATTEMPT_PENALTY_FACTOR = 1.3; // pénalité de temps par erreur : +30 % par cycle
const NGPLUS_HINT_COST_FACTOR = 1.4;   // coût des indices (temps + ressources) : +40 % par cycle
const NGPLUS_TOLERANCE_REDUCTION = 1;  // tolérance de calibrage : -1 par cycle (plancher 1)
const NGPLUS_MAX_ATTEMPTS_REDUCTION = 1; // tentatives max par puzzle : -1 par cycle (plancher 1)
const NGPLUS_HINT_BUDGET_REDUCTION = 1; // indices max par mission : -1 par cycle (plancher 0)

function findMission(missionId) {
  return MISSIONS.find(m => m.id === missionId) || null;
}

function clampResource(v) {
  return Math.max(0, Math.min(100, v));
}

/** Applique un delta de ressources à la campagne (clampé 0-100). Utilisé par
 * les conséquences de choix, les pénalités de tentative et le coût des indices. */
function applyResourceDelta(campaign, resourceDelta) {
  if (!resourceDelta) return;
  RESOURCE_KEYS.forEach(key => {
    if (typeof resourceDelta[key] === 'number') {
      campaign.resources[key] = clampResource(campaign.resources[key] + resourceDelta[key]);
    }
  });
}

/** Crée l'état de campagne initial pour une nouvelle room. */
function createCampaign() {
  return {
    resources: { ...INITIAL_RESOURCES },
    completedMissions: {}, // missionId -> { stars, timeLeft, attempts, hintsUsed, choices }
    flags: {},
    ending: null,
    ngPlus: 0,       // nombre de cycles New Game+ entamés (0 = première partie)
    bestStars: {}    // missionId -> meilleur score (1-3) jamais obtenu, persiste à travers les rejeux et les cycles NG+
  };
}

/**
 * Réinitialise la campagne pour un nouveau cycle (bouton « REJOUER LA
 * CAMPAGNE » du Hub, disponible uniquement lorsque `campaign.ending` est
 * défini, donc après la fin de la mission finale). Incrémente `ngPlus` :
 * `getEffectiveMission` s'en sert ensuite pour durcir chaque mission.
 * `bestStars` est conservé (record historique), tout le reste repart à zéro.
 */
function restartCampaign(campaign) {
  const fresh = createCampaign();
  fresh.ngPlus = Math.min(NGPLUS_MAX_CYCLES, (campaign && Number.isInteger(campaign.ngPlus) ? campaign.ngPlus : 0) + 1);
  fresh.bestStars = { ...(campaign && campaign.bestStars) };
  return fresh;
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
  if (Number.isInteger(input.ngPlus)) {
    campaign.ngPlus = Math.max(0, Math.min(NGPLUS_MAX_CYCLES, input.ngPlus));
  }
  if (input.bestStars && typeof input.bestStars === 'object') {
    MISSIONS.forEach(mission => {
      const stars = input.bestStars[mission.id];
      if (Number.isInteger(stars)) {
        campaign.bestStars[mission.id] = Math.max(1, Math.min(3, stars));
      }
    });
  }
  // Le record d'étoiles doit au moins refléter les missions déjà marquées terminées.
  Object.keys(campaign.completedMissions).forEach(id => {
    const stars = campaign.completedMissions[id].stars;
    campaign.bestStars[id] = Math.max(campaign.bestStars[id] || 0, stars);
  });
  const finale = MISSIONS.find(m => m.isFinale);
  if (finale && campaign.completedMissions[finale.id]) {
    campaign.ending = resolveEnding(campaign);
  }
  return campaign;
}

/**
 * Construit une version « effective » d'une mission pour un cycle NG+ donné :
 * clone profond (les données de mission sont du JSON pur, pas de fonctions)
 * puis durcissement des leviers de difficulté. Ne modifie jamais `MISSIONS`.
 * Seule l'autorité (navigateur Technicien) a besoin de cette version — les
 * données envoyées à l'Opérateur (texte, mapping, schéma…) sont identiques
 * quel que soit le cycle, seuls les nombres qui gouvernent la validation et
 * le budget d'indices/tentatives durcissent.
 */
function getEffectiveMission(mission, ngPlus) {
  const cycle = Math.max(0, Math.min(NGPLUS_MAX_CYCLES, Number.isFinite(ngPlus) ? ngPlus : 0));
  const effective = JSON.parse(JSON.stringify(mission));
  if (cycle === 0) return effective;

  const timeFactor = Math.max(NGPLUS_TIME_FLOOR_RATIO, Math.pow(NGPLUS_TIME_FACTOR, cycle));
  effective.timeLimit = Math.max(90, Math.round(mission.timeLimit * timeFactor));

  if (Number.isFinite(effective.maxHintsPerMission)) {
    effective.maxHintsPerMission = Math.max(0, effective.maxHintsPerMission - NGPLUS_HINT_BUDGET_REDUCTION * cycle);
  }

  effective.puzzles.forEach(p => {
    if (Number.isFinite(p.tolerance)) {
      p.tolerance = Math.max(1, p.tolerance - NGPLUS_TOLERANCE_REDUCTION * cycle);
    }
    if (Number.isFinite(p.maxAttempts)) {
      p.maxAttempts = Math.max(1, p.maxAttempts - NGPLUS_MAX_ATTEMPTS_REDUCTION * cycle);
    }
    if (Number.isFinite(p.attemptTimePenalty)) {
      p.attemptTimePenalty = Math.round(p.attemptTimePenalty * Math.pow(NGPLUS_ATTEMPT_PENALTY_FACTOR, cycle));
    }
    if (p.attemptResourcePenalty) {
      Object.keys(p.attemptResourcePenalty).forEach(key => {
        p.attemptResourcePenalty[key] = Math.round(p.attemptResourcePenalty[key] * Math.pow(NGPLUS_ATTEMPT_PENALTY_FACTOR, cycle));
      });
    }
    if (p.hintCost) {
      if (Number.isFinite(p.hintCost.time)) {
        p.hintCost.time = Math.round(p.hintCost.time * Math.pow(NGPLUS_HINT_COST_FACTOR, cycle));
      }
      if (p.hintCost.resourceDelta) {
        Object.keys(p.hintCost.resourceDelta).forEach(key => {
          p.hintCost.resourceDelta[key] = Math.round(p.hintCost.resourceDelta[key] * Math.pow(NGPLUS_HINT_COST_FACTOR, cycle));
        });
      }
    }
  });

  return effective;
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
      timeLimit: m.timeLimit,
      maxHintsPerMission: Number.isFinite(m.maxHintsPerMission) ? m.maxHintsPerMission : null,
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
    ending: campaign.ending,
    ngPlus: campaign.ngPlus || 0,
    bestStars: { ...campaign.bestStars }
  };
}

// (note : `timeLimit` et `maxHintsPerMission` sont inclus dans chaque entrée
// de `missions` ci-dessus — voir le `.map` plus haut — pour permettre à
// l'UI du Hub d'afficher une durée estimée et un budget d'indices par
// mission, y compris pour les missions verrouillées.)

/**
 * Détermine si une mission peut être (re)lancée.
 *
 * ── Règle de rejeu ──────────────────────────────────────────────────────
 * Une mission déjà marquée terminée dans `campaign.completedMissions` peut
 * toujours être relancée (`isReplay: true`), y compris après la fin de la
 * campagne (`campaign.ending` défini) : cela permet de reconsolider son
 * score sans jamais perdre la progression. Sur un rejeu, `completeMission`
 * NE réapplique PAS la récompense de ressources ni les conséquences du choix
 * narratif (uniquement appliquées à la toute première réussite), et ne
 * recalcule jamais la fin de campagne déjà figée. Le score d'étoiles ne
 * peut que s'améliorer (jamais redescendre) — voir `completeMission`.
 *
 * Une campagne terminée (`campaign.ending` défini) n'empêche plus de
 * terminer une mission annexe pas encore complétée (branches optionnelles
 * non requises par la mission finale) : seul `campaign:replay` (rejeu
 * complet / New Game+, voir `restartCampaign`) remet la campagne à zéro.
 */
function canStartMission(campaign, missionId) {
  const mission = findMission(missionId);
  if (!mission) return { ok: false, reason: 'Mission introuvable' };
  if (campaign.completedMissions[missionId]) return { ok: true, mission, isReplay: true };
  if (!isMissionUnlocked(campaign, mission)) return { ok: false, reason: 'Mission verrouillée' };
  return { ok: true, mission, isReplay: false };
}

/** Crée l'état d'exécution (runtime) d'une mission qui démarre.
 * `mission` doit être la version effective (voir `getEffectiveMission`) :
 * c'est elle qui porte le `timeLimit` réellement applicable (NG+ inclus). */
function startMissionRuntime(mission, isReplay) {
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
    totalTimePenalty: 0,
    choiceLog: {},
    isReplay: !!isReplay,
    // Compteur monotone (pas une estampille temporelle) utilisé par
    // l'autorité (rtdb-client.js) pour ordonner `lastEvent` de façon fiable :
    // deux événements d'autorité rapprochés peuvent partager le même
    // Date.now() à la milliseconde près, ce qu'un compteur entier ne peut
    // jamais faire.
    eventSeq: 0
  };
}

function getPuzzleForRole(mission, puzzleIndex, role) {
  const puzzle = mission.puzzles[puzzleIndex];
  if (!puzzle) return null;
  // Expose les leviers de difficulté (durcis par NG+ sur la version
  // "effective" de la mission, voir getEffectiveMission) : l'UI en a besoin
  // pour afficher tentatives restantes, coût d'indice avant confirmation,
  // etc. — valeurs identiques pour les deux rôles (seul le contenu `data`
  // diffère entre Technicien et Opérateur).
  return {
    id: puzzle.id,
    name: puzzle.name,
    module: puzzle.module,
    type: puzzle.type,
    data: role === 'technician' ? puzzle.technicianData : puzzle.operatorData,
    maxAttempts: Number.isFinite(puzzle.maxAttempts) ? puzzle.maxAttempts : null,
    attemptTimePenalty: Number.isFinite(puzzle.attemptTimePenalty) ? puzzle.attemptTimePenalty : 0,
    attemptResourcePenalty: puzzle.attemptResourcePenalty || null,
    hintCost: puzzle.hintCost || null,
    hintsTotal: Array.isArray(puzzle.hints) ? Math.min(puzzle.hints.length, MAX_HINTS_PER_PUZZLE) : 0
  };
}

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

function pairSetsEqual(a, b) {
  return setsOfPairsEqual(a, b, 'wire', 'port');
}

/** Compare deux ensembles de paires {k1, k2} indépendamment de l'ordre
 * (utilisé par wire_panel et logic_grid). */
function setsOfPairsEqual(a, b, k1, k2) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const norm = arr => arr.map(p => `${p && p[k1]}:${p && p[k2]}`).sort();
  const na = norm(a);
  const nb = norm(b);
  return na.every((v, i) => v === nb[i]);
}

function switchesEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => !!v === !!b[i]);
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
    case 'logic_grid': {
      // Déduction logique : le Technicien reçoit des indices (pas la réponse
      // directe) et doit lui-même déduire quelle ligne va avec quelle colonne
      // avant de dicter l'affectation à l'Opérateur.
      if (!action || !Array.isArray(action.assignments)) return { valid: false, message: 'Action invalide' };
      const match = setsOfPairsEqual(action.assignments, puzzle.solution, 'row', 'col');
      return { valid: match, message: match ? 'GRILLE DE DÉDUCTION VALIDÉE' : 'AFFECTATION INCORRECTE' };
    }
    case 'valve_routing': {
      // Réseau de vannes/conduits : l'Opérateur ne peut avancer que de nœud
      // en nœud adjacent ; le chemin complet doit correspondre exactement
      // au circuit dicté par le Technicien.
      if (!action || !Array.isArray(action.path)) return { valid: false, message: 'Action invalide' };
      const edges = Array.isArray(puzzle.edges) ? puzzle.edges : null;
      if (edges) {
        for (let i = 0; i < action.path.length - 1; i++) {
          const a = action.path[i], b = action.path[i + 1];
          const linked = edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
          if (!linked) return { valid: false, message: 'CONDUIT NON RELIÉ — BLOCAGE DÉTECTÉ' };
        }
      }
      const match = arraysEqual(action.path, puzzle.solution);
      return { valid: match, message: match ? 'CIRCUIT OUVERT' : 'ITINÉRAIRE INCORRECT' };
    }
    case 'parity_checksum': {
      // Vérification de parité : le Technicien calcule mentalement (poids +
      // cible fournis) quels commutateurs doivent être actifs ; l'Opérateur,
      // lui, ne voit ni poids ni cible, seulement des commutateurs nus.
      if (!action || !Array.isArray(action.switches)) return { valid: false, message: 'Action invalide' };
      const match = switchesEqual(action.switches, puzzle.solution);
      return { valid: match, message: match ? 'PARITÉ CORRECTE — CHECKSUM VALIDÉ' : 'CHECKSUM INVALIDE' };
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

/** Retourne le prochain indice disponible pour le puzzle courant, ou null.
 * `totalHintsUsedInMission` permet de faire respecter le budget d'indices
 * de la mission (`mission.maxHintsPerMission`), en plus du plafond par
 * puzzle (`MAX_HINTS_PER_PUZZLE`). Le champ `cost` (peut être null) indique
 * le prix à payer — temps de mission et/ou ressources — pour le révéler ;
 * c'est à l'appelant (autorité Technicien) de l'appliquer et de le
 * répercuter aux deux joueurs. */
function getHint(mission, puzzleIndex, hintsUsedSoFar, totalHintsUsedInMission) {
  const puzzle = mission.puzzles[puzzleIndex];
  if (!puzzle || !Array.isArray(puzzle.hints) || puzzle.hints.length === 0) {
    return { text: null, hintsRemaining: 0, cost: null };
  }
  const missionBudget = Number.isFinite(mission.maxHintsPerMission) ? mission.maxHintsPerMission : Infinity;
  const usedInMission = Number.isFinite(totalHintsUsedInMission) ? totalHintsUsedInMission : 0;
  if (hintsUsedSoFar >= puzzle.hints.length || hintsUsedSoFar >= MAX_HINTS_PER_PUZZLE || usedInMission >= missionBudget) {
    return { text: null, hintsRemaining: 0, cost: null };
  }
  const text = puzzle.hints[hintsUsedSoFar];
  const hintsRemaining = Math.max(0, Math.min(puzzle.hints.length, MAX_HINTS_PER_PUZZLE) - (hintsUsedSoFar + 1));
  const cost = puzzle.hintCost ? { ...puzzle.hintCost } : null;
  return { text, hintsRemaining, cost };
}

/** Applique les conséquences d'un choix aux ressources / flags de campagne.
 * Supporte `flag` (un seul drapeau, rétrocompatible) et `flags` (tableau). */
function applyConsequence(campaign, consequence) {
  if (!consequence) return;
  applyResourceDelta(campaign, consequence.resourceDelta);
  if (consequence.flag) {
    campaign.flags[consequence.flag] = true;
  }
  if (Array.isArray(consequence.flags)) {
    consequence.flags.forEach(flag => { campaign.flags[flag] = true; });
  }
}

/**
 * Calcule le nombre d'étoiles (1-3) obtenues pour une mission réussie.
 * Barème volontairement strict : les 3 étoiles exigent un run quasi
 * parfait (aucun indice, au plus une tentative par puzzle en moyenne, et
 * une marge de temps restante confortable) ; sinon 2 étoiles pour un bon
 * run ; sinon 1 étoile (la mission reste réussie, juste chahutée).
 */
function computeStars(mission, runtime) {
  const totalPuzzles = Math.max(1, mission.puzzles.length);
  const timeMargin = mission.timeLimit > 0 ? runtime.timeLeft / mission.timeLimit : 0;
  const flawless = runtime.totalHints === 0 && runtime.totalAttempts <= totalPuzzles && timeMargin >= 0.3;
  if (flawless) return 3;
  const solid = runtime.totalHints <= 1 && runtime.totalAttempts <= totalPuzzles * 1.5 && timeMargin >= 0.1;
  if (solid) return 2;
  return 1;
}

/** Détermine la fin de campagne parmi ENDINGS selon l'état courant. */
function resolveEnding(campaign) {
  const ctx = { resources: campaign.resources, flags: campaign.flags };
  const ending = ENDINGS.find(e => e.condition(ctx)) || ENDINGS[ENDINGS.length - 1];
  return { id: ending.id, title: ending.title, text: ending.text };
}

/**
 * Finalise une mission (succès ou échec), met à jour la campagne, calcule
 * les étoiles/récompenses et, si c'est la mission finale réussie (pour la
 * toute première fois), l'ending.
 *
 * Règle de rejeu : quand `runtime.isReplay` est vrai (mission déjà présente
 * dans `campaign.completedMissions`), on NE réapplique PAS
 * `mission.resourceReward`, on NE réapplique PAS les conséquences du choix
 * narratif (déjà appliquées lors de la première réussite — voir l'autorité
 * Technicien qui saute `applyConsequence` pendant un rejeu), et on NE
 * recalcule PAS `campaign.ending` même pour la mission finale (la fin est
 * figée à la première issue). Le score d'étoiles ne peut que s'améliorer :
 * `completedMissions[id].stars = max(ancien, nouveau)`. `bestStars` (record
 * historique, survit aux rejeux de campagne complets / NG+) suit la même
 * règle de max.
 */
function completeMission(campaign, mission, runtime, win) {
  let result = null;
  const isReplay = !!runtime.isReplay;
  if (win) {
    const stars = computeStars(mission, runtime);
    const previous = campaign.completedMissions[mission.id];
    const bestStarsForMission = Math.max(stars, previous ? previous.stars : 0, campaign.bestStars[mission.id] || 0);
    result = {
      stars: bestStarsForMission,
      timeLeft: runtime.timeLeft,
      attempts: runtime.totalAttempts,
      hintsUsed: runtime.totalHints,
      choices: runtime.choiceLog,
      isReplay
    };
    campaign.completedMissions[mission.id] = { stars: bestStarsForMission };
    campaign.bestStars[mission.id] = bestStarsForMission;

    if (!isReplay) {
      RESOURCE_KEYS.forEach(key => {
        const delta = mission.resourceReward[key] || 0;
        campaign.resources[key] = clampResource(campaign.resources[key] + delta);
      });
      if (mission.isFinale && !campaign.ending) {
        campaign.ending = resolveEnding(campaign);
      }
    }
  }

  const newlyUnlocked = MISSIONS
    .filter(m => !campaign.completedMissions[m.id] && isMissionUnlocked(campaign, m))
    .map(m => m.id);

  return { result, newlyUnlocked, ending: campaign.ending, isReplay };
}

  return {
    MISSIONS,
    findMission,
    createCampaign,
    restartCampaign,
    sanitizeCampaign,
    isMissionUnlocked,
    missionStatus,
    getHubPayload,
    getEffectiveMission,
    canStartMission,
    startMissionRuntime,
    getPuzzleForRole,
    validateAction,
    getHint,
    applyConsequence,
    applyResourceDelta,
    computeStars,
    resolveEnding,
    completeMission,
    MAX_HINTS_PER_PUZZLE,
    NGPLUS_MAX_CYCLES
  };
})();
