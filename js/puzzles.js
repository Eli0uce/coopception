// ── Banque de puzzles ─────────────────────────────────────────────────────────

const PUZZLE_BANK = {};

// FACILE
PUZZLE_BANK.cross_code = { difficulty:'easy', variants:[
  { technicianData:{ title:"TABLE DE CORRESPONDANCE",subtitle:"Communiquez les codes à l'Opérateur",mapping:{"ALPHA":"7","BETA":"2","GAMMA":"9","DELTA":"4","SIGMA":"1"},sequence:["GAMMA","ALPHA","DELTA","BETA"] }, operatorData:{title:"PANNEAU D'ENTRÉE",subtitle:"Entrez la séquence dans l'ordre",buttons:["1","2","3","4","5","6","7","8","9","0"]}, solution:["9","7","4","2"] },
  { technicianData:{ title:"TABLE DE CORRESPONDANCE",subtitle:"Communiquez les codes à l'Opérateur",mapping:{"OMEGA":"3","THETA":"8","KAPPA":"5","LAMBDA":"6","PHI":"0"},sequence:["THETA","PHI","OMEGA","KAPPA"] }, operatorData:{title:"PANNEAU D'ENTRÉE",subtitle:"Entrez la séquence dans l'ordre",buttons:["0","1","2","3","4","5","6","7","8","9"]}, solution:["8","0","3","5"] },
  { technicianData:{ title:"TABLE DE CORRESPONDANCE",subtitle:"Communiquez les codes à l'Opérateur",mapping:{"NORD":"4","SUD":"7","EST":"1","OUEST":"9","ZENIT":"6"},sequence:["SUD","ZENIT","EST","NORD"] }, operatorData:{title:"PANNEAU D'ENTRÉE",subtitle:"Entrez la séquence dans l'ordre",buttons:["1","2","3","4","5","6","7","8","9","0"]}, solution:["7","6","1","4"] }
]};

PUZZLE_BANK.symbol_code = { difficulty:'easy', variants:[
  { technicianData:{ title:"TABLE DES SYMBOLES",subtitle:"Communiquez les valeurs correspondantes",mapping:{"★":"7","◆":"3","⬡":"9","✦":"5","⊕":"1"},sequence:["⬡","★","✦","◆"] }, operatorData:{title:"PANNEAU D'ENTRÉE",subtitle:"Entrez la séquence transmise",buttons:["1","2","3","4","5","6","7","8","9","0"]}, solution:["9","7","5","3"] },
  { technicianData:{ title:"TABLE DES SYMBOLES",subtitle:"Communiquez les valeurs correspondantes",mapping:{"♦":"2","♠":"8","♥":"4","♣":"6","⬟":"0"},sequence:["♠","♣","♦","♥"] }, operatorData:{title:"PANNEAU D'ENTRÉE",subtitle:"Entrez la séquence transmise",buttons:["0","1","2","3","4","5","6","7","8","9"]}, solution:["8","6","2","4"] },
  { technicianData:{ title:"TABLE DES SYMBOLES",subtitle:"Communiquez les valeurs correspondantes",mapping:{"α":"3","β":"7","γ":"1","δ":"9","ε":"5"},sequence:["β","δ","α","γ"] }, operatorData:{title:"PANNEAU D'ENTRÉE",subtitle:"Entrez la séquence transmise",buttons:["1","2","3","4","5","6","7","8","9","0"]}, solution:["7","9","3","1"] }
]};

// MOYEN
PUZZLE_BANK.mirror_sequence = { difficulty:'medium', variants:[
  { technicianData:{ title:"SÉQUENCE CIBLE",subtitle:"Guidez l'Opérateur dans l'ordre exact",sequence:["rouge","bleu","vert","rouge","jaune"] }, operatorData:{ title:"PANNEAU DE COMMANDE",subtitle:"Activez les commutateurs selon les instructions",buttons:[{label:"VENT-A",color:"vert"},{label:"SYS-R",color:"rouge"},{label:"FLUX-J",color:"jaune"},{label:"CIRC-B",color:"bleu"},{label:"PMP-V",color:"vert"},{label:"ARC-R",color:"rouge"}] }, solution:["SYS-R","CIRC-B","VENT-A","ARC-R","FLUX-J"] },
  { technicianData:{ title:"SÉQUENCE CIBLE",subtitle:"Guidez l'Opérateur dans l'ordre exact",sequence:["jaune","vert","bleu","jaune"] }, operatorData:{ title:"PANNEAU DE COMMANDE",subtitle:"Activez les commutateurs selon les instructions",buttons:[{label:"CMD-J",color:"jaune"},{label:"SRV-V",color:"vert"},{label:"NET-B",color:"bleu"},{label:"AUX-R",color:"rouge"},{label:"FLW-J",color:"jaune"},{label:"GRD-V",color:"vert"}] }, solution:["CMD-J","SRV-V","NET-B","FLW-J"] },
  { technicianData:{ title:"SÉQUENCE CIBLE",subtitle:"Guidez l'Opérateur dans l'ordre exact",sequence:["bleu","rouge","bleu","vert","rouge"] }, operatorData:{ title:"PANNEAU DE COMMANDE",subtitle:"Activez les commutateurs selon les instructions",buttons:[{label:"PWR-R",color:"rouge"},{label:"MNT-B",color:"bleu"},{label:"ENV-V",color:"vert"},{label:"HYD-B",color:"bleu"},{label:"ALR-R",color:"rouge"},{label:"ATM-V",color:"vert"}] }, solution:["MNT-B","PWR-R","HYD-B","ENV-V","ALR-R"] }
]};

// v1: SONIC→S·O·N·I·C→S·C·I·N·Z=SCINZ ✓  v2: Atbash SPACE→HKZXV ✓  v3: César+3 LUNAR→OXQDU ✓
PUZZLE_BANK.cipher = { difficulty:'medium', variants:[
  { technicianData:{ title:"CLÉ DE CHIFFREMENT",subtitle:"Dictez CHIFFRÉ → ORIGINAL à l'Opérateur",key:{"A":"M","B":"X","C":"Z","D":"P","E":"K","F":"T","G":"R","H":"W","I":"N","J":"Q","K":"F","L":"Y","M":"A","N":"I","O":"C","P":"D","Q":"J","R":"G","S":"S","T":"F","U":"U","V":"V","W":"H","X":"B","Y":"L","Z":"E"} }, operatorData:{title:"MESSAGE CHIFFRÉ",subtitle:"Déchiffrez et entrez le mot original",cipherText:"SCINZ",inputLength:5}, solution:"SONIC" },
  { technicianData:{ title:"CLÉ DE CHIFFREMENT",subtitle:"Dictez CHIFFRÉ → ORIGINAL à l'Opérateur",key:{"A":"Z","B":"Y","C":"X","D":"W","E":"V","F":"U","G":"T","H":"S","I":"R","J":"Q","K":"P","L":"O","M":"N","N":"M","O":"L","P":"K","Q":"J","R":"I","S":"H","T":"G","U":"F","V":"E","W":"D","X":"C","Y":"B","Z":"A"} }, operatorData:{title:"MESSAGE CHIFFRÉ",subtitle:"Déchiffrez et entrez le mot original",cipherText:"HKZXV",inputLength:5}, solution:"SPACE" },
  { technicianData:{ title:"CLÉ DE CHIFFREMENT",subtitle:"Dictez CHIFFRÉ → ORIGINAL à l'Opérateur",key:{"A":"D","B":"E","C":"F","D":"G","E":"H","F":"I","G":"J","H":"K","I":"L","J":"M","K":"N","L":"O","M":"P","N":"Q","O":"R","P":"S","Q":"T","R":"U","S":"V","T":"W","U":"X","V":"Y","W":"Z","X":"A","Y":"B","Z":"C"} }, operatorData:{title:"MESSAGE CHIFFRÉ",subtitle:"Déchiffrez et entrez le mot original",cipherText:"OXQDU",inputLength:5}, solution:"LUNAR" }
]};

PUZZLE_BANK.calibration = { difficulty:'medium', variants:[
  { technicianData:{ title:"VALEURS DE CALIBRAGE",subtitle:"Guidez l'Opérateur pour atteindre ces valeurs",targets:[{name:"PRESSION",value:67,unit:"%"},{name:"TEMPÉRATURE",value:34,unit:"°C"},{name:"DÉBIT",value:82,unit:"L/s"}] }, operatorData:{ title:"PANNEAU DE CALIBRAGE",subtitle:"Ajustez les curseurs selon les instructions",sliders:[{id:"s1",label:"CURSEUR ALPHA",min:0,max:100},{id:"s2",label:"CURSEUR BETA",min:0,max:100},{id:"s3",label:"CURSEUR GAMMA",min:0,max:100}] }, solution:[67,34,82], tolerance:3 },
  { technicianData:{ title:"VALEURS DE CALIBRAGE",subtitle:"Guidez l'Opérateur pour atteindre ces valeurs",targets:[{name:"TENSION",value:45,unit:"V"},{name:"FRÉQUENCE",value:72,unit:"Hz"},{name:"AMPLITUDE",value:28,unit:"dB"}] }, operatorData:{ title:"PANNEAU DE CALIBRAGE",subtitle:"Ajustez les curseurs selon les instructions",sliders:[{id:"s1",label:"CURSEUR X",min:0,max:100},{id:"s2",label:"CURSEUR Y",min:0,max:100},{id:"s3",label:"CURSEUR Z",min:0,max:100}] }, solution:[45,72,28], tolerance:3 },
  { technicianData:{ title:"VALEURS DE CALIBRAGE",subtitle:"Guidez l'Opérateur pour atteindre ces valeurs",targets:[{name:"OXYGÈNE",value:91,unit:"%"},{name:"CO2",value:18,unit:"ppm"},{name:"HUMIDITÉ",value:55,unit:"%"}] }, operatorData:{ title:"PANNEAU DE CALIBRAGE",subtitle:"Ajustez les curseurs selon les instructions",sliders:[{id:"s1",label:"VALVE-1",min:0,max:100},{id:"s2",label:"VALVE-2",min:0,max:100},{id:"s3",label:"VALVE-3",min:0,max:100}] }, solution:[91,18,55], tolerance:3 }
]};

// DIFFICILE
PUZZLE_BANK.wire_panel = { difficulty:'hard', variants:[
  { technicianData:{ title:"SCHÉMA DE CÂBLAGE",subtitle:"Dictez les connexions à effectuer",connections:[{wire:"FIL-ROUGE",port:"PORT-3"},{wire:"FIL-BLEU",port:"PORT-1"},{wire:"FIL-VERT",port:"PORT-4"},{wire:"FIL-JAUNE",port:"PORT-2"}] }, operatorData:{ title:"PANNEAU DE CÂBLAGE",subtitle:"Connectez chaque fil au bon port",wires:["FIL-ROUGE","FIL-BLEU","FIL-VERT","FIL-JAUNE"],ports:["PORT-1","PORT-2","PORT-3","PORT-4"] }, solution:{"FIL-ROUGE":"PORT-3","FIL-BLEU":"PORT-1","FIL-VERT":"PORT-4","FIL-JAUNE":"PORT-2"} },
  { technicianData:{ title:"SCHÉMA DE CÂBLAGE",subtitle:"Dictez les connexions à effectuer",connections:[{wire:"CÂBLE-A",port:"BORNE-2"},{wire:"CÂBLE-B",port:"BORNE-4"},{wire:"CÂBLE-C",port:"BORNE-1"},{wire:"CÂBLE-D",port:"BORNE-3"}] }, operatorData:{ title:"PANNEAU DE CÂBLAGE",subtitle:"Connectez chaque fil au bon port",wires:["CÂBLE-A","CÂBLE-B","CÂBLE-C","CÂBLE-D"],ports:["BORNE-1","BORNE-2","BORNE-3","BORNE-4"] }, solution:{"CÂBLE-A":"BORNE-2","CÂBLE-B":"BORNE-4","CÂBLE-C":"BORNE-1","CÂBLE-D":"BORNE-3"} },
  { technicianData:{ title:"SCHÉMA DE CÂBLAGE",subtitle:"Dictez les connexions à effectuer",connections:[{wire:"CONDUIT-X",port:"NODE-4"},{wire:"CONDUIT-Y",port:"NODE-2"},{wire:"CONDUIT-Z",port:"NODE-1"},{wire:"CONDUIT-W",port:"NODE-3"}] }, operatorData:{ title:"PANNEAU DE CÂBLAGE",subtitle:"Connectez chaque fil au bon port",wires:["CONDUIT-X","CONDUIT-Y","CONDUIT-Z","CONDUIT-W"],ports:["NODE-1","NODE-2","NODE-3","NODE-4"] }, solution:{"CONDUIT-X":"NODE-4","CONDUIT-Y":"NODE-2","CONDUIT-Z":"NODE-1","CONDUIT-W":"NODE-3"} }
]};

PUZZLE_BANK.final_protocol = { difficulty:'hard', variants:[
  { technicianData:{ title:"PROTOCOLE D'URGENCE",subtitle:"Lisez les instructions dans l'ordre",steps:[{order:1,instruction:"Confirmez l'interrupteur ROUGE"},{order:2,instruction:"Entrez le code : 7-7-3"},{order:3,instruction:"Activez LEVIER-3 puis LEVIER-1"},{order:4,instruction:"Appuyez sur VALIDATION"}] }, operatorData:{ title:"PANNEAU FINAL",subtitle:"Exécutez les commandes dictées",controls:[{type:"switch",id:"sw_red",label:"ROUGE",color:"red"},{type:"switch",id:"sw_blue",label:"BLEU",color:"blue"},{type:"numpad",id:"numpad",label:"CODE"},{type:"lever",id:"lev1",label:"LEVIER-1"},{type:"lever",id:"lev2",label:"LEVIER-2"},{type:"lever",id:"lev3",label:"LEVIER-3"},{type:"button",id:"btn_validate",label:"VALIDATION",color:"green"}] }, solution:{switch:"sw_red",code:"773",levers:["lev3","lev1"],validate:true} },
  { technicianData:{ title:"PROTOCOLE D'URGENCE",subtitle:"Lisez les instructions dans l'ordre",steps:[{order:1,instruction:"Activez l'interrupteur BLEU"},{order:2,instruction:"Entrez le code : 4-1-9"},{order:3,instruction:"Activez LEVIER-2 puis LEVIER-3"},{order:4,instruction:"Appuyez sur VALIDATION"}] }, operatorData:{ title:"PANNEAU FINAL",subtitle:"Exécutez les commandes dictées",controls:[{type:"switch",id:"sw_red",label:"ROUGE",color:"red"},{type:"switch",id:"sw_blue",label:"BLEU",color:"blue"},{type:"numpad",id:"numpad",label:"CODE"},{type:"lever",id:"lev1",label:"LEVIER-1"},{type:"lever",id:"lev2",label:"LEVIER-2"},{type:"lever",id:"lev3",label:"LEVIER-3"},{type:"button",id:"btn_validate",label:"VALIDATION",color:"green"}] }, solution:{switch:"sw_blue",code:"419",levers:["lev2","lev3"],validate:true} }
]};

// ── Timer automatique selon difficulté ────────────────────────────────────────
const TIME_PER_DIFFICULTY = { easy: 90, medium: 160, hard: 220 };
const TIME_BUFFER = 90;
function computeTimeLimit(puzzles) {
  return puzzles.reduce((sum, p) => sum + (TIME_PER_DIFFICULTY[p.difficulty] || 160), 0) + TIME_BUFFER;
}

// ── Sélection aléatoire N puzzles (3-5), un seul par type ─────────────────────
const MODULES = ['MODULE RÉACTEUR','MODULE ATMOSPHÈRE','MODULE COMMUNICATIONS','MODULE PROPULSION','MODULE CENTRAL'];

function buildRandomPuzzles() {
  const pool = [];
  for (const [type, entry] of Object.entries(PUZZLE_BANK)) {
    for (const v of entry.variants) {
      pool.push({ type, difficulty: entry.difficulty, v });
    }
  }
  pool.sort(() => Math.random() - 0.5);

  const N = 3 + Math.floor(Math.random() * 3);
  const selected = [];
  const usedTypes = new Set();
  for (const item of pool) {
    if (selected.length >= N) break;
    if (!usedTypes.has(item.type)) { selected.push(item); usedTypes.add(item.type); }
  }

  const order = { easy: 0, medium: 1, hard: 2 };
  selected.sort((a, b) => {
    if (a.type === 'final_protocol') return 1;
    if (b.type === 'final_protocol') return -1;
    return order[a.difficulty] - order[b.difficulty];
  });

  return selected.map((item, i) => ({
    id: i + 1, module: MODULES[i] || ('MODULE ' + (i+1)),
    type: item.type, difficulty: item.difficulty,
    technicianData: item.v.technicianData, operatorData: item.v.operatorData,
    solution: item.v.solution, tolerance: item.v.tolerance || null
  }));
}

let PUZZLES = [];
function initPuzzles(seedJson) {
  PUZZLES = seedJson ? JSON.parse(seedJson) : buildRandomPuzzles();
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateAction(puzzleIndex, action) {
  const puzzle = PUZZLES[puzzleIndex];
  if (!puzzle) return { valid: false, message: 'Puzzle introuvable' };
  switch (puzzle.type) {
    case 'cross_code':
    case 'symbol_code':
    case 'mirror_sequence': {
      const ok = action.sequence && action.sequence.length === puzzle.solution.length
        && action.sequence.every((v, i) => v === puzzle.solution[i]);
      return { valid: !!ok, message: ok ? 'SÉQUENCE VALIDÉE ✓' : 'SÉQUENCE INCORRECTE ✗' };
    }
    case 'cipher': {
      const ok = action.word && action.word.toUpperCase() === puzzle.solution;
      return { valid: !!ok, message: ok ? 'MOT CORRECT ✓' : 'MOT INCORRECT ✗' };
    }
    case 'calibration': {
      const tol = puzzle.tolerance || 3;
      const ok = action.values && action.values.every((v, i) => Math.abs(v - puzzle.solution[i]) <= tol);
      return { valid: !!ok, message: ok ? 'CALIBRAGE OK ✓' : 'CALIBRAGE HORS TOLÉRANCE ✗' };
    }
    case 'wire_panel': {
      const sol = puzzle.solution;
      const ok = action.connections && Object.keys(sol).every(w => action.connections[w] === sol[w]);
      return { valid: !!ok, message: ok ? 'CÂBLAGE CORRECT ✓' : 'CÂBLAGE INCORRECT ✗' };
    }
    case 'final_protocol': {
      const s = action.finalState, sol = puzzle.solution;
      if (!s) return { valid: false, message: 'PROTOCOLE INCOMPLET ✗' };
      const ok = s.switch === sol.switch && s.code === sol.code
        && sol.levers.every(l => s.levers && s.levers.includes(l)) && s.validate === true;
      return { valid: !!ok, message: ok ? 'PROTOCOLE VALIDÉ ✓' : 'PROTOCOLE INCOMPLET ✗' };
    }
    default: return { valid: false, message: 'Type inconnu' };
  }
}
