/* =========================================================================
   KPLR PLATFORM — SHARED CLIENT-SIDE BEHAVIOUR
   No build step, no framework. Vanilla JS, progressively enhances static
   HTML. Every page includes this file plus (on listing pages) a page-level
   inline call to KPLR.initListing(...).
   ========================================================================= */
(function () {
  "use strict";
  var KPLR = window.KPLR = window.KPLR || {};

  /* ---------------- Theme (dark default, light optional) ---------------- */
  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem("kplr-theme"); } catch (e) {}
    var theme = stored || "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-kplr-theme-toggle]").forEach(function (btn) {
      updateThemeIcon(btn, theme);
      btn.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme");
        var next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("kplr-theme", next); } catch (e) {}
        document.querySelectorAll("[data-kplr-theme-toggle]").forEach(function (b) { updateThemeIcon(b, next); });
      });
    });
  }
  function updateThemeIcon(btn, theme) { btn.textContent = theme === "dark" ? "☾" : "☀"; btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode"); }

  /* ---------------- Font size control ---------------- */
  function initFontControl() {
    var sizes = [16, 18, 20, 22];
    var stored = null;
    try { stored = parseInt(localStorage.getItem("kplr-font-size"), 10); } catch (e) {}
    var idx = sizes.indexOf(stored) > -1 ? sizes.indexOf(stored) : 1;
    applySize(sizes[idx]);
    document.querySelectorAll("[data-kplr-font-inc]").forEach(function (b) {
      b.addEventListener("click", function () { idx = Math.min(sizes.length - 1, idx + 1); applySize(sizes[idx]); });
    });
    document.querySelectorAll("[data-kplr-font-dec]").forEach(function (b) {
      b.addEventListener("click", function () { idx = Math.max(0, idx - 1); applySize(sizes[idx]); });
    });
    function applySize(px) {
      document.documentElement.style.setProperty("--kplr-font-scale", px + "px");
      try { localStorage.setItem("kplr-font-size", px); } catch (e) {}
    }
  }

  /* ---------------- Reading progress bar ---------------- */
  function initProgress() {
    var bar = document.querySelector("[data-kplr-progress]");
    var article = document.querySelector("[data-kplr-article-root]");
    if (!bar || !article) return;
    function update() {
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight * 0.5;
      var scrolled = -rect.top;
      var pct = total > 0 ? Math.max(0, Math.min(100, (scrolled / total) * 100)) : 0;
      bar.style.width = pct + "%";
    }
    document.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------------- TOC scrollspy + mobile collapse ---------------- */
  function initTOC() {
    var toc = document.querySelector("[data-kplr-toc]");
    if (!toc) return;
    var toggle = toc.querySelector("[data-kplr-toc-toggle]");
    if (toggle) toggle.addEventListener("click", function () { toc.classList.toggle("open"); });

    var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
    var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
    if (!targets.length) return;
    function onScroll() {
      var pos = window.scrollY + 110;
      var activeIdx = 0;
      targets.forEach(function (t, i) { if (t.offsetTop <= pos) activeIdx = i; });
      links.forEach(function (a, i) { a.classList.toggle("active", i === activeIdx); });
    }
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- Toast ---------------- */
  var toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "kplr-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }
  KPLR.toast = toast;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Copied to clipboard"); }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Copied to clipboard"); } catch (e) { toast("Copy failed — select and copy manually"); }
    document.body.removeChild(ta);
  }
  KPLR.copyText = copyText;

  /* ---------------- Copy link / print / bookmark ---------------- */
  function initSimpleActions() {
    document.querySelectorAll("[data-kplr-copy-link]").forEach(function (b) {
      b.addEventListener("click", function () { copyText(window.location.href); });
    });
    document.querySelectorAll("[data-kplr-print]").forEach(function (b) {
      b.addEventListener("click", function () { window.print(); });
    });
    document.querySelectorAll("[data-kplr-bookmark]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = "kplr-bookmarks";
        var url = window.location.pathname;
        var list = [];
        try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
        if (list.indexOf(url) === -1) { list.push(url); toast("Bookmarked locally"); }
        else { list = list.filter(function (u) { return u !== url; }); toast("Removed bookmark"); }
        try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
      });
    });
  }

  /* ---------------- Citation formatting ---------------- */
  function formatCitation(meta, style) {
    var year = "2026";
    var pn = meta.pubNumber;
    var title = meta.title, sub = meta.subtitle, journal = meta.journal, url = meta.url, author = meta.author;
    var last = "Patrick", first = "Muchangi";
    switch (style) {
      case "apa":
        return first + " " + last + " (" + year + "). " + title + ": " + sub + ". " + journal + ", Practice Note No. " + pn + ". " + url;
      case "oscola":
        return "Muchangi Patrick, '" + title + ": " + sub + "' (" + year + ") " + journal + " Practice Note No. " + pn + ".";
      case "bluebook":
        return "Muchangi Patrick, " + title + ": " + sub + ", " + journal + ", Practice Note No. " + pn + " (" + year + ").";
      case "chicago":
        return last + ", " + first + ". \"" + title + ": " + sub + ".\" " + journal + ", Practice Note No. " + pn + " (" + meta.dateDisplay + ").";
      case "harvard":
        return last + ", " + first[0] + ". (" + year + ") '" + title + ": " + sub + "', " + journal + ", Practice Note No. " + pn + ". Available at: " + url;
      default:
        return meta.citationText;
    }
  }
  function bibtex(meta) {
    var key = "patrick" + meta.year + meta.slug.replace(/-/g, "");
    return "@techreport{" + key + ",\n" +
      "  author = {Muchangi Patrick},\n" +
      "  title = {" + meta.title + ": " + meta.subtitle + "},\n" +
      "  institution = {" + meta.journal + "},\n" +
      "  year = {" + meta.year + "},\n" +
      "  number = {" + meta.ref + "},\n" +
      "  url = {" + meta.url + "}\n" +
      "}";
  }
  function ris(meta) {
    return ["TY  - RPRT",
      "AU  - Patrick, Muchangi",
      "TI  - " + meta.title + ": " + meta.subtitle,
      "PY  - " + meta.year,
      "PB  - " + meta.journal,
      "SN  - " + meta.ref,
      "UR  - " + meta.url,
      "ER  - "].join("\n");
  }

  function initCitationPanel() {
    var panel = document.querySelector("[data-kplr-citation-panel]");
    if (!panel) return;
    var meta = JSON.parse(panel.getAttribute("data-meta"));
    var textEl = panel.querySelector("[data-kplr-citation-text]");
    var tabs = Array.prototype.slice.call(panel.querySelectorAll("[data-kplr-citation-tab]"));
    var style = "apa";
    function render() { textEl.textContent = formatCitation(meta, style); }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        style = t.getAttribute("data-kplr-citation-tab");
        tabs.forEach(function (x) { x.classList.toggle("active", x === t); });
        render();
      });
    });
    render();
    var copyBtn = panel.querySelector("[data-kplr-citation-copy]");
    if (copyBtn) copyBtn.addEventListener("click", function () { copyText(textEl.textContent); });
    var bibBtn = panel.querySelector("[data-kplr-export-bibtex]");
    if (bibBtn) bibBtn.addEventListener("click", function () { copyText(bibtex(meta)); toast("BibTeX copied"); });
    var risBtn = panel.querySelector("[data-kplr-export-ris]");
    if (risBtn) risBtn.addEventListener("click", function () { copyText(ris(meta)); toast("RIS copied"); });
  }

  /* ---------------- Share links ---------------- */
  function initShare() {
    document.querySelectorAll("[data-kplr-share]").forEach(function (a) {
      var kind = a.getAttribute("data-kplr-share");
      var url = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);
      var map = {
        linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + url,
        x: "https://twitter.com/intent/tweet?url=" + url + "&text=" + title,
        email: "mailto:?subject=" + title + "&body=" + url,
        whatsapp: "https://wa.me/?text=" + title + "%20" + url
      };
      if (map[kind]) a.setAttribute("href", map[kind]);
    });
  }

  /* ---------------- Listing / search page ---------------- */
  function initListing(indexUrl, gridSelector) {
    var grid = document.querySelector(gridSelector);
    var searchInput = document.querySelector("[data-kplr-search-input]");
    var sortSelect = document.querySelector("[data-kplr-sort-select]");
    var chips = Array.prototype.slice.call(document.querySelectorAll("[data-kplr-filter-chip]"));
    var resultsMeta = document.querySelector("[data-kplr-results-meta]");
    var emptyState = document.querySelector("[data-kplr-empty-state]");
    if (!grid) return;

    var allItems = [];
    var activeFilter = "all";

    fetch(indexUrl).then(function (r) { return r.json(); }).then(function (data) {
      allItems = data;
      render();
    }).catch(function () {
      if (resultsMeta) resultsMeta.textContent = "Could not load publications index.";
    });

    function matchesFilter(item) {
      if (activeFilter === "all") return true;
      return (item.topics || []).indexOf(activeFilter) > -1 || item.practiceArea === activeFilter || item.category === activeFilter;
    }
    function matchesSearch(item, q) {
      if (!q) return true;
      q = q.toLowerCase();
      var hay = [item.title, item.subtitle, item.ref, item.practiceArea, item.category, item.author, (item.keywords || []).join(" "), (item.topics || []).join(" ")].join(" ").toLowerCase();
      return hay.indexOf(q) > -1;
    }
    function sortItems(items, mode) {
      var copy = items.slice();
      if (mode === "oldest") copy.sort(function (a, b) { return a.publicationDate.localeCompare(b.publicationDate); });
      else if (mode === "title") copy.sort(function (a, b) { return a.title.localeCompare(b.title); });
      else copy.sort(function (a, b) { return b.publicationDate.localeCompare(a.publicationDate); }); // newest default
      return copy;
    }

    function render() {
      var q = searchInput ? searchInput.value.trim() : "";
      var mode = sortSelect ? sortSelect.value : "newest";
      var filtered = allItems.filter(function (i) { return matchesFilter(i) && matchesSearch(i, q); });
      filtered = sortItems(filtered, mode);

      grid.innerHTML = "";
      filtered.forEach(function (item) { grid.appendChild(buildCard(item)); });

      if (resultsMeta) resultsMeta.textContent = filtered.length + (filtered.length === 1 ? " publication" : " publications") + (q ? " matching \u201c" + q + "\u201d" : "");
      if (emptyState) emptyState.style.display = filtered.length ? "none" : "block";
    }

    function buildCard(item) {
      var a = document.createElement("a");
      a.className = "kplr-card";
      a.href = item.url;
      a.innerHTML =
        '<div class="kplr-card-cover"><img src="' + item.coverThumb + '" alt="' + escapeHtml(item.title) + ' cover" loading="lazy"></div>' +
        '<div class="kplr-card-body">' +
          '<div class="kplr-card-toprow"><span class="kplr-card-num">' + item.ref + '</span><span class="kplr-card-cat">' + escapeHtml(item.category) + '</span></div>' +
          '<h3 class="kplr-card-title">' + escapeHtml(item.title) + '</h3>' +
          '<div class="kplr-card-area">' + escapeHtml(item.practiceArea) + '</div>' +
          '<div class="kplr-card-footer"><span class="read">Read Online →</span><span>' + item.readingTime + ' min · PDF</span></div>' +
        '</div>';
      return a;
    }
    function escapeHtml(s) { return (s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    if (searchInput) searchInput.addEventListener("input", debounce(render, 120));
    if (sortSelect) sortSelect.addEventListener("change", render);
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        activeFilter = c.getAttribute("data-kplr-filter-chip");
        chips.forEach(function (x) { x.classList.toggle("active", x === c); });
        render();
      });
    });
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); var a = arguments; t = setTimeout(function () { fn.apply(null, a); }, ms); }; }
  KPLR.initListing = initListing;

  /* ---------------- Keyboard navigation for TOC / article ---------------- */
  function initKeyboardNav() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "j" || e.key === "k") {
        var headings = Array.prototype.slice.call(document.querySelectorAll(".kplr-article h2, .kplr-article h3"));
        if (!headings.length) return;
        var pos = window.scrollY + 120;
        var idx = headings.findIndex(function (h) { return h.offsetTop > pos; });
        if (e.key === "j") { var target = idx === -1 ? headings[headings.length - 1] : headings[idx]; target.scrollIntoView({ behavior: "smooth" }); }
        if (e.key === "k") { var pidx = idx === -1 ? headings.length - 1 : Math.max(0, idx - 2); headings[pidx].scrollIntoView({ behavior: "smooth" }); }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initFontControl();
    initProgress();
    initTOC();
    initSimpleActions();
    initCitationPanel();
    initShare();
    initKeyboardNav();
  });
})();
