// ADR-0089 — the tenant-admin module preview.
//
// The "Modulok" tab sells modules the tenant does not own yet, so it has to SHOW
// them: the tenant's own site, rendered as if the cart were paid for. The render
// itself is done by renderTenantModulePreview() (tenant/editor.ts, writes nothing);
// this file only decorates the resulting page so the tenant can read it:
//
//   · every section belonging to a NOT-YET-OWNED module wears a MINTA badge —
//     without it the preview would quietly claim the content is already theirs
//     (§B.17, and the bait-and-switch invariant);
//   · #focus=<id> outlines one module's section and scrolls to it;
//   · #only=<id> keeps a single section — this is what the shop-card thumbnails
//     show, and it is a HASH on purpose: all thumbnails then share ONE cached
//     document instead of triggering one full render each.
//
// The decoration is client-side because both are view state, not content: the same
// cached render serves the overlay and all twelve thumbnails.

import { MODULE_CATALOG } from "../modules.js";
import { T } from "../i18n/mail.js";

/** The `data-cit-module` anchors a catalog module renders under, if any. */
export function domAnchorsOf(moduleId: string): readonly string[] {
  const def = MODULE_CATALOG.find((m) => m.id === moduleId);
  if (!def?.domType) return [];
  return [def.domType, ...(def.domTypesAlso ?? [])];
}

/** Catalog ids that can be previewed (the subscription catalog, spine included). */
export function previewableIds(): readonly string[] {
  return MODULE_CATALOG.filter((m) => m.billing !== "once").map((m) => m.id);
}

/**
 * Parse the `on=` query into a module-id set. Unknown ids are dropped (never
 * trusted into the renderer), and the spine is always present — it is included in
 * the base price, so a preview without it would show a site nobody can contact.
 */
export function parsePreviewSet(raw: string | null): Set<string> {
  const known = new Set(previewableIds());
  // `on=*` — the all-in render every shop-card thumbnail clips a section out of.
  // One shared URL means ONE render and ONE cached document for all of them.
  if (raw === "*") return new Set(known);
  const out = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const id = part.trim();
    if (id && known.has(id)) out.add(id);
  }
  for (const m of MODULE_CATALOG) if (m.spine) out.add(m.id);
  return out;
}

const PREVIEW_CSS = `
/* The badge FLOWS above the section title instead of floating over it: absolutely
   positioned it covered the heading on a phone (measured, 2026-08-31). */
.cit-pv-badge{display:block;margin:0 auto 10px;width:fit-content;max-width:92%;
  font:600 12px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.02em;
  background:#fff4d6;color:#8a6300;border:1px solid #e8cf90;border-radius:999px;
  padding:5px 12px;text-align:center;position:relative;z-index:40}
.cit-pv-focus{outline:3px solid #1fb6d6;outline-offset:-3px;box-shadow:0 0 0 100vmax rgba(10,31,54,.18);
  clip-path:inset(-100vmax)}
/* Single-section clip: hide the kept element's SIBLINGS up the chain. Touching the
   kept subtree (e.g. a blanket display:revert) flattens the section's own grid/flex
   layout and it collapses to zero height — measured, 2026-08-31. */
.cit-pv-hide{display:none!important}
body.cit-pv-only .cit-pv-focus{outline:0;box-shadow:none;clip-path:none}
.cit-pv-note{margin:0;padding:38px 24px;text-align:center;font:500 15px/1.6 system-ui,-apple-system,
  "Segoe UI",Roboto,sans-serif;color:#60748b}
`;

/**
 * Inject the preview overlay. `owned` = what the tenant actually pays for today;
 * everything else previewed gets the sample badge.
 */
export function decoratePreview(
  html: string,
  opts: { owned: ReadonlySet<string>; shown: ReadonlySet<string>; lang: string },
): string {
  const anchors: Record<string, string[]> = {};
  for (const id of opts.shown) {
    const a = domAnchorsOf(id);
    if (a.length) anchors[id] = [...a];
  }
  const notOwned = [...opts.shown].filter((id) => !opts.owned.has(id));
  const payload = JSON.stringify({
    anchors,
    notOwned,
    badge: T(opts.lang, "MINTA — az Ön adataival töltjük fel"),
    // A module whose whole surface is the owner's own words (usp) has no section
    // to show until they write it. Saying so is honest; showing the page top
    // instead would pass off the hero as "this is that module" (§B.17).
    empty: T(opts.lang, "Ez a szakasz az Ön saját szövegeiből épül fel — beállítás után jelenik meg az oldalon."),
  });
  const script =
    `<style>${PREVIEW_CSS}</style>` +
    `<script>(function(){var P=${payload};` +
    `function sectionFor(id){var sels=P.anchors[id]||[];for(var i=0;i<sels.length;i++){` +
    `var el=document.querySelector('[data-cit-module="'+sels[i]+'"]');if(!el)continue;` +
    `return el.closest("section")||el;}return null}` +
    // Sample badge on everything the tenant has not paid for yet.
    `P.notOwned.forEach(function(id){var s=sectionFor(id);if(!s)return;` +
    `if(s.querySelector(":scope > .cit-pv-badge"))return;` +
    `var b=document.createElement("span");b.className="cit-pv-badge";` +
    `b.textContent=P.badge;s.insertBefore(b,s.firstChild)});` +
    // View state from the hash, so one cached document serves every thumbnail.
    `function apply(){var h=new URLSearchParams((location.hash||"").replace(/^#/,""));` +
    `var only=h.get("only"),focus=h.get("focus");` +
    `document.querySelectorAll(".cit-pv-focus").forEach(function(e){e.classList.remove("cit-pv-focus")});` +
    `document.querySelectorAll(".cit-pv-hide").forEach(function(e){e.classList.remove("cit-pv-hide")});` +
    `var old=document.querySelector(".cit-pv-note");if(old)old.remove();` +
    `document.body.classList.remove("cit-pv-only");` +
    `if(only){document.body.classList.add("cit-pv-only");var s=sectionFor(only);` +
    `if(s){for(var n=s;n&&n.parentElement;n=n.parentElement){` +
    `var sib=n.parentElement.children;` +
    `for(var i=0;i<sib.length;i++)if(sib[i]!==n)sib[i].classList.add("cit-pv-hide");` +
    `if(n.parentElement===document.body)break}}` +
    `else{for(var c=document.body.children,j=0;j<c.length;j++)c[j].classList.add("cit-pv-hide");` +
    `var note=document.createElement("p");note.className="cit-pv-note";note.textContent=P.empty;` +
    `document.body.appendChild(note)}return}` +
    // Scroll BELOW the site's own sticky header — scrollIntoView parks the section
    // top under it, and the sample badge (the honesty marker) ends up hidden.
    `if(focus){var f=sectionFor(focus);if(f){f.classList.add("cit-pv-focus");` +
    `setTimeout(function(){var off=0,hd=document.querySelector("header,nav");` +
    `if(hd){var st=getComputedStyle(hd);if(st.position==="fixed"||st.position==="sticky")off=hd.offsetHeight}` +
    `window.scrollTo({top:Math.max(0,f.getBoundingClientRect().top+window.pageYOffset-off-14)})},60)}}}` +
    `window.addEventListener("hashchange",apply);apply();})();</script>`;
  return html.includes("</body>") ? html.replace("</body>", `${script}</body>`) : html + script;
}
