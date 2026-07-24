/* ============================================================
   audio-player.js – Wedding Invitation Audio Engine
   ● Handles background wedding music across all pages
   ● Autoplay on page entry with fallback for browser policies
   ● Continuous playback across pages (marriage / reception)
   ● Restarts from beginning every time index.html is (re)loaded
   ============================================================ */

(function () {
  'use strict';

  // Audio source – path is relative to the HTML document location
  const AUDIO_SOURCES = [
    'assets/music/A2.mp3'
  ];

  // ── Detect which page we're on ──────────────────────────────
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isIndexPage = currentPage === '' || currentPage === 'index.html';

  // If we're on the index page, wipe any saved playback position
  // so the song always starts from the very beginning on reload.
  if (isIndexPage) {
    sessionStorage.removeItem('wedding_music_time');
  }

  class WeddingAudioPlayer {
    constructor() {
      this.audio = new Audio();
      this.audio.loop = false;       // false – we manage end-of-track ourselves
      this.audio.preload = 'auto';
      this.isPlaying = false;
      this.currentTrackIndex = 0;
      this.webAudioSynth = null;
      this.audioCtx = null;

      this.initSource();
      this.createFloatingUI();
      this.bindEvents();

      // Auto-start check
      this.attemptAutoplay();
    }

    initSource() {
      this.audio.src = AUDIO_SOURCES[this.currentTrackIndex];

      if (isIndexPage) {
        // Always restart from the beginning on the index page
        this.audio.currentTime = 0;
      } else {
        // Restore playback position saved when the user left the previous page
        const savedTime = parseFloat(sessionStorage.getItem('wedding_music_time') || '0');
        if (!isNaN(savedTime) && savedTime > 0) {
          // Set after metadata loads (required in some browsers)
          this.audio.addEventListener('loadedmetadata', () => {
            this.audio.currentTime = savedTime;
          }, { once: true });
          // Also set directly; works when metadata is already cached
          this.audio.currentTime = savedTime;
        }
      }
    }

    createFloatingUI() {
      // Find or create #music-player icon element
      let playerContainer = document.getElementById('music-player');
      if (!playerContainer) {
        playerContainer = document.createElement('div');
        playerContainer.id = 'music-player';
        playerContainer.setAttribute('role', 'button');
        playerContainer.setAttribute('aria-label', 'Toggle background music');
        playerContainer.setAttribute('tabindex', '0');
        playerContainer.innerHTML = `
          <div id="music-bars">
            <div class="mbar paused"></div>
            <div class="mbar paused"></div>
            <div class="mbar paused"></div>
            <div class="mbar paused"></div>
            <div class="mbar paused"></div>
          </div>
        `;
        document.body.appendChild(playerContainer);
      }

      this.musicPlayer = playerContainer;
      this.musicBars = playerContainer.querySelectorAll('.mbar');
    }

    bindEvents() {
      // Play/Pause Click & Keyboard Listener on #music-player icon
      if (this.musicPlayer) {
        this.musicPlayer.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePlay();
        });
        this.musicPlayer.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.togglePlay();
          }
        });
      }

      // Audio event listeners
      this.audio.addEventListener('play', () => {
        this.isPlaying = true;
        this.updateUIState();
        sessionStorage.setItem('wedding_music_state', 'playing');
      });

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this.updateUIState();
        sessionStorage.setItem('wedding_music_state', 'paused');
      });

      // When the track ends, loop it back to the start
      this.audio.addEventListener('ended', () => {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      });

      this.audio.addEventListener('error', (err) => {
        console.warn('Audio URL loading error on path:', this.audio.src, err);
        // Try next track if available, otherwise fall back to web-audio synth
        if (this.currentTrackIndex < AUDIO_SOURCES.length - 1) {
          this.currentTrackIndex++;
          this.audio.src = AUDIO_SOURCES[this.currentTrackIndex];
          this.audio.play().catch(() => this.fallbackToSynth());
        } else {
          this.fallbackToSynth();
        }
      });

      // ── Save playback position before the user leaves the page ──
      // 'pagehide' is the most reliable event on mobile & modern browsers.
      // 'beforeunload' is a reliable fallback for desktop browsers.
      const saveTime = () => {
        if (this.audio && !this.audio.ended) {
          sessionStorage.setItem('wedding_music_time', String(this.audio.currentTime));
        }
      };
      window.addEventListener('pagehide', saveTime);
      window.addEventListener('beforeunload', saveTime);

      // ── User interaction listener for browser autoplay restriction ──
      const unlockAudio = () => {
        const desiredState = sessionStorage.getItem('wedding_music_state');
        if (desiredState !== 'paused' && !this.isPlaying) {
          this.playAudio();
        }
        ['click', 'touchstart', 'pointerdown', 'keydown', 'scroll'].forEach(evt => {
          document.removeEventListener(evt, unlockAudio);
        });
      };

      ['click', 'touchstart', 'pointerdown', 'keydown', 'scroll'].forEach(evt => {
        document.addEventListener(evt, unlockAudio, { once: true, passive: true });
      });
    }

    attemptAutoplay() {
      // If the user manually paused, respect that choice
      const savedState = sessionStorage.getItem('wedding_music_state');
      if (savedState === 'paused') {
        this.updateUIState();
        return;
      }

      // Attempt automatic playback
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isPlaying = true;
            this.updateUIState();
          })
          .catch((err) => {
            console.log('Autoplay deferred until user interaction:', err);
            this.isPlaying = false;
            this.updateUIState();
          });
      }
    }

    playAudio() {
      if (this.webAudioSynth && this.webAudioSynth.playing) {
        this.webAudioSynth.play();
        this.isPlaying = true;
        this.updateUIState();
        return;
      }

      const promise = this.audio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            this.isPlaying = true;
            this.updateUIState();
          })
          .catch((e) => {
            console.warn('Play attempt blocked:', e);
            this.fallbackToSynth();
          });
      }
    }

    pauseAudio() {
      if (this.audio) {
        this.audio.pause();
      }
      if (this.webAudioSynth) {
        this.webAudioSynth.pause();
      }
      this.isPlaying = false;
      this.updateUIState();
    }

    togglePlay() {
      if (this.isPlaying) {
        this.pauseAudio();
      } else {
        this.playAudio();
      }
    }

    updateUIState() {
      if (!this.musicBars) return;
      if (this.isPlaying) {
        this.musicBars.forEach((bar) => bar.classList.remove('paused'));
        if (this.musicPlayer) {
          this.musicPlayer.setAttribute('aria-label', 'Pause background music');
        }
      } else {
        this.musicBars.forEach((bar) => bar.classList.add('paused'));
        if (this.musicPlayer) {
          this.musicPlayer.setAttribute('aria-label', 'Play background music');
        }
      }
    }

    fallbackToSynth() {
      if (this.webAudioSynth) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.audioCtx = new AudioCtx();

        // Gentle Tanpura / Indian chord oscillator synth fallback
        const masterGain = this.audioCtx.createGain();
        masterGain.gain.value = 0.15;
        masterGain.connect(this.audioCtx.destination);

        const freqs = [146.83, 220.00, 293.66, 440.00]; // D, A, D, A notes (Sa-Pa harmony)
        const oscs = freqs.map(freq => {
          const osc = this.audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.connect(masterGain);
          return osc;
        });

        this.webAudioSynth = {
          playing: false,
          play: () => {
            if (this.audioCtx.state === 'suspended') {
              this.audioCtx.resume();
            }
            if (!this.webAudioSynth.playing) {
              oscs.forEach(o => { try { o.start(); } catch(e){} });
              this.webAudioSynth.playing = true;
            }
            masterGain.gain.setTargetAtTime(0.15, this.audioCtx.currentTime, 0.1);
          },
          pause: () => {
            if (this.audioCtx) {
              masterGain.gain.setTargetAtTime(0.001, this.audioCtx.currentTime, 0.1);
            }
            this.webAudioSynth.playing = false;
          }
        };

        if (this.isPlaying) {
          this.webAudioSynth.play();
        }
      } catch (e) {
        console.error('Synth fallback error:', e);
      }
    }
  }

  // Initialize player once DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    window.weddingAudio = new WeddingAudioPlayer();
  });
})();
