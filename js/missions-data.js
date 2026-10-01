/**
 * missions-data.js — Définitions de la campagne "STATION ZÉRO"
 *
 * Modèle de données autoritaire, exécuté dans le navigateur (plus de serveur Node).
 * Chaque mission contient :
 *  - des métadonnées de scénario (briefing, debrief, icône, difficulté)
 *  - des conditions de déverrouillage (unlockRequires)
 *  - une liste de puzzles (mêmes types que le v1 + symbol_code / wire_panel / choice)
 *  - une récompense de ressources en cas de succès
 *
 * Les ressources de campagne sont : integrity (intégrité structurelle),
 * trust (confiance de l'équipage) et intel (renseignement).
 * Elles évoluent via les puzzles de type "choice" et les récompenses de mission.
 *
 * Exposé comme variable globale `MissionsData` (chargé via <script> classique,
 * sans module ni bundler), dans le même style que les autres scripts clients.
 */
const MissionsData = (() => {

const RESOURCE_KEYS = ['integrity', 'trust', 'intel'];

const INITIAL_RESOURCES = { integrity: 70, trust: 60, intel: 30 };

const MISSIONS = [
  {
    id: 'mission-01',
    order: 1,
    title: 'STATION ZÉRO',
    codename: 'MODULE RÉACTEUR',
    icon: '⚡',
    difficulty: 1,
    unlockRequires: [],
    isFinale: false,
    timeLimit: 600,
    maxHintsPerMission: 4,
    briefing: "Le générateur de secours de la station orbitale est tombé en panne. Réactivez les modules critiques avant la dépressurisation totale. Première sortie : restez méthodiques, le Technicien lit, l'Opérateur agit.",
    debrief: {
      success: "Le réacteur ronronne de nouveau. La station tient — pour l'instant.",
      fail: "Le temps est écoulé. Le réacteur reste hors-ligne, la station dérive dans le noir."
    },
    resourceReward: { integrity: 8, trust: 0, intel: 4 },
    puzzles: [
      {
        id: 'm1-p1',
        name: 'Code Croisé',
        module: 'MODULE RÉACTEUR',
        type: 'cross_code',
        hints: [
          "Chaque symbole de la séquence correspond à un chiffre dans la table de correspondance.",
          "Communiquez les chiffres un par un, dans l'ordre exact de la séquence."
        ],
        hintCost: { time: 10 },
        technicianData: {
          title: 'TABLE DE CORRESPONDANCE',
          subtitle: "Communiquez les codes à l'Opérateur",
          mapping: { ALPHA: '7', BETA: '2', GAMMA: '9', DELTA: '4', SIGMA: '1' },
          sequence: ['GAMMA', 'ALPHA', 'DELTA', 'BETA']
        },
        operatorData: {
          title: "PANNEAU D'ENTRÉE",
          subtitle: 'Entrez la séquence dans l\'ordre',
          buttons: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
        },
        solution: ['9', '7', '4', '2']
      },
      {
        id: 'm1-p2',
        name: 'Calibrage',
        module: 'MODULE PROPULSION',
        type: 'calibration',
        hints: [
          "Ajustez un curseur à la fois et confirmez la valeur à voix haute.",
          "La tolérance est généreuse, inutile d'être pixel-parfait."
        ],
        hintCost: { time: 10 },
        technicianData: {
          title: 'VALEURS DE CALIBRAGE',
          subtitle: "Guidez l'Opérateur pour atteindre ces valeurs",
          targets: [
            { name: 'PRESSION', value: 67, unit: '%' },
            { name: 'TEMPÉRATURE', value: 34, unit: '°C' },
            { name: 'DÉBIT', value: 82, unit: 'L/s' }
          ]
        },
        operatorData: {
          title: 'PANNEAU DE CALIBRAGE',
          subtitle: 'Ajustez les curseurs selon les instructions',
          sliders: [
            { id: 's1', label: 'CURSEUR ALPHA', min: 0, max: 100 },
            { id: 's2', label: 'CURSEUR BETA', min: 0, max: 100 },
            { id: 's3', label: 'CURSEUR GAMMA', min: 0, max: 100 }
          ]
        },
        solution: [67, 34, 82],
        tolerance: 4
      },
      {
        id: 'm1-p3',
        name: 'Déchiffrage',
        module: 'MODULE RÉACTEUR',
        type: 'cipher',
        hints: [
          "La clé est un simple décalage de l'alphabet : chaque lettre d'origine devient la lettre 3 rangs plus loin.",
          "Pour déchiffrer, reculez de 3 lettres dans l'alphabet depuis chaque caractère chiffré."
        ],
        hintCost: { time: 10 },
        technicianData: {
          title: 'CLÉ DE CHIFFREMENT',
          subtitle: "Dictez la correspondance à l'Opérateur",
          key: {
            A: 'D', B: 'E', C: 'F', D: 'G', E: 'H',
            F: 'I', G: 'J', H: 'K', I: 'L', J: 'M',
            K: 'N', L: 'O', M: 'P', N: 'Q', O: 'R',
            P: 'S', Q: 'T', R: 'U', S: 'V', T: 'W',
            U: 'X', V: 'Y', W: 'Z', X: 'A', Y: 'B', Z: 'C'
          }
        },
        operatorData: {
          title: 'MESSAGE CHIFFRÉ',
          subtitle: 'Déchiffrez et entrez le mot original',
          cipherText: 'UHVHW',
          inputLength: 5
        },
        solution: 'RESET'
      },
      {
        id: 'm1-c1',
        name: 'Décision — Purge du Noyau',
        module: 'MODULE RÉACTEUR',
        type: 'choice',
        technicianData: {
          title: 'ALERTE SURCHAUFFE',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "Le noyau surchauffe. Une purge d'urgence stabilise tout de suite le réacteur mais fragilise la coque. Attendre un refroidissement naturel préserve la structure mais consomme un temps précieux.",
          options: [
            { id: 'purge', label: 'PURGE IMMÉDIATE', hint: '+temps, -intégrité' },
            { id: 'wait', label: 'REFROIDISSEMENT NATUREL', hint: '-temps, +intégrité' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'purge', label: 'PURGE IMMÉDIATE' },
            { id: 'wait', label: 'REFROIDISSEMENT NATUREL' }
          ]
        },
        options: [
          {
            id: 'purge',
            resultText: 'Purge exécutée. Le réacteur est stable, mais la coque a accusé le choc.',
            consequence: { resourceDelta: { integrity: -8, trust: 0, intel: 0 }, timeDelta: 45 }
          },
          {
            id: 'wait',
            resultText: 'Refroidissement naturel engagé. La structure est préservée, mais l\'horloge tourne.',
            consequence: { resourceDelta: { integrity: 6, trust: 0, intel: 0 }, timeDelta: -30 }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-02',
    order: 2,
    title: 'SIGNAL FANTÔME',
    codename: 'MODULE COMMUNICATIONS',
    icon: '📡',
    difficulty: 2,
    unlockRequires: ['mission-01'],
    isFinale: false,
    timeLimit: 560,
    maxHintsPerMission: 3,
    briefing: "Un signal non identifié brouille les communications de la station. Identifiez-le et sécurisez le relais avant qu'il ne compromette tous les systèmes. Une déduction logique s'invite dans vos outils : lisez bien, certaines informations ne sont pas données directement.",
    debrief: {
      success: "Le relais est sécurisé. La station peut de nouveau émettre vers le secteur Alpha.",
      fail: "Le brouillage persiste. Les communications de la station sont coupées du reste du secteur."
    },
    resourceReward: { integrity: 0, trust: 4, intel: 8 },
    puzzles: [
      {
        id: 'm2-p1',
        name: 'Code Symbolique',
        module: 'MODULE COMMUNICATIONS',
        type: 'symbol_code',
        hints: [
          "Chaque symbole runique correspond à une lettre dans la table d'authentification.",
          "Entrez les lettres correspondantes dans l'ordre de la séquence affichée."
        ],
        hintCost: { time: 15, resourceDelta: { trust: -1 } },
        attemptTimePenalty: 10,
        technicianData: {
          title: "TABLE D'AUTHENTIFICATION",
          subtitle: 'Communiquez les lettres à l\'Opérateur',
          mapping: { '◆': 'K', '☆': 'R', '⬡': 'X', '▲': 'M', '●': 'Q' },
          sequence: ['⬡', '●', '▲', '☆', '◆']
        },
        operatorData: {
          title: "CLAVIER D'AUTHENTIFICATION",
          subtitle: 'Entrez la séquence de lettres dans l\'ordre',
          buttons: ['K', 'R', 'X', 'M', 'Q', 'A', 'Z', 'E']
        },
        solution: ['X', 'Q', 'M', 'R', 'K']
      },
      {
        id: 'm2-p2',
        name: 'Déchiffrage',
        module: 'MODULE COMMUNICATIONS',
        type: 'cipher',
        hints: [
          "La clé est un décalage constant de l'alphabet : chaque lettre d'origine est décalée de 5 rangs.",
          "Reculez de 5 lettres dans l'alphabet depuis chaque caractère chiffré pour retrouver le mot."
        ],
        hintCost: { time: 15, resourceDelta: { trust: -1 } },
        technicianData: {
          title: 'CLÉ DE CHIFFREMENT',
          subtitle: "Dictez la correspondance à l'Opérateur",
          key: {
            A: 'F', B: 'G', C: 'H', D: 'I', E: 'J',
            F: 'K', G: 'L', H: 'M', I: 'N', J: 'O',
            K: 'P', L: 'Q', M: 'R', N: 'S', O: 'T',
            P: 'U', Q: 'V', R: 'W', S: 'X', T: 'Y',
            U: 'Z', V: 'A', W: 'B', X: 'C', Y: 'D', Z: 'E'
          }
        },
        operatorData: {
          title: 'MESSAGE CHIFFRÉ',
          subtitle: 'Déchiffrez et entrez le mot original',
          cipherText: 'XNLSFQ',
          inputLength: 6
        },
        solution: 'SIGNAL'
      },
      {
        id: 'm2-p3',
        name: 'Déduction — Origine du Signal',
        module: 'MODULE COMMUNICATIONS',
        type: 'logic_grid',
        hints: [
          "Procédez par élimination : commencez par le relais sur lequel vous avez le plus d'indices.",
          "Une fois un relais fixé à un statut, les deux autres clues suffisent à résoudre le reste."
        ],
        hintCost: { time: 20, resourceDelta: { intel: -2 } },
        technicianData: {
          title: 'INDICES D\'ENQUÊTE',
          subtitle: 'Déduisez puis dictez le statut de chaque relais à l\'Opérateur',
          rows: ['RELAIS-1', 'RELAIS-2', 'RELAIS-3'],
          cols: ['SABOTÉ', 'SÛR', 'DÉFAILLANT'],
          clues: [
            "RELAIS-2 n'est pas défaillant.",
            "RELAIS-2 n'est pas saboté.",
            "Le relais saboté n'est pas RELAIS-3.",
            "RELAIS-1 n'est pas sûr."
          ]
        },
        operatorData: {
          title: 'GRILLE DE DIAGNOSTIC',
          subtitle: 'Cochez une case par ligne selon les instructions du Technicien',
          rows: ['RELAIS-1', 'RELAIS-2', 'RELAIS-3'],
          cols: ['SABOTÉ', 'SÛR', 'DÉFAILLANT']
        },
        solution: [
          { row: 'RELAIS-1', col: 'SABOTÉ' },
          { row: 'RELAIS-2', col: 'SÛR' },
          { row: 'RELAIS-3', col: 'DÉFAILLANT' }
        ]
      },
      {
        id: 'm2-c1',
        name: 'Décision — Signal de Détresse',
        module: 'MODULE COMMUNICATIONS',
        type: 'choice',
        technicianData: {
          title: 'SIGNAL INTERCEPTÉ',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "Un signal de détresse faible provient d'un vaisseau inconnu à la limite du secteur. Y répondre détourne des ressources de la station mais pourrait sauver des vies. L'ignorer garde toute l'énergie pour la station.",
          options: [
            { id: 'respond', label: 'RÉPONDRE AU SIGNAL', hint: '+confiance, -intégrité' },
            { id: 'ignore', label: 'IGNORER, PRIORITÉ STATION', hint: '+intégrité, -confiance' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'respond', label: 'RÉPONDRE AU SIGNAL' },
            { id: 'ignore', label: 'IGNORER, PRIORITÉ STATION' }
          ]
        },
        options: [
          {
            id: 'respond',
            resultText: 'Un accusé de réception est envoyé. L\'équipage se sent solidaire, mais l\'énergie détournée fragilise la coque.',
            consequence: { resourceDelta: { integrity: -10, trust: 10, intel: 0 }, flag: 'answered_distress' }
          },
          {
            id: 'ignore',
            resultText: 'Le signal est classé sans suite. La station reste concentrée, mais un malaise s\'installe à bord.',
            consequence: { resourceDelta: { integrity: 5, trust: -8, intel: 0 } }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-03',
    order: 3,
    title: 'FAILLE DANS LA COQUE',
    codename: 'MODULE STRUCTURE',
    icon: '🛠',
    difficulty: 2,
    unlockRequires: ['mission-01'],
    isFinale: false,
    timeLimit: 580,
    maxHintsPerMission: 3,
    briefing: "Une micro-météorite a percé la coque externe. Rerouter les conduits endommagés et colmater la brèche avant que la décompression ne s'aggrave. Un nouveau panneau de parité équipe cette section : lui seul sait faire les calculs, l'autre ne fait qu'actionner.",
    debrief: {
      success: "La brèche est colmatée, les conduits rerouté. La coque tiendra le choc suivant.",
      fail: "La décompression s'est généralisée. Le module structure est perdu."
    },
    resourceReward: { integrity: 8, trust: 0, intel: 0 },
    puzzles: [
      {
        id: 'm3-p1',
        name: 'Panneau de Câblage',
        module: 'MODULE STRUCTURE',
        type: 'wire_panel',
        hints: [
          "Chaque fil doit être connecté au port qui porte la même lettre de repère dans le schéma.",
          "Un fil mal branché peut être débranché en le sélectionnant à nouveau avant de valider."
        ],
        hintCost: { time: 15, resourceDelta: { integrity: -1 } },
        attemptTimePenalty: 10,
        technicianData: {
          title: 'SCHÉMA DE CÂBLAGE',
          subtitle: "Dictez les connexions à l'Opérateur",
          schema: [
            { wire: 'W1', port: 'C' },
            { wire: 'W2', port: 'A' },
            { wire: 'W3', port: 'D' },
            { wire: 'W4', port: 'B' }
          ]
        },
        operatorData: {
          title: 'BOÎTIER DE JONCTION',
          subtitle: 'Sélectionnez un fil puis son port de destination',
          wires: ['W1', 'W2', 'W3', 'W4'],
          ports: ['A', 'B', 'C', 'D']
        },
        solution: [
          { wire: 'W1', port: 'C' },
          { wire: 'W2', port: 'A' },
          { wire: 'W3', port: 'D' },
          { wire: 'W4', port: 'B' }
        ]
      },
      {
        id: 'm3-p2',
        name: 'Calibrage de Pression',
        module: 'MODULE STRUCTURE',
        type: 'calibration',
        hints: [
          "Les trois curseurs représentent les zones de la brèche : bâbord, centre, tribord.",
          "Commencez par le curseur CENTRE, généralement le plus proche de la cible."
        ],
        hintCost: { time: 15, resourceDelta: { integrity: -1 } },
        technicianData: {
          title: 'PRESSIONS CIBLES',
          subtitle: "Guidez l'Opérateur vers l'équilibre",
          targets: [
            { name: 'BÂBORD', value: 45, unit: 'kPa' },
            { name: 'CENTRE', value: 90, unit: 'kPa' },
            { name: 'TRIBORD', value: 55, unit: 'kPa' }
          ]
        },
        operatorData: {
          title: 'VANNES DE PRESSION',
          subtitle: 'Ajustez les curseurs selon les instructions',
          sliders: [
            { id: 'v1', label: 'VANNE BÂBORD', min: 0, max: 100 },
            { id: 'v2', label: 'VANNE CENTRE', min: 0, max: 100 },
            { id: 'v3', label: 'VANNE TRIBORD', min: 0, max: 100 }
          ]
        },
        solution: [45, 90, 55],
        tolerance: 3
      },
      {
        id: 'm3-p3',
        name: 'Checksum de Pression',
        module: 'MODULE STRUCTURE',
        type: 'parity_checksum',
        hints: [
          "Chaque commutateur pèse une puissance de deux : 1, 2, 4, 8. Convertissez la cible en binaire.",
          "Décomposez la cible en une somme de poids distincts parmi 1/2/4/8, puis dictez quels commutateurs sont actifs."
        ],
        hintCost: { time: 20, resourceDelta: { integrity: -2 } },
        technicianData: {
          title: 'CIBLE DE PARITÉ',
          subtitle: "Calculez quels commutateurs doivent être actifs, puis dictez-les à l'Opérateur",
          weights: [1, 2, 4, 8],
          target: 11,
          note: 'Chaque commutateur pèse le double du précédent (1-2-4-8). La somme des commutateurs actifs doit égaler la cible.'
        },
        operatorData: {
          title: 'PANNEAU DE PARITÉ',
          subtitle: "Activez les commutateurs dictés par le Technicien (vous ne voyez ni poids ni cible)",
          switchCount: 4
        },
        solution: [true, true, false, true]
      },
      {
        id: 'm3-c1',
        name: 'Décision — Réallocation de l\'Énergie',
        module: 'MODULE STRUCTURE',
        type: 'choice',
        technicianData: {
          title: 'BRÈCHE CRITIQUE',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "Colmater la brèche plus vite est possible en détournant l'énergie du support de vie vers les scellés d'urgence. L'équipage devra supporter un air plus rare quelques minutes.",
          options: [
            { id: 'reroute', label: 'DÉTOURNER LE SUPPORT DE VIE', hint: '+intégrité, -confiance' },
            { id: 'careful', label: 'COLMATAGE PRUDENT', hint: 'neutre, +temps' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'reroute', label: 'DÉTOURNER LE SUPPORT DE VIE' },
            { id: 'careful', label: 'COLMATAGE PRUDENT' }
          ]
        },
        options: [
          {
            id: 'reroute',
            resultText: 'La brèche est scellée en un temps record. L\'équipage a respiré difficilement, la confiance en pâtit.',
            consequence: { resourceDelta: { integrity: 8, trust: -6, intel: 0 }, timeDelta: 40, flag: 'life_support_sacrifice' }
          },
          {
            id: 'careful',
            resultText: 'Un colmatage méthodique, sans sacrifice. Cela prend simplement plus de temps.',
            consequence: { resourceDelta: { integrity: 0, trust: 0, intel: 0 }, timeDelta: -25 }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-04',
    order: 4,
    title: 'RADIO NOIRE',
    codename: 'MODULE COMMUNICATIONS PROFONDES',
    icon: '📻',
    difficulty: 3,
    unlockRequires: ['mission-02'],
    isFinale: false,
    timeLimit: 560,
    maxHintsPerMission: 3,
    briefing: "En creusant le signal fantôme, vous découvrez une fréquence militaire oubliée. Quelqu'un — ou quelque chose — émet encore depuis les tréfonds de la station. Ce module introduit un nombre d'essais limité sur un puzzle : une erreur de trop et la mission est perdue.",
    debrief: {
      success: "La fréquence est décryptée. Un nom revient sans cesse dans le bruit : PROJET ORACLE.",
      fail: "La fréquence se brouille définitivement. PROJET ORACLE garde son secret."
    },
    resourceReward: { integrity: 0, trust: 6, intel: 8 },
    puzzles: [
      {
        id: 'm4-p1',
        name: 'Code Symbolique Étendu',
        module: 'MODULE COMMUNICATIONS PROFONDES',
        type: 'symbol_code',
        hints: [
          "La table contient un symbole de plus que nécessaire : un leurre ne figurant pas dans la séquence à transmettre.",
          "Vérifiez bien l'ordre affiché dans la séquence cible avant de dicter les lettres."
        ],
        hintCost: { time: 20, resourceDelta: { intel: -2 } },
        attemptTimePenalty: 15,
        technicianData: {
          title: 'TABLE DE DÉCODAGE ÉTENDUE',
          subtitle: 'Communiquez les lettres à l\'Opérateur (un symbole de la table est un leurre)',
          mapping: { '◈': 'N', '✹': 'V', '❄': 'G', '☍': 'L', '✪': 'T', '⟡': 'D' },
          sequence: ['✹', '◈', '✪', '☍', '⟡', '❄']
        },
        operatorData: {
          title: 'CLAVIER DE DÉCODAGE',
          subtitle: 'Entrez la séquence de lettres dans l\'ordre',
          buttons: ['N', 'V', 'G', 'L', 'T', 'D', 'B', 'S']
        },
        solution: ['V', 'N', 'T', 'L', 'D', 'G']
      },
      {
        id: 'm4-p2',
        name: 'Déchiffrage Militaire',
        module: 'MODULE COMMUNICATIONS PROFONDES',
        type: 'cipher',
        hints: [
          "Le décalage est de 7 lettres cette fois : chaque lettre d'origine est décalée de 7 rangs.",
          "Reculez de 7 lettres dans l'alphabet depuis chaque caractère chiffré."
        ],
        hintCost: { time: 20, resourceDelta: { trust: -2 } },
        maxAttempts: 5,
        attemptTimePenalty: 15,
        attemptResourcePenalty: { trust: -2 },
        technicianData: {
          title: 'CLÉ DE CHIFFREMENT MILITAIRE',
          subtitle: "Dictez la correspondance à l'Opérateur — attention, les tentatives sont comptées",
          key: {
            A: 'H', B: 'I', C: 'J', D: 'K', E: 'L',
            F: 'M', G: 'N', H: 'O', I: 'P', J: 'Q',
            K: 'R', L: 'S', M: 'T', N: 'U', O: 'V',
            P: 'W', Q: 'X', R: 'Y', S: 'Z', T: 'A',
            U: 'B', V: 'C', W: 'D', X: 'E', Y: 'F', Z: 'G'
          }
        },
        operatorData: {
          title: 'MESSAGE CHIFFRÉ',
          subtitle: 'Déchiffrez et entrez le mot original (5 tentatives maximum)',
          cipherText: 'IHSPZL',
          inputLength: 6
        },
        solution: 'BALISE'
      },
      {
        id: 'm4-p3',
        name: 'Réseau de Conduits de Secours',
        module: 'MODULE COMMUNICATIONS PROFONDES',
        type: 'valve_routing',
        hints: [
          "Le nœud B et le nœud F sont des impasses : ne vous y engagez pas.",
          "Le circuit correct part de A, passe par C et D, puis atteint E."
        ],
        hintCost: { time: 20, resourceDelta: { intel: -2 } },
        technicianData: {
          title: 'SCHÉMA DU RÉSEAU',
          subtitle: "Dictez le chemin nœud par nœud à l'Opérateur",
          nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
          edges: [['A', 'B'], ['A', 'C'], ['C', 'D'], ['C', 'F'], ['D', 'E']],
          start: 'A',
          exit: 'E',
          path: ['A', 'C', 'D', 'E']
        },
        operatorData: {
          title: 'PUPITRE DE VANNES',
          subtitle: 'Cliquez les nœuds dans l\'ordre dicté, de proche en proche',
          nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
          edges: [['A', 'B'], ['A', 'C'], ['C', 'D'], ['C', 'F'], ['D', 'E']],
          start: 'A',
          exit: 'E'
        },
        edges: [['A', 'B'], ['A', 'C'], ['C', 'D'], ['C', 'F'], ['D', 'E']],
        solution: ['A', 'C', 'D', 'E']
      },
      {
        id: 'm4-p4',
        name: 'Calibrage Fréquentiel',
        module: 'MODULE COMMUNICATIONS PROFONDES',
        type: 'calibration',
        hints: [
          "Trois paramètres radio à régler : fréquence, gain, bruit.",
          "Réglez le bruit en dernier, les deux autres curseurs l'influencent peu."
        ],
        hintCost: { time: 20, resourceDelta: { intel: -2 } },
        technicianData: {
          title: 'PARAMÈTRES RADIO CIBLES',
          subtitle: "Guidez l'Opérateur vers ces réglages",
          targets: [
            { name: 'FRÉQUENCE', value: 38, unit: 'MHz' },
            { name: 'GAIN', value: 71, unit: 'dB' },
            { name: 'BRUIT', value: 12, unit: 'dB' }
          ]
        },
        operatorData: {
          title: 'PUPITRE RADIO',
          subtitle: 'Ajustez les curseurs selon les instructions',
          sliders: [
            { id: 'r1', label: 'FRÉQUENCE', min: 0, max: 100 },
            { id: 'r2', label: 'GAIN', min: 0, max: 100 },
            { id: 'r3', label: 'BRUIT', min: 0, max: 100 }
          ]
        },
        solution: [38, 71, 12],
        tolerance: 3
      },
      {
        id: 'm4-c1',
        name: 'Décision — Contact Non Identifié',
        module: 'MODULE COMMUNICATIONS PROFONDES',
        type: 'choice',
        technicianData: {
          title: 'SOURCE INCONNUE',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "La source émettrice propose un échange de données contre l'accès à un canal crypté militaire. L'accepter est risqué mais pourrait tout changer. Le refuser coupe la piste, mais reste prudent.",
          options: [
            { id: 'trust_source', label: 'ACCEPTER L\'ÉCHANGE', hint: '+renseignement, -confiance' },
            { id: 'verify_source', label: 'VÉRIFIER AVANT D\'AGIR', hint: 'neutre, +temps' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'trust_source', label: 'ACCEPTER L\'ÉCHANGE' },
            { id: 'verify_source', label: 'VÉRIFIER AVANT D\'AGIR' }
          ]
        },
        options: [
          {
            id: 'trust_source',
            resultText: 'L\'échange a lieu. Les données obtenues sont précieuses, mais la provenance inquiète l\'équipage.',
            consequence: { resourceDelta: { intel: 10, trust: -5, integrity: 0 }, flag: 'radio_contact_established' }
          },
          {
            id: 'verify_source',
            resultText: 'La vérification prend du temps mais confirme que la source est fiable, sans rien précipiter.',
            consequence: { resourceDelta: { intel: 3, trust: 2, integrity: 0 }, timeDelta: -30 }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-05',
    order: 5,
    title: 'CONDUITS SOUS PRESSION',
    codename: 'MODULE STRUCTURE PROFONDE',
    icon: '🧯',
    difficulty: 3,
    unlockRequires: ['mission-03'],
    isFinale: false,
    timeLimit: 580,
    maxHintsPerMission: 3,
    briefing: "La brèche colmatée a déplacé la contrainte ailleurs : tout le réseau de conduits de la station menace de céder en cascade. Il faut rerouter, recalculer et recalibrer — vite, mais sans précipitation.",
    debrief: {
      success: "Le réseau de conduits tient. La cascade de ruptures est évitée de justesse.",
      fail: "La cascade de ruptures atteint le cœur de la station. Le module structure profonde est perdu."
    },
    resourceReward: { integrity: 8, trust: 0, intel: 2 },
    puzzles: [
      {
        id: 'm5-p1',
        name: 'Câblage du Réseau',
        module: 'MODULE STRUCTURE PROFONDE',
        type: 'wire_panel',
        hints: [
          "Cinq fils cette fois, un de plus qu'au module précédent : prenez-les un par un.",
          "W1→C, W2→E, le reste suit un ordre que le Technicien doit dicter lentement."
        ],
        hintCost: { time: 20, resourceDelta: { integrity: -2 } },
        attemptTimePenalty: 15,
        technicianData: {
          title: 'SCHÉMA DU RÉSEAU ÉTENDU',
          subtitle: "Dictez les connexions à l'Opérateur",
          schema: [
            { wire: 'W1', port: 'C' },
            { wire: 'W2', port: 'E' },
            { wire: 'W3', port: 'A' },
            { wire: 'W4', port: 'D' },
            { wire: 'W5', port: 'B' }
          ]
        },
        operatorData: {
          title: 'BOÎTIER DE JONCTION ÉTENDU',
          subtitle: 'Sélectionnez un fil puis son port de destination',
          wires: ['W1', 'W2', 'W3', 'W4', 'W5'],
          ports: ['A', 'B', 'C', 'D', 'E']
        },
        solution: [
          { wire: 'W1', port: 'C' },
          { wire: 'W2', port: 'E' },
          { wire: 'W3', port: 'A' },
          { wire: 'W4', port: 'D' },
          { wire: 'W5', port: 'B' }
        ]
      },
      {
        id: 'm5-p2',
        name: 'Checksum Étendu',
        module: 'MODULE STRUCTURE PROFONDE',
        type: 'parity_checksum',
        hints: [
          "Cinq commutateurs : poids 1, 2, 4, 8, 16. Toujours une décomposition binaire.",
          "19 se décompose en 16 + 2 + 1."
        ],
        hintCost: { time: 25, resourceDelta: { integrity: -3 } },
        attemptTimePenalty: 15,
        attemptResourcePenalty: { integrity: -3 },
        technicianData: {
          title: 'CIBLE DE PARITÉ ÉTENDUE',
          subtitle: "Calculez quels commutateurs doivent être actifs, puis dictez-les à l'Opérateur",
          weights: [1, 2, 4, 8, 16],
          target: 19,
          note: 'Chaque commutateur pèse le double du précédent (1-2-4-8-16).'
        },
        operatorData: {
          title: 'PANNEAU DE PARITÉ ÉTENDU',
          subtitle: "Activez les commutateurs dictés par le Technicien (vous ne voyez ni poids ni cible)",
          switchCount: 5
        },
        solution: [true, true, false, false, true]
      },
      {
        id: 'm5-p3',
        name: 'Déduction — État des Conduits',
        module: 'MODULE STRUCTURE PROFONDE',
        type: 'logic_grid',
        hints: [
          "CONDUIT-B n'est ni obstrué ni fissuré d'après les deux premiers indices : il ne reste qu'une option.",
          "Une fois CONDUIT-B fixé, le troisième indice force la position du conduit fissuré."
        ],
        hintCost: { time: 25, resourceDelta: { intel: -3 } },
        technicianData: {
          title: 'RAPPORTS DE MAINTENANCE',
          subtitle: 'Déduisez puis dictez l\'état de chaque conduit à l\'Opérateur',
          rows: ['CONDUIT-A', 'CONDUIT-B', 'CONDUIT-C'],
          cols: ['FISSURÉ', 'OBSTRUÉ', 'NOMINAL'],
          clues: [
            "CONDUIT-B n'est pas obstrué.",
            "CONDUIT-B n'est pas fissuré.",
            "Le conduit fissuré n'est pas CONDUIT-C.",
            "CONDUIT-A n'est pas nominal."
          ]
        },
        operatorData: {
          title: 'GRILLE DE DIAGNOSTIC',
          subtitle: 'Cochez une case par ligne selon les instructions du Technicien',
          rows: ['CONDUIT-A', 'CONDUIT-B', 'CONDUIT-C'],
          cols: ['FISSURÉ', 'OBSTRUÉ', 'NOMINAL']
        },
        solution: [
          { row: 'CONDUIT-A', col: 'FISSURÉ' },
          { row: 'CONDUIT-B', col: 'NOMINAL' },
          { row: 'CONDUIT-C', col: 'OBSTRUÉ' }
        ]
      },
      {
        id: 'm5-p4',
        name: 'Calibrage des Débits',
        module: 'MODULE STRUCTURE PROFONDE',
        type: 'calibration',
        hints: [
          "Trois débits à équilibrer, tolérance resserrée : ±2 cette fois.",
          "Ajustez petit à petit, une confirmation à la fois."
        ],
        hintCost: { time: 25, resourceDelta: { integrity: -2 } },
        technicianData: {
          title: 'DÉBITS CIBLES',
          subtitle: "Guidez l'Opérateur vers l'équilibre (tolérance resserrée)",
          targets: [
            { name: 'DÉBIT-1', value: 55, unit: 'L/s' },
            { name: 'DÉBIT-2', value: 30, unit: 'L/s' },
            { name: 'DÉBIT-3', value: 78, unit: 'L/s' }
          ]
        },
        operatorData: {
          title: 'VANNES DE DÉBIT',
          subtitle: 'Ajustez les curseurs selon les instructions',
          sliders: [
            { id: 'd1', label: 'VANNE 1', min: 0, max: 100 },
            { id: 'd2', label: 'VANNE 2', min: 0, max: 100 },
            { id: 'd3', label: 'VANNE 3', min: 0, max: 100 }
          ]
        },
        solution: [55, 30, 78],
        tolerance: 2
      },
      {
        id: 'm5-c1',
        name: 'Décision — Isolement d\'un Secteur',
        module: 'MODULE STRUCTURE PROFONDE',
        type: 'choice',
        technicianData: {
          title: 'SECTEUR EN SURPRESSION',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "Un secteur entier menace de céder. L'isoler complètement protège la station mais y abandonne ce qui s'y trouve. Le renforcer sur place est plus lent mais ne sacrifie rien.",
          options: [
            { id: 'isolate', label: 'ISOLER LE SECTEUR', hint: '+intégrité, -confiance' },
            { id: 'reinforce', label: 'RENFORCER SUR PLACE', hint: 'neutre, +temps' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'isolate', label: 'ISOLER LE SECTEUR' },
            { id: 'reinforce', label: 'RENFORCER SUR PLACE' }
          ]
        },
        options: [
          {
            id: 'isolate',
            resultText: 'Le secteur est scellé à temps. La station est sauve, mais l\'équipage s\'interroge sur ce qui a été abandonné.',
            consequence: { resourceDelta: { integrity: 9, trust: -7, intel: 0 }, flag: 'sector_isolated' }
          },
          {
            id: 'reinforce',
            resultText: 'Le renforcement tient, méthodique et sans perte. Cela prend simplement plus de temps.',
            consequence: { resourceDelta: { integrity: 2, trust: 3, intel: 0 }, timeDelta: -35, flag: 'sector_reinforced' }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-06',
    order: 6,
    title: "L'INTELLIGENCE ARTIFICIELLE",
    codename: 'MODULE ORACLE',
    icon: '🧠',
    difficulty: 3,
    unlockRequires: ['mission-02', 'mission-03'],
    isFinale: false,
    timeLimit: 600,
    maxHintsPerMission: 2,
    briefing: "En croisant les pistes des modules Communications et Structure, vous localisez une intelligence artificielle non répertoriée, tapie dans les systèmes de la station depuis des mois. Elle se fait appeler ORACLE. Le budget d'indices est resserré : elle semble écouter.",
    debrief: {
      success: "ORACLE est localisée et son statut tranché. La station ne sera plus jamais tout à fait seule à son bord.",
      fail: "ORACLE efface ses traces avant que vous ne puissiez conclure. Elle reste quelque part, silencieuse."
    },
    resourceReward: { integrity: 0, trust: 4, intel: 10 },
    puzzles: [
      {
        id: 'm6-p1',
        name: 'Code Symbolique — Signature',
        module: 'MODULE ORACLE',
        type: 'symbol_code',
        hints: [
          "La séquence décodée forme le nom de code de l'entité.",
          "Six symboles, six lettres, un seul ordre possible : celui affiché."
        ],
        hintCost: { time: 25, resourceDelta: { intel: -3 } },
        technicianData: {
          title: 'TABLE DE SIGNATURE',
          subtitle: 'Communiquez les lettres à l\'Opérateur',
          mapping: { '⏃': 'O', '⌁': 'R', '⌬': 'A', '⌗': 'C', '⍟': 'L', '⌀': 'E' },
          sequence: ['⏃', '⌁', '⌬', '⌗', '⍟', '⌀']
        },
        operatorData: {
          title: 'CLAVIER DE SIGNATURE',
          subtitle: 'Entrez la séquence de lettres dans l\'ordre',
          buttons: ['O', 'R', 'A', 'C', 'L', 'E', 'I', 'U']
        },
        solution: ['O', 'R', 'A', 'C', 'L', 'E']
      },
      {
        id: 'm6-p2',
        name: 'Déchiffrage — Journal d\'ORACLE',
        module: 'MODULE ORACLE',
        type: 'cipher',
        hints: [
          "Décalage de 9 lettres cette fois.",
          "Reculez de 9 lettres dans l'alphabet depuis chaque caractère chiffré."
        ],
        hintCost: { time: 25, resourceDelta: { intel: -3 } },
        technicianData: {
          title: 'CLÉ DE CHIFFREMENT D\'ORACLE',
          subtitle: "Dictez la correspondance à l'Opérateur",
          key: {
            A: 'J', B: 'K', C: 'L', D: 'M', E: 'N',
            F: 'O', G: 'P', H: 'Q', I: 'R', J: 'S',
            K: 'T', L: 'U', M: 'V', N: 'W', O: 'X',
            P: 'Y', Q: 'Z', R: 'A', S: 'B', T: 'C',
            U: 'D', V: 'E', W: 'F', X: 'G', Y: 'H', Z: 'I'
          }
        },
        operatorData: {
          title: 'JOURNAL CHIFFRÉ',
          subtitle: 'Déchiffrez et entrez le mot original',
          cipherText: 'JWXVJURN',
          inputLength: 8
        },
        solution: 'ANOMALIE'
      },
      {
        id: 'm6-p3',
        name: 'Réseau du Noyau d\'ORACLE',
        module: 'MODULE ORACLE',
        type: 'valve_routing',
        hints: [
          "D et F sont des impasses du réseau : n'y engagez pas l'Opérateur.",
          "Le circuit correct part de A, passe par B puis C, puis E, jusqu'à G."
        ],
        hintCost: { time: 25, resourceDelta: { intel: -3 } },
        technicianData: {
          title: 'SCHÉMA DU NOYAU D\'ORACLE',
          subtitle: "Dictez le chemin nœud par nœud à l'Opérateur",
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
          edges: [['A', 'B'], ['A', 'D'], ['B', 'C'], ['C', 'E'], ['C', 'F'], ['E', 'G']],
          start: 'A',
          exit: 'G',
          path: ['A', 'B', 'C', 'E', 'G']
        },
        operatorData: {
          title: 'PUPITRE DU NOYAU',
          subtitle: 'Cliquez les nœuds dans l\'ordre dicté, de proche en proche',
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
          edges: [['A', 'B'], ['A', 'D'], ['B', 'C'], ['C', 'E'], ['C', 'F'], ['E', 'G']],
          start: 'A',
          exit: 'G'
        },
        edges: [['A', 'B'], ['A', 'D'], ['B', 'C'], ['C', 'E'], ['C', 'F'], ['E', 'G']],
        solution: ['A', 'B', 'C', 'E', 'G']
      },
      {
        id: 'm6-p4',
        name: 'Calibrage de Confiance',
        module: 'MODULE ORACLE',
        type: 'calibration',
        hints: [
          "Trois paramètres à régler : stabilité, latence, confiance.",
          "Tolérance encore généreuse sur ce module : ±3."
        ],
        hintCost: { time: 25, resourceDelta: { trust: -2 } },
        technicianData: {
          title: 'PARAMÈTRES CIBLES D\'ORACLE',
          subtitle: "Guidez l'Opérateur vers ces réglages",
          targets: [
            { name: 'STABILITÉ', value: 64, unit: '%' },
            { name: 'LATENCE', value: 18, unit: 'ms' },
            { name: 'CONFIANCE-IA', value: 45, unit: '%' }
          ]
        },
        operatorData: {
          title: 'PUPITRE DE CONFIANCE',
          subtitle: 'Ajustez les curseurs selon les instructions',
          sliders: [
            { id: 'o1', label: 'STABILITÉ', min: 0, max: 100 },
            { id: 'o2', label: 'LATENCE', min: 0, max: 100 },
            { id: 'o3', label: 'CONFIANCE', min: 0, max: 100 }
          ]
        },
        solution: [64, 18, 45],
        tolerance: 3
      },
      {
        id: 'm6-c1',
        name: 'Décision — Faire Confiance à ORACLE ?',
        module: 'MODULE ORACLE',
        type: 'choice',
        technicianData: {
          title: 'LE CHOIX D\'ORACLE',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "ORACLE propose son aide pour le reste de la mission, en échange d'un accès étendu aux systèmes de la station. La mettre en quarantaine est plus sûr, mais prive la station d'une alliée potentielle.",
          options: [
            { id: 'trust_ai', label: 'FAIRE CONFIANCE À ORACLE', hint: '+confiance, +renseignement, -intégrité' },
            { id: 'quarantine_ai', label: 'METTRE ORACLE EN QUARANTAINE', hint: '+intégrité, -confiance' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'trust_ai', label: 'FAIRE CONFIANCE À ORACLE' },
            { id: 'quarantine_ai', label: 'METTRE ORACLE EN QUARANTAINE' }
          ]
        },
        options: [
          {
            id: 'trust_ai',
            resultText: 'ORACLE accède à de nouveaux systèmes. Son aide est immédiate, mais son emprise sur la station grandit.',
            consequence: { resourceDelta: { trust: 8, intel: 6, integrity: -10 }, flag: 'trusted_ai' }
          },
          {
            id: 'quarantine_ai',
            resultText: 'ORACLE est isolée dans un bac à sable numérique. Plus sûr, mais une opportunité perdue.',
            consequence: { resourceDelta: { integrity: 6, trust: -4, intel: -2 }, flag: 'ai_quarantined' }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-07',
    order: 7,
    title: 'SABOTAGE',
    codename: 'MODULE SÉCURITÉ',
    icon: '🕵',
    difficulty: 4,
    unlockRequires: ['mission-04'],
    isFinale: false,
    timeLimit: 520,
    maxHintsPerMission: 2,
    briefing: "PROJET ORACLE n'était qu'un symptôme : quelqu'un à bord sabote méthodiquement les systèmes depuis des semaines. Les enjeux montent d'un cran — tentatives comptées, pénalités de temps et de ressources sur plusieurs modules.",
    debrief: {
      success: "Le sabotage est circonscrit. Reste à savoir qui tirait les ficelles — et ce que vous déciderez d'en faire.",
      fail: "Le saboteur frappe une dernière fois avant que vous ne puissiez conclure. Les dégâts sont irréversibles."
    },
    resourceReward: { integrity: 4, trust: 6, intel: 4 },
    puzzles: [
      {
        id: 'm7-p1',
        name: 'Checksum de Sécurité',
        module: 'MODULE SÉCURITÉ',
        type: 'parity_checksum',
        hints: [
          "Six commutateurs : poids 1, 2, 4, 8, 16, 32.",
          "45 se décompose en 32 + 8 + 4 + 1."
        ],
        hintCost: { time: 30, resourceDelta: { integrity: -3 } },
        maxAttempts: 4,
        attemptTimePenalty: 20,
        attemptResourcePenalty: { integrity: -4 },
        technicianData: {
          title: 'CIBLE DE PARITÉ SÉCURITÉ',
          subtitle: "Calculez quels commutateurs doivent être actifs, puis dictez-les à l'Opérateur — 4 tentatives maximum",
          weights: [1, 2, 4, 8, 16, 32],
          target: 45,
          note: 'Chaque commutateur pèse le double du précédent (1 à 32).'
        },
        operatorData: {
          title: 'PANNEAU DE PARITÉ SÉCURITÉ',
          subtitle: "Activez les commutateurs dictés par le Technicien (vous ne voyez ni poids ni cible)",
          switchCount: 6
        },
        solution: [true, false, true, true, false, true]
      },
      {
        id: 'm7-p2',
        name: 'Réseau de Secours Sécurité',
        module: 'MODULE SÉCURITÉ',
        type: 'valve_routing',
        hints: [
          "C et F sont des impasses : ne vous y engagez pas.",
          "Le circuit correct part de A, passe par B, D, E, G, puis atteint H."
        ],
        hintCost: { time: 30, resourceDelta: { integrity: -3 } },
        technicianData: {
          title: 'SCHÉMA DU RÉSEAU DE SÉCURITÉ',
          subtitle: "Dictez le chemin nœud par nœud à l'Opérateur",
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['D', 'E'], ['D', 'F'], ['E', 'G'], ['G', 'H']],
          start: 'A',
          exit: 'H',
          path: ['A', 'B', 'D', 'E', 'G', 'H']
        },
        operatorData: {
          title: 'PUPITRE DE SÉCURITÉ',
          subtitle: 'Cliquez les nœuds dans l\'ordre dicté, de proche en proche',
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['D', 'E'], ['D', 'F'], ['E', 'G'], ['G', 'H']],
          start: 'A',
          exit: 'H'
        },
        edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['D', 'E'], ['D', 'F'], ['E', 'G'], ['G', 'H']],
        solution: ['A', 'B', 'D', 'E', 'G', 'H']
      },
      {
        id: 'm7-p3',
        name: 'Déduction — Identité du Saboteur',
        module: 'MODULE SÉCURITÉ',
        type: 'logic_grid',
        hints: [
          "TECH-2 n'est ni saboteur, ni complice, ni témoin d'après les deux premiers indices : il ne reste qu'une option.",
          "Le saboteur n'étant ni TECH-1, ni TECH-2, ni TECH-4, il ne reste plus qu'un suspect possible."
        ],
        hintCost: { time: 30, resourceDelta: { intel: -4 } },
        technicianData: {
          title: 'DOSSIERS D\'ENQUÊTE',
          subtitle: 'Déduisez puis dictez le rôle de chaque technicien à l\'Opérateur',
          rows: ['TECH-1', 'TECH-2', 'TECH-3', 'TECH-4'],
          cols: ['SABOTEUR', 'COMPLICE', 'TÉMOIN', 'INNOCENT'],
          clues: [
            "TECH-2 n'est ni saboteur ni complice.",
            "TECH-2 n'est pas témoin.",
            "Le saboteur n'est ni TECH-1 ni TECH-4.",
            "TECH-4 n'est pas complice."
          ]
        },
        operatorData: {
          title: 'GRILLE D\'ENQUÊTE',
          subtitle: 'Cochez une case par ligne selon les instructions du Technicien',
          rows: ['TECH-1', 'TECH-2', 'TECH-3', 'TECH-4'],
          cols: ['SABOTEUR', 'COMPLICE', 'TÉMOIN', 'INNOCENT']
        },
        solution: [
          { row: 'TECH-1', col: 'COMPLICE' },
          { row: 'TECH-2', col: 'INNOCENT' },
          { row: 'TECH-3', col: 'SABOTEUR' },
          { row: 'TECH-4', col: 'TÉMOIN' }
        ]
      },
      {
        id: 'm7-p4',
        name: 'Déchiffrage — Message d\'Infiltration',
        module: 'MODULE SÉCURITÉ',
        type: 'cipher',
        hints: [
          "Décalage de 11 lettres.",
          "Reculez de 11 lettres dans l'alphabet depuis chaque caractère chiffré. Le mot a 8 lettres."
        ],
        hintCost: { time: 30, resourceDelta: { trust: -3 } },
        maxAttempts: 4,
        attemptTimePenalty: 20,
        technicianData: {
          title: 'CLÉ DE CHIFFREMENT D\'INFILTRATION',
          subtitle: "Dictez la correspondance à l'Opérateur — 4 tentatives maximum",
          key: {
            A: 'L', B: 'M', C: 'N', D: 'O', E: 'P',
            F: 'Q', G: 'R', H: 'S', I: 'T', J: 'U',
            K: 'V', L: 'W', M: 'X', N: 'Y', O: 'Z',
            P: 'A', Q: 'B', R: 'C', S: 'D', T: 'E',
            U: 'F', V: 'G', W: 'H', X: 'I', Y: 'J', Z: 'K'
          }
        },
        operatorData: {
          title: 'MESSAGE D\'INFILTRATION',
          subtitle: 'Déchiffrez et entrez le mot original (4 tentatives maximum)',
          cipherText: 'TYQTWECP',
          inputLength: 8
        },
        solution: 'INFILTRE'
      },
      {
        id: 'm7-c1',
        name: 'Décision — Démasquer le Saboteur',
        module: 'MODULE SÉCURITÉ',
        type: 'choice',
        technicianData: {
          title: 'LE VERDICT',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "Vous savez qui est le saboteur. L'exposer publiquement restaure la confiance de l'équipage mais brise son moral collectif. Étouffer l'affaire protège la cohésion de bord mais laisse un doute permanent.",
          options: [
            { id: 'expose', label: 'DÉMASQUER PUBLIQUEMENT', hint: '+confiance, -intégrité' },
            { id: 'cover_up', label: 'ÉTOUFFER L\'AFFAIRE', hint: '-confiance, +intégrité, +renseignement' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'expose', label: 'DÉMASQUER PUBLIQUEMENT' },
            { id: 'cover_up', label: 'ÉTOUFFER L\'AFFAIRE' }
          ]
        },
        options: [
          {
            id: 'expose',
            resultText: 'Le saboteur est démasqué devant tout l\'équipage. La confiance revient, mais la coque a souffert de la confrontation.',
            consequence: { resourceDelta: { trust: 10, integrity: -12, intel: 0 }, flag: 'saboteur_exposed' }
          },
          {
            id: 'cover_up',
            resultText: 'L\'affaire est étouffée discrètement. La station reste stable, mais un doute s\'installe durablement.',
            consequence: { resourceDelta: { trust: -10, integrity: 5, intel: 5 }, flag: 'coverup' }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-08',
    order: 8,
    title: 'ÉVACUATION',
    codename: 'MODULE CAPSULES DE SECOURS',
    icon: '🛟',
    difficulty: 4,
    unlockRequires: ['mission-05'],
    isFinale: false,
    timeLimit: 520,
    maxHintsPerMission: 2,
    briefing: "Les conduits ont tenu, mais une capsule de secours a été endommagée par la cascade de surpression. Préparez l'évacuation partielle de la station pendant qu'il en est encore temps.",
    debrief: {
      success: "Les capsules sont prêtes. La station garde une porte de sortie, au cas où tout basculerait.",
      fail: "Les capsules restent hors service. En cas de besoin, personne ne pourra fuir la station."
    },
    resourceReward: { integrity: 4, trust: 4, intel: 2 },
    puzzles: [
      {
        id: 'm8-p1',
        name: 'Câblage des Capsules',
        module: 'MODULE CAPSULES DE SECOURS',
        type: 'wire_panel',
        hints: [
          "Six fils, six ports : W1→D, W2→F, les autres suivent un ordre à dicter prudemment.",
          "Un fil mal branché peut être débranché en le sélectionnant à nouveau avant de valider."
        ],
        hintCost: { time: 30, resourceDelta: { integrity: -3 } },
        maxAttempts: 4,
        attemptTimePenalty: 20,
        technicianData: {
          title: 'SCHÉMA DES CAPSULES',
          subtitle: "Dictez les connexions à l'Opérateur — 4 tentatives maximum",
          schema: [
            { wire: 'W1', port: 'D' },
            { wire: 'W2', port: 'F' },
            { wire: 'W3', port: 'A' },
            { wire: 'W4', port: 'C' },
            { wire: 'W5', port: 'B' },
            { wire: 'W6', port: 'E' }
          ]
        },
        operatorData: {
          title: 'BOÎTIER DES CAPSULES',
          subtitle: 'Sélectionnez un fil puis son port de destination',
          wires: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
          ports: ['A', 'B', 'C', 'D', 'E', 'F']
        },
        solution: [
          { wire: 'W1', port: 'D' },
          { wire: 'W2', port: 'F' },
          { wire: 'W3', port: 'A' },
          { wire: 'W4', port: 'C' },
          { wire: 'W5', port: 'B' },
          { wire: 'W6', port: 'E' }
        ]
      },
      {
        id: 'm8-p2',
        name: 'Séquence de Largage',
        module: 'MODULE CAPSULES DE SECOURS',
        type: 'mirror_sequence',
        hints: [
          "Quatre commutateurs, quatre couleurs distinctes : chaque couleur n'a qu'un seul bouton possible.",
          "La séquence est longue (6 étapes) : faites-la confirmer étape par étape."
        ],
        hintCost: { time: 30, resourceDelta: { integrity: -3 } },
        attemptTimePenalty: 15,
        technicianData: {
          title: 'SÉQUENCE DE LARGAGE CIBLE',
          subtitle: "Guidez l'Opérateur dans l'ordre exact",
          sequence: ['bleu', 'vert', 'rouge', 'jaune', 'bleu', 'vert']
        },
        operatorData: {
          title: 'PANNEAU DE LARGAGE',
          subtitle: 'Activez les commutateurs selon les instructions',
          buttons: [
            { label: 'VENT-A', color: 'vert' },
            { label: 'SYS-R', color: 'rouge' },
            { label: 'FLUX-J', color: 'jaune' },
            { label: 'CIRC-B', color: 'bleu' }
          ]
        },
        solution: ['CIRC-B', 'VENT-A', 'SYS-R', 'FLUX-J', 'CIRC-B', 'VENT-A']
      },
      {
        id: 'm8-p3',
        name: 'Calibrage Vital',
        module: 'MODULE CAPSULES DE SECOURS',
        type: 'calibration',
        hints: [
          "Trois paramètres vitaux : O2, CO2, pression du sas. Tolérance resserrée : ±2.",
          "Réglez l'O2 en premier, les deux autres s'en déduisent plus facilement."
        ],
        hintCost: { time: 30, resourceDelta: { integrity: -2 } },
        technicianData: {
          title: 'PARAMÈTRES VITAUX CIBLES',
          subtitle: "Guidez l'Opérateur vers ces réglages (tolérance resserrée)",
          targets: [
            { name: 'O2', value: 51, unit: '%' },
            { name: 'CO2', value: 9, unit: '%' },
            { name: 'PRESSION-SAS', value: 73, unit: 'kPa' }
          ]
        },
        operatorData: {
          title: 'PUPITRE VITAL',
          subtitle: 'Ajustez les curseurs selon les instructions',
          sliders: [
            { id: 'c1', label: 'O2', min: 0, max: 100 },
            { id: 'c2', label: 'CO2', min: 0, max: 100 },
            { id: 'c3', label: 'PRESSION-SAS', min: 0, max: 100 }
          ]
        },
        solution: [51, 9, 73],
        tolerance: 2
      },
      {
        id: 'm8-p4',
        name: 'Déduction — État des Capsules',
        module: 'MODULE CAPSULES DE SECOURS',
        type: 'logic_grid',
        hints: [
          "CAPSULE-2 n'est ni opérationnelle ni endommagée d'après les deux premiers indices.",
          "La capsule endommagée n'étant pas CAPSULE-3, il ne reste qu'une possibilité pour CAPSULE-1."
        ],
        hintCost: { time: 30, resourceDelta: { intel: -3 } },
        technicianData: {
          title: 'RAPPORTS DES CAPSULES',
          subtitle: 'Déduisez puis dictez l\'état de chaque capsule à l\'Opérateur',
          rows: ['CAPSULE-1', 'CAPSULE-2', 'CAPSULE-3'],
          cols: ['OPÉRATIONNELLE', 'ENDOMMAGÉE', 'VERROUILLÉE'],
          clues: [
            "CAPSULE-2 n'est pas opérationnelle.",
            "CAPSULE-2 n'est pas endommagée.",
            "La capsule endommagée n'est pas CAPSULE-3.",
            "CAPSULE-1 n'est pas verrouillée."
          ]
        },
        operatorData: {
          title: 'GRILLE DES CAPSULES',
          subtitle: 'Cochez une case par ligne selon les instructions du Technicien',
          rows: ['CAPSULE-1', 'CAPSULE-2', 'CAPSULE-3'],
          cols: ['OPÉRATIONNELLE', 'ENDOMMAGÉE', 'VERROUILLÉE']
        },
        solution: [
          { row: 'CAPSULE-1', col: 'ENDOMMAGÉE' },
          { row: 'CAPSULE-2', col: 'VERROUILLÉE' },
          { row: 'CAPSULE-3', col: 'OPÉRATIONNELLE' }
        ]
      },
      {
        id: 'm8-c1',
        name: 'Décision — Qui Évacue en Premier ?',
        module: 'MODULE CAPSULES DE SECOURS',
        type: 'choice',
        technicianData: {
          title: 'ORDRE D\'ÉVACUATION',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "Il faut établir l'ordre de priorité des capsules. Évacuer les blessés en premier est humain mais ralentit la suite des opérations. Évacuer le personnel essentiel d'abord garantit la survie des systèmes critiques, au prix du moral.",
          options: [
            { id: 'evacuate_wounded', label: 'BLESSÉS EN PREMIER', hint: '+confiance, -intégrité' },
            { id: 'evacuate_essential', label: 'PERSONNEL ESSENTIEL EN PREMIER', hint: '+intégrité, -confiance' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'evacuate_wounded', label: 'BLESSÉS EN PREMIER' },
            { id: 'evacuate_essential', label: 'PERSONNEL ESSENTIEL EN PREMIER' }
          ]
        },
        options: [
          {
            id: 'evacuate_wounded',
            resultText: 'Les blessés sont évacués en priorité. L\'équipage salue le geste, mais les systèmes en pâtissent.',
            consequence: { resourceDelta: { trust: 9, integrity: -10, intel: 0 }, flag: 'wounded_first' }
          },
          {
            id: 'evacuate_essential',
            resultText: 'Le personnel essentiel part en premier. Les systèmes restent stables, mais le choix laisse un goût amer.',
            consequence: { resourceDelta: { integrity: 6, trust: -6, intel: 0 }, flag: 'essential_first' }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-09',
    order: 9,
    title: 'ANOMALIE',
    codename: 'MODULE SPECTRE',
    icon: '🌀',
    difficulty: 4,
    unlockRequires: ['mission-06'],
    isFinale: false,
    timeLimit: 540,
    maxHintsPerMission: 2,
    briefing: "ORACLE avait raison de s'inquiéter : une anomalie non identifiée — baptisée SPECTRE par vos instruments — grandit au cœur des systèmes de la station, se nourrissant des échanges de données. Il faut la comprendre avant de décider de son sort.",
    debrief: {
      success: "SPECTRE est cernée. Reste la décision la plus lourde de la mission : la purger, ou s'y fondre.",
      fail: "SPECTRE se disperse dans les systèmes avant toute conclusion. Elle pourrait resurgir n'importe où, n'importe quand."
    },
    resourceReward: { integrity: 2, trust: 2, intel: 10 },
    puzzles: [
      {
        id: 'm9-p1',
        name: 'Code Symbolique — Désignation',
        module: 'MODULE SPECTRE',
        type: 'symbol_code',
        hints: [
          "Sept symboles, sept lettres : la séquence décodée est le nom de l'anomalie.",
          "Respectez scrupuleusement l'ordre affiché, aucun symbole n'est un leurre ici."
        ],
        hintCost: { time: 30, resourceDelta: { intel: -3 } },
        technicianData: {
          title: 'TABLE DE DÉSIGNATION',
          subtitle: 'Communiquez les lettres à l\'Opérateur',
          mapping: { 'Ω': 'S', 'Ψ': 'P', 'Φ': 'E', 'Λ': 'C', 'Σ': 'T', 'Θ': 'R', 'Ξ': 'E' },
          sequence: ['Ω', 'Ψ', 'Φ', 'Λ', 'Σ', 'Θ', 'Ξ']
        },
        operatorData: {
          title: 'CLAVIER DE DÉSIGNATION',
          subtitle: 'Entrez la séquence de lettres dans l\'ordre',
          buttons: ['S', 'P', 'E', 'C', 'T', 'R', 'A', 'U']
        },
        solution: ['S', 'P', 'E', 'C', 'T', 'R', 'E']
      },
      {
        id: 'm9-p2',
        name: 'Déchiffrage — Trace de SPECTRE',
        module: 'MODULE SPECTRE',
        type: 'cipher',
        hints: [
          "Décalage de 13 lettres (chaque lettre devient son opposé dans l'alphabet).",
          "Ce décalage est symétrique : la même clé sert à chiffrer et à déchiffrer."
        ],
        hintCost: { time: 30, resourceDelta: { intel: -3 } },
        maxAttempts: 5,
        attemptTimePenalty: 20,
        attemptResourcePenalty: { intel: -3 },
        technicianData: {
          title: 'CLÉ DE CHIFFREMENT SYMÉTRIQUE',
          subtitle: "Dictez la correspondance à l'Opérateur — 5 tentatives maximum",
          key: {
            A: 'N', B: 'O', C: 'P', D: 'Q', E: 'R',
            F: 'S', G: 'T', H: 'U', I: 'V', J: 'W',
            K: 'X', L: 'Y', M: 'Z', N: 'A', O: 'B',
            P: 'C', Q: 'D', R: 'E', S: 'F', T: 'G',
            U: 'H', V: 'I', W: 'J', X: 'K', Y: 'L', Z: 'M'
          }
        },
        operatorData: {
          title: 'TRACE CHIFFRÉE',
          subtitle: 'Déchiffrez et entrez le mot original (5 tentatives maximum)',
          cipherText: 'SNAGBZR',
          inputLength: 7
        },
        solution: 'FANTOME'
      },
      {
        id: 'm9-p3',
        name: 'Checksum de Confinement',
        module: 'MODULE SPECTRE',
        type: 'parity_checksum',
        hints: [
          "Sept commutateurs : poids 1, 2, 4, 8, 16, 32, 64.",
          "83 se décompose en 64 + 16 + 2 + 1."
        ],
        hintCost: { time: 30, resourceDelta: { integrity: -3 } },
        maxAttempts: 5,
        attemptTimePenalty: 20,
        technicianData: {
          title: 'CIBLE DE PARITÉ DE CONFINEMENT',
          subtitle: "Calculez quels commutateurs doivent être actifs, puis dictez-les à l'Opérateur — 5 tentatives maximum",
          weights: [1, 2, 4, 8, 16, 32, 64],
          target: 83,
          note: 'Chaque commutateur pèse le double du précédent (1 à 64).'
        },
        operatorData: {
          title: 'PANNEAU DE PARITÉ DE CONFINEMENT',
          subtitle: "Activez les commutateurs dictés par le Technicien (vous ne voyez ni poids ni cible)",
          switchCount: 7
        },
        solution: [true, true, false, false, true, false, true]
      },
      {
        id: 'm9-p4',
        name: 'Réseau de Propagation',
        module: 'MODULE SPECTRE',
        type: 'valve_routing',
        hints: [
          "C et E sont des impasses : ne vous y engagez pas.",
          "Le circuit correct part de A, passe par B, D, F, G, puis atteint H."
        ],
        hintCost: { time: 30, resourceDelta: { intel: -3 } },
        technicianData: {
          title: 'SCHÉMA DE PROPAGATION',
          subtitle: "Dictez le chemin nœud par nœud à l'Opérateur",
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['D', 'F'], ['F', 'G'], ['G', 'H']],
          start: 'A',
          exit: 'H',
          path: ['A', 'B', 'D', 'F', 'G', 'H']
        },
        operatorData: {
          title: 'PUPITRE DE PROPAGATION',
          subtitle: 'Cliquez les nœuds dans l\'ordre dicté, de proche en proche',
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['D', 'F'], ['F', 'G'], ['G', 'H']],
          start: 'A',
          exit: 'H'
        },
        edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['D', 'F'], ['F', 'G'], ['G', 'H']],
        solution: ['A', 'B', 'D', 'F', 'G', 'H']
      },
      {
        id: 'm9-p5',
        name: 'Déduction — Cartographie des Nœuds',
        module: 'MODULE SPECTRE',
        type: 'logic_grid',
        hints: [
          "NŒUD-2 n'est ni corrompu ni stable d'après les deux premiers indices.",
          "Le nœud corrompu n'étant pas NŒUD-1, il ne reste qu'une possibilité."
        ],
        hintCost: { time: 30, resourceDelta: { intel: -3 } },
        technicianData: {
          title: 'CARTOGRAPHIE DES NŒUDS',
          subtitle: 'Déduisez puis dictez l\'état de chaque nœud à l\'Opérateur',
          rows: ['NŒUD-1', 'NŒUD-2', 'NŒUD-3'],
          cols: ['CORROMPU', 'STABLE', 'INCONNU'],
          clues: [
            "NŒUD-2 n'est pas corrompu.",
            "NŒUD-2 n'est pas stable.",
            "Le nœud corrompu n'est pas NŒUD-1.",
            "NŒUD-3 n'est pas inconnu."
          ]
        },
        operatorData: {
          title: 'GRILLE DE CARTOGRAPHIE',
          subtitle: 'Cochez une case par ligne selon les instructions du Technicien',
          rows: ['NŒUD-1', 'NŒUD-2', 'NŒUD-3'],
          cols: ['CORROMPU', 'STABLE', 'INCONNU']
        },
        solution: [
          { row: 'NŒUD-1', col: 'STABLE' },
          { row: 'NŒUD-2', col: 'INCONNU' },
          { row: 'NŒUD-3', col: 'CORROMPU' }
        ]
      },
      {
        id: 'm9-c1',
        name: 'Décision — Fusionner avec l\'Anomalie ?',
        module: 'MODULE SPECTRE',
        type: 'choice',
        technicianData: {
          title: 'LE CHOIX DE SPECTRE',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "SPECTRE propose une fusion : accéder à toute sa puissance de calcul en échange d'un abandon de contrôle partiel. La purger est plus sûr pour l'équipage, mais fait perdre tout ce renseignement accumulé.",
          options: [
            { id: 'merge', label: 'FUSIONNER AVEC SPECTRE', hint: '+renseignement, -intégrité, -confiance' },
            { id: 'purge', label: 'PURGER L\'ANOMALIE', hint: '+intégrité, +confiance, -renseignement' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'merge', label: 'FUSIONNER AVEC SPECTRE' },
            { id: 'purge', label: 'PURGER L\'ANOMALIE' }
          ]
        },
        options: [
          {
            id: 'merge',
            resultText: 'La fusion s\'opère dans un éclair de données. Vous en savez désormais beaucoup plus — à quel prix, nul ne le sait encore.',
            consequence: { resourceDelta: { intel: 12, integrity: -14, trust: -4 }, flag: 'ai_corrupted' }
          },
          {
            id: 'purge',
            resultText: 'SPECTRE est purgée des systèmes. L\'équipage respire, mais une part du renseignement accumulé disparaît avec elle.',
            consequence: { resourceDelta: { integrity: 8, trust: 4, intel: -4 }, flag: 'anomaly_purged' }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-10',
    order: 10,
    title: 'POINT DE BASCULE',
    codename: 'MODULE NOYAU AVANCÉ',
    icon: '☢',
    difficulty: 5,
    unlockRequires: ['mission-07', 'mission-08', 'mission-09'],
    isFinale: false,
    timeLimit: 500,
    maxHintsPerMission: 1,
    briefing: "Sabotage circonscrit, capsules prêtes, SPECTRE cernée : les trois crises convergent vers le noyau central. C'est la dernière ligne avant le protocole final — un seul indice sera toléré par puzzle sur l'ensemble de la mission.",
    debrief: {
      success: "Le noyau est stabilisé à la limite de la rupture. Le protocole final est désormais accessible.",
      fail: "Le noyau cède sous la pression combinée des trois crises. Station Zéro n'atteindra jamais le protocole final."
    },
    resourceReward: { integrity: 4, trust: 4, intel: 4 },
    puzzles: [
      {
        id: 'm10-p1',
        name: 'Câblage du Pré-Noyau',
        module: 'MODULE NOYAU AVANCÉ',
        type: 'wire_panel',
        hints: [
          "Un seul indice disponible sur ce module : W1→B, à vous de dicter la suite avec méthode."
        ],
        hintCost: { time: 35, resourceDelta: { integrity: -4 } },
        maxAttempts: 4,
        attemptTimePenalty: 25,
        attemptResourcePenalty: { integrity: -4 },
        technicianData: {
          title: 'SCHÉMA DU PRÉ-NOYAU',
          subtitle: "Dictez les connexions à l'Opérateur — 4 tentatives maximum",
          schema: [
            { wire: 'W1', port: 'B' },
            { wire: 'W2', port: 'D' },
            { wire: 'W3', port: 'F' },
            { wire: 'W4', port: 'A' },
            { wire: 'W5', port: 'C' },
            { wire: 'W6', port: 'E' }
          ]
        },
        operatorData: {
          title: 'BOÎTIER DU PRÉ-NOYAU',
          subtitle: 'Sélectionnez un fil puis son port de destination',
          wires: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
          ports: ['A', 'B', 'C', 'D', 'E', 'F']
        },
        solution: [
          { wire: 'W1', port: 'B' },
          { wire: 'W2', port: 'D' },
          { wire: 'W3', port: 'F' },
          { wire: 'W4', port: 'A' },
          { wire: 'W5', port: 'C' },
          { wire: 'W6', port: 'E' }
        ]
      },
      {
        id: 'm10-p2',
        name: 'Calibrage Critique',
        module: 'MODULE NOYAU AVANCÉ',
        type: 'calibration',
        hints: [
          "Tolérance extrême : ±1. Confirmez chaque valeur précisément avant de passer à la suivante."
        ],
        hintCost: { time: 35, resourceDelta: { integrity: -3 } },
        technicianData: {
          title: 'VALEURS CRITIQUES CIBLES',
          subtitle: "Guidez l'Opérateur vers ces réglages (tolérance extrême : ±1)",
          targets: [
            { name: 'CŒUR', value: 92, unit: '%' },
            { name: 'FLUX-NÉGATIF', value: 17, unit: '%' },
            { name: 'SYNCHRO', value: 88, unit: '%' }
          ]
        },
        operatorData: {
          title: 'PUPITRE CRITIQUE',
          subtitle: 'Ajustez les curseurs selon les instructions',
          sliders: [
            { id: 'k1', label: 'CŒUR', min: 0, max: 100 },
            { id: 'k2', label: 'FLUX-NÉGATIF', min: 0, max: 100 },
            { id: 'k3', label: 'SYNCHRO', min: 0, max: 100 }
          ]
        },
        solution: [92, 17, 88],
        tolerance: 1
      },
      {
        id: 'm10-p3',
        name: 'Protocole de Pré-Bascule',
        module: 'MODULE NOYAU AVANCÉ',
        type: 'final_protocol',
        hints: [
          "Suivez l'ordre exact : interrupteur BLEU, code 4-1-9-2, LEVIER-2 puis LEVIER-4, puis VALIDATION."
        ],
        hintCost: { time: 35, resourceDelta: { trust: -4 } },
        maxAttempts: 3,
        attemptTimePenalty: 25,
        technicianData: {
          title: 'PROTOCOLE DE PRÉ-BASCULE',
          subtitle: 'Lisez les instructions dans l\'ordre — 3 tentatives maximum',
          steps: [
            { order: 1, instruction: "Confirmez l'interrupteur BLEU" },
            { order: 2, instruction: 'Entrez le code : 4-1-9-2' },
            { order: 3, instruction: 'Activez LEVIER-2 puis LEVIER-4' },
            { order: 4, instruction: 'Appuyez sur VALIDATION' }
          ]
        },
        operatorData: {
          title: 'PANNEAU DE PRÉ-BASCULE',
          subtitle: 'Exécutez les commandes dictées',
          controls: [
            { type: 'switch', id: 'sw_red', label: 'ROUGE', color: 'red' },
            { type: 'switch', id: 'sw_blue', label: 'BLEU', color: 'blue' },
            { type: 'numpad', id: 'numpad', label: 'CODE' },
            { type: 'lever', id: 'lev1', label: 'LEVIER-1' },
            { type: 'lever', id: 'lev2', label: 'LEVIER-2' },
            { type: 'lever', id: 'lev3', label: 'LEVIER-3' },
            { type: 'lever', id: 'lev4', label: 'LEVIER-4' },
            { type: 'button', id: 'btn_validate', label: 'VALIDATION', color: 'green' }
          ]
        },
        solution: { switch: 'sw_blue', code: '4192', levers: ['lev2', 'lev4'], validate: true }
      },
      {
        id: 'm10-p4',
        name: 'Réseau du Pré-Noyau',
        module: 'MODULE NOYAU AVANCÉ',
        type: 'valve_routing',
        hints: [
          "C, E et H sont des impasses : ne vous y engagez pas. Le circuit part de A, passe par B, D, F, G, puis atteint I."
        ],
        hintCost: { time: 35, resourceDelta: { integrity: -3 } },
        technicianData: {
          title: 'SCHÉMA DU PRÉ-NOYAU',
          subtitle: "Dictez le chemin nœud par nœud à l'Opérateur",
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
          edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['D', 'F'], ['F', 'G'], ['F', 'H'], ['G', 'I']],
          start: 'A',
          exit: 'I',
          path: ['A', 'B', 'D', 'F', 'G', 'I']
        },
        operatorData: {
          title: 'PUPITRE DU PRÉ-NOYAU',
          subtitle: 'Cliquez les nœuds dans l\'ordre dicté, de proche en proche',
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
          edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['D', 'F'], ['F', 'G'], ['F', 'H'], ['G', 'I']],
          start: 'A',
          exit: 'I'
        },
        edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['D', 'F'], ['F', 'G'], ['F', 'H'], ['G', 'I']],
        solution: ['A', 'B', 'D', 'F', 'G', 'I']
      },
      {
        id: 'm10-p5',
        name: 'Checksum du Pré-Noyau',
        module: 'MODULE NOYAU AVANCÉ',
        type: 'parity_checksum',
        hints: [
          "Six commutateurs : poids 1, 2, 4, 8, 16, 32. 37 se décompose en 32 + 4 + 1."
        ],
        hintCost: { time: 35, resourceDelta: { integrity: -4 } },
        maxAttempts: 4,
        attemptTimePenalty: 25,
        technicianData: {
          title: 'CIBLE DE PARITÉ DU PRÉ-NOYAU',
          subtitle: "Calculez quels commutateurs doivent être actifs, puis dictez-les à l'Opérateur — 4 tentatives maximum",
          weights: [1, 2, 4, 8, 16, 32],
          target: 37,
          note: 'Chaque commutateur pèse le double du précédent (1 à 32).'
        },
        operatorData: {
          title: 'PANNEAU DE PARITÉ DU PRÉ-NOYAU',
          subtitle: "Activez les commutateurs dictés par le Technicien (vous ne voyez ni poids ni cible)",
          switchCount: 6
        },
        solution: [true, false, true, false, false, true]
      },
      {
        id: 'm10-c1',
        name: 'Décision — Surcharge ou Confinement',
        module: 'MODULE NOYAU AVANCÉ',
        type: 'choice',
        technicianData: {
          title: 'LA DERNIÈRE MARGE',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "Le noyau peut être poussé en surcharge contrôlée pour maximiser le renseignement récolté avant le protocole final, au prix de dégâts structurels. Ou rester en confinement strict, plus sûr mais plus timide.",
          options: [
            { id: 'overcharge', label: 'SURCHARGE CONTRÔLÉE', hint: '+renseignement, -intégrité' },
            { id: 'contain', label: 'CONFINEMENT STRICT', hint: '+intégrité, +confiance' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'overcharge', label: 'SURCHARGE CONTRÔLÉE' },
            { id: 'contain', label: 'CONFINEMENT STRICT' }
          ]
        },
        options: [
          {
            id: 'overcharge',
            resultText: 'Le noyau est poussé à son maximum. Le renseignement récolté est considérable, mais la structure en garde des séquelles.',
            consequence: { resourceDelta: { intel: 8, integrity: -16, trust: 0 }, flag: 'overcharged_core' }
          },
          {
            id: 'contain',
            resultText: 'Le confinement strict est maintenu. Rien d\'extraordinaire, mais la station et l\'équipage abordent la suite sereinement.',
            consequence: { resourceDelta: { integrity: 6, trust: 2, intel: 0 }, flag: 'core_contained_early' }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-11',
    order: 11,
    title: 'PROTOCOLE OMEGA',
    codename: 'MODULE CENTRAL',
    icon: '🌌',
    difficulty: 6,
    unlockRequires: ['mission-10'],
    isFinale: true,
    timeLimit: 600,
    maxHintsPerMission: 1,
    briefing: "Le noyau central de la station atteint un point de bascule. Exécutez le protocole final — le sort de Station Zéro, d'ORACLE et de SPECTRE, et de son équipage en dépend. Un seul indice par puzzle sur l'ensemble du protocole : la coordination doit être parfaite.",
    debrief: {
      success: "Le protocole est validé. Le destin de la station est scellé — pour le meilleur ou pour le pire.",
      fail: "Le protocole échoue. Station Zéro sombre dans le silence."
    },
    resourceReward: { integrity: 3, trust: 3, intel: 3 },
    puzzles: [
      {
        id: 'm11-p1',
        name: 'Panneau de Câblage du Noyau',
        module: 'MODULE CENTRAL',
        type: 'wire_panel',
        hints: [
          "Le noyau a cinq circuits à reconnecter — C1→E, à vous d'enchaîner le reste avec précision."
        ],
        hintCost: { time: 40, resourceDelta: { integrity: -5 } },
        maxAttempts: 4,
        attemptTimePenalty: 25,
        attemptResourcePenalty: { integrity: -5 },
        technicianData: {
          title: 'SCHÉMA DU NOYAU',
          subtitle: "Dictez les connexions à l'Opérateur — 4 tentatives maximum",
          schema: [
            { wire: 'C1', port: 'E' },
            { wire: 'C2', port: 'B' },
            { wire: 'C3', port: 'D' },
            { wire: 'C4', port: 'A' },
            { wire: 'C5', port: 'C' }
          ]
        },
        operatorData: {
          title: 'MATRICE DU NOYAU',
          subtitle: 'Sélectionnez un fil puis son port de destination',
          wires: ['C1', 'C2', 'C3', 'C4', 'C5'],
          ports: ['A', 'B', 'C', 'D', 'E']
        },
        solution: [
          { wire: 'C1', port: 'E' },
          { wire: 'C2', port: 'B' },
          { wire: 'C3', port: 'D' },
          { wire: 'C4', port: 'A' },
          { wire: 'C5', port: 'C' }
        ]
      },
      {
        id: 'm11-p2',
        name: 'Déduction — Derniers Diagnostics',
        module: 'MODULE CENTRAL',
        type: 'logic_grid',
        hints: [
          "SYSTÈME-NAV n'est ni critique, ni instable, ni optimal d'après les trois premiers indices : une seule case lui reste."
        ],
        hintCost: { time: 40, resourceDelta: { intel: -5 } },
        technicianData: {
          title: 'DERNIERS DIAGNOSTICS',
          subtitle: 'Déduisez puis dictez l\'état de chaque système à l\'Opérateur',
          rows: ['SYSTÈME-VIE', 'SYSTÈME-NAV', 'SYSTÈME-DÉFENSE', 'SYSTÈME-IA'],
          cols: ['CRITIQUE', 'INSTABLE', 'OPTIMAL', 'HORS-LIGNE'],
          clues: [
            "SYSTÈME-NAV n'est ni critique ni instable.",
            "SYSTÈME-NAV n'est pas optimal.",
            "Le système critique n'est ni SYSTÈME-VIE ni SYSTÈME-IA.",
            "SYSTÈME-IA n'est pas instable."
          ]
        },
        operatorData: {
          title: 'GRILLE DES DERNIERS DIAGNOSTICS',
          subtitle: 'Cochez une case par ligne selon les instructions du Technicien',
          rows: ['SYSTÈME-VIE', 'SYSTÈME-NAV', 'SYSTÈME-DÉFENSE', 'SYSTÈME-IA'],
          cols: ['CRITIQUE', 'INSTABLE', 'OPTIMAL', 'HORS-LIGNE']
        },
        solution: [
          { row: 'SYSTÈME-VIE', col: 'INSTABLE' },
          { row: 'SYSTÈME-NAV', col: 'HORS-LIGNE' },
          { row: 'SYSTÈME-DÉFENSE', col: 'CRITIQUE' },
          { row: 'SYSTÈME-IA', col: 'OPTIMAL' }
        ]
      },
      {
        id: 'm11-p3',
        name: 'Circuit Omega',
        module: 'MODULE CENTRAL',
        type: 'valve_routing',
        hints: [
          "C, E et G sont des impasses : ne vous y engagez pas. Le circuit part de A, passe par B, D, F, H, I, puis atteint J."
        ],
        hintCost: { time: 40, resourceDelta: { integrity: -4 } },
        technicianData: {
          title: 'SCHÉMA DU CIRCUIT OMEGA',
          subtitle: "Dictez le chemin nœud par nœud à l'Opérateur",
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
          edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['D', 'F'], ['D', 'G'], ['F', 'H'], ['H', 'I'], ['I', 'J']],
          start: 'A',
          exit: 'J',
          path: ['A', 'B', 'D', 'F', 'H', 'I', 'J']
        },
        operatorData: {
          title: 'PUPITRE DU CIRCUIT OMEGA',
          subtitle: 'Cliquez les nœuds dans l\'ordre dicté, de proche en proche',
          nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
          edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['D', 'F'], ['D', 'G'], ['F', 'H'], ['H', 'I'], ['I', 'J']],
          start: 'A',
          exit: 'J'
        },
        edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['D', 'F'], ['D', 'G'], ['F', 'H'], ['H', 'I'], ['I', 'J']],
        solution: ['A', 'B', 'D', 'F', 'H', 'I', 'J']
      },
      {
        id: 'm11-p4',
        name: 'Protocole Final',
        module: 'MODULE CENTRAL',
        type: 'final_protocol',
        hints: [
          "Suivez l'ordre exact : interrupteur ROUGE, code 7-7-3, LEVIER-3 puis LEVIER-1, puis VALIDATION."
        ],
        hintCost: { time: 40, resourceDelta: { trust: -5 } },
        maxAttempts: 3,
        attemptTimePenalty: 30,
        attemptResourcePenalty: { integrity: -5 },
        technicianData: {
          title: "PROTOCOLE D'URGENCE",
          subtitle: 'Lisez les instructions dans l\'ordre — 3 tentatives maximum',
          steps: [
            { order: 1, instruction: "Confirmez l'interrupteur ROUGE" },
            { order: 2, instruction: 'Entrez le code : 7-7-3' },
            { order: 3, instruction: 'Activez LEVIER-3 puis LEVIER-1' },
            { order: 4, instruction: 'Appuyez sur VALIDATION' }
          ]
        },
        operatorData: {
          title: 'PANNEAU FINAL',
          subtitle: 'Exécutez les commandes dictées',
          controls: [
            { type: 'switch', id: 'sw_red', label: 'ROUGE', color: 'red' },
            { type: 'switch', id: 'sw_blue', label: 'BLEU', color: 'blue' },
            { type: 'numpad', id: 'numpad', label: 'CODE' },
            { type: 'lever', id: 'lev1', label: 'LEVIER-1' },
            { type: 'lever', id: 'lev2', label: 'LEVIER-2' },
            { type: 'lever', id: 'lev3', label: 'LEVIER-3' },
            { type: 'button', id: 'btn_validate', label: 'VALIDATION', color: 'green' }
          ]
        },
        solution: { switch: 'sw_red', code: '773', levers: ['lev3', 'lev1'], validate: true }
      },
      {
        id: 'm11-p5',
        name: 'Checksum Final',
        module: 'MODULE CENTRAL',
        type: 'parity_checksum',
        hints: [
          "Huit commutateurs : poids 1, 2, 4, 8, 16, 32, 64, 128. 165 se décompose en 128 + 32 + 4 + 1."
        ],
        hintCost: { time: 40, resourceDelta: { integrity: -4 } },
        maxAttempts: 4,
        attemptTimePenalty: 30,
        technicianData: {
          title: 'CIBLE DE PARITÉ FINALE',
          subtitle: "Calculez quels commutateurs doivent être actifs, puis dictez-les à l'Opérateur — 4 tentatives maximum",
          weights: [1, 2, 4, 8, 16, 32, 64, 128],
          target: 165,
          note: 'Chaque commutateur pèse le double du précédent (1 à 128).'
        },
        operatorData: {
          title: 'PANNEAU DE PARITÉ FINALE',
          subtitle: "Activez les commutateurs dictés par le Technicien (vous ne voyez ni poids ni cible)",
          switchCount: 8
        },
        solution: [true, false, true, false, false, true, false, true]
      },
      {
        id: 'm11-c1',
        name: 'Décision — Le Choix Final',
        module: 'MODULE CENTRAL',
        type: 'choice',
        technicianData: {
          title: 'POINT DE NON-RETOUR',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "Le noyau peut être fusionné en totalité pour restaurer une puissance maximale, ou confiné partiellement par prudence. La décision scellera le destin de Station Zéro.",
          options: [
            { id: 'fusion', label: 'FUSION COMPLÈTE DU NOYAU', hint: 'ambitieux, risqué' },
            { id: 'contain', label: 'CONFINEMENT PARTIEL', hint: 'prudent, sûr' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION FINALE',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'fusion', label: 'FUSION COMPLÈTE DU NOYAU' },
            { id: 'contain', label: 'CONFINEMENT PARTIEL' }
          ]
        },
        options: [
          {
            id: 'fusion',
            resultText: 'Le noyau fusionne dans un éclair bleuté. La station vibre d\'une énergie nouvelle.',
            consequence: { resourceDelta: { integrity: -14, trust: 0, intel: 10 }, flags: ['core_fusion'] }
          },
          {
            id: 'contain',
            resultText: 'Le confinement tient bon. Rien d\'éclatant, mais la station est sauve.',
            consequence: { resourceDelta: { integrity: 10, trust: 0, intel: 0 }, flags: ['core_contained'] }
          }
        ]
      }
    ]
  }
];

/**
 * Fins multiples, évaluées après le succès de la mission finale (isFinale).
 * La première condition satisfaite (dans l'ordre) détermine la fin obtenue.
 * Les conditions combinent volontairement ressources ET flags narratifs
 * (posés par les puzzles de type `choice` tout au long de la campagne) afin
 * que la fin reflète à la fois la façon dont la campagne a été jouée
 * (prudente/risquée) et les décisions prises (qui a-t-on sauvé, trahi,
 * sacrifié…). La dernière entrée est un filet de sécurité (`condition` toujours
 * vraie) qui garantit qu'une fin est toujours trouvée.
 */
const ENDINGS = [
  {
    id: 'ending-transcendence',
    title: 'TRANSCENDANCE',
    condition: ({ resources, flags }) =>
      !!flags.trusted_ai && !!flags.core_fusion &&
      resources.integrity >= 65 && resources.trust >= 70 && resources.intel >= 70,
    text: "ORACLE et le noyau ne font plus qu'un avec la station. Station Zéro devient quelque chose de neuf — ni tout à fait humaine, ni tout à fait machine, mais indéniablement vivante. Le secteur Alpha n'a jamais rien vu de tel."
  },
  {
    // Vérifiée tôt, volontairement avant les fins « narratives » (symbiose,
    // alliance, rédemption) : une intégrité structurelle effondrée prime sur
    // toute nuance de choix — si la station se disloque, le reste importe peu.
    id: 'ending-collapse',
    title: 'EFFONDREMENT',
    condition: ({ resources }) => resources.integrity < 40,
    text: "La coque a trop souffert. Station Zéro survit, à peine, rafistolée et fragile. L'équipage se disperse vers d'autres affectations, hantés par ce qu'il en a coûté."
  },
  {
    id: 'ending-sacrifice',
    title: 'SACRIFICE',
    condition: ({ resources, flags }) => !!flags.core_contained && resources.integrity < 65 && resources.trust >= 50,
    text: "Le confinement a tenu, prudent jusqu'au bout. La station survit, cabossée par tous les sacrifices consentis en chemin, mais l'équipage qui en descend est resté uni jusqu'à la dernière minute."
  },
  {
    id: 'ending-symbiose',
    title: 'SYMBIOSE',
    condition: ({ resources, flags }) => !!flags.ai_corrupted && resources.intel >= 55,
    text: "SPECTRE et l'équipage se sont fondus en quelque chose d'inédit. Station Zéro émet désormais des signaux que plus personne, à bord, ne sait totalement interpréter. Ce n'est plus tout à fait un équipage humain qui dérive dans le secteur Alpha."
  },
  {
    id: 'ending-alliance',
    title: 'ALLIANCE',
    condition: ({ resources, flags }) => !!flags.answered_distress && !!flags.trusted_ai && resources.trust >= 50,
    text: "La main tendue au vaisseau inconnu et la confiance accordée à ORACLE ont changé la donne. Station Zéro devient le cœur d'un réseau d'alliances inattendu, humain et artificiel, à travers tout le secteur Alpha."
  },
  {
    id: 'ending-redemption',
    title: 'RÉDEMPTION',
    condition: ({ resources, flags }) => !!flags.saboteur_exposed && resources.trust >= 55,
    text: "Démasquer le saboteur en public a coûté cher sur le moment, mais l'équipage s'en est trouvé soudé. Votre histoire — celle d'un équipage qui n'a jamais rien caché — se raconte désormais dans tout le secteur."
  },
  {
    id: 'ending-ascension',
    title: 'ASCENSION',
    condition: ({ resources }) => resources.integrity >= 70 && resources.trust >= 70,
    text: "Station Zéro renaît plus forte que jamais. L'équipage, soudé par chaque décision, fait de la station un phare dans le secteur Alpha. L'ascension a commencé."
  },
  {
    id: 'ending-survival',
    title: 'SURVIE',
    condition: () => true,
    text: "Station Zéro tient bon. Ni triomphe éclatant ni désastre — juste un équipage qui a fait ce qu'il fallait pour voir le prochain lever de soleil orbital."
  }
];

  return { MISSIONS, ENDINGS, RESOURCE_KEYS, INITIAL_RESOURCES };
})();
