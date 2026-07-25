/* =========================================================================
   CONVERSION.JS — site-wide funnel instrumentation + WhatsApp widget
   Loaded on every real page (root pages + /resources/**). Two jobs:

   1. Delegated click tracking for the events product/marketing actually
      need to see which CTA is producing consultations:
        - whatsapp_click          any wa.me link, anywhere on the page
        - booking_widget_click    the Zoho "Book a ... Gap Analysis" links
        - registration_cta_click  ODPC registration CTAs, tagged with which
                                   package (?package=micro-small|medium|large)
        - retainer_cta_click      any CTA pointing at the retainer offer
                                   (?interest=retainer or data-cta="retainer")
      These are delegated (one listener on document) so they work on every
      page without needing per-page wiring, and keep working on content
      added later without touching this file again.

   2. A small persistent WhatsApp button. Self-contained (own inline SVG,
      own injected CSS) so it renders identically everywhere, including the
      ~50 templates that don't load Font Awesome. Sits above the mobile
      sticky booking bar and behind any open modal/cookie banner.
   ========================================================================= */
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "254736358938";
  var WHATSAPP_URL = "https://wa.me/" + WHATSAPP_NUMBER;

  function track(eventName, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params || {});
    }
  }

  function packageFromHref(href) {
    try {
      var url = new URL(href, window.location.href);
      return url.searchParams.get("package") || url.searchParams.get("tier") || null;
    } catch (e) { return null; }
  }

  function interestFromHref(href) {
    try {
      var url = new URL(href, window.location.href);
      return url.searchParams.get("interest") || null;
    } catch (e) { return null; }
  }

  /* ---------------- Delegated click tracking ---------------- */
  document.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest("a[href]") : null;
    if (!link) return;
    var href = link.getAttribute("href") || "";

    if (href.indexOf("wa.me/") !== -1) {
      track("whatsapp_click", {
        link_text: (link.textContent || "").trim().slice(0, 80),
        page_path: window.location.pathname
      });
      return;
    }

    if (href.indexOf("zohobookings.com") !== -1 || href.indexOf("/book") === 0 || href === "book.html") {
      track("booking_widget_click", {
        link_text: (link.textContent || "").trim().slice(0, 80),
        page_path: window.location.pathname
      });
      return;
    }

    if (href.indexOf("odpc-registration.html") !== -1 || link.hasAttribute("data-package")) {
      var pkg = link.getAttribute("data-package") || packageFromHref(href);
      if (pkg) {
        track("registration_cta_click", { package: pkg, page_path: window.location.pathname });
        return;
      }
    }

    var interest = link.getAttribute("data-cta") === "retainer" ? "retainer" : interestFromHref(href);
    if (interest === "retainer") {
      track("retainer_cta_click", { page_path: window.location.pathname });
    }
  }, true);

  /* ---------------- WhatsApp floating widget ---------------- */
  function injectStyles() {
    if (document.getElementById("cv-wa-style")) return;
    var style = document.createElement("style");
    style.id = "cv-wa-style";
    style.textContent = [
      "#cv-wa-fab{position:fixed;right:18px;bottom:18px;z-index:1900;",
      "display:flex;align-items:center;justify-content:center;",
      "width:56px;height:56px;border-radius:50%;background:#25D366;",
      "box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer;text-decoration:none;",
      "transition:bottom .25s ease,transform .15s ease,opacity .2s ease;}",
      "#cv-wa-fab:hover{transform:scale(1.06);}",
      "#cv-wa-fab svg{width:30px;height:30px;display:block;}",
      "#cv-wa-fab.cv-wa-raised{bottom:88px;}",
      "#cv-wa-fab.cv-wa-hidden{opacity:0;pointer-events:none;transform:scale(.85);}",
      "@media(min-width:981px){#cv-wa-fab{right:26px;bottom:26px;}#cv-wa-fab.cv-wa-raised{bottom:26px;}}"
    ].join("");
    document.head.appendChild(style);
  }

  function buildWidget() {
    if (document.getElementById("cv-wa-fab")) return;
    injectStyles();

    var a = document.createElement("a");
    a.id = "cv-wa-fab";
    a.href = WHATSAPP_URL;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "Chat with us on WhatsApp");
    a.innerHTML =
      '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path fill="#fff" d="M16.02 3C9.4 3 4 8.4 4 15.02c0 2.23.62 4.32 1.7 6.11L4 29l8.06-1.66a12.9 12.9 0 0 0 3.96.62c6.62 0 12.02-5.4 12.02-12.02C28.04 8.4 22.65 3 16.02 3zm0 21.94c-1.98 0-3.83-.55-5.4-1.5l-.39-.23-4.78.99 1-4.66-.25-.4a9.9 9.9 0 0 1-1.6-5.42c0-5.47 4.45-9.92 9.93-9.92 5.47 0 9.92 4.45 9.92 9.92 0 5.48-4.45 9.92-9.93 10.22zm5.46-7.44c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.91-2.2-.24-.58-.49-.5-.67-.5-.17 0-.37-.02-.57-.02-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.06 4.47.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/>' +
      '</svg>';
    document.body.appendChild(a);

    var stickyBar = document.getElementById("mobile-booking-bar");
    var openModal = null;
    var syncPosition = function () {
      var raised = stickyBar && stickyBar.classList.contains("is-visible");
      a.classList.toggle("cv-wa-raised", !!raised);
      var anyModalOpen =
        document.querySelector(".kg-modal.is-open") ||
        document.querySelector(".kc-modal.is-open") ||
        document.body.classList.contains("nav-locked");
      a.classList.toggle("cv-wa-hidden", !!anyModalOpen);
    };
    syncPosition();
    window.addEventListener("scroll", syncPosition, { passive: true });
    window.addEventListener("resize", syncPosition);
    // Modal state changes don't fire their own events, so poll lightly —
    // cheap (class checks only) and keeps the widget from covering a modal.
    setInterval(syncPosition, 400);

    a.addEventListener("click", function () {
      track("whatsapp_click", { link_text: "floating_widget", page_path: window.location.pathname });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidget);
  } else {
    buildWidget();
  }
})();
