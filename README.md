# 🚀 STATION ZÉRO — Jeu coopératif asymétrique

## 🔐 Connexion et sauvegarde Firebase

La version WebSocket actuelle utilise Firebase Authentication pour identifier les joueurs et
Cloud Firestore pour sauvegarder la progression de campagne par compte et par room.

1. Dans Firebase Console, activez **Authentication → Sign-in method → Email/Password**.
2. Activez **Cloud Firestore** en mode production.
3. Conservez la configuration publique dans `client/js/firebase-config.js`.
4. Ajoutez ces règles Firestore (les utilisateurs ne peuvent lire et écrire que leurs sauvegardes) :

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

La connexion est obligatoire pour créer ou rejoindre une room. La sauvegarde est mise à jour
depuis le Hub après chaque synchronisation de campagne. Un retour dans la même room restaure
la progression sauvegardée lorsque la campagne n'a pas encore commencé. La progression en
cours reste également maintenue en mémoire par le serveur pour permettre la reconnexion des
deux joueurs.

> La clé Firebase visible dans le navigateur n'est pas un secret. La sécurité repose sur
> Authentication et les règles Firestore ; ne laissez pas de règles publiques en production.

Jeu coopératif 2 joueurs pour navigateur, inspiré de *Operation: Tango* et *We Were Here*.

Ce dépôt contient **deux implémentations** :

1. **`client/` + `server/`** — version active, avec **serveur Node/WebSocket
   autoritaire** et une **campagne à missions multiples** (recommandée, voir
   ci-dessous).
2. **Racine du dépôt** (`index.html`, `js/`, `css/`) — version historique
   autonome basée sur **Firebase Realtime Database**, sans serveur de jeu
   (documentée plus bas, section *Version historique*).

---

## 🛰️ Version Campagne (client/ + server/) — recommandée

Un serveur Node.js **autoritaire** (aucune logique de jeu côté client) gère
une **campagne** de 5 missions déblocables, avec ressources de station,
choix narratifs à conséquences, indices, plusieurs fins, et reprise de
session après rechargement de page.

### ▶️ Lancer le serveur

```bash
cd server
npm install
npm start          # ou : npm run dev
```

Ouvrez **http://localhost:3000** dans deux onglets/navigateurs différents
(un pour le Technicien, un pour l'Opérateur).

### 🎮 Déroulement

1. **Lobby** (`/`) — un joueur crée une room (devient **Technicien**), l'autre
   la rejoint avec le code à 4 caractères (devient **Opérateur**).
2. **Hub Spatial** (`/hub`) — dès que les deux joueurs sont connectés, ils
   arrivent sur le Hub : état de la campagne (ressources, missions
   terminées/disponibles/verrouillées) et sélection de la prochaine mission.
   L'état du Hub est entièrement calculé et envoyé par le serveur.
3. **Mission** (`technician.html` / `operator.html`) — les deux rôles
   résolvent ensemble les modules de la mission choisie (puzzles + décisions),
   guidés par le **Technicien** (informations) et exécutés par l'**Opérateur**
   (contrôles).
4. **Débrief** — succès (étoiles, récompenses de ressources, déblocages) ou
   échec (temps écoulé) ramène les deux joueurs au Hub pour continuer la
   campagne.

### 🗺️ Les missions

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

### 🧩 Types de puzzles

| Type | Description |
|------|--------------|
| `cross_code` / `symbol_code` | Table de correspondance → séquence à saisir |
| `mirror_sequence` | Couleurs cibles → commutateurs colorés |
| `cipher` | Clé de chiffrement → mot à déchiffrer |
| `calibration` | Valeurs cibles → curseurs (tolérance ±3–4) |
| `wire_panel` | Schéma fil → port à reproduire (connexions libres) |
| `final_protocol` | Séquence multi-étapes (interrupteur + code + leviers) |
| `choice` | Dilemme narratif → conséquences sur les ressources/fins |

### 🔌 Protocole WebSocket (aperçu)

| Message client → serveur | Rôle |
|---|---|
| `room:create` / `room:join` | Lobby |
| `session:resume { code, role }` | Reprend l'état courant (Hub ou mission en cours) — utilisé au chargement du Hub, des pages de rôle, et après un rechargement de page (reconnexion) |
| `mission:start { missionId }` | Démarre une mission déverrouillée |
| `puzzle:action { action }` | Soumet une réponse (Opérateur uniquement) |
| `hint:request` | Demande un indice sur le puzzle courant |
| `hub:return` | Abandonne la mission en cours, retour au Hub |
| `campaign:reset` | Réinitialise la progression de la room |

| Message serveur → client | Rôle |
|---|---|
| `hub:state` | Ressources + statut de chaque mission |
| `mission:started` / `mission:resume` | Démarrage ou reprise d'une mission |
| `puzzle:next` / `puzzle:solved` / `puzzle:failed` | Progression dans la mission |
| `hint:response` | Texte d'indice |
| `mission:complete` | Étoiles, débrief, récompenses, déblocages, fin de campagne éventuelle |
| `game:over` | Échec (temps écoulé) |
| `player:disconnected` / `player:reconnected` | État de connexion de l'autre joueur |

Toute la logique (déverrouillage, validation des puzzles, ressources, fins)
vit côté serveur dans `server/campaign.js` et `server/data/missions.js` — le
client ne fait qu'afficher l'état reçu et envoyer des actions.

### 🔁 Reconnexion

Si un onglet se recharge ou se déconnecte brièvement, la room reste en
mémoire pendant 5 minutes. Au rechargement, la page envoie
`session:resume` avec le code de room et le rôle stockés en
`sessionStorage`, et le serveur renvoie l'état exact (Hub ou puzzle en
cours) pour reconstruire l'interface.

### 📁 Structure (`client/` + `server/`)

```
server/
  server.js          → Serveur HTTP + WebSocket, routage des messages
  campaign.js         → Moteur de campagne (déverrouillage, validation, fins)
  data/missions.js    → Définitions des 5 missions (puzzles, choix, récompenses)

client/
  index.html          → Lobby (création / jonction de room)
  hub.html / js/hub.js → Hub Spatial (état de campagne, sélection de mission)
  technician.html / js/technician.js → Rôle Technicien
  operator.html  / js/operator.js  → Rôle Opérateur
  js/ws-client.js      → Client WebSocket partagé
  js/chat.js           → Chat texte partagé
  css/                 → Thèmes (vert Technicien, ambre Opérateur, bleu Hub)
```

---

## 🕯️ Version historique (Firebase, racine du dépôt)

**Jouable à distance via Firebase + GitHub Pages — aucun serveur requis.**

---

## ⚙️ Configuration Firebase (obligatoire)

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com) → Créer un projet
2. **Realtime Database** → Créer une base → **Mode test**
3. ⚙️ Paramètres → **Ajouter une app Web** → copier `firebaseConfig`
4. Coller dans `js/firebase-config.js`
5. Règles DB : `{ "rules": { ".read": true, ".write": true } }`

---

## 🌐 Déploiement GitHub Pages

```bash
git add . && git commit -m "Initial"
git push -u origin master
```

Puis : **Settings → Pages → Source : master / root**

---

## ▶️ Test local rapide

```bash
npx serve .
```

Ouvrez **http://localhost:3000** dans deux onglets/navigateurs différents.

---

## 🎮 Concept

Deux joueurs sur une station spatiale en perdition :

| Rôle | Description |
|------|-------------|
| **🖥 Technicien** | Accès aux manuels numériques, codes, tables de correspondance |
| **⚙ Opérateur** | Contrôle les panneaux physiques, cadrans, leviers, claviers |

Ni l'un ni l'autre ne peut réussir seul — communiquez via le **chat vocal WebRTC** intégré !

---

## 🧩 Les puzzles (sélection aléatoire à chaque partie)

| Type | Difficulté | Description |
|------|-----------|-------------|
| **Code Croisé** | Facile | Table de correspondance → séquence de chiffres |
| **Symboles** | Facile | Variante avec symboles (★, ◆, ⬡...) |
| **Séquence Miroir** | Moyen | Couleurs cibles → commutateurs colorés |
| **Déchiffrage** | Moyen | Clé de chiffrement → mot à déchiffrer |
| **Calibrage** | Moyen | Valeurs cibles → ajustement de curseurs (±3 tolérance) |
| **Câblage** | Difficile | Schéma de connexions fil→port |
| **Protocole Final** | Difficile | Séquence multi-étapes (interrupteurs + code + leviers) |

Les puzzles sont **randomisés** (3–5 puzzles par partie, un par type, triés par difficulté croissante).

---

## 📖 Scénario

Station Zéro orbite autour d'Europe en 2157. Un sabotage interne déclenche une défaillance en cascade.  
Il reste **15 minutes** avant la dépressurisation totale.  
Le **Technicien (Aria)** et l'**Opérateur (Cole)** doivent réactiver les modules ensemble, sans se voir.

---

## 🔊 Fonctionnalités

- **Chat vocal WebRTC P2P** — Firebase comme serveur de signaling STUN
- **Cinématiques synchronisées** — dialogues entre puzzles, pilotés par le Technicien
- **Audio procédural** — Web Audio API (effets, alarmes, musique spatiale générative)
- **Timer adaptatif** — durée calculée selon les puzzles tirés
- **Effets visuels** — glitch, radar animé, CRT scanlines, champ d'étoiles

---

## 📁 Structure

```
index.html            → Menu principal / Lobby
technician.html       → Page du Technicien
operator.html         → Page de l'Opérateur

js/
  firebase-config.js  → Clés Firebase (à configurer)
  firebase-db.js      → Couche d'abstraction Firebase Realtime DB
  puzzles.js          → Banque de puzzles + randomisation + validation
  scenario.js         → Moteur de cinématiques synchronisées (Firebase)
  audio.js            → AudioManager complet (Web Audio API)
  voice-chat.js       → WebRTC P2P via Firebase signaling
  lobby.js            → Création / rejoindre une room
  technician.js       → Logique page Technicien
  operator.js         → Logique page Opérateur

css/
  main.css            → Variables CSS, composants partagés
  technician.css       → Styles thème vert (Technicien)
  operator.css         → Styles thème ambre (Opérateur)
```

---

## 🛡️ Règles Firebase Realtime Database

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> ⚠️ En production, restreignez l'accès par authentification Firebase.
