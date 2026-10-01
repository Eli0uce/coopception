/**
 * onboarding.js — Modale "COMMENT JOUER", partagée entre le Lobby (index.html)
 * et le Hub (hub.html). Ouverture via tout élément portant
 * `data-onboarding-trigger`, fermeture par le bouton ✕, un clic sur le fond,
 * ou la touche Échap. Purement présentationnel : aucune dépendance à WS.
 */
const Onboarding = (() => {
  function init() {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    const triggers = document.querySelectorAll('[data-onboarding-trigger]');
    const closeBtn = document.getElementById('onboarding-close');
    const startBtn = document.getElementById('onboarding-start');

    function open() {
      overlay.classList.add('visible');
      const closeTarget = closeBtn || overlay;
      if (closeTarget && closeTarget.focus) closeTarget.focus();
    }
    function close() {
      overlay.classList.remove('visible');
    }

    triggers.forEach(btn => btn.addEventListener('click', open));
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (startBtn) startBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) close();
    });

    return { open, close };
  }

  return { init };
})();
