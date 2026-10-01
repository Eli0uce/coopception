// Chat vocal WebRTC — Firebase comme serveur de signaling
const VoiceChat = (() => {
  let pc = null;
  let localStream = null;
  let myRole = null;
  let db = null;
  let roomCode = null;
  let isMuted = false;

  const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

  async function init(role, code, firebaseDb) {
    myRole = role;
    roomCode = code;
    db = firebaseDb;
    _buildUI();
    await _getMic();
    if (role === 'technician') await _createOffer();
    else await _waitForOffer();
  }

  async function _getMic() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      _setStatus('🎙 Micro actif', 'ok');
    } catch (e) {
      _setStatus('❌ Micro refusé', 'err');
      console.warn('Micro non disponible:', e);
    }
  }

  function _createPeer() {
    if (pc) { pc.close(); }
    pc = new RTCPeerConnection(ICE_SERVERS);
    if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    pc.onicecandidate = e => {
      if (e.candidate) {
        db.ref(`rooms/${roomCode}/signal/${myRole}_ice`).push(e.candidate.toJSON());
      }
    };

    pc.ontrack = e => {
      let audio = document.getElementById('sz-remote-audio');
      if (!audio) { audio = document.createElement('audio'); audio.id = 'sz-remote-audio'; audio.autoplay = true; document.body.appendChild(audio); }
      audio.srcObject = e.streams[0];
      _setStatus('🔊 Connecté', 'ok');
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected')     _setStatus('🔊 Connecté', 'ok');
      if (s === 'disconnected')  _setStatus('⚠ Déconnecté', 'warn');
      if (s === 'failed')        _setStatus('❌ Échec', 'err');
    };
    return pc;
  }

  async function _createOffer() {
    _createPeer();
    _setStatus('📡 Appel en cours...', 'warn');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await db.ref(`rooms/${roomCode}/signal/offer`).set({ sdp: offer.sdp, type: offer.type });

    // Attendre la réponse
    db.ref(`rooms/${roomCode}/signal/answer`).on('value', async snap => {
      if (!snap.exists() || pc.currentRemoteDescription) return;
      await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
    });

    // ICE de l'opérateur
    db.ref(`rooms/${roomCode}/signal/operator_ice`).on('child_added', snap => {
      if (snap.exists() && pc) pc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(() => {});
    });
  }

  async function _waitForOffer() {
    _setStatus('📡 Attente appel...', 'warn');
    db.ref(`rooms/${roomCode}/signal/offer`).on('value', async snap => {
      if (!snap.exists() || pc) return;
      _createPeer();
      await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await db.ref(`rooms/${roomCode}/signal/answer`).set({ sdp: answer.sdp, type: answer.type });
    });

    // ICE du technicien
    db.ref(`rooms/${roomCode}/signal/technician_ice`).on('child_added', snap => {
      if (snap.exists() && pc) pc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(() => {});
    });
  }

  function toggleMute() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    const btn = document.getElementById('sz-mute-btn');
    if (btn) {
      btn.textContent = isMuted ? '🔇 MUET' : '🎙 MICRO';
      btn.classList.toggle('muted', isMuted);
    }
  }

  function _buildUI() {
    const widget = document.createElement('div');
    widget.id = 'voice-widget';
    widget.innerHTML = `
      <div id="voice-status" class="voice-status">⏳ Connexion...</div>
      <button id="sz-mute-btn" class="btn" onclick="VoiceChat.toggleMute()">🎙 MICRO</button>
    `;
    document.body.appendChild(widget);
  }

  function _setStatus(text, type) {
    const el = document.getElementById('voice-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'voice-status ' + (type || '');
  }

  return { init, toggleMute };
})();

