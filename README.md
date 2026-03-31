# 🚀 STATION ZÉRO — Jeu coopératif asymétrique

Jeu coopératif 2 joueurs pour navigateur, inspiré de *Operation: Tango* et *We Were Here*.  
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
  technician.css      → Styles thème vert (Technicien)
  operator.css        → Styles thème ambre (Opérateur)
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
