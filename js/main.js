/* ============================================================
   main.js  –  Home Page Logic
   ● Envelope open animation
   ● Dual Countdown timers for Reception & Marriage
   ● RSVP form handler
   ============================================================ */

(function () {
  'use strict';

  // Event Dates for Priya & Vinoth
  const RECEPTION_DATE = new Date('2026-09-06T18:30:00');
  const MARRIAGE_DATE  = new Date('2026-09-07T06:00:00');

  function pad(n) { return String(n).padStart(2, '0'); }

  function updateCountdown(targetDate, prefix) {
    const now = Date.now();
    const diff = Math.max(0, targetDate.getTime() - now);

    const daysEl    = document.getElementById(`${prefix}-days`);
    const hoursEl   = document.getElementById(`${prefix}-hours`);
    const minutesEl = document.getElementById(`${prefix}-minutes`);
    const secondsEl = document.getElementById(`${prefix}-seconds`);

    if (daysEl)    daysEl.textContent    = pad(Math.floor(diff / 86400000));
    if (hoursEl)   hoursEl.textContent   = pad(Math.floor((diff / 3600000) % 24));
    if (minutesEl) minutesEl.textContent = pad(Math.floor((diff / 60000) % 60));
    if (secondsEl) secondsEl.textContent = pad(Math.floor((diff / 1000) % 60));
  }

  function tickAllCountdowns() {
    updateCountdown(RECEPTION_DATE, 'rcp');
    updateCountdown(MARRIAGE_DATE, 'mar');
  }

  /* ── Envelope Open Logic ── */
  let opened = false;

  function openEnvelope() {
    if (opened) return;
    opened = true;

    /* Animate flap and card */
    const flap = document.getElementById('env-flap');
    const card = document.getElementById('env-card');
    const btn  = document.getElementById('open-btn');

    if (flap) flap.classList.add('open');
    if (card) card.classList.add('open');

    if (btn) {
      btn.textContent = 'Unfolding Invitation…';
      btn.disabled = true;
    }

    /* Trigger audio playback if audio player is ready */
    if (window.weddingAudio) {
      window.weddingAudio.play();
    }

    /* Reveal invitation content */
    setTimeout(function () {
      const initial = document.getElementById('invite-initial');
      const details = document.getElementById('invite-details');
      const extras  = document.getElementById('post-hero-sections');

      if (initial) initial.style.display = 'none';
      if (details) details.classList.add('show');
      if (extras)  extras.classList.add('show');

      /* Start countdowns */
      tickAllCountdowns();
      setInterval(tickAllCountdowns, 1000);

      /* Trigger scroll fade observer refresh for revealed elements */
      if (typeof window.refreshScrollFade === 'function') {
        window.refreshScrollFade();
      }
    }, 950);
  }

  /* ── RSVP Form Handler ── */
  function initRsvp() {
    const form = document.getElementById('rsvp-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = document.getElementById('rsvp-name').value.trim();
      const guests = document.getElementById('rsvp-guests') ? document.getElementById('rsvp-guests').value : '1';
      const eventSelect = document.getElementById('rsvp-event') ? document.getElementById('rsvp-event').value : 'Both Events';

      if (!name) return;

      alert(`Thank you ${name}! Your RSVP for ${eventSelect} (${guests} guest(s)) has been joyfully recorded 💐`);
      form.reset();
    });
  }

  /* ── Initialize ── */
  document.addEventListener('DOMContentLoaded', function () {
    const seal = document.getElementById('env-seal');
    if (seal) seal.addEventListener('click', openEnvelope);

    const openBtn = document.getElementById('open-btn');
    if (openBtn) openBtn.addEventListener('click', openEnvelope);

    initRsvp();
    tickAllCountdowns();
  });
})();
