/*
 * Citoviso UI — shared chrome behaviours (design core / "dizájn-mag").
 * ADR-0021 ①. Progressive enhancement only: the page is fully usable without JS.
 * JS hooks are data-attributes so any surface (homepage, console, admin) reuses them:
 *   [data-citui-header]       — sticky header, gets .is-scrolled past 20px
 *   [data-citui-menu-toggle]  — mobile menu button
 *   [data-citui-nav]          — nav container toggled with .is-open
 *   .citui-reveal             — scroll-reveal targets, get .citui-visible in view
 */
(function () {
  "use strict";

  // Mark JS as available so the reveal hidden-state can apply (see citui.css).
  // (index.html also sets this inline in <head> to avoid a flash — this is a fallback.)
  document.documentElement.classList.add("citui-js");

  // Sticky header state
  var header = document.querySelector("[data-citui-header]");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 20); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Mobile navigation
  var toggle = document.querySelector("[data-citui-menu-toggle]");
  var nav = document.querySelector("[data-citui-nav]");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("citui-menu-open", open);
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("citui-menu-open");
      });
    });
  }

  // Scroll reveal (falls back to visible when unsupported or reduced-motion)
  var reveals = document.querySelectorAll(".citui-reveal");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("citui-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("citui-visible"); });
  }
})();
