// Données et validation des puzzles (côté client)
const PUZZLES = [
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

