document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  const overlay = document.querySelector('.nav-overlay');

  const closeNav = () => {
    nav.classList.remove('open');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    if (overlay) overlay.classList.remove('show');
    document.body.classList.remove('nav-locked');
  };
  const openNav = () => {
    nav.classList.add('open');
    toggle.classList.add('active');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    if (overlay) overlay.classList.add('show');
    document.body.classList.add('nav-locked');
  };

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      if (nav.classList.contains('open')) closeNav(); else openNav();
    });
    nav.querySelectorAll('a:not(.nav-item > a)').forEach(a => a.addEventListener('click', closeNav));
    if (overlay) overlay.addEventListener('click', closeNav);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) closeNav();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 980 && nav.classList.contains('open')) closeNav();
    });
  }

  // Shrink the fixed header once scrolling begins (~98px -> ~60px, see
  // .is-scrolled in styles.css). The header is position:fixed, so this is
  // purely cosmetic — it never affects document flow or causes layout
  // shift in the content underneath.
  const siteHeader = document.querySelector('.site-header');
  if (siteHeader) {
    const SCROLL_THRESHOLD = 40;
    let headerScrolled = false;
    const syncHeaderState = () => {
      const shouldShrink = window.scrollY > SCROLL_THRESHOLD;
      if (shouldShrink !== headerScrolled) {
        headerScrolled = shouldShrink;
        siteHeader.classList.toggle('is-scrolled', headerScrolled);
      }
    };
    syncHeaderState();
    window.addEventListener('scroll', syncHeaderState, { passive: true });
  }

  // Knowledge Centre dropdown: click to open, stays open until the user
  // picks an option or clicks elsewhere. No hover, no auto-redirect —
  // clicking the "Knowledge Centre" label itself only ever toggles the menu.
  document.querySelectorAll('.nav-item').forEach(item => {
    const topLink = item.querySelector(':scope > a');
    const panel = item.querySelector(':scope > .dropdown-panel');
    if (!topLink || !panel) return;
    topLink.setAttribute('aria-haspopup', 'true');
    topLink.setAttribute('aria-expanded', 'false');
    topLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !item.classList.contains('open');
      document.querySelectorAll('.nav-item.open').forEach((other) => {
        if (other !== item) {
          other.classList.remove('open');
          const otherLink = other.querySelector(':scope > a');
          if (otherLink) otherLink.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('open', willOpen);
      topLink.setAttribute('aria-expanded', String(willOpen));
    });
    // Selecting an option (or any link inside the panel) closes the dropdown.
    panel.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        item.classList.remove('open');
        topLink.setAttribute('aria-expanded', 'false');
      });
    });
  });
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-item.open').forEach((item) => {
      if (!item.contains(e.target)) {
        item.classList.remove('open');
        const topLink = item.querySelector(':scope > a');
        if (topLink) topLink.setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.nav-item.open').forEach((item) => {
        item.classList.remove('open');
        const topLink = item.querySelector(':scope > a');
        if (topLink) topLink.setAttribute('aria-expanded', 'false');
      });
    }
  });

  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && items.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    items.forEach(el => io.observe(el));
  } else {
    items.forEach(el => el.classList.add('in'));
  }

  // Quiet counter animation for hero stats with a data-count target.
  // Runs once, respects prefers-reduced-motion, and leaves the original
  // label (e.g. "10+") untouched — only the numeric portion counts up.
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const counters = document.querySelectorAll('.hero-stats .num[data-count]');
  if (counters.length && !reduceMotion) {
    counters.forEach(el => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      const suffix = el.textContent.replace(/^[0-9]+/, '');
      if (isNaN(target)) return;
      const duration = 900;
      const start = performance.now();
      requestAnimationFrame(function step(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (p < 1) requestAnimationFrame(step);
      });
    });
  }

  // MOBILE STICKY BOOKING BAR — only relevant on the Contact page. Appears
  // once the visitor scrolls past the main booking card (so it doesn't just
  // duplicate the CTA they can already see), and hides again near the
  // footer so it never sits on top of the office details / map / footer.
  const stickyBar = document.getElementById('mobile-booking-bar');
  const bookingCard = document.querySelector('.booking-hero-card');
  const siteFooter = document.querySelector('.site-footer');
  if (stickyBar && bookingCard) {
    const toggleStickyBar = () => {
      const cardBottom = bookingCard.getBoundingClientRect().bottom;
      const pastHero = cardBottom < 0;
      const nearFooter = siteFooter ? siteFooter.getBoundingClientRect().top < window.innerHeight : false;
      stickyBar.classList.toggle('is-visible', pastHero && !nearFooter);
    };
    toggleStickyBar();
    window.addEventListener('scroll', toggleStickyBar, { passive: true });
    window.addEventListener('resize', toggleStickyBar);
  }

  const forms = document.querySelectorAll('.consult-form');
  forms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const status = form.querySelector('.form-status') || form.parentElement.querySelector('.form-status');
      const original = btn.textContent;
      const successMessage = form.dataset.successMessage ||
        "Thank you for contacting Muchangi Patrick & Associates Advocates. We aim to respond within one business day. If your enquiry is urgent, you may also schedule a Digital Trust Gap Analysis using the booking link above.";
      btn.textContent = 'Sending…';
      btn.disabled = true;
      if (status) { status.style.display = 'none'; status.textContent = ''; }

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      })
        .then((response) => {
          if (response.ok) {
            btn.textContent = form.dataset.successLabel || 'Request received';
            form.reset();
            if (status) {
              status.textContent = successMessage;
              status.style.color = '#2e7d32';
              status.style.display = 'block';
            }
          } else {
            throw new Error('Form submission failed');
          }
        })
        .catch(() => {
          btn.textContent = original;
          if (status) {
            status.textContent = 'Something went wrong sending your message. Please email us directly at consult@dataprivacyadvocates.co.ke or call 0722 878 607.';
            status.style.color = '#b3261e';
            status.style.display = 'block';
          }
        })
        .finally(() => {
          btn.disabled = false;
          setTimeout(() => { if (btn.textContent !== original) btn.textContent = original; }, 4000);
        });
    });
  });

  // Cookie consent banner
  const banner = document.querySelector('.cookie-banner');
  if (banner) {
    const stored = localStorage.getItem('mp_cookie_consent');
    let autoDismissTimer = null;

    const setConsent = (value) => {
      if (autoDismissTimer) { clearTimeout(autoDismissTimer); autoDismissTimer = null; }
      localStorage.setItem('mp_cookie_consent', value);
      localStorage.setItem('mp_cookie_consent_date', new Date().toISOString());
      if (typeof gtag === 'function') {
        gtag('consent', 'update', { 'analytics_storage': value === 'all' ? 'granted' : 'denied' });
      }
      banner.classList.remove('show');
    };

    if (!stored) {
      setTimeout(() => {
        banner.classList.add('show');
        // If no choice is made within 3 seconds, dismiss automatically.
        // Defaults to essential-only (no analytics/marketing cookies) since
        // no explicit consent was given for anything beyond that.
        autoDismissTimer = setTimeout(() => {
          if (!localStorage.getItem('mp_cookie_consent')) {
            setConsent('essential');
          }
        }, 3000);
      }, 600);
    }

    const acceptBtn = banner.querySelector('.cookie-accept');
    const essentialBtn = banner.querySelector('.cookie-essential');
    if (acceptBtn) acceptBtn.addEventListener('click', () => setConsent('all'));
    if (essentialBtn) essentialBtn.addEventListener('click', () => setConsent('essential'));
  }

  // Cookie preference center (on cookie-notice.html)
  const prefForm = document.querySelector('.pref-form');
  if (prefForm) {
    const analyticsToggle = prefForm.querySelector('#pref-analytics');
    const consent = localStorage.getItem('mp_cookie_consent');
    if (analyticsToggle) analyticsToggle.checked = consent === 'all';
    const saveBtn = prefForm.querySelector('.pref-save');
    const savedMsg = prefForm.querySelector('.pref-saved-msg');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const value = analyticsToggle && analyticsToggle.checked ? 'all' : 'essential';
        localStorage.setItem('mp_cookie_consent', value);
        localStorage.setItem('mp_cookie_consent_date', new Date().toISOString());
        if (typeof gtag === 'function') {
          gtag('consent', 'update', { 'analytics_storage': value === 'all' ? 'granted' : 'denied' });
        }
        if (savedMsg) {
          savedMsg.classList.add('show');
          setTimeout(() => savedMsg.classList.remove('show'), 2800);
        }
        const globalBanner = document.querySelector('.cookie-banner');
        if (globalBanner) globalBanner.classList.remove('show');
      });
    }
  }
});
