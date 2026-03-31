// Données et validation des puzzles (côté client)
const PUZZLE_BANK = {

  cross_code: [
    { technicianData:{ title:"TABLE DE CORRESPONDANCE",subtitle:"Communiquez les codes à l'Opérateur",mapping:{"ALPHA":"7","BETA":"2","GAMMA":"9","DELTA":"4","SIGMA":"1"},sequence:["GAMMA","ALPHA","DELTA","BETA"] }, operatorData:{title:"PANNEAU D'ENTRÉE",subtitle:"Entrez la séquence dans l'ordre",buttons:["1","2","3","4","5","6","7","8","9","0"]}, solution:["9","7","4","2"] },
    { technicianData:{ title:"TABLE DE CORRESPONDANCE",subtitle:"Communiquez les codes à l'Opérateur",mapping:{"OMEGA":"3","THETA":"8","KAPPA":"5","LAMBDA":"6","PHI":"0"},sequence:["THETA","PHI","OMEGA","KAPPA"] }, operatorData:{title:"PANNEAU D'ENTRÉE",subtitle:"Entrez la séquence dans l'ordre",buttons:["0","1","2","3","4","5","6","7","8","9"]}, solution:["8","0","3","5"] },
    { technicianData:{ title:"TABLE DE CORRESPONDANCE",subtitle:"Communiquez les codes à l'Opérateur",mapping:{"NORD":"4","SUD":"7","EST":"1","OUEST":"9","ZENIT":"6"},sequence:["SUD","ZENIT","EST","NORD"] }, operatorData:{title:"PANNEAU D'ENTRÉE",subtitle:"Entrez la séquence dans l'ordre",buttons:["1","2","3","4","5","6","7","8","9","0"]}, solution:["7","6","1","4"] }
  ],

  mirror_sequence: [
    { technicianData:{ title:"SÉQUENCE CIBLE",subtitle:"Guidez l'Opérateur dans l'ordre exact",sequence:["rouge","bleu","vert","rouge","jaune"] }, operatorData:{ title:"PANNEAU DE COMMANDE",subtitle:"Activez les commutateurs selon les instructions",buttons:[{label:"VENT-A",color:"vert"},{label:"SYS-R",color:"rouge"},{label:"FLUX-J",color:"jaune"},{label:"CIRC-B",color:"bleu"},{label:"PMP-V",color:"vert"},{label:"ARC-R",color:"rouge"}] }, solution:["SYS-R","CIRC-B","VENT-A","ARC-R","FLUX-J"] },
    { technicianData:{ title:"SÉQUENCE CIBLE",subtitle:"Guidez l'Opérateur dans l'ordre exact",sequence:["jaune","vert","bleu","jaune"] }, operatorData:{ title:"PANNEAU DE COMMANDE",subtitle:"Activez les commutateurs selon les instructions",buttons:[{label:"CMD-J",color:"jaune"},{label:"SRV-V",color:"vert"},{label:"NET-B",color:"bleu"},{label:"AUX-R",color:"rouge"},{label:"FLW-J",color:"jaune"},{label:"GRD-V",color:"vert"}] }, solution:["CMD-J","SRV-V","NET-B","FLW-J"] },
    { technicianData:{ title:"SÉQUENCE CIBLE",subtitle:"Guidez l'Opérateur dans l'ordre exact",sequence:["bleu","rouge","bleu","vert","rouge"] }, operatorData:{ title:"PANNEAU DE COMMANDE",subtitle:"Activez les commutateurs selon les instructions",buttons:[{label:"PWR-R",color:"rouge"},{label:"MNT-B",color:"bleu"},{label:"ENV-V",color:"vert"},{label:"HYD-B",color:"bleu"},{label:"ALR-R",color:"rouge"},{label:"ATM-V",color:"vert"}] }, solution:["MNT-B","PWR-R","HYD-B","ENV-V","ALR-R"] }
  ],

  cipher: [
    { technicianData:{ title:"CLÉ DE CHIFFREMENT",subtitle:"Dictez la correspondance à l'Opérateur",key:{"A":"M","B":"X","C":"Z","D":"P","E":"K","F":"T","G":"R","H":"W","I":"N","J":"Q","K":"F","L":"Y","M":"A","N":"I","O":"C","P":"D","Q":"J","R":"G","S":"S","T":"F","U":"U","V":"V","W":"H","X":"B","Y":"L","Z":"E"} }, operatorData:{title:"MESSAGE CHIFFRÉ",subtitle:"Déchiffrez et entrez le mot original",cipherText:"SCNKM",inputLength:5}, solution:"SONIC" },
    { technicianData:{ title:"CLÉ DE CHIFFREMENT",subtitle:"Dictez la correspondance à l'Opérateur",key:{"A":"Z","B":"Y","C":"X","D":"W","E":"V","F":"U","G":"T","H":"S","I":"R","J":"Q","K":"P","L":"O","M":"N","N":"M","O":"L","P":"K","Q":"J","R":"I","S":"H","T":"G","U":"F","V":"E","W":"D","X":"C","Y":"B","Z":"A"} }, operatorData:{title:"MESSAGE CHIFFRÉ",subtitle:"Déchiffrez et entrez le mot original",cipherText:"HKZXV",inputLength:5}, solution:"SPACE" },
    { technicianData:{ title:"CLÉ DE CHIFFREMENT",subtitle:"Dictez la correspondance à l'Opérateur",key:{"A":"D","B":"E","C":"F","D":"G","E":"H","F":"I","G":"J","H":"K","I":"L","J":"M","K":"N","L":"O","M":"P","N":"Q","O":"R","P":"S","Q":"T","R":"U","S":"V","T":"W","U":"X","V":"Y","W":"Z","X":"A","Y":"B","Z":"C"} }, operatorData:{title:"MESSAGE CHIFFRÉ",subtitle:"Déchiffrez et entrez le mot original",cipherText:"OXAOR",inputLength:5}, solution:"LUNAR" }
  ],

  calibration: [
    { technicianData:{ title:"VALEURS DE CALIBRAGE",subtitle:"Guidez l'Opérateur pour atteindre ces valeurs",targets:[{name:"PRESSION",value:67,unit:"%"},{name:"TEMPÉRATURE",value:34,unit:"°C"},{name:"DÉBIT",value:82,unit:"L/s"}] }, operatorData:{ title:"PANNEAU DE CALIBRAGE",subtitle:"Ajustez les curseurs selon les instructions",sliders:[{id:"s1",label:"CURSEUR ALPHA",min:0,max:100},{id:"s2",label:"CURSEUR BETA",min:0,max:100},{id:"s3",label:"CURSEUR GAMMA",min:0,max:100}] }, solution:[67,34,82], tolerance:3 },
    { technicianData:{ title:"VALEURS DE CALIBRAGE",subtitle:"Guidez l'Opérateur pour atteindre ces valeurs",targets:[{name:"TENSION",value:45,unit:"V"},{name:"FRÉQUENCE",value:72,unit:"Hz"},{name:"AMPLITUDE",value:28,unit:"dB"}] }, operatorData:{ title:"PANNEAU DE CALIBRAGE",subtitle:"Ajustez les curseurs selon les instructions",sliders:[{id:"s1",label:"CURSEUR X",min:0,max:100},{id:"s2",label:"CURSEUR Y",min:0,max:100},{id:"s3",label:"CURSEUR Z",min:0,max:100}] }, solution:[45,72,28], tolerance:3 },
    { technicianData:{ title:"VALEURS DE CALIBRAGE",subtitle:"Guidez l'Opérateur pour atteindre ces valeurs",targets:[{name:"OXYGÈNE",value:91,unit:"%"},{name:"CO2",value:18,unit:"ppm"},{name:"HUMIDITÉ",value:55,unit:"%"}] }, operatorData:{ title:"PANNEAU DE CALIBRAGE",subtitle:"Ajustez les curseurs selon les instructions",sliders:[{id:"s1",label:"VALVE-1",min:0,max:100},{id:"s2",label:"VALVE-2",min:0,max:100},{id:"s3",label:"VALVE-3",min:0,max:100}] }, solution:[91,18,55], tolerance:3 }
  ],

  final_protocol: [
    { technicianData:{ title:"PROTOCOLE D'URGENCE",subtitle:"Lisez les instructions dans l'ordre",steps:[{order:1,instruction:"Confirmez l'interrupteur ROUGE"},{order:2,instruction:"Entrez le code : 7-7-3"},{order:3,instruction:"Activez LEVIER-3 puis LEVIER-1"},{order:4,instruction:"Appuyez sur VALIDATION"}] }, operatorData:{ title:"PANNEAU FINAL",subtitle:"Exécutez les commandes dictées",controls:[{type:"switch",id:"sw_red",label:"ROUGE",color:"red"},{type:"switch",id:"sw_blue",label:"BLEU",color:"blue"},{type:"numpad",id:"numpad",label:"CODE"},{type:"lever",id:"lev1",label:"LEVIER-1"},{type:"lever",id:"lev2",label:"LEVIER-2"},{type:"lever",id:"lev3",label:"LEVIER-3"},{type:"button",id:"btn_validate",label:"VALIDATION",color:"green"}] }, solution:{switch:"sw_red",code:"773",levers:["lev3","lev1"],validate:true} },
    { technicianData:{ title:"PROTOCOLE D'URGENCE",subtitle:"Lisez les instructions dans l'ordre",steps:[{order:1,instruction:"Activez l'interrupteur BLEU"},{order:2,instruction:"Entrez le code : 4-1-9"},{order:3,instruction:"Activez LEVIER-2 puis LEVIER-3"},{order:4,instruction:"Appuyez sur VALIDATION"}] }, operatorData:{ title:"PANNEAU FINAL",subtitle:"Exécutez les commandes dictées",controls:[{type:"switch",id:"sw_red",label:"ROUGE",color:"red"},{type:"switch",id:"sw_blue",label:"BLEU",color:"blue"},{type:"numpad",id:"numpad",label:"CODE"},{type:"lever",id:"lev1",label:"LEVIER-1"},{type:"lever",id:"lev2",label:"LEVIER-2"},{type:"lever",id:"lev3",label:"LEVIER-3"},{type:"button",id:"btn_validate",label:"VALIDATION",color:"green"}] }, solution:{switch:"sw_blue",code:"419",levers:["lev2","lev3"],validate:true} }
  ]
};

const MODULES = ['MODULE RÉACTEUR','MODULE ATMOSPHÈRE','MODULE COMMUNICATIONS','MODULE PROPULSION','MODULE CENTRAL'];
const TYPES   = ['cross_code','mirror_sequence','cipher','calibration','final_protocol'];

function buildRandomPuzzles() {
  return TYPES.map((type, i) => {
    const bank = PUZZLE_BANK[type];
    const v = bank[Math.floor(Math.random() * bank.length)];
    return { id:i+1, module:MODULES[i], type, technicianData:v.technicianData, operatorData:v.operatorData, solution:v.solution, tolerance:v.tolerance||null };
  });
}

let PUZZLES = [];
function initPuzzles(seedJson) {
  PUZZLES = seedJson ? JSON.parse(seedJson) : buildRandomPuzzles();
}

function validateAction(puzzleIndex, action) {
  const puzzle = PUZZLES[puzzleIndex];
  if (!puzzle) return { valid:false, message:'Puzzle introuvable' };
  switch (puzzle.type) {
    case 'cross_code':
    case 'mirror_sequence': {
      const ok = action.sequence && action.sequence.length===puzzle.solution.length && action.sequence.every((v,i)=>v===puzzle.solution[i]);
      return { valid:!!ok, message:ok?'SÉQUENCE VALIDÉE ✓':'SÉQUENCE INCORRECTE ✗' };
    }
    case 'cipher': {
      const ok = action.word && action.word.toUpperCase()===puzzle.solution;
      return { valid:!!ok, message:ok?'MOT CORRECT ✓':'MOT INCORRECT ✗' };
    }
    case 'calibration': {
      const ok = action.values && action.values.every((v,i)=>Math.abs(v-puzzle.solution[i])<=(puzzle.tolerance||3));
      return { valid:!!ok, message:ok?'CALIBRAGE OK ✓':'CALIBRAGE HORS TOLÉRANCE ✗' };
    }
    case 'final_protocol': {
      const s=action.finalState, sol=puzzle.solution;
      if(!s) return {valid:false,message:'PROTOCOLE INCOMPLET ✗'};
      const ok=s.switch===sol.switch&&s.code===sol.code&&sol.levers.every(l=>s.levers&&s.levers.includes(l))&&s.validate===true;
      return { valid:!!ok, message:ok?'PROTOCOLE VALIDÉ ✓':'PROTOCOLE INCOMPLET ✗' };
    }
    default: return { valid:false, message:'Type inconnu' };
  }
}
  {
    id: 1, name: "Code Croisé", module: "MODULE RÉACTEUR", type: "cross_code",
    technicianData: {
      title: "TABLE DE CORRESPONDANCE",
      subtitle: "Communiquez les codes à l'Opérateur",
      mapping: { "ALPHA":"7","BETA":"2","GAMMA":"9","DELTA":"4","SIGMA":"1" },
      sequence: ["GAMMA","ALPHA","DELTA","BETA"]
    },
    operatorData: {
      title: "PANNEAU D'ENTRÉE",
      subtitle: "Entrez la séquence dans l'ordre",
      buttons: ["1","2","3","4","5","6","7","8","9","0"]
    },
    solution: ["9","7","4","2"]
  },
  {
    id: 2, name: "Séquence Miroir", module: "MODULE ATMOSPHÈRE", type: "mirror_sequence",
    technicianData: {
      title: "SÉQUENCE CIBLE",
      subtitle: "Guidez l'Opérateur dans l'ordre exact",
      sequence: ["rouge","bleu","vert","rouge","jaune"]
    },
    operatorData: {
      title: "PANNEAU DE COMMANDE",
      subtitle: "Activez les commutateurs selon les instructions",
      buttons: [
        {label:"VENT-A",color:"vert"},{label:"SYS-R",color:"rouge"},
        {label:"FLUX-J",color:"jaune"},{label:"CIRC-B",color:"bleu"},
        {label:"PMP-V",color:"vert"},{label:"ARC-R",color:"rouge"}
      ]
    },
    solution: ["SYS-R","CIRC-B","VENT-A","ARC-R","FLUX-J"]
  },
  {
    id: 3, name: "Déchiffrage", module: "MODULE COMMUNICATIONS", type: "cipher",
    technicianData: {
      title: "CLÉ DE CHIFFREMENT",
      subtitle: "Dictez la correspondance à l'Opérateur",
      key: {"A":"M","B":"X","C":"Z","D":"P","E":"K","F":"T","G":"R","H":"W","I":"N","J":"Q","K":"F","L":"Y","M":"A","N":"I","O":"C","P":"D","Q":"J","R":"G","S":"S","T":"F","U":"U","V":"V","W":"H","X":"B","Y":"L","Z":"E"}
    },
    operatorData: {
      title: "MESSAGE CHIFFRÉ",
      subtitle: "Déchiffrez et entrez le mot original",
      cipherText: "SCNKM", inputLength: 5
    },
    solution: "SONIC"
  },
  {
    id: 4, name: "Calibrage", module: "MODULE PROPULSION", type: "calibration",
    technicianData: {
      title: "VALEURS DE CALIBRAGE",
      subtitle: "Guidez l'Opérateur pour atteindre ces valeurs",
      targets: [{name:"PRESSION",value:67,unit:"%"},{name:"TEMPÉRATURE",value:34,unit:"°C"},{name:"DÉBIT",value:82,unit:"L/s"}]
    },
    operatorData: {
      title: "PANNEAU DE CALIBRAGE",
      subtitle: "Ajustez les curseurs selon les instructions",
      sliders: [{id:"s1",label:"CURSEUR ALPHA",min:0,max:100},{id:"s2",label:"CURSEUR BETA",min:0,max:100},{id:"s3",label:"CURSEUR GAMMA",min:0,max:100}]
    },
    solution: [67, 34, 82], tolerance: 3
  },
  {
    id: 5, name: "Protocole Final", module: "MODULE CENTRAL", type: "final_protocol",
    technicianData: {
      title: "PROTOCOLE D'URGENCE",
      subtitle: "Lisez les instructions dans l'ordre",
      steps: [
        {order:1,instruction:"Confirmez l'interrupteur ROUGE"},
        {order:2,instruction:"Entrez le code : 7-7-3"},
        {order:3,instruction:"Activez LEVIER-3 puis LEVIER-1"},
        {order:4,instruction:"Appuyez sur VALIDATION"}
      ]
    },
    operatorData: {
      title: "PANNEAU FINAL",
      subtitle: "Exécutez les commandes dictées",
      controls: [
        {type:"switch",id:"sw_red",label:"ROUGE",color:"red"},
        {type:"switch",id:"sw_blue",label:"BLEU",color:"blue"},
        {type:"numpad",id:"numpad",label:"CODE"},
        {type:"lever",id:"lev1",label:"LEVIER-1"},
        {type:"lever",id:"lev2",label:"LEVIER-2"},
        {type:"lever",id:"lev3",label:"LEVIER-3"},
        {type:"button",id:"btn_validate",label:"VALIDATION",color:"green"}
      ]
    },
    solution: {switch:"sw_red",code:"773",levers:["lev3","lev1"],validate:true}
  }
];

function validateAction(puzzleIndex, action) {
  const puzzle = PUZZLES[puzzleIndex];
  if (!puzzle) return { valid: false, message: 'Puzzle introuvable' };
  switch (puzzle.type) {
    case 'cross_code': {
      const sol = puzzle.solution;
      const ok = action.sequence && action.sequence.length === sol.length && action.sequence.every((v,i) => v === sol[i]);
      return { valid: !!ok, message: ok ? 'SÉQUENCE VALIDÉE ✓' : 'SÉQUENCE INCORRECTE ✗' };
    }
    case 'mirror_sequence': {
      const sol = puzzle.solution;
      const ok = action.sequence && action.sequence.length === sol.length && action.sequence.every((v,i) => v === sol[i]);
      return { valid: !!ok, message: ok ? 'SÉQUENCE VALIDÉE ✓' : 'SÉQUENCE INCORRECTE ✗' };
    }
    case 'cipher': {
      const ok = action.word && action.word.toUpperCase() === puzzle.solution;
      return { valid: !!ok, message: ok ? 'MOT CORRECT ✓' : 'MOT INCORRECT ✗' };
    }
    case 'calibration': {
      const ok = action.values && action.values.every((v,i) => Math.abs(v - puzzle.solution[i]) <= puzzle.tolerance);
      return { valid: !!ok, message: ok ? 'CALIBRAGE OK ✓' : 'CALIBRAGE HORS TOLÉRANCE ✗' };
    }
    case 'final_protocol': {
      const s = action.finalState;
      const sol = puzzle.solution;
      if (!s) return { valid: false, message: 'PROTOCOLE INCOMPLET ✗' };
      const ok = s.switch === sol.switch && s.code === sol.code && sol.levers.every(l => s.levers && s.levers.includes(l)) && s.validate === true;
      return { valid: !!ok, message: ok ? 'PROTOCOLE VALIDÉ ✓' : 'PROTOCOLE INCOMPLET ✗' };
    }
    default: return { valid: false, message: 'Type inconnu' };
  }
}

