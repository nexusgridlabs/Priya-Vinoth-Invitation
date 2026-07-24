/* ============================================================
   audio-player.js – Wedding Invitation Audio Engine
   ● Handles background wedding music across all pages
   ● Autoplay on page entry with fallback for browser policies
   ● Persistent playback state & floating Play/Pause widget
   ============================================================ */

(function () {
  'use strict';

  // Royalty-free traditional Indian wedding instrumental music sources
  // Path resolved relative to the HTML document location
  const AUDIO_SOURCES = [
    'assets/music/A2.mp3'
  ];

  class WeddingAudioPlayer {
    constructor() {
      this.audio = new Audio();
      this.audio.loop = true;
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
      
 // Restore playback position if available in session
      const savedTime = parseFloat(sessionStorage.getItem('wedding_music_time') || '0');
      if (savedTime && !isNaN(savedTime)) {
        this.audio.currentTime = savedTime;
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

      this.audio.addEventListener('error', (err) => {
        console.warn('Audio URL loading error on path:', this.audio.src, err);
        // Try track 2 if track 1 fails, otherwise fallback to web audio synth
        if (this.currentTrackIndex < AUDIO_SOURCES.length - 1) {
          this.currentTrackIndex++;
          this.audio.src = AUDIO_SOURCES[this.currentTrackIndex];
          this.audio.play().catch(() => this.fallbackToSynth());
        } else {
          this.fallbackToSynth();
        }
      });

      // Note: Playback time is NOT saved — audio always restarts from beginning on reload

      // User interaction listener for browser autoplay restriction
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
      // Check if user previously paused music
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
            // Fallback to web synth if audio element fails completely
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
