/* =========================================================================
   MP-NAV — shared behaviour for the global nav, dark-mode toggle and the
   command palette. Loaded on every page. Theme preference is stored under
   the same key the Knowledge Centre's KPLR.initTheme() already uses, so a
   visitor's choice persists whether they're on the homepage, a case note,
   or a Practice Note.
   ========================================================================= */
(function(){
  "use strict";
  var THEME_KEY = "kplr-theme";

  /* ---------------- Theme ---------------- */
  function getTheme(){
    try { return localStorage.getItem(THEME_KEY) || "light"; } catch(e){ return "light"; }
  }
  function setTheme(theme){
    try { localStorage.setItem(THEME_KEY, theme); } catch(e){}
    document.documentElement.setAttribute("data-theme", theme);
    var invert = document.body.classList.contains("mp-invert");
    document.documentElement.classList.toggle("mp-inverted", invert && theme === "dark");
    document.querySelectorAll(".mp-nav-theme i").forEach(function(icon){
      icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
    });
    document.querySelectorAll(".mp-nav-theme").forEach(function(btn){
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    });
  }
  function initTheme(){
    setTheme(getTheme());
    document.querySelectorAll(".mp-nav-theme, [data-kplr-theme-toggle]").forEach(function(btn){
      btn.addEventListener("click", function(){
        setTheme(getTheme() === "dark" ? "light" : "dark");
      });
    });
  }

  /* ---------------- Mobile menu ---------------- */
  function initMobileMenu(){
    var toggle = document.getElementById("mpNavToggle");
    var panel = document.getElementById("mpNavMobile");
    if(!toggle || !panel) return;

    // iOS Safari doesn't reliably honour body{overflow:hidden} — the page
    // behind the fixed nav can still scroll/rubber-band, which is what
    // makes a menu item near the top edge feel like it's "under the
    // header" (the header is stationary but the layout underneath is
    // still moving). Locking via position:fixed on the body is the
    // robust cross-browser fix.
    var lockedScrollY = 0;
    function lockScroll(){
      lockedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = "fixed";
      document.body.style.top = (-lockedScrollY) + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
    function unlockScroll(){
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, lockedScrollY);
    }

    toggle.addEventListener("click", function(){
      var open = panel.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if(open){ lockScroll(); } else { unlockScroll(); }
    });
    panel.querySelectorAll("a").forEach(function(a){
      a.addEventListener("click", function(){
        panel.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        unlockScroll();
      });
    });
  }

  /* ---------------- Mega-menu (touch support) ---------------- */
  function initMegaMenu(){
    document.querySelectorAll(".mp-nav-item").forEach(function(item){
      var btn = item.querySelector("button");
      if(!btn) return;
      btn.addEventListener("click", function(e){
        if(window.innerWidth < 981) return;
        e.preventDefault();
        var isOpen = item.classList.contains("open");
        document.querySelectorAll(".mp-nav-item.open").forEach(function(o){ o.classList.remove("open"); });
        if(!isOpen) item.classList.add("open");
      });
    });
    document.addEventListener("click", function(e){
      if(!e.target.closest(".mp-nav-item")){
        document.querySelectorAll(".mp-nav-item.open").forEach(function(o){ o.classList.remove("open"); });
      }
    });
  }

  /* ---------------- Command palette ---------------- */
  var paletteIndex = null;
  var paletteEls = {};
  var activeIndex = -1;
  var flatResults = [];

  function iconFor(type){
    switch(type){
      case "case": return "fa-gavel";
      case "note": return "fa-file-lines";
      case "practice": return "fa-briefcase";
      case "sector": return "fa-industry";
      case "page": return "fa-arrow-right";
      default: return "fa-circle";
    }
  }
  function groupLabel(type){
    switch(type){
      case "case": return "Case Digest";
      case "note": return "Knowledge Centre";
      case "practice": return "Practice Areas";
      case "sector": return "Sectors";
      case "page": return "Pages";
      default: return "Results";
    }
  }
  function loadIndex(cb){
    if(paletteIndex){ cb(paletteIndex); return; }
    fetch("/assets/data/search-index.json").then(function(r){ return r.json(); }).then(function(d){
      paletteIndex = d; cb(d);
    }).catch(function(){ paletteIndex = []; cb([]); });
  }
  function renderResults(items, query){
    var root = paletteEls.results;
    root.innerHTML = "";
    flatResults = items;
    activeIndex = items.length ? 0 : -1;
    if(!items.length){
      root.innerHTML = '<div class="mp-palette-empty">No matches for "' + escapeHtml(query) + '". Try a case name, a topic, or a practice area.</div>';
      return;
    }
    var groups = {};
    var order = [];
    items.forEach(function(item){
      if(!groups[item.type]){ groups[item.type] = []; order.push(item.type); }
      groups[item.type].push(item);
    });
    var flatIndex = 0;
    order.forEach(function(type){
      var label = document.createElement("div");
      label.className = "mp-palette-group-label";
      label.textContent = groupLabel(type);
      root.appendChild(label);
      groups[type].forEach(function(item){
        var a = document.createElement("a");
        a.className = "mp-palette-item";
        a.href = item.url;
        a.dataset.index = flatIndex++;
        a.innerHTML = '<span class="mpi-icon"><i class="fas ' + iconFor(item.type) + '"></i></span>' +
          '<span class="mpi-text"><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.subtitle || "") + '</span></span>';
        root.appendChild(a);
      });
    });
    updateActive();
  }
  function updateActive(){
    var items = paletteEls.results.querySelectorAll(".mp-palette-item");
    items.forEach(function(el, i){ el.classList.toggle("active", i === activeIndex); });
    if(items[activeIndex]) items[activeIndex].scrollIntoView({block:"nearest"});
  }
  function escapeHtml(s){
    return (s || "").replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; });
  }
  function search(query){
    if(!paletteIndex) return [];
    if(!query.trim()) return paletteIndex.slice(0, 8);
    var q = query.toLowerCase();
    return paletteIndex.filter(function(item){
      var hay = (item.title + " " + (item.subtitle || "") + " " + (item.keywords || "")).toLowerCase();
      return hay.indexOf(q) > -1;
    }).slice(0, 40);
  }
  function openPalette(){
    if(!paletteEls.overlay) return;
    paletteEls.overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    loadIndex(function(){
      paletteEls.input.value = "";
      renderResults(search(""), "");
      setTimeout(function(){ paletteEls.input.focus(); }, 30);
    });
  }
  function closePalette(){
    if(!paletteEls.overlay) return;
    paletteEls.overlay.classList.remove("open");
    document.body.style.overflow = "";
  }
  function initPalette(){
    paletteEls.overlay = document.getElementById("mpPaletteOverlay");
    paletteEls.input = document.getElementById("mpPaletteInput");
    paletteEls.results = document.getElementById("mpPaletteResults");
    if(!paletteEls.overlay) return;

    document.querySelectorAll(".mp-nav-search").forEach(function(btn){
      btn.addEventListener("click", openPalette);
    });
    paletteEls.overlay.addEventListener("click", function(e){
      if(e.target === paletteEls.overlay) closePalette();
    });
    paletteEls.input.addEventListener("input", function(){
      renderResults(search(paletteEls.input.value), paletteEls.input.value);
    });
    paletteEls.results.addEventListener("click", function(e){
      var item = e.target.closest(".mp-palette-item");
      if(item) closePalette();
    });
    document.addEventListener("keydown", function(e){
      var isTyping = /input|textarea/i.test(document.activeElement.tagName);
      if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"){
        e.preventDefault();
        paletteEls.overlay.classList.contains("open") ? closePalette() : openPalette();
        return;
      }
      if(e.key === "/" && !isTyping){
        e.preventDefault();
        openPalette();
        return;
      }
      if(!paletteEls.overlay.classList.contains("open")) return;
      if(e.key === "Escape"){ closePalette(); return; }
      if(e.key === "ArrowDown"){
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, flatResults.length - 1);
        updateActive();
      }
      if(e.key === "ArrowUp"){
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActive();
      }
      if(e.key === "Enter"){
        var active = paletteEls.results.querySelector(".mp-palette-item.active");
        if(active){ window.location.href = active.getAttribute("href"); }
      }
    });
  }

  /* ---------------- Citation panel (case notes) ---------------- */
  function formatMpCitation(meta, style){
    var year = meta.year, title = meta.title, sub = meta.subtitle, journal = meta.journal, url = meta.url, noteNo = meta.ref;
    switch(style){
      case "apa":
        return "Muchangi Patrick & Associates Advocates, Editorial Board (" + year + "). " + title + " — " + sub + ". " + journal + ", Case Note " + noteNo + ". " + url;
      case "oscola":
        return "'" + title + "' (" + journal + " Case Note " + noteNo + ", " + year + ") <" + url + ">.";
      case "bluebook":
        return "Muchangi Patrick & Assocs. Advocs., " + title + ", " + journal + ", Case Note " + noteNo + " (" + year + "), " + url + ".";
      case "chicago":
        return "Muchangi Patrick & Associates Advocates, Editorial Board. \"" + title + ": " + sub + ".\" " + journal + ", Case Note " + noteNo + " (" + year + "). " + url + ".";
      case "harvard":
        return "Muchangi Patrick & Associates Advocates (" + year + ") '" + title + "', " + journal + ", Case Note " + noteNo + ". Available at: " + url;
      default:
        return title + " — " + sub;
    }
  }
  function mpBibtex(meta){
    var key = "mp" + meta.year + meta.slug.replace(/[^a-z0-9]/gi, "");
    return "@misc{" + key + ",\n  author = {{Muchangi Patrick \\& Associates Advocates}},\n  title = {" + meta.title + "},\n  howpublished = {" + meta.journal + ", Case Note " + meta.ref + "},\n  year = {" + meta.year + "},\n  url = {" + meta.url + "}\n}";
  }
  function mpRis(meta){
    return ["TY  - CASE","AU  - Muchangi Patrick & Associates Advocates","TI  - " + meta.title,"PY  - " + meta.year,"PB  - " + meta.journal,"SN  - " + meta.ref,"UR  - " + meta.url,"ER  - "].join("\n");
  }
  function copyToClipboard(text){
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text); }
    else{
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try{ document.execCommand("copy"); }catch(e){}
      document.body.removeChild(ta);
    }
    showToast("Copied to clipboard");
  }
  function showToast(msg){
    var el = document.getElementById("mpCiteToast");
    if(!el){
      el = document.createElement("div");
      el.id = "mpCiteToast"; el.className = "mp-cite-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function(){ el.classList.remove("show"); }, 2200);
  }
  function initCitationPanel(){
    var panel = document.querySelector("[data-mp-citation-panel]");
    if(!panel) return;
    var meta = JSON.parse(panel.getAttribute("data-meta"));
    var textEl = panel.querySelector("[data-mp-citation-text]");
    var tabs = Array.prototype.slice.call(panel.querySelectorAll("[data-mp-citation-tab]"));
    var style = "apa";
    function render(){ textEl.textContent = formatMpCitation(meta, style); }
    tabs.forEach(function(t){
      t.addEventListener("click", function(){
        style = t.getAttribute("data-mp-citation-tab");
        tabs.forEach(function(x){ x.classList.toggle("active", x === t); });
        render();
      });
    });
    render();
    var copyBtn = panel.querySelector("[data-mp-citation-copy]");
    if(copyBtn) copyBtn.addEventListener("click", function(){ copyToClipboard(textEl.textContent); });
    var bibBtn = panel.querySelector("[data-mp-export-bibtex]");
    if(bibBtn) bibBtn.addEventListener("click", function(){ copyToClipboard(mpBibtex(meta)); showToast("BibTeX copied"); });
    var risBtn = panel.querySelector("[data-mp-export-ris]");
    if(risBtn) risBtn.addEventListener("click", function(){ copyToClipboard(mpRis(meta)); showToast("RIS copied"); });
  }

  document.addEventListener("DOMContentLoaded", function(){
    initTheme();
    initMobileMenu();
    initMegaMenu();
    initPalette();
    initCitationPanel();
  });
})();
