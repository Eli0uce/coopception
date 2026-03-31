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

## 🌐 GitHub Pages

```bash
git init && git add . && git commit -m "Initial"
git remote add origin https://github.com/TON_USER/station-zero.git
git push -u origin main
```
Puis : **Settings → Pages → Source : main / root**

## ▶️ Test local

```bash
npx serve .
```

---

## 🎮 Concept
Deux joueurs sur une station spatiale en perdition :
- **Technicien** : accès aux manuels numériques, codes, clés
- **Opérateur** : contrôle les panneaux physiques, cadrans, leviers

Ni l'un ni l'autre ne peut réussir seul — communiquez via le chat intégré !

## ▶️ Lancer le jeu

```bash
cd server
npm install
npm start
```

Ouvrez **http://localhost:3000** dans deux onglets/navigateurs.

## 🧩 Les 5 puzzles
1. **Code Croisé** — Technicien lit une table de correspondance, Opérateur entre la séquence
2. **Séquence Miroir** — Technicien voit les couleurs cibles, Opérateur active les bons commutateurs
3. **Déchiffrage** — Technicien possède la clé, Opérateur déchiffre le message
4. **Calibrage** — Technicien lit les valeurs, Opérateur ajuste les curseurs
5. **Protocole Final** — Séquence complexe multi-étapes

## 📁 Structure
```
server/     → Node.js + WebSocket
client/     → HTML/CSS/JS vanilla (aucun framework)
```

