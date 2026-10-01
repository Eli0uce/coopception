# 🚀 STATION ZÉRO — Jeu coopératif asymétrique

Jeu coopératif 2 joueurs pour navigateur, inspiré de *Operation: Tango* et
*We Were Here*. Un joueur est le **🖥 Technicien** (accès aux manuels, codes,
tables de correspondance), l'autre l'**⚙ Opérateur** (contrôle les panneaux,
cadrans, leviers). Ni l'un ni l'autre ne peut réussir seul : il faut
communiquer.

Le dépôt contient **deux implémentations** :

1. **Racine du dépôt** (`index.html`, `hub.html`, `technician.html`,
   `operator.html`, `js/`, `css/`) — la **Campagne STATION ZÉRO**, 5 missions
   déblocables avec ressources de station, choix narratifs, indices,
   plusieurs fins, et sauvegarde de progression. **100 % statique**, sans
   aucun serveur : c'est la version déployée sur GitHub Pages et documentée
   ci-dessous.
2. **`legacy/`** — l'ancien prototype autonome (un seul niveau, puzzles
   aléatoires, cinématiques, chat vocal WebRTC), conservé tel quel pour
   mémoire, non maintenu.

---

## 🛰️ Architecture — tout tourne dans le navigateur

Il n'y a **plus de serveur Node/Express/WebSocket**. Le dossier `server/` a
été supprimé : toute la logique de jeu qui vivait auparavant dans
`server/campaign.js` / `server/data/missions.js` / `server/server.js` a été
portée en scripts navigateur classiques (`<script>`, pas de bundler, pas de
module) :

| Avant (Node) | Maintenant (navigateur) | Rôle |
|---|---|---|
| `server/data/missions.js` | `js/missions-data.js` (global `MissionsData`) | Données de campagne : missions, puzzles, hints, briefings, fins |
| `server/campaign.js` | `js/campaign-engine.js` (global `CampaignEngine`) | Moteur pur : déverrouillage, validation des puzzles, ressources, étoiles, fins |
| `server/server.js` (Express + `ws`) | `js/rtdb-client.js` (global `WS`) | Transport temps réel — **remplace le WebSocket par Firebase Realtime Database**, même API `connect / send / on / off` qu'avant |

`lobby.js`, `hub.js`, `technician.js`, `operator.js` et `chat.js` n'ont
quasiment pas changé : ils parlent toujours au même objet global `WS` avec
les mêmes types de messages (`room:create`, `hub:state`,
`mission:started`, `puzzle:solved`, …). Seuls les chemins de navigation
`/hub` et `/` ont été remplacés par `hub.html` et `index.html` (GitHub Pages
ne réécrit pas les chemins sans extension).

### 👑 Modèle d'autorité (qui décide quoi)

Comme il n'y a plus de serveur, **le navigateur du Technicien de chaque
room fait office d'hôte autoritaire** :

- c'est lui qui exécute `CampaignEngine` (valide les actions de puzzle,
  applique les conséquences des choix, calcule les étoiles, résout les
  fins de campagne) ;
- c'est lui qui fait tourner le **minuteur de mission** (`setInterval` de
  1 seconde, comme l'ancien serveur) ;
- il réplique le résultat de chaque action dans Firebase Realtime
  Database sous `rooms/{code}/…` ;
- l'**Opérateur n'exécute jamais de logique de jeu** : il envoie ses
  actions (`puzzle:action`, `hint:request`, `mission:start`, `hub:return`,
  `campaign:reset`) dans une file d'attente RTDB (`rooms/{code}/requests`)
  que le Technicien consomme dès qu'il est en ligne, et il se contente de
  réagir aux changements d'état répliqués par le Technicien.

Conséquence pratique : **le navigateur du Technicien doit rester ouvert**
pour que la partie progresse (minuteur, validation). S'il ferme son onglet
en pleine mission, le minuteur s'arrête jusqu'à ce qu'il revienne — en
rouvrant `technician.html`, son navigateur reconstruit l'état de mission
depuis Firebase (`session:resume`) et relance le minuteur là où il s'était
arrêté.

### 🗄️ Schéma Firebase Realtime Database

```
rooms/{code}/
  meta/            { technicianUid, operatorUid,
                     technicianOnline, operatorOnline, createdAt }
  campaign/        { resources, completedMissions, flags, ending }
  phase            'hub' | 'mission'
  mission/         runtime de la mission active (autorité Technicien) :
                   { missionId, puzzleIndex, timeLeft, totalPuzzles,
                     resources, puzzleStates, totalAttempts, totalHints,
                     choiceLog, lastEvent }
                   `lastEvent` sert de "slot" horodaté pour les
                   notifications ponctuelles (puzzle résolu/raté, indice,
                   avancée de puzzle, démarrage) que l'Opérateur détecte
                   par différence d'horodatage.
  result/          résultat de fin de mission (succès → étoiles/débrief/
                   récompenses/déblocages/fin ; échec → raison), un seul
                   slot horodaté
  roomEvent/       notifications hors-mission (room:ready, mission:aborted,
                   campaign:reset, erreurs ciblées via `onlyRole`)
  requests/{id}    file d'actions Opérateur → Technicien (consommée puis
                   supprimée par le Technicien)
  chat/{id}        messages de tchat
  progress/        dernier message `puzzle:progress` (passthrough live)
```

Toutes les lectures/écritures exigent un utilisateur Firebase Auth
authentifié (voir règles plus bas).

---

## ⚙️ Configuration Firebase (obligatoire)

Le jeu utilise **trois produits Firebase**, déjà référencés dans
`js/firebase-config.js` :

1. **Authentication → Sign-in method → Email/Password** — activez-le. La
   connexion par email/mot de passe est **obligatoire** pour créer ou
   rejoindre une room (gérée par `js/firebase-auth.js`, module
   `StationAuth`).
2. **Realtime Database** — créez une base (choisissez la région la plus
   proche ; la configuration actuelle pointe vers
   `asia-southeast1`, ajustez `databaseURL` dans `js/firebase-config.js`
   si vous créez votre propre projet). C'est la couche de synchronisation
   temps réel entre le Technicien et l'Opérateur (remplace l'ancien
   serveur WebSocket).
3. **Cloud Firestore** — activez-le en mode production. Sert uniquement à
   sauvegarder la progression de campagne par compte et par room
   (`users/{uid}/campaigns/{roomCode}`), pour pouvoir la restaurer si vous
   recréez une room avec le même compte.

Collez votre propre configuration publique dans `js/firebase-config.js` :

```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://VOTRE-PROJET-default-rtdb.VOTRE-REGION.firebasedatabase.app",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

> La clé Firebase visible dans le navigateur n'est pas un secret. La
> sécurité repose sur Authentication et sur les règles Realtime
> Database/Firestore ci-dessous — ne déployez jamais avec des règles
> ouvertes (`".read": true, ".write": true`) en production.

### 🔐 Règles Realtime Database (à coller dans Console → Realtime Database → Règles)

Exige un utilisateur authentifié et limite chaque room à son propre
sous-arbre `rooms/{code}` :

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null",
        "chat": {
          ".indexOn": ["ts"]
        }
      }
    }
  }
}
```

### 🔐 Règles Cloud Firestore (à coller dans Console → Firestore → Règles)

Chaque utilisateur ne peut lire/écrire que ses propres sauvegardes de
campagne :

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/campaigns/{campaignId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🌐 Déploiement GitHub Pages

Aucune étape de build. Le site est servi tel quel depuis la racine du
dépôt (`.nojekyll` est présent pour éviter que Jekyll ignore les dossiers
commençant par `_`, et pour servir les fichiers tels quels).

```bash
git add . && git commit -m "Campagne 100% statique (GitHub Pages)"
git push
```

Puis : **Settings → Pages → Source : Deploy from a branch → branch
`main` / dossier `/ (root)`**.

GitHub Pages ne réécrit pas les chemins sans extension : toutes les
navigations internes utilisent donc des noms de fichiers explicites
(`hub.html`, `index.html`) plutôt que `/hub` ou `/`.

### ▶️ Test local rapide

Avec Python (déjà présent sur la plupart des systèmes) :

```bash
python3 -m http.server 8080
```

Ouvrez **http://localhost:8080** dans deux onglets/navigateurs différents
(un pour le Technicien, un pour l'Opérateur) — ou n'importe quel autre
serveur de fichiers statiques (`npx serve .`, extension "Live Server", …).
Aucune dépendance npm n'est nécessaire pour la campagne elle-même.

---

## 🎮 Déroulement

1. **Lobby** (`index.html`) — connexion email/mot de passe, puis un joueur
   crée une room (devient **Technicien**), l'autre la rejoint avec le code
   à 4 caractères (devient **Opérateur**).
2. **Hub Spatial** (`hub.html`) — dès que les deux joueurs sont connectés,
   ils arrivent sur le Hub : état de la campagne (ressources, missions
   terminées/disponibles/verrouillées) et sélection de la prochaine
   mission.
3. **Mission** (`technician.html` / `operator.html`) — les deux rôles
   résolvent ensemble les modules de la mission choisie (puzzles +
   décisions), guidés par le **Technicien** (informations) et exécutés par
   l'**Opérateur** (contrôles).
4. **Débrief** — succès (étoiles, récompenses de ressources, déblocages)
   ou échec (temps écoulé) ramène les deux joueurs au Hub pour continuer
   la campagne.

## 🗺️ Les missions

| # | Mission | Codename | Puzzles | Prérequis |
|---|---------|----------|---------|-----------|
| 1 | STATION ZÉRO | Module Réacteur | Code Croisé, Calibrage, Décision | Aucun |
| 2 | SIGNAL FANTÔME | Module Communications | Code Symbolique, Déchiffrage, Décision | Mission 1 |
| 3 | FAILLE DANS LA COQUE | Module Structure | Câblage, Calibrage, Décision | Mission 1 |
| 4 | CARGO FANTÔME | Module Amarrage | Séquence Miroir, Code Symbolique, Décision | Missions 2 & 3 |
| 5 | PROTOCOLE OMEGA (finale) | Module Central | Câblage, Protocole Final, Décision finale | Missions 1–4 |

Chaque **décision** (puzzle de type `choice`) modifie les ressources de
campagne (**Intégrité**, **Confiance**, **Renseignement**) et peut poser des
"flags" narratifs. Les ressources finales et les flags déterminent laquelle
des **4 fins** (Ascension, Rédemption, Effondrement, Survie) est obtenue à
l'issue de la mission finale.

## 🧩 Types de puzzles

| Type | Description |
|------|--------------|
| `cross_code` / `symbol_code` | Table de correspondance → séquence à saisir |
| `mirror_sequence` | Couleurs cibles → commutateurs colorés |
| `cipher` | Clé de chiffrement → mot à déchiffrer |
| `calibration` | Valeurs cibles → curseurs (tolérance ±3–4) |
| `wire_panel` | Schéma fil → port à reproduire (connexions libres) |
| `final_protocol` | Séquence multi-étapes (interrupteur + code + leviers) |
| `choice` | Dilemme narratif → conséquences sur les ressources/fins |

## 🔌 Protocole (messages `WS`, inchangés depuis la version WebSocket)

| Message → (Technicien ou Opérateur selon contexte) | Rôle |
|---|---|
| `room:create` / `room:join` | Lobby |
| `session:resume { code, role }` | Reprend l'état courant (Hub ou mission en cours) — utilisé au chargement du Hub, des pages de rôle, et après un rechargement de page |
| `mission:start { missionId }` | Démarre une mission déverrouillée |
| `puzzle:action { action }` | Soumet une réponse (Opérateur uniquement) |
| `hint:request` | Demande un indice sur le puzzle courant |
| `hub:return` | Abandonne la mission en cours, retour au Hub |
| `campaign:reset` | Réinitialise la progression de la room |
| `campaign:restore { campaign }` | Restaure une sauvegarde Firestore (Technicien, hub vide uniquement) |

| Message ← (diffusé via Firebase) | Rôle |
|---|---|
| `hub:state` | Ressources + statut de chaque mission |
| `mission:started` / `mission:resume` | Démarrage ou reprise d'une mission |
| `puzzle:next` / `puzzle:solved` / `puzzle:failed` | Progression dans la mission |
| `hint:response` | Texte d'indice |
| `mission:complete` | Étoiles, débrief, récompenses, déblocages, fin de campagne éventuelle |
| `game:over` | Échec (temps écoulé) |
| `player:disconnected` / `player:reconnected` | État de connexion de l'autre joueur |

Toute la logique (déverrouillage, validation des puzzles, ressources, fins)
vit dans `js/campaign-engine.js` + `js/missions-data.js`, exécutée par le
navigateur du Technicien — les autres scripts ne font qu'afficher l'état
reçu et envoyer des actions.

## 🔁 Reconnexion

Si un onglet se recharge, la page envoie `session:resume` avec le code de
room et le rôle stockés en `sessionStorage`. Le navigateur (Technicien ou
Opérateur) relit l'état courant dans Firebase Realtime Database et
reconstruit l'interface (Hub ou puzzle en cours). Côté Technicien, le
runtime de mission (puzzles résolus, indices utilisés, temps restant) est
entièrement reconstruit depuis `rooms/{code}/mission` et le minuteur
redémarre automatiquement.

## 🔐 Connexion et sauvegarde de campagne

La connexion email/mot de passe est obligatoire pour créer ou rejoindre
une room. La sauvegarde Firestore est mise à jour depuis le Hub après
chaque synchronisation de campagne. Un retour dans la même room restaure
la progression sauvegardée lorsque la campagne n'a pas encore commencé
dans cette room.

## 📁 Structure du dépôt

```
index.html            → Lobby (connexion + création/jonction de room)
hub.html              → Hub Spatial (état de campagne, sélection de mission)
technician.html       → Rôle Technicien
operator.html         → Rôle Opérateur
.nojekyll             → Désactive le traitement Jekyll sur GitHub Pages

js/
  firebase-config.js   → Clés Firebase publiques (à configurer)
  firebase-auth.js      → StationAuth : Auth email/mot de passe + sauvegarde Firestore
  missions-data.js      → Données de campagne (ex server/data/missions.js)
  campaign-engine.js     → Moteur de campagne pur (ex server/campaign.js)
  rtdb-client.js         → Transport temps réel Firebase RTDB (remplace WS/serveur,
                           global `WS` avec la même API que l'ancien ws-client.js)
  lobby.js / hub.js / technician.js / operator.js → Logique par page
  chat.js                → Chat texte partagé
  hub-scene.js           → Décor 3D Three.js du Hub (module ES)
  vendor/three.module.min.js → Three.js (fichier local, pas de CDN)

css/
  main.css / hub.css / technician.css / operator.css → Thèmes (vert
  Technicien, ambre Opérateur, bleu Hub)

legacy/                 → Ancien prototype autonome (Firebase RTDB, puzzles
                           aléatoires, cinématiques, chat vocal WebRTC) —
                           conservé pour mémoire, non maintenu, non lié à
                           la campagne ci-dessus. Mêmes noms de fichiers
                           (`js/`, `css/`, `index.html`, …) mais isolés
                           dans leur propre dossier pour éviter toute
                           collision avec la campagne servie à la racine.
```

> Le dossier `server/` (Express + `ws`, serveur WebSocket Node.js) a été
> **supprimé** : toute sa logique vit maintenant dans `js/campaign-engine.js`
> et `js/missions-data.js`, et son rôle de transport est assuré par
> Firebase Realtime Database via `js/rtdb-client.js`. Le jeu est
> entièrement jouable sans Node, serveur ni étape de build.
