const puzzles = require('./puzzles.json');

function createGameState(roomId) {
  return {
    roomId,
    currentPuzzle: 0,
    totalPuzzles: puzzles.length,
    puzzleStates: puzzles.map(p => ({ id: p.id, solved: false, attempts: 0, progress: {} })),
    timeLeft: 900, // 15 minutes
    started: false,
    finished: false,
    win: false
  };
}

function getPuzzleForRole(puzzleIndex, role) {
  const puzzle = puzzles[puzzleIndex];
  if (!puzzle) return null;
  return {
    id: puzzle.id,
    name: puzzle.name,
    module: puzzle.module,
    type: puzzle.type,
    data: role === 'technician' ? puzzle.technicianData : puzzle.operatorData
  };
}

function validateAction(gameState, puzzleIndex, action) {
  const puzzle = puzzles[puzzleIndex];
  if (!puzzle) return { valid: false, message: 'Puzzle introuvable' };

  switch (puzzle.type) {
    case 'cross_code': {
      if (!action.sequence) return { valid: false };
      const sol = puzzle.solution;
      const match = action.sequence.length === sol.length &&
        action.sequence.every((v, i) => v === sol[i]);
      return { valid: match, message: match ? 'SÉQUENCE VALIDÉE' : 'SÉQUENCE INCORRECTE' };
    }
    case 'mirror_sequence': {
      if (!action.sequence) return { valid: false };
      const sol = puzzle.solution;
      const match = action.sequence.length === sol.length &&
        action.sequence.every((v, i) => v === sol[i]);
      return { valid: match, message: match ? 'SÉQUENCE VALIDÉE' : 'SÉQUENCE INCORRECTE' };
    }
    case 'cipher': {
      if (!action.word) return { valid: false };
      const match = action.word.toUpperCase() === puzzle.solution;
      return { valid: match, message: match ? 'MOT CORRECT' : 'MOT INCORRECT' };
    }
    case 'calibration': {
      if (!action.values) return { valid: false };
      const sol = puzzle.solution;
      const tol = puzzle.tolerance;
      const match = action.values.every((v, i) => Math.abs(v - sol[i]) <= tol);
      return { valid: match, message: match ? 'CALIBRAGE OK' : 'CALIBRAGE HORS TOLÉRANCE' };
    }
    case 'final_protocol': {
      if (!action.finalState) return { valid: false };
      const s = action.finalState;
      const sol = puzzle.solution;
      const switchOk = s.switch === sol.switch;
      const codeOk = s.code === sol.code;
      const leversOk = sol.levers.every(l => s.levers && s.levers.includes(l));
      const validateOk = s.validate === true;
      const match = switchOk && codeOk && leversOk && validateOk;
      return { valid: match, message: match ? 'PROTOCOLE VALIDÉ' : 'PROTOCOLE INCOMPLET' };
    }
    default:
      return { valid: false, message: 'Type de puzzle inconnu' };
  }
}

module.exports = { createGameState, getPuzzleForRole, validateAction };

