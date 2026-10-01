/* Firebase Authentication + Firestore campaign saves. */
const StationAuth = (() => {
  let auth;
  let db;
  let ready;

  function init() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
        auth.onAuthStateChanged(resolve);
      } catch (error) {
        reject(error);
      }
    });
    return ready;
  }

  async function currentUser() {
    await init();
    return auth.currentUser;
  }

  async function signIn(email, password) {
    await init();
    return auth.signInWithEmailAndPassword(email, password);
  }

  async function signUp(email, password) {
    await init();
    return auth.createUserWithEmailAndPassword(email, password);
  }

  async function signOut() {
    await init();
    await auth.signOut();
  }

  async function saveCampaign(roomCode, payload) {
    const user = await currentUser();
    if (!user || !roomCode || !payload) return;
    await db.collection('users').doc(user.uid).collection('campaigns').doc(roomCode).set({
      ...payload,
      roomCode,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function loadCampaign(roomCode) {
    const user = await currentUser();
    if (!user || !roomCode) return null;
    const snapshot = await db.collection('users').doc(user.uid).collection('campaigns').doc(roomCode).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  function errorMessage(error) {
    const messages = {
      'auth/invalid-email': 'Adresse email invalide.',
      'auth/user-not-found': 'Compte introuvable.',
      'auth/wrong-password': 'Mot de passe incorrect.',
      'auth/email-already-in-use': 'Cette adresse est déjà utilisée.',
      'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.'
    };
    return messages[error.code] || 'Connexion Firebase impossible.';
  }

  return { init, currentUser, signIn, signUp, signOut, saveCampaign, loadCampaign, errorMessage };
})();
