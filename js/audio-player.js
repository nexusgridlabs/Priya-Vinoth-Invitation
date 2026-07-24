/* ============================================================
   audio-player.js – Wedding Invitation Audio Engine  v3
   ● Seamless playback across page navigations (mobile + desktop)
   ● Handles bfcache (iOS Safari back/forward swipe)
   ● Smooth volume fade-in on page entry (no pop / lag)
   ● Restarts from beginning every time index.html is loaded
   ============================================================ */

(function () {
  'use strict';

  const AUDIO_SRC = 'assets/music/A2.mp3';
  const FADE_DURATION = 0.6; // seconds for volume fade-in

  // ── Detect current page ───────────────────────────────────
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isIndexPage = currentPage === '' || currentPage === 'index.html';

  // On the index page always wipe saved position so it restarts
  if (isIndexPage) {
    sessionStorage.removeItem('wedding_music_time');
    sessionStorage.removeItem('wedding_music_state');
    sessionStorage.removeItem('wedding_music_unlocked');
  }

  class WeddingAudioPlayer {
    constructor() {
      this.audio       = new Audio();
      this.audio.loop  = false;
      this.audio.preload = 'auto';

      // Mute initially; we fade in via Web Audio API to avoid pop
      this.audioCtx    = null;
      this.gainNode    = null;
      this.sourceNode  = null;

      this.isPlaying   = false;
      this._userPaused = sessionStorage.getItem('wedding_music_state') === 'paused';

      this._setupAudio();
      this._createUI();
      this._bindEvents();
      this._attemptAutoplay();
    }

    /* ── Audio setup ─────────────────────────────────────── */
    _setupAudio() {
      this.audio.src = AUDIO_SRC;

      // Restore saved playback position for non-index pages
      if (!isIndexPage) {
        const saved = parseFloat(sessionStorage.getItem('wedding_music_time') || '0');
        if (!isNaN(saved) && saved > 0) {
          // Try immediately (works if metadata already cached)
          this.audio.currentTime = saved;
          // Also set once metadata is available (guaranteed fallback)
          this.audio.addEventListener('loadedmetadata', () => {
            if (Math.abs(this.audio.currentTime - saved) > 1) {
              this.audio.currentTime = saved;
            }
          }, { once: true });
        }
      }
    }

    /* ── Web Audio context for smooth gain control ────────── */
    _initAudioContext() {
      if (this.audioCtx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.audioCtx = new AC();
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 0; // start silent, fade in
        this.gainNode.connect(this.audioCtx.destination);

        // Connect the <audio> element as a MediaElementSource
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
        this.sourceNode.connect(this.gainNode);
      } catch (e) {
        console.warn('WebAudio init failed, falling back to direct audio:', e);
        this.audioCtx = null;
        this.gainNode = null;
      }
    }

    _fadeIn() {
      if (this.gainNode && this.audioCtx) {
        const now = this.audioCtx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(1, now + FADE_DURATION);
      }
    }

    _fadeOut(duration = 0.3) {
      if (this.gainNode && this.audioCtx) {
        const now = this.audioCtx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(0.001, now + duration);
      }
    }

    /* ── Floating music icon UI ───────────────────────────── */
    _createUI() {
      let container = document.getElementById('music-player');
      if (!container) {
        container = document.createElement('div');
        container.id = 'music-player';
        container.setAttribute('role', 'button');
        container.setAttribute('aria-label', 'Toggle background music');
        container.setAttribute('tabindex', '0');
        container.innerHTML = `
          <div id="music-bars">
            <div class="mbar paused"></div>
            <div class="mbar paused"></div>
            <div class="mbar paused"></div>
            <div class="mbar paused"></div>
            <div class="mbar paused"></div>
          </div>
        `;
        document.body.appendChild(container);
      }
      this._playerEl = container;
      this._bars     = container.querySelectorAll('.mbar');
    }

    /* ── Event wiring ─────────────────────────────────────── */
    _bindEvents() {
      // Toggle click / keyboard
      this._playerEl.addEventListener('click',   (e) => { e.stopPropagation(); this.toggle(); });
      this._playerEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); }
      });

      // Sync UI with native audio events
      this.audio.addEventListener('play', () => {
        this.isPlaying = true;
        this._updateUI();
        sessionStorage.setItem('wedding_music_state', 'playing');
      });
      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this._updateUI();
        if (!this._navigating) {
          sessionStorage.setItem('wedding_music_state', 'paused');
        }
      });
      this.audio.addEventListener('ended', () => {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      });
      this.audio.addEventListener('error', () => {
        console.warn('Audio error – src:', this.audio.src);
      });

      // ── Save position reliably before leaving the page ────
      // pagehide fires on mobile (iOS bfcache too) and desktop
      const saveState = () => {
        this._navigating = true;
        if (this.audio && !this.audio.ended) {
          sessionStorage.setItem('wedding_music_time', String(this.audio.currentTime));
        }
        if (this.isPlaying) {
          sessionStorage.setItem('wedding_music_state', 'playing');
        }
      };
      window.addEventListener('pagehide',     saveState, { capture: true });
      window.addEventListener('beforeunload', saveState, { capture: true });

      // ── bfcache restore (iOS Safari back swipe) ───────────
      // When a page is restored from bfcache, pageshow fires with
      // persisted=true. We must resume audio here because no JS re-runs.
      window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
          // Page was restored from cache — re-sync state
          this._navigating = false;
          const state = sessionStorage.getItem('wedding_music_state');
          const time  = parseFloat(sessionStorage.getItem('wedding_music_time') || '0');

          if (!isNaN(time) && time > 0) {
            try { this.audio.currentTime = time; } catch(_) {}
          }

          if (state !== 'paused' && !this.isPlaying) {
            // Resume via user-gesture unlock if needed
            this._resumeFromCache();
          } else if (state === 'paused') {
            this.isPlaying = false;
            this._updateUI();
          }
        }
      });

      // ── Unlock autoplay on first user interaction ─────────
      const unlock = () => {
        if (!this._userPaused && !this.isPlaying) {
          this.play();
        }
        ['click','touchstart','pointerdown','keydown','scroll'].forEach(evt =>
          document.removeEventListener(evt, unlock));
      };
      ['click','touchstart','pointerdown','keydown','scroll'].forEach(evt =>
        document.addEventListener(evt, unlock, { once: true, passive: true }));
    }

    _resumeFromCache() {
      // On bfcache restore we may still be in a user-gesture context
      const tryPlay = () => {
        this.play();
        ['click','touchstart','pointerdown'].forEach(evt =>
          document.removeEventListener(evt, tryPlay));
      };
      const p = this.audio.play();
      // If we have previously unlocked autoplay, attempt immediate play without waiting
      if (sessionStorage.getItem('wedding_music_unlocked') === 'true') {
        // Playback may still be blocked; rely on play() handling
      }
      if (p !== undefined) {
        p.then(() => {
          this._updateUI();
          this.isPlaying = true;
          // Remember that autoplay was unlocked for future pages
          sessionStorage.setItem('wedding_music_unlocked', 'true');
        }).catch(() => {
          // Still blocked — wait for next touch
          ['click','touchstart','pointerdown'].forEach(evt =>
            document.addEventListener(evt, tryPlay, { once: true, passive: true }));
        });
      }
    }

    /* ── Autoplay attempt on page load ───────────────────── */
    _attemptAutoplay() {
    if (this._userPaused) {
      this.isPlaying = false;
      this._updateUI();
      return;
    }
    this._initAudioContext();
    // If we have previously unlocked autoplay, try to play immediately
    if (sessionStorage.getItem('wedding_music_unlocked') === 'true') {
      this.play();
      return;
    }
    const p = this.audio.play();
    if (p !== undefined) {
        p.then(() => {
          this._fadeIn();
          this.isPlaying = true;
          this._updateUI();
          // Remember that autoplay was unlocked for future pages
          sessionStorage.setItem('wedding_music_unlocked', 'true');
        }).catch(() => {
          this.isPlaying = false;
          this._updateUI();
          // Silently wait for user interaction (handled by unlock listener)
        });
      }
    }

    /* ── Public controls ─────────────────────────────────── */
    play() {
      this._initAudioContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const p = this.audio.play();
      if (p !== undefined) {
        p.then(() => {
          this._fadeIn();
          this.isPlaying = true;
          this._userPaused = false;
          this._updateUI();
          // Remember that autoplay was unlocked for future pages
          sessionStorage.setItem('wedding_music_unlocked', 'true');
        }).catch(() => {});
      }
    }

    pause() {
      this._fadeOut(0.25);
      // Delay native pause until fade completes
      setTimeout(() => {
        this.audio.pause();
        this.isPlaying = false;
        this._userPaused = true;
        this._updateUI();
        sessionStorage.setItem('wedding_music_state', 'paused');
      }, 280);
    }

    toggle() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this._userPaused = false;
        this.play();
      }
    }

    /* ── UI state sync ───────────────────────────────────── */
    _updateUI() {
      if (!this._bars) return;
      if (this.isPlaying) {
        this._bars.forEach(b => b.classList.remove('paused'));
        this._playerEl?.setAttribute('aria-label', 'Pause background music');
      } else {
        this._bars.forEach(b => b.classList.add('paused'));
        this._playerEl?.setAttribute('aria-label', 'Play background music');
      }
    }
  }

  // Init on DOMContentLoaded (or immediately if already ready)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.weddingAudio = new WeddingAudioPlayer();
    });
  } else {
    window.weddingAudio = new WeddingAudioPlayer();
  }
})();
