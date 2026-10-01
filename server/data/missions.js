/**
 * missions.js — Définitions de la campagne "STATION ZÉRO"
 *
 * Modèle de données autoritaire côté serveur. Chaque mission contient :
 *  - des métadonnées de scénario (briefing, debrief, icône, difficulté)
 *  - des conditions de déverrouillage (unlockRequires)
 *  - une liste de puzzles (mêmes types que le v1 + symbol_code / wire_panel / choice)
 *  - une récompense de ressources en cas de succès
 *
 * Les ressources de campagne sont : integrity (intégrité structurelle),
 * trust (confiance de l'équipage) et intel (renseignement).
 * Elles évoluent via les puzzles de type "choice" et les récompenses de mission.
 */

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
    briefing: "Le générateur de secours de la station orbitale est tombé en panne. Réactivez les modules critiques avant la dépressurisation totale.",
    debrief: {
      success: "Le réacteur ronronne de nouveau. La station tient — pour l'instant.",
      fail: "Le temps est écoulé. Le réacteur reste hors-ligne, la station dérive dans le noir."
    },
    resourceReward: { integrity: 10, trust: 0, intel: 5 },
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
          "La tolérance est de ±3, inutile d'être pixel-parfait."
        ],
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
        tolerance: 3
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
    timeLimit: 540,
    briefing: "Un signal non identifié brouille les communications de la station. Identifiez-le et sécurisez le relais avant qu'il ne compromette tous les systèmes.",
    debrief: {
      success: "Le relais est sécurisé. La station peut de nouveau émettre vers le secteur Alpha.",
      fail: "Le brouillage persiste. Les communications de la station sont coupées du reste du secteur."
    },
    resourceReward: { integrity: 0, trust: 5, intel: 15 },
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
          "La clé donne la correspondance lettre-originale → lettre-chiffrée.",
          "Déchiffrez lettre par lettre en cherchant la clé qui produit le caractère chiffré."
        ],
        technicianData: {
          title: 'CLÉ DE CHIFFREMENT',
          subtitle: "Dictez la correspondance à l'Opérateur",
          key: {
            A: 'M', B: 'X', C: 'Z', D: 'P', E: 'K',
            F: 'T', G: 'R', H: 'W', I: 'N', J: 'Q',
            K: 'F', L: 'Y', M: 'A', N: 'I', O: 'C',
            P: 'D', Q: 'J', R: 'G', S: 'S', T: 'F',
            U: 'U', V: 'V', W: 'H', X: 'B', Y: 'L', Z: 'E'
          }
        },
        operatorData: {
          title: 'MESSAGE CHIFFRÉ',
          subtitle: 'Déchiffrez et entrez le mot original',
          cipherText: 'GKYMN',
          inputLength: 5
        },
        solution: 'RELAI'
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
            consequence: { resourceDelta: { integrity: -6, trust: 10, intel: 0 }, flag: 'answered_distress' }
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
    timeLimit: 600,
    briefing: "Une micro-météorite a percé la coque externe. Rerouter les conduits endommagés et colmater la brèche avant que la décompression ne s'aggrave.",
    debrief: {
      success: "La brèche est colmatée, les conduits rerouté. La coque tiendra le choc suivant.",
      fail: "La décompression s'est généralisée. Le module structure est perdu."
    },
    resourceReward: { integrity: 15, trust: 0, intel: 0 },
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
        tolerance: 4
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
            consequence: { resourceDelta: { integrity: 8, trust: -6, intel: 0 }, timeDelta: 40 }
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
    title: 'CARGO FANTÔME',
    codename: 'MODULE AMARRAGE',
    icon: '🛰',
    difficulty: 3,
    unlockRequires: ['mission-02', 'mission-03'],
    isFinale: false,
    timeLimit: 660,
    briefing: "Un cargo dérivant a été détecté à l'amarrage. Aucune réponse de son équipage. Explorez ses systèmes et décidez du sort de ce qu'il transporte.",
    debrief: {
      success: "Le cargo est sécurisé et arrimé. Son secret vous appartient désormais.",
      fail: "L'amarrage a échoué. Le cargo dérive de nouveau dans le vide, ses secrets perdus."
    },
    resourceReward: { integrity: 0, trust: 10, intel: 10 },
    puzzles: [
      {
        id: 'm4-p1',
        name: 'Séquence Miroir',
        module: 'MODULE AMARRAGE',
        type: 'mirror_sequence',
        hints: [
          "La séquence cible est une suite de couleurs : reproduisez-la exactement dans le même ordre.",
          "Deux boutons peuvent partager la même couleur : appuyez sur l'un ou l'autre, seule la couleur compte."
        ],
        technicianData: {
          title: 'SÉQUENCE CIBLE',
          subtitle: "Guidez l'Opérateur dans l'ordre exact",
          sequence: ['bleu', 'vert', 'rouge', 'jaune', 'bleu']
        },
        operatorData: {
          title: 'PANNEAU DE COMMANDE',
          subtitle: 'Activez les commutateurs selon les instructions',
          buttons: [
            { label: 'VENT-A', color: 'vert' },
            { label: 'SYS-R', color: 'rouge' },
            { label: 'FLUX-J', color: 'jaune' },
            { label: 'CIRC-B', color: 'bleu' },
            { label: 'PMP-V', color: 'vert' },
            { label: 'ARC-B', color: 'bleu' }
          ]
        },
        solution: ['CIRC-B', 'VENT-A', 'SYS-R', 'FLUX-J', 'ARC-B']
      },
      {
        id: 'm4-p2',
        name: 'Code Symbolique',
        module: 'MODULE AMARRAGE',
        type: 'symbol_code',
        hints: [
          "Il s'agit du même principe que le code d'authentification : symbole → lettre.",
          "Vérifiez bien l'ordre affiché dans la séquence cible avant de valider."
        ],
        technicianData: {
          title: 'SAS DE DÉVERROUILLAGE',
          subtitle: 'Communiquez les lettres à l\'Opérateur',
          mapping: { '✦': 'D', '✧': 'O', '❖': 'C', '❈': 'K', '❂': 'S' },
          sequence: ['❖', '✦', '✧', '❂']
        },
        operatorData: {
          title: 'CLAVIER DU SAS',
          subtitle: 'Entrez la séquence de lettres dans l\'ordre',
          buttons: ['D', 'O', 'C', 'K', 'S', 'B', 'Y', 'L']
        },
        solution: ['C', 'D', 'O', 'S']
      },
      {
        id: 'm4-c1',
        name: 'Décision — Survivant en Cryo',
        module: 'MODULE AMARRAGE',
        type: 'choice',
        technicianData: {
          title: 'DÉCOUVERTE À BORD',
          subtitle: 'Lisez le dilemme à l\'Opérateur et décidez ensemble',
          narrative: "Un survivant est trouvé en sommeil cryogénique. Le réveiller maintenant consomme de l'énergie et comporte un risque médical inconnu. Le laisser en cryo jusqu'au retour à la station est plus sûr mais pourrait être perçu comme un abandon.",
          options: [
            { id: 'wake', label: 'RÉVEILLER MAINTENANT', hint: '+confiance, -intégrité' },
            { id: 'leave', label: 'LAISSER EN CRYO', hint: '-confiance, sûr' }
          ]
        },
        operatorData: {
          title: 'CONSOLE DE DÉCISION',
          subtitle: 'Sélectionnez l\'option validée avec le Technicien',
          options: [
            { id: 'wake', label: 'RÉVEILLER MAINTENANT' },
            { id: 'leave', label: 'LAISSER EN CRYO' }
          ]
        },
        options: [
          {
            id: 'wake',
            resultText: 'Le survivant se réveille, désorienté mais vivant. L\'équipage salue le geste — l\'énergie dépensée fragilise un peu la station.',
            consequence: { resourceDelta: { integrity: -5, trust: 12, intel: 5 }, flag: 'saved_survivor' }
          },
          {
            id: 'leave',
            resultText: 'Le caisson reste fermé. Plus sûr, mais un froid s\'installe parmi l\'équipage à l\'idée de l\'avoir laissé.',
            consequence: { resourceDelta: { integrity: 0, trust: -10, intel: 2 } }
          }
        ]
      }
    ]
  },

  {
    id: 'mission-05',
    order: 5,
    title: 'PROTOCOLE OMEGA',
    codename: 'MODULE CENTRAL',
    icon: '🌌',
    difficulty: 4,
    unlockRequires: ['mission-01', 'mission-02', 'mission-03', 'mission-04'],
    isFinale: true,
    timeLimit: 720,
    briefing: "Le noyau central de la station atteint un point de bascule. Exécutez le protocole final — le sort de Station Zéro et de son équipage en dépend.",
    debrief: {
      success: "Le protocole est validé. Le destin de la station est scellé — pour le meilleur ou pour le pire.",
      fail: "Le protocole échoue. Station Zéro sombre dans le silence."
    },
    resourceReward: { integrity: 5, trust: 5, intel: 5 },
    puzzles: [
      {
        id: 'm5-p1',
        name: 'Panneau de Câblage du Noyau',
        module: 'MODULE CENTRAL',
        type: 'wire_panel',
        hints: [
          "Le noyau a cinq circuits à reconnecter — prenez-les un par un avec le Technicien.",
          "Un fil peut être débranché en le resélectionnant avant de choisir un nouveau port."
        ],
        technicianData: {
          title: 'SCHÉMA DU NOYAU',
          subtitle: "Dictez les connexions à l'Opérateur",
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
        id: 'm5-p2',
        name: 'Protocole Final',
        module: 'MODULE CENTRAL',
        type: 'final_protocol',
        hints: [
          "Suivez l'ordre des étapes affichées, une à la fois, sans en sauter.",
          "Le bouton VALIDATION doit toujours être la dernière action."
        ],
        technicianData: {
          title: "PROTOCOLE D'URGENCE",
          subtitle: 'Lisez les instructions dans l\'ordre',
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
        id: 'm5-c1',
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
            consequence: { resourceDelta: { integrity: -5, trust: 0, intel: 10 }, flag: 'core_fusion' }
          },
          {
            id: 'contain',
            resultText: 'Le confinement tient bon. Rien d\'éclatant, mais la station est sauve.',
            consequence: { resourceDelta: { integrity: 8, trust: 0, intel: 0 }, flag: 'core_contained' }
          }
        ]
      }
    ]
  }
];

/**
 * Fins multiples, évaluées après le succès de la mission finale (isFinale).
 * La première condition satisfaite (dans l'ordre) détermine la fin obtenue.
 */
const ENDINGS = [
  {
    id: 'ending-ascension',
    title: 'ASCENSION',
    condition: ({ resources, flags }) => resources.integrity >= 70 && resources.trust >= 70,
    text: "Station Zéro renaît plus forte que jamais. L'équipage, soudé par chaque décision, fait de la station un phare dans le secteur Alpha. L'ascension a commencé."
  },
  {
    id: 'ending-redemption',
    title: 'RÉDEMPTION',
    condition: ({ resources, flags }) => !!flags.saved_survivor && resources.trust >= 50,
    text: "Les sacrifices ont payé. Le survivant réveillé raconte votre histoire à travers tout le secteur : celle d'un équipage qui n'a jamais abandonné personne."
  },
  {
    id: 'ending-collapse',
    title: 'EFFONDREMENT',
    condition: ({ resources }) => resources.integrity < 40,
    text: "La coque a trop souffert. Station Zéro survit, à peine, rafistolée et fragile. L'équipage se disperse vers d'autres affectations, hantés par ce qu'il en a coûté."
  },
  {
    id: 'ending-survival',
    title: 'SURVIE',
    condition: () => true,
    text: "Station Zéro tient bon. Ni triomphe éclatant ni désastre — juste un équipage qui a fait ce qu'il fallait pour voir le prochain lever de soleil orbital."
  }
];

module.exports = { MISSIONS, ENDINGS, RESOURCE_KEYS, INITIAL_RESOURCES };
