/* ============================================================
   parallax.js – Wedding Invitation Parallax & Visual Effects Engine
   ● Smooth background image parallax on scroll (60fps requestAnimationFrame)
   ● Multi-layer depth parallax for floating petals & golden mandalas
   ● Interactive 3D tilt effects on cards & envelope
   ● Scroll progress bar indicator under fixed navigation header
   ============================================================ */

(function () {
  'use strict';

  let ticking = false;
  let lastScrollY = window.scrollY || 0;

  // Cache elements for high performance scroll updates
  let heroBgElements = [];
  let pageHeroImgs = [];
  let floatingPetals = [];
  let parallaxCards = [];
  let scrollProgressBar = null;

  function initParallaxElements() {
    heroBgElements = Array.from(document.querySelectorAll('.hero-bg, .parallax-bg'));
    pageHeroImgs   = Array.from(document.querySelectorAll('.page-hero img'));
    floatingPetals = Array.from(document.querySelectorAll('.petal, .parallax-ornament'));
    parallaxCards  = Array.from(document.querySelectorAll('.event-card, .venue-card, .event-countdown-wrapper, .ritual-timeline .timeline-content'));

    // Create scroll progress bar under fixed header
    createScrollProgressBar();
    
    // Assign depth speeds to floating petals if not set
    floatingPetals.forEach((petal, idx) => {
      const speeds = [0.12, 0.25, 0.4, 0.18, 0.32, 0.5];
      petal.dataset.parallaxSpeed = petal.dataset.parallaxSpeed || speeds[idx % speeds.length];
    });

    // Mark parallax cards
    parallaxCards.forEach((card, idx) => {
      card.classList.add('parallax-card');
      const cardSpeed = (idx % 2 === 0) ? -0.04 : 0.04;
      card.dataset.parallaxSpeed = card.dataset.parallaxSpeed || cardSpeed;
    });

    // Bind 3D mouse tilt handlers to cards
    init3DTilt();

    // Initialize Scroll Fade In & Fade Out observer
    initScrollFadeEffects();

    // Initial render
    onScroll();
  }

  /* ── High Performance Scrolling Fade In & Fade Out Engine ── */
  let fadeObserver = null;

  function initScrollFadeEffects() {
    const fadeSelectors = [
      'section:not(.hero-section)',
      '.page-hero-content',
      '.event-card',
      '.venue-card',
      '.wedding-card',
      '.event-countdown-wrapper',
      '.timeline-item',
      '.wish-item',
      'footer',
      '.scroll-fade'
    ].join(', ');

    const elementsToFade = Array.from(document.querySelectorAll(fadeSelectors));

    elementsToFade.forEach(el => {
      if (!el.classList.contains('scroll-fade') && 
          !el.classList.contains('scroll-fade-up') &&
          !el.classList.contains('scroll-fade-down') &&
          !el.classList.contains('scroll-fade-left') &&
          !el.classList.contains('scroll-fade-right') &&
          !el.classList.contains('scroll-fade-zoom')) {
        el.classList.add('scroll-fade');
      }
    });

    if (!('IntersectionObserver' in window)) {
      elementsToFade.forEach(el => el.classList.add('scroll-visible'));
      return;
    }

    if (fadeObserver) {
      fadeObserver.disconnect();
    }

    fadeObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('scroll-visible');
        } else {
          // Fade out when scrolling out of view
          entry.target.classList.remove('scroll-visible');
        }
      });
    }, {
      root: null,
      rootMargin: '-20px 0px -20px 0px',
      threshold: 0.1
    });

    elementsToFade.forEach(el => {
      fadeObserver.observe(el);
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('scroll-visible');
      }
    });

    // Global refresh function for dynamically revealed content
    window.refreshScrollFade = function () {
      const currentEls = Array.from(document.querySelectorAll(fadeSelectors));
      currentEls.forEach(el => {
        if (!el.classList.contains('scroll-fade') &&
            !el.classList.contains('scroll-fade-up') &&
            !el.classList.contains('scroll-fade-down') &&
            !el.classList.contains('scroll-fade-left') &&
            !el.classList.contains('scroll-fade-right') &&
            !el.classList.contains('scroll-fade-zoom')) {
          el.classList.add('scroll-fade');
        }
        if (fadeObserver) fadeObserver.observe(el);
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('scroll-visible');
        }
      });
    };
  }

  function createScrollProgressBar() {
    const header = document.querySelector('.wedding-header');
    if (!header || document.getElementById('scroll-progress-bar')) return;

    scrollProgressBar = document.createElement('div');
    scrollProgressBar.id = 'scroll-progress-bar';
    scrollProgressBar.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      width: 0%;
      background: var(--gradient-gold, linear-gradient(90deg, #dfb747, #f7eaab, #b38515));
      box-shadow: 0 0 8px rgba(197, 155, 39, 0.6);
      transition: width 0.1s ease-out;
      z-index: 1001;
      pointer-events: none;
    `;
    header.appendChild(scrollProgressBar);
  }

  function updateScrollProgress(scrollY) {
    if (!scrollProgressBar) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      const progress = Math.min(100, Math.max(0, (scrollY / docHeight) * 100));
      scrollProgressBar.style.width = `${progress}%`;
    }
  }

  function updateParallax(scrollY) {
    // 1. Hero background parallax
    heroBgElements.forEach(bg => {
      const speed = parseFloat(bg.dataset.speed) || 0.35;
      const yPos = scrollY * speed;
      bg.style.transform = `translate3d(0, ${yPos}px, 0)`;
    });

    // 2. Page Hero banner image shift
    pageHeroImgs.forEach(img => {
      const parent = img.closest('.page-hero');
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        const speed = 0.28;
        const yPos = (window.innerHeight - rect.top) * speed * 0.2;
        img.style.transform = `translate3d(0, ${yPos}px, 0) scale(1.08)`;
      }
    });

    // 3. Multi-layer floating petals & ornaments parallax
    floatingPetals.forEach(petal => {
      const speed = parseFloat(petal.dataset.parallaxSpeed) || 0.2;
      const yOffset = scrollY * speed;
      const rotation = (scrollY * 0.1) % 360;
      petal.style.transform = `translate3d(0, ${yOffset}px, 0) rotate(${rotation}deg)`;
    });

    // 4. Subtle Section Card floating parallax
    parallaxCards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.bottom > -100 && rect.top < window.innerHeight + 100) {
        const speed = parseFloat(card.dataset.parallaxSpeed) || 0.03;
        const centerDiff = (window.innerHeight / 2) - (rect.top + rect.height / 2);
        const yOffset = centerDiff * speed;
        card.style.transform = `translate3d(0, ${yOffset}px, 0)`;
      }
    });

    // 5. Update top scroll progress bar
    updateScrollProgress(scrollY);

    ticking = false;
  }

  function onScroll() {
    lastScrollY = window.scrollY || window.pageYOffset || 0;
    if (!ticking) {
      requestAnimationFrame(() => updateParallax(lastScrollY));
      ticking = true;
    }
  }

  /* ── Interactive 3D Tilt Effect on Hover ── */
  function init3DTilt() {
    const tiltTargets = document.querySelectorAll('.event-card, .venue-card, .envelope-stage');
    
    tiltTargets.forEach(target => {
      target.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease';
      
      target.addEventListener('mousemove', (e) => {
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -6;
        const rotateY = ((x - centerX) / centerX) * 6;
        
        target.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      });

      target.addEventListener('mouseleave', () => {
        target.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    });
  }

  // Initialize on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initParallaxElements);
  } else {
    initParallaxElements();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
})();
