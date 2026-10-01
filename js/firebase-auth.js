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

  async function signInWithGoogle() {
    await init();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      return await auth.signInWithPopup(provider);
    } catch (error) {
      // Popup bloquée/fermée : bascule sur la redirection (utile sur mobile)
      const fallback = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];
      if (fallback.includes(error.code)) {
        await auth.signInWithRedirect(provider);
        return null;
      }
      throw error;
    }
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
      'auth/popup-closed-by-user': 'Connexion annulée.',
      'auth/cancelled-popup-request': 'Connexion annulée.',
      'auth/popup-blocked': 'La fenêtre Google a été bloquée par le navigateur.',
      'auth/unauthorized-domain': "Ce domaine n'est pas autorisé dans Firebase Authentication.",
      'auth/account-exists-with-different-credential': 'Un compte existe déjà avec cette adresse.',
      'auth/network-request-failed': 'Réseau indisponible.'
    };
    return messages[error.code] || 'Connexion Google impossible.';
  }

  return { init, currentUser, signInWithGoogle, signOut, saveCampaign, loadCampaign, errorMessage };
})();
