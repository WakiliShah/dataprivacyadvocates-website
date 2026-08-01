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

  // CONTACT FORM QUALIFICATION — pre-fill the inquiry dropdown and a starter
  // message from query params that CTAs elsewhere on the site already carry
  // (?package= from ODPC Registration, ?interest= from the compliance
  // checker report / retainer-style CTAs, ?score=/?band=/?sector= from the
  // self-assessment). No page reload, no server round-trip — this just
  // fills in fields the visitor would otherwise have had to type themselves.
  (function prefillContactForm() {
    const consultForm = document.querySelector('.consult-form');
    if (!consultForm) return;
    const params = new URLSearchParams(window.location.search);
    const pkg = params.get('package');
    const interest = params.get('interest');
    const tier = params.get('tier');
    const score = params.get('score');
    const band = params.get('band');
    const sector = params.get('sector');
    if (!pkg && !interest && !score) return;

    const inquirySelect = consultForm.querySelector('[name="inquiry_type"]');
    const messageField = consultForm.querySelector('[name="matter"]');
    let starter = '';
    const tierInfo = {
      essential: { label: 'Essential Compliance Retainer', price: 'KES 35,000/month' },
      standard: { label: 'SACCO & SME Standard Retainer', price: 'KES 55,000/month' },
      board: { label: 'Board Advisory Retainer', price: 'KES 130,000/month' }
    };

    if (pkg) {
      const pkgLabels = { 'micro-small': 'Micro/Small package', 'medium': 'Medium package', 'large': 'Large/Enterprise package' };
      if (inquirySelect) inquirySelect.value = 'registration';
      starter = `I'd like to register under the ${pkgLabels[pkg] || pkg} ODPC registration package.`;
    } else if (interest === 'retainer') {
      if (inquirySelect) inquirySelect.value = 'retainer';
      const t = tier && tierInfo[tier];
      starter = t
        ? `I'm interested in the ${t.label} (${t.price}) — please send the engagement letter and next steps.`
        : "I'm interested in an ongoing compliance retainer — please share scope and pricing.";
    } else if (interest === 'compliance-report' || score) {
      if (inquirySelect) inquirySelect.value = 'audit';
      starter = `I completed the compliance self-assessment${sector ? ' (' + sector + ' sector)' : ''} and scored ${score || '—'}%${band ? ' (' + band + ')' : ''}. I'd like to discuss the results.`;
    }

    if (messageField && starter && !messageField.value) messageField.value = starter;

    // RETAINER "GET STARTED" FAST PATH — a visitor who clicked "Get Started"
    // on a specific retainer tier has already decided what they want; asking
    // them to book a free 10-minute call first is an extra, unwanted step.
    // Swap the hero to a direct sign-up prompt and send them straight to the
    // form below, which is already pre-filled with their tier above.
    if (interest === 'retainer' && tier && tierInfo[tier]) {
      const t = tierInfo[tier];
      const heroEyebrow = document.getElementById('booking-hero-eyebrow');
      const heroTitle = document.getElementById('booking-hero-title');
      const heroCopy = document.getElementById('booking-hero-copy');
      const heroPrimaryBtn = document.getElementById('booking-hero-primary-btn');
      const fallbackEyebrow = document.getElementById('fallback-eyebrow');
      const fallbackTitle = document.getElementById('fallback-title');
      const fallbackCopy = document.getElementById('fallback-copy');

      if (heroEyebrow) heroEyebrow.textContent = 'Retainer Sign-Up';
      if (heroTitle) heroTitle.textContent = `Get Started — ${t.label}`;
      if (heroCopy) heroCopy.textContent = `You've selected the ${t.label} (${t.price}). Confirm a few details below and we'll send the engagement letter and next steps — no need to book a call first.`;
      if (heroPrimaryBtn) {
        heroPrimaryBtn.removeAttribute('target');
        heroPrimaryBtn.removeAttribute('rel');
        heroPrimaryBtn.href = '#contact-form';
        heroPrimaryBtn.innerHTML = '<i class="fas fa-arrow-down"></i> Continue to Sign-Up Form';
      }
      if (fallbackEyebrow) fallbackEyebrow.textContent = 'Confirm Your Details';
      if (fallbackTitle) fallbackTitle.textContent = `Complete your ${t.label} sign-up`;
      if (fallbackCopy) fallbackCopy.textContent = "Fill in your details below and a partner will send your engagement letter and onboarding steps within one business day. Prefer to talk first? Use WhatsApp or the call link above.";

      const formWrap = document.querySelector('.form-wrap--simple');
      if (formWrap) formWrap.id = 'contact-form';

      const mobileBtn = document.getElementById('mobile-booking-bar-btn');
      if (mobileBtn) {
        mobileBtn.removeAttribute('target');
        mobileBtn.removeAttribute('rel');
        mobileBtn.href = '#contact-form';
        mobileBtn.innerHTML = '<i class="fas fa-arrow-down"></i> Continue Sign-Up';
      }
    }
  })();

  // Default acknowledgment copy per form_type — used only when a form
  // doesn't set its own data-success-message/data-success-label. Centralised
  // here so copy changes don't require editing every page that embeds a
  // given form type (see FORM-AUDIT and the Client Communication &
  // Automation Standard for the full form inventory).
  const DEFAULT_ACK = {
    newsletter: {
      label: 'Subscribed',
      message: "You're subscribed. Watch your inbox for the next KPLR briefing — new ODPC determinations, guidance notes and compliance deadlines."
    },
    feedback: {
      label: 'Feedback received',
      message: 'Thank you — your feedback helps shape the next briefing.'
    },
    consultation: {
      label: 'Request received',
      message: "Thank you for contacting Muchangi Patrick & Associates Advocates. We aim to respond within one business day. If your enquiry is urgent, you may also schedule a Digital Trust Gap Analysis using the booking link above."
    }
  };

  // PART 8: stamp every form's rendered_at hidden field with the current
  // time as soon as the page is ready — form-submit.mts rejects submissions
  // that arrive implausibly fast after render (a common bot signature).
  document.querySelectorAll('.js-rendered-at').forEach((el) => { el.value = String(Date.now()); });

  const forms = document.querySelectorAll('.consult-form');
  forms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const status = form.querySelector('.form-status') || form.parentElement.querySelector('.form-status');
      const original = btn.textContent;
      const formType = form.dataset.formType || 'consultation';
      const defaults = DEFAULT_ACK[formType] || DEFAULT_ACK.consultation;
      const successMessage = form.dataset.successMessage || defaults.message;
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
            btn.textContent = form.dataset.successLabel || defaults.label;
            if (typeof gtag === 'function') {
              const eventName = formType === 'newsletter' ? 'newsletter_signup'
                : formType === 'feedback' ? 'feedback_form_submit'
                : 'contact_form_submit';
              const eventParams = { page_path: window.location.pathname };
              if (eventName === 'contact_form_submit') {
                const inquiryField = form.querySelector('[name="inquiry_type"]');
                eventParams.inquiry_type = (inquiryField && inquiryField.value) || 'general';
              }
              gtag('event', eventName, eventParams);
            }
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
        const granted = value === 'all' ? 'granted' : 'denied';
        gtag('consent', 'update', {
          'analytics_storage': granted,
          'ad_storage': granted,
          'ad_user_data': granted,
          'ad_personalization': granted
        });
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
          const granted = value === 'all' ? 'granted' : 'denied';
          gtag('consent', 'update', {
            'analytics_storage': granted,
            'ad_storage': granted,
            'ad_user_data': granted,
            'ad_personalization': granted
          });
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

/* ==== Resource Gate — email-gated downloads (checklists, templates,
   compliance toolkits, course manuals). Reuses the site's Netlify Forms
   setup (see .kg-form / name="kplr-resource-request") so submissions land
   in the same place as the newsletter signups. Progressive: if a visitor
   has already unlocked once on this device, later clicks skip straight
   to the file instead of re-asking. ==== */
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('kg-modal');
  if (!modal) return;

  const inner       = document.getElementById('kg-modal-inner');
  const closeBtn     = document.getElementById('kg-modal-close');
  const titleEl      = document.getElementById('kg-modal-title');
  const eyebrowEl     = document.getElementById('kg-modal-eyebrow');
  const form         = document.getElementById('kg-form');
  const resourceField = document.getElementById('kg-resource-field');
  const emailField    = document.getElementById('kg-email');
  const nameField      = document.getElementById('kg-name');
  const errorBox      = document.getElementById('kg-error');
  const successBox    = document.getElementById('kg-success');
  const successText   = document.getElementById('kg-success-text');
  const manualLink    = document.getElementById('kg-manual-link');
  const submitBtn     = document.getElementById('kg-submit');

  let pendingFile = null;
  let pendingReveal = null;
  let lastFocused = null;

  const encode = (data) => Object.keys(data)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');

  const triggerDownload = (file) => {
    const a = document.createElement('a');
    a.href = file;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openModal = (trigger) => {
    lastFocused = document.activeElement;
    pendingFile = trigger.getAttribute('data-kg-file');
    pendingReveal = trigger.getAttribute('data-kg-reveal');
    const title = trigger.getAttribute('data-kg-title') || 'This resource';
    const id = trigger.getAttribute('data-kg-id') || title;

    if (typeof gtag === 'function') {
      gtag('event', 'resource_gate_open', { resource_id: id, resource_title: title });
    }

    titleEl.textContent = title;
    if (eyebrowEl) eyebrowEl.textContent = pendingReveal ? 'Free, personalised' : 'Free resource';
    if (submitBtn) submitBtn.innerHTML = pendingReveal ? 'Show my results <i class="fas fa-arrow-right"></i>' : 'Get the download <i class="fas fa-arrow-right"></i>';
    resourceField.value = id;
    errorBox.classList.remove('is-visible');
    form.hidden = false;
    successBox.hidden = true;
    form.reset();
    resourceField.value = id;

    // Returning visitor who already unlocked a resource on this device —
    // skip straight to the file rather than asking again.
    const savedEmail = localStorage.getItem('kplr_gate_email');
    if (savedEmail) {
      emailField.value = savedEmail;
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('nav-locked');
    setTimeout(() => nameField && nameField.focus(), 60);
  };

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('nav-locked');
    if (lastFocused) lastFocused.focus();
  };

  document.querySelectorAll('[data-kg-file], [data-kg-reveal]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(trigger);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      errorBox.classList.remove('is-visible');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      const formData = new FormData(form);
      const payload = {};
      formData.forEach((value, key) => { payload[key] = value; });

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(payload)
      })
        .then(() => {
          localStorage.setItem('kplr_gate_email', payload.email || '');
          if (typeof gtag === 'function') {
            gtag('event', 'resource_gate_submit', {
              resource_id: payload.resource || '',
              page_path: window.location.pathname
            });
          }
          form.hidden = true;
          successBox.hidden = false;
          if (pendingReveal) {
            successText.textContent = "You're all set — your personalised breakdown is ready below.";
            if (manualLink) manualLink.hidden = true;
          } else {
            successText.textContent = 'Your download should start automatically. A copy of the link is also below if you need it again.';
            if (manualLink && pendingFile) { manualLink.hidden = false; manualLink.href = pendingFile; }
          }
          if (pendingFile) triggerDownload(pendingFile);
          if (pendingReveal) { revealTarget(pendingReveal); closeModal(); }
        })
        .catch(() => {
          // Network/Forms failure — don't block a legitimate reader from
          // the document (or their own already-computed results) just
          // because the lead notification didn't reach us.
          if (pendingReveal) {
            errorBox.textContent = "We couldn't reach our server just now, but here's your breakdown anyway — we'd still love your details next time.";
          } else {
            errorBox.textContent = "We couldn't reach our server just now. You can still get the file below — we'd still love your email next time.";
          }
          errorBox.classList.add('is-visible');
          if (manualLink && pendingFile) { manualLink.hidden = false; manualLink.href = pendingFile; }
          form.hidden = true;
          successBox.hidden = false;
          successText.textContent = pendingReveal ? "Here's your breakdown:" : 'Here is your download:';
          if (pendingFile) triggerDownload(pendingFile);
          if (pendingReveal) { revealTarget(pendingReveal); closeModal(); }
        })
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = pendingReveal ? 'Show my results <i class="fas fa-arrow-right"></i>' : 'Get the download <i class="fas fa-arrow-right"></i>';
        });
    });
  }

  function revealTarget(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.hidden = false;
    target.classList.add('is-revealed');
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
  }
});
