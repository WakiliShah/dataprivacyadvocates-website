/* ==========================================================================
   Data Privacy Compliance Checker
   Self-contained modal wizard: sector selection -> 9 category steps (52
   controls total, based on Kenya's Data Protection Act, 2019) -> instant
   scored report. No external dependencies, no data leaves the browser.
   ========================================================================== */
(function () {
  var CATEGORIES = [
    {
      id: 'notice',
      name: 'Lawful Basis, Notice & Registration',
      controls: [
        'The organisation has registered as a data controller/processor with the ODPC where required.',
        'A privacy notice is published and describes the purposes of processing in plain language.',
        'Each processing activity is mapped to a lawful basis under the Data Protection Act, 2019.',
        'Privacy notices are reviewed and updated whenever processing purposes change.',
        "Children's data, where collected, has additional safeguards and parental consent mechanisms.",
        'Special/sensitive personal data has a documented legal basis and additional safeguards.'
      ]
    },
    {
      id: 'rights',
      name: 'Data Subject Rights',
      controls: [
        'A documented process handles data subject access requests (DSARs) within statutory timelines.',
        'Data subjects can request correction or rectification of inaccurate personal data.',
        'Data subjects can request erasure or deletion of personal data where applicable.',
        'Data subjects can object to or restrict certain processing, such as direct marketing.',
        'A data portability mechanism exists for applicable processing.',
        'Identity is verified before a rights request is actioned.',
        'Staff are trained to recognise and escalate data subject rights requests.'
      ]
    },
    {
      id: 'consent',
      name: 'Consent Management',
      controls: [
        'Consent is obtained freely and specifically, and is clearly distinguishable from other terms.',
        'Consent can be withdrawn as easily as it was given.',
        'Consent records (who, when, what was agreed) are retained as evidence.',
        'Cookie and tracking consent is obtained before non-essential cookies are set.',
        'Marketing consent is captured separately from consent for core service delivery.',
        'Consent language avoids bundling multiple purposes into a single opt-in.'
      ]
    },
    {
      id: 'governance',
      name: 'DPO & Governance',
      controls: [
        'A Data Protection Officer (or equivalent) has been appointed and notified to the ODPC where required.',
        'The DPO has a direct reporting line to senior management or the board on data protection matters.',
        'A data protection policy has been approved and is periodically reviewed.',
        'Staff receive periodic data protection training.',
        'A DPIA (data protection impact assessment) process exists for high-risk processing.',
        'The board or senior leadership receives periodic reporting on data protection risk.'
      ]
    },
    {
      id: 'vendors',
      name: 'Vendors & Data Processing Agreements',
      controls: [
        'Data processing agreements are in place with all third-party processors.',
        "Vendor due diligence assesses a processor's data protection and security posture before onboarding.",
        'Sub-processing by vendors requires prior authorisation.',
        'Contracts specify data return or deletion obligations on termination.',
        'AI and cloud vendors are assessed for data residency and access controls.',
        'Vendor compliance is periodically reviewed or audited.'
      ]
    },
    {
      id: 'security',
      name: 'Security Safeguards',
      controls: [
        'Access to personal data is restricted on a need-to-know basis with role-based access controls.',
        'Personal data is encrypted in transit and at rest where appropriate.',
        'Multi-factor authentication is enforced for systems holding personal data.',
        'Regular security testing, such as vulnerability scanning or penetration testing, is conducted.',
        'Physical safeguards protect premises and devices holding personal data.',
        'A formal information security policy governs the handling of personal data.',
        'Employee offboarding includes timely revocation of system access.'
      ]
    },
    {
      id: 'breach',
      name: 'Breach Response',
      controls: [
        'A documented data breach response plan exists.',
        'The organisation can detect and investigate a suspected breach within a defined timeframe.',
        'A process exists to notify the ODPC within 72 hours where required.',
        'A process exists to notify affected data subjects where there is a risk of harm.',
        'Breach incidents are logged and reviewed for root cause and remediation.',
        'Breach response roles are assigned and tested, for example through tabletop exercises.'
      ]
    },
    {
      id: 'crossborder',
      name: 'Cross-Border Transfers',
      controls: [
        'Cross-border transfers of personal data are identified and documented.',
        'Appropriate safeguards, such as standard contractual clauses or an adequacy basis, support each transfer.',
        'Data localisation requirements for regulated sectors (e.g. finance, health) are assessed.',
        'Transfer impact assessments are conducted for higher-risk jurisdictions.'
      ]
    },
    {
      id: 'retention',
      name: 'Retention & Disposal',
      controls: [
        'Data retention periods are defined for each category of personal data.',
        'Personal data is securely disposed of or deleted at the end of its retention period.',
        'Data minimisation principles guide what personal data is collected.',
        'Archived and backup data is subject to the same retention and disposal controls.'
      ]
    }
  ];

  var SECTORS = [
    { id: 'fintech', label: 'Fintech & Digital Finance', icon: 'fa-sack-dollar', focus: ['security', 'crossborder'], note: "Payment and forex-adjacent processing raises the bar on <strong>Security Safeguards</strong> and <strong>Cross-Border Transfers</strong> \u2014 areas the ODPC and Central Bank both scrutinise closely for fintechs." },
    { id: 'health', label: 'Healthcare & Health-Tech', icon: 'fa-notes-medical', focus: ['rights', 'retention'], note: "Health data is treated as sensitive personal data under the Act, so <strong>Data Subject Rights</strong> and <strong>Retention & Disposal</strong> carry extra weight \u2014 particularly patient access requests and secure record disposal." },
    { id: 'education', label: 'Learning Institutions', icon: 'fa-graduation-cap', focus: ['consent', 'governance'], note: "Schools and universities hold significant volumes of children's and staff data, so <strong>Consent Management</strong> and <strong>DPO & Governance</strong> \u2014 including safeguards for minors \u2014 are the areas ODPC guidance emphasises most." },
    { id: 'startup', label: 'Technology, SaaS & Startups', icon: 'fa-rocket', focus: ['vendors', 'governance'], note: "Fast-growing platforms typically lean on cloud and AI vendors, so <strong>Vendors & DPAs</strong> and <strong>DPO & Governance</strong> are usually the first things investors and enterprise customers ask about in due diligence." },
    { id: 'corporate', label: 'Corporate & Other', icon: 'fa-building', focus: ['governance', 'security'], note: "For established corporates, <strong>DPO & Governance</strong> and <strong>Security Safeguards</strong> tend to be where legacy practices lag furthest behind current ODPC expectations." }
  ];

  var TOTAL_STEPS = CATEGORIES.length + 2; // sector + categories + report
  var state = { step: 0, sector: null, answers: {} };

  var modal = document.getElementById('kc-modal');
  var startBtn = document.getElementById('kc-start-btn');
  var closeBtn = document.getElementById('kc-modal-close');
  var body = document.getElementById('kc-modal-body');
  var progressBar = document.getElementById('kc-progress-bar');
  var lastFocused = null;

  if (!modal || !startBtn || !body) return;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  }); }

  function totalControls() {
    var n = 0;
    CATEGORIES.forEach(function (c) { n += c.controls.length; });
    return n;
  }

  function openModal() {
    lastFocused = document.activeElement;
    state.step = 0;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    render();
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  startBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  function updateProgress() {
    var pct = Math.round((state.step / (TOTAL_STEPS - 1)) * 100);
    if (progressBar) progressBar.style.width = pct + '%';
  }

  function renderSectorStep() {
    var html = '<div class="kc-step-label">Step 1 of ' + TOTAL_STEPS + '</div>';
    html += '<h3>What sector best describes your organisation?</h3>';
    html += '<p class="kc-modal-intro">This lets the report highlight the two control areas the ODPC and sector regulators usually focus on first for organisations like yours.</p>';
    html += '<div class="kc-sector-grid">';
    SECTORS.forEach(function (s) {
      var sel = state.sector === s.id ? ' is-selected' : '';
      html += '<div class="kc-sector-option' + sel + '" data-sector="' + s.id + '" role="button" tabindex="0">' +
        '<i class="fas ' + s.icon + '"></i><span>' + esc(s.label) + '</span></div>';
    });
    html += '</div>';
    html += '<div class="kc-nav-row"><span class="kc-hint">Select a sector to continue.</span>' +
      '<button type="button" class="btn btn-brass btn-sm" id="kc-next" disabled>Next <i class="fas fa-arrow-right"></i></button></div>';
    body.innerHTML = html;

    body.querySelectorAll('.kc-sector-option').forEach(function (el) {
      var pick = function () {
        state.sector = el.getAttribute('data-sector');
        body.querySelectorAll('.kc-sector-option').forEach(function (o) { o.classList.remove('is-selected'); });
        el.classList.add('is-selected');
        var nextBtn = document.getElementById('kc-next');
        if (nextBtn) nextBtn.disabled = false;
      };
      el.addEventListener('click', pick);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    var next = document.getElementById('kc-next');
    if (next) next.addEventListener('click', function () { state.step++; render(); });
  }

  function renderCategoryStep(catIndex) {
    var cat = CATEGORIES[catIndex];
    var html = '<div class="kc-step-label">Step ' + (state.step + 1) + ' of ' + TOTAL_STEPS + ' &mdash; ' + esc(cat.name) + '</div>';
    html += '<h3>' + esc(cat.name) + '</h3>';
    html += '<p class="kc-modal-intro">For each control, select the option that best reflects current practice.</p>';

    cat.controls.forEach(function (text, i) {
      var key = cat.id + ':' + i;
      var current = state.answers[key];
      html += '<div class="kc-question" data-key="' + key + '"><p>' + esc(text) + '</p>' +
        '<div class="kc-answer-row">' +
        ['1', '0.5', '0'].map(function (val) {
          var label = val === '1' ? 'Yes' : (val === '0.5' ? 'Partial' : 'No');
          var active = current === val ? ' is-active' : '';
          return '<button type="button" class="' + active.trim() + '" data-val="' + val + '">' + label + '</button>';
        }).join('') +
        '</div></div>';
    });

    html += '<div class="kc-nav-row"><button type="button" class="btn btn-line btn-sm" id="kc-back">Back</button>' +
      '<button type="button" class="btn btn-brass btn-sm" id="kc-next">Next <i class="fas fa-arrow-right"></i></button></div>';
    body.innerHTML = html;

    body.querySelectorAll('.kc-question').forEach(function (q) {
      var key = q.getAttribute('data-key');
      q.querySelectorAll('.kc-answer-row button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.answers[key] = btn.getAttribute('data-val');
          q.querySelectorAll('.kc-answer-row button').forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
        });
      });
    });
    document.getElementById('kc-back').addEventListener('click', function () { state.step--; render(); });
    document.getElementById('kc-next').addEventListener('click', function () { state.step++; render(); });
  }

  function computeReport() {
    var perCategory = {};
    var totalScore = 0, totalMax = 0;
    CATEGORIES.forEach(function (cat) {
      var score = 0, max = cat.controls.length;
      cat.controls.forEach(function (_, i) {
        var v = state.answers[cat.id + ':' + i];
        score += v ? parseFloat(v) : 0;
      });
      perCategory[cat.id] = { name: cat.name, score: score, max: max, pct: Math.round((score / max) * 100) };
      totalScore += score; totalMax += max;
    });
    var overallPct = Math.round((totalScore / totalMax) * 100);
    return { perCategory: perCategory, overallPct: overallPct };
  }

  function bandFor(pct) {
    if (pct >= 80) return { label: 'Strong', cls: 'kc-band-strong' };
    if (pct >= 50) return { label: 'Developing', cls: 'kc-band-developing' };
    return { label: 'At Risk', cls: 'kc-band-risk' };
  }

  function renderReport() {
    var report = computeReport();
    var band = bandFor(report.overallPct);
    var sector = SECTORS.filter(function (s) { return s.id === state.sector; })[0] || SECTORS[4];

    var html = '<div class="kc-step-label">Your Report</div>';
    html += '<h3>Compliance Readiness Report</h3>';
    html += '<div class="kc-report-score"><div class="big">' + report.overallPct + '%</div>' +
      '<div class="kc-report-band ' + band.cls + '">' + band.label + '</div></div>';

    html += '<div class="kc-sector-note"><strong>' + esc(sector.label) + ' &mdash; sector priority focus:</strong><br>' + sector.note + '</div>';

    var rows = CATEGORIES.slice().sort(function (a, b) { return report.perCategory[a.id].pct - report.perCategory[b.id].pct; });
    rows.forEach(function (cat) {
      var c = report.perCategory[cat.id];
      var isFocus = sector.focus.indexOf(cat.id) !== -1;
      html += '<div class="kc-cat-row"><div class="kc-cat-row-top"><span>' + esc(cat.name) + (isFocus ? ' <i class="fas fa-star" style="color:var(--cta);font-size:.7rem;" title="Sector priority"></i>' : '') + '</span><span>' + c.pct + '%</span></div>' +
        '<div class="kc-cat-track"><div class="kc-cat-fill" style="width:' + c.pct + '%;background:' + (c.pct >= 80 ? 'var(--success)' : c.pct >= 50 ? 'var(--warning)' : 'var(--error)') + ';"></div></div></div>';
    });

    html += '<p style="font-size:.82rem;color:var(--muted);margin-top:8px;">Unanswered controls are scored as not yet in place. This self-assessment is directional and does not constitute legal advice.</p>';

    html += '<div class="kc-report-actions">' +
      '<a href="contact.html" class="btn btn-brass btn-sm">Discuss This Report <i class="fas fa-arrow-right"></i></a>' +
      '<button type="button" class="btn btn-line btn-sm" id="kc-print">Print / Save Report</button>' +
      '<button type="button" class="btn btn-line btn-sm" id="kc-restart">Retake Assessment</button>' +
      '</div>';

    body.innerHTML = html;
    document.getElementById('kc-print').addEventListener('click', function () { window.print(); });
    document.getElementById('kc-restart').addEventListener('click', function () {
      state = { step: 0, sector: null, answers: {} };
      render();
    });
  }

  function render() {
    updateProgress();
    if (state.step === 0) {
      renderSectorStep();
    } else if (state.step <= CATEGORIES.length) {
      renderCategoryStep(state.step - 1);
    } else {
      renderReport();
    }
    body.scrollTop = 0;
    var inner = document.getElementById('kc-modal-inner');
    if (inner) inner.scrollTop = 0;
  }
})();
