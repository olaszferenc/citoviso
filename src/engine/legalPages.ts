// ADR-0110 — the accommodation's OWN legal pages (/adatvedelem, /impresszum).
//
// Why these are not rendered through renderSite(): on the template-first path each
// of the 16 art templates brings its own header and footer, so "the legal page in
// the accommodation's template" would mean writing it 16 times — the 100×N trap the
// architecture forbids (ADR-0089: "egy ponton vágunk"). The approved plan solves it
// the way the mock did: a self-contained document page that WEARS the accommodation's
// skin (its tokens and webfonts) with a minimal header and footer of its own.
//
// Layout follows the frozen contract in assets/design-refs/tenant-site/legal-footer/:
// desktop = sticky table of contents + flat document, mobile = collapsible sections,
// plain-language "Röviden" box on top. The mock uses @container because its frame is
// a div; here the viewport IS the window, so the same breakpoints are @media.
import {
  TENANT_LEGAL_EFFECTIVE_FROM,
  TENANT_LEGAL_MISSING,
  TENANT_LEGAL_VERSION,
  TENANT_PRIVACY_TLDR,
  tenantImprintSections,
  tenantPrivacySections,
  type HostingProviderIdentity,
  type TenantLegalBlock,
  type TenantLegalIdentity,
  type TenantLegalSection,
} from "../legal.js";
import type { Recipe, SiteData } from "./recipe.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "./skins.js";
import { esc } from "./templateKit.js";

export type TenantLegalKind = "privacy" | "imprint";

/** The public paths. Kept here so the router, the footer and the guard share one truth. */
export const TENANT_LEGAL_PATHS: Readonly<Record<TenantLegalKind, string>> = {
  privacy: "/adatvedelem",
  imprint: "/impresszum",
};

const PAGE_TITLE: Readonly<Record<TenantLegalKind, string>> = {
  privacy: "Adatkezelési tájékoztató", // i18n-exempt: legal pack (§H.22)
  imprint: "Impresszum", // i18n-exempt: legal pack (§H.22)
};

const PAGE_LEAD: Readonly<Record<TenantLegalKind, string>> = {
  privacy: `Hatályos: ${TENANT_LEGAL_EFFECTIVE_FROM} · ${TENANT_LEGAL_VERSION} verzió`, // i18n-exempt: legal pack (§H.22)
  imprint:
    "Az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. törvény 4. §-a szerint", // i18n-exempt: legal pack (§H.22)
};

/**
 * A registry fact we do not hold is shown, LOUDLY, as missing (ADR-0110 ⑥).
 *
 * The marker wears the skin's accent rather than a hardcoded red: the design-token
 * doctrine (ADR-0021 ①) allows no raw hex here, and emphasis — not hue — is what
 * the rule is actually about. Bold + italic + accent reads as "something is wrong"
 * on every skin, including the dark ones where a fixed red would vanish.
 */
function value(v: string | null): string {
  return v ? esc(v) : `<em class="cit-lg-missing">${esc(TENANT_LEGAL_MISSING)}</em>`;
}

function renderBlock(b: TenantLegalBlock): string {
  switch (b.kind) {
    case "p":
      return `<p>${esc(b.text)}</p>`;
    case "ul":
      return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "dl":
      return (
        `<dl>` +
        b.rows.map((r) => `<dt>${esc(r.term)}</dt><dd>${value(r.value)}</dd>`).join("") +
        `</dl>`
      );
    case "table":
      // data-label carries the column header into the mobile card layout. Without it
      // the 4-column table renders 444px wide on a 390px phone and the last column is
      // silently clipped — measured, and invisible on a screenshot (ADR-0110).
      return (
        `<table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
        b.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell, i) => `<td data-label="${esc(b.head[i] ?? "")}">${esc(cell)}</td>`)
                .join("")}</tr>`,
          )
          .join("") +
        `</tbody></table>`
      );
  }
}

function renderSection(s: TenantLegalSection, index: number): string {
  // The first section starts open on mobile; on desktop CSS + script keep them all open.
  const open = index === 0 ? " open" : "";
  return (
    `<details class="cit-lg-sec" id="${esc(s.id)}"${open}>` +
    `<summary><span class="cit-lg-num">${index + 1}</span>` +
    `<span class="cit-lg-label">${esc(s.heading)}</span><span class="cit-lg-chev"></span></summary>` +
    `<div class="cit-lg-body">${s.blocks.map(renderBlock).join("")}</div>` +
    `</details>`
  );
}

/** Plain-language summary — privacy page only (ADR-0110 ②). */
function renderTldr(): string {
  return (
    `<section class="cit-lg-tldr" aria-label="Röviden">` + // i18n-exempt: legal pack (§H.22)
    `<div class="cit-lg-tldr__head">` +
    `<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M10 2.2 16.4 4.6v5.1c0 4-2.7 7-6.4 8.1-3.7-1.1-6.4-4.1-6.4-8.1V4.6L10 2.2Z"/>` +
    `<path d="m7.3 10.1 1.9 1.9 3.5-3.7"/></svg>` +
    `<h2>Röviden</h2></div>` + // i18n-exempt: legal pack (§H.22)
    `<ul>${TENANT_PRIVACY_TLDR.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` +
    `<p class="cit-lg-tldr__note">Ez az összefoglaló a tájékozódást segíti; a kötelező ` + // i18n-exempt: legal pack (§H.22)
    `tartalmat az alábbi részletes szakaszok adják.</p>` +
    `</section>`
  );
}

/**
 * The standing legal strip that sits at the bottom of EVERY page of a live tenant
 * site (ADR-0110 ③, kept from the "B" variant). Self-contained: it carries its own
 * style block, because on the template-first path there is no shared stylesheet to
 * extend, and it must look right under all 16 templates.
 *
 * ALWAYS rendered on a live page, even for a tenant whose legal data is still
 * empty. It first dropped out in that case ("an empty bar is noise"), but the
 * knowledge-base audit caught what that really meant: the strip is the ONLY carrier
 * of the IMPRINT link on the template-first path — the 16 templates' own footers
 * carry "Adatkezelés" alone — so the imprint became unreachable exactly for the
 * tenant who has not filled anything in yet. Name and tax number are optional
 * INSIDE the strip; the two links are not.
 */
export function renderLegalStrip(who: TenantLegalIdentity): string {
  const tax = who.taxNumber ? `<span>Adószám: ${esc(who.taxNumber)}</span>` : ""; // i18n-exempt: legal pack (§H.22)
  return `
<style>
  .cit-legal-strip { background: color-mix(in srgb, var(--cit-ink) 92%, var(--cit-accent));
    color: color-mix(in srgb, var(--cit-bg) 88%, transparent);
    font-family: var(--cit-font-body); font-size: .82rem; line-height: 1.5; }
  .cit-legal-strip__inner { max-width: 1120px; margin: 0 auto; display: flex; flex-wrap: wrap;
    align-items: center; gap: .5rem .9rem; padding: .85rem clamp(1.1rem, 4vw, 2.5rem); }
  .cit-legal-strip__name { display: inline-flex; align-items: center; gap: .4rem; font-weight: 600; }
  .cit-legal-strip__name svg { width: 15px; height: 15px; flex: 0 0 auto; }
  .cit-legal-strip__sep { opacity: .45; }
  .cit-legal-strip__links { display: flex; gap: .9rem; margin-left: auto; }
  .cit-legal-strip a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  /* At phone width the row wraps and the separator would be orphaned at a line end. */
  @media (max-width: 719px) {
    .cit-legal-strip__links { margin-left: 0; width: 100%; }
    .cit-legal-strip__sep { display: none; }
  }
</style>
<div class="cit-legal-strip">
  <div class="cit-legal-strip__inner">
    <span class="cit-legal-strip__name">
      <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 2.2 16.4 4.6v5.1c0 4-2.7 7-6.4 8.1-3.7-1.1-6.4-4.1-6.4-8.1V4.6L10 2.2Z"/>
        <path d="m7.3 10.1 1.9 1.9 3.5-3.7"/>
      </svg>${who.legalName ? esc(who.legalName) : ""}
    </span>
    ${who.legalName && who.taxNumber ? `<span class="cit-legal-strip__sep">·</span>` : ""}
    ${tax}
    <span class="cit-legal-strip__links">
      <a href="${TENANT_LEGAL_PATHS.privacy}">Adatkezelés</a>
      <a href="${TENANT_LEGAL_PATHS.imprint}">Impresszum</a>
    </span>
  </div>
</div>`;
}

/**
 * Append the standing legal strip to a rendered page (ADR-0110 ③).
 *
 * Done as a stamp on the finished HTML rather than inside the 16 templates: one
 * place to change, and template no. 17 gets it for free (ADR-0089: "egy ponton
 * vágunk"). No-op when we hold no legal facts at all.
 */
export function withLegalStrip(html: string, who: TenantLegalIdentity): string {
  const strip = renderLegalStrip(who);
  if (!strip) return html;
  return html.includes("</body>") ? html.replace("</body>", `${strip}\n</body>`) : html + strip;
}

/**
 * Remove the footer's legal links — for the MOCK (ADR-0110 ⑦).
 *
 * A cold lead has no legal data with us and no legal pages on the preview host,
 * so a link there would either 404 or, worse, imply that we published an imprint
 * for a business we have never spoken to. Empty <li> wrappers left behind are
 * cleaned up the same way the gallery switch does it.
 */
export function stripTenantLegalLinks(html: string): string {
  const paths = Object.values(TENANT_LEGAL_PATHS)
    .map((p) => p.replace(/^\//, ""))
    .join("|");
  return html
    .replace(new RegExp(`<a\\b[^>]*href="/(?:${paths})"[^>]*>[\\s\\S]*?</a>`, "gi"), "")
    .replace(/<li\b[^>]*>\s*<\/li>/gi, "");
}

const PAGE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--cit-bg); color: var(--cit-ink);
    font-family: var(--cit-font-body); }

  .cit-lg-nav { position: sticky; top: 0; z-index: 20; background: var(--cit-surface);
    border-bottom: 1px solid var(--cit-line); }
  .cit-lg-nav__inner { max-width: 1120px; margin: 0 auto; display: flex; align-items: center;
    justify-content: space-between; gap: 1rem; padding: .85rem clamp(1.1rem, 4vw, 2.5rem); }
  .cit-lg-brand { font-family: var(--cit-font-display); font-size: 1.25rem; font-weight: 600;
    color: var(--cit-ink); text-decoration: none; }
  .cit-lg-back { background: var(--cit-accent); color: var(--cit-on-accent); text-decoration: none;
    padding: .55rem 1.15rem; border-radius: var(--cit-radius); font-weight: 600; font-size: .85rem; }

  .cit-lg-doc { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: 1fr;
    gap: 1.2rem; padding: clamp(1.2rem, 3.5vw, 2.4rem) clamp(1.1rem, 4vw, 2.5rem) clamp(1.6rem, 4vw, 3rem); }
  @media (min-width: 900px) { .cit-lg-doc { grid-template-columns: 254px minmax(0, 1fr); gap: 2.8rem; } }
  .cit-lg-crumb { grid-column: 1 / -1; font-size: .8rem; color: var(--cit-muted); margin: 0; }
  .cit-lg-crumb a { color: var(--cit-accent); }

  /* Left rail: sticky table of contents (desktop only). */
  .cit-lg-toc { display: none; }
  @media (min-width: 900px) {
    .cit-lg-toc { display: block; position: sticky; top: 88px; align-self: start;
      max-height: calc(100vh - 120px); overflow: auto; }
  }
  .cit-lg-toc__title { font-size: .7rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--cit-muted); margin: 0 0 .7rem; font-weight: 700; }
  .cit-lg-toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: .1rem;
    border-left: 2px solid var(--cit-line); }
  .cit-lg-toc a { display: block; padding: .42rem .7rem; margin-left: -2px;
    border-left: 2px solid transparent; color: var(--cit-muted); text-decoration: none;
    font-size: .855rem; line-height: 1.4; }
  .cit-lg-toc a:hover { color: var(--cit-ink); }
  .cit-lg-toc a.is-active { color: var(--cit-accent); font-weight: 700;
    border-left-color: var(--cit-accent);
    background: color-mix(in srgb, var(--cit-accent) 7%, transparent); }
  .cit-lg-toc__foot { margin: 1rem 0 0; font-size: .78rem; line-height: 1.5; color: var(--cit-muted); }
  .cit-lg-toc__foot a { display: inline; padding: 0; border: 0; color: var(--cit-accent); }

  .cit-lg-body-col { max-width: 74ch; }
  .cit-lg-title { font-family: var(--cit-font-display); font-size: clamp(1.6rem, 4vw, 2.2rem);
    margin: .2rem 0 .35rem; font-weight: 600; }
  .cit-lg-meta { color: var(--cit-muted); font-size: .85rem; margin: 0 0 1.4rem; }

  .cit-lg-tldr { background: var(--cit-surface); border: 1px solid var(--cit-line);
    border-left: 4px solid var(--cit-accent); border-radius: var(--cit-radius);
    box-shadow: var(--cit-shadow); padding: 1rem clamp(1rem, 2.5vw, 1.4rem); margin: 0 0 1.8rem; }
  .cit-lg-tldr__head { display: flex; align-items: center; gap: .5rem; margin: 0 0 .5rem; }
  .cit-lg-tldr__head svg { width: 18px; height: 18px; flex: 0 0 auto; color: var(--cit-accent); }
  .cit-lg-tldr__head h2 { font-family: var(--cit-font-display); font-size: 1.05rem; margin: 0;
    font-weight: 600; }
  .cit-lg-tldr ul { margin: 0; padding-left: 1.15rem; display: grid; gap: .35rem; }
  .cit-lg-tldr li { font-size: .92rem; line-height: 1.6; }
  .cit-lg-tldr__note { margin: .75rem 0 0; font-size: .8rem; color: var(--cit-muted); line-height: 1.5; }

  /* A section is a <details>: collapsible on mobile, a flat document on desktop. */
  .cit-lg-sec { border: 1px solid var(--cit-line); border-radius: var(--cit-radius);
    background: var(--cit-surface); margin: 0 0 .7rem; scroll-margin-top: 96px; overflow: hidden; }
  .cit-lg-sec > summary { list-style: none; cursor: pointer; display: flex; align-items: center;
    gap: .7rem; padding: .85rem 1rem; font-family: var(--cit-font-display); font-size: 1.05rem;
    font-weight: 600; color: var(--cit-ink); }
  .cit-lg-sec > summary::-webkit-details-marker { display: none; }
  .cit-lg-sec > summary:hover { background: color-mix(in srgb, var(--cit-accent) 4%, var(--cit-surface)); }
  .cit-lg-num { flex: 0 0 auto; width: 1.55rem; height: 1.55rem; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--cit-accent) 10%, var(--cit-surface));
    color: var(--cit-accent); font-family: var(--cit-font-body); font-size: .78rem; font-weight: 700; }
  .cit-lg-label { flex: 1 1 auto; }
  /* Chevron drawn from borders — no emoji, no icon font (design decree). */
  .cit-lg-chev { flex: 0 0 auto; width: .5rem; height: .5rem; margin-right: .2rem;
    border-right: 2px solid var(--cit-muted); border-bottom: 2px solid var(--cit-muted);
    transform: rotate(45deg); transition: transform .18s; }
  .cit-lg-sec[open] > summary .cit-lg-chev { transform: rotate(-135deg); }
  .cit-lg-body { padding: 0 1rem 1.1rem; border-top: 1px solid var(--cit-line); padding-top: .9rem; }

  @media (min-width: 900px) {
    .cit-lg-sec { border: 0; background: transparent; border-radius: 0; margin: 0 0 1.9rem; }
    .cit-lg-sec > summary { pointer-events: none; padding: 0 0 .45rem; font-size: 1.2rem; }
    .cit-lg-sec > summary:hover { background: transparent; }
    .cit-lg-chev { display: none; }
    .cit-lg-body { padding: 0; border-top: 0; }
    /* Belt and braces next to the script's "open" toggle: keep the content painted
       even with JavaScript off, so the legal text is never hidden behind a click. */
    .cit-lg-sec::details-content { content-visibility: visible; block-size: auto; }
  }

  .cit-lg-body p, .cit-lg-body li { line-height: 1.7; font-size: .94rem; }
  .cit-lg-body p:first-child { margin-top: 0; }
  .cit-lg-body ul { padding-left: 1.1rem; }
  .cit-lg-body dl { display: grid; grid-template-columns: 1fr; gap: .2rem .9rem; margin: 0;
    font-size: .94rem; }
  @media (min-width: 900px) { .cit-lg-body dl { grid-template-columns: max-content 1fr; } }
  .cit-lg-body dt { font-weight: 600; color: var(--cit-muted); }
  .cit-lg-body dd { margin: 0 0 .5rem; }
  .cit-lg-missing { color: var(--cit-accent); font-weight: 700; font-style: italic; }
  .cit-lg-body table { border-collapse: collapse; width: 100%; font-size: .88rem; }
  .cit-lg-body th, .cit-lg-body td { border: 1px solid var(--cit-line); padding: .5rem .6rem;
    text-align: left; vertical-align: top; }
  .cit-lg-body th { background: color-mix(in srgb, var(--cit-accent) 7%, var(--cit-surface));
    font-weight: 600; }

  /* MOBILE TABLE (measured): 4 columns render ~444px wide on a 390px phone and the
     last column is silently clipped. Below the breakpoint the table becomes a card
     list carrying its header per cell. */
  @media (max-width: 719px) {
    .cit-lg-body table { display: block; }
    .cit-lg-body thead { display: none; }
    .cit-lg-body tbody, .cit-lg-body tr, .cit-lg-body td { display: block; width: 100%; }
    .cit-lg-body tr { border: 1px solid var(--cit-line); border-radius: 10px; margin-bottom: .7rem; }
    .cit-lg-body td { border: 0; border-top: 1px solid var(--cit-line); padding: .5rem .7rem; }
    .cit-lg-body tr td:first-child { border-top: 0; font-weight: 600; }
    .cit-lg-body td::before { content: attr(data-label); display: block; font-size: .72rem;
      letter-spacing: .08em; text-transform: uppercase; color: var(--cit-muted);
      margin-bottom: .15rem; }
    .cit-lg-body tr td:first-child::before { content: attr(data-label); font-weight: 400; }
  }

  .cit-lg-foot { background: color-mix(in srgb, var(--cit-ink) 92%, var(--cit-accent));
    color: color-mix(in srgb, var(--cit-bg) 88%, transparent); }
  .cit-lg-foot__inner { max-width: 1120px; margin: 0 auto; display: flex; flex-wrap: wrap;
    gap: .6rem; justify-content: space-between; font-size: .82rem;
    padding: 1rem clamp(1.1rem, 4vw, 2.5rem); }
  .cit-lg-foot a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
`;

// Desktop keeps every section open (there the summary is a heading, not a control),
// and the table of contents follows the reading position. Kept small and defensive:
// with JavaScript off the CSS above already paints the content.
const PAGE_JS = `
(function () {
  var secs = [].slice.call(document.querySelectorAll(".cit-lg-sec"));
  var links = [].slice.call(document.querySelectorAll(".cit-lg-toc a"));
  function desktop() { return window.matchMedia("(min-width: 900px)").matches; }
  function sync() { if (desktop()) secs.forEach(function (s) { s.open = true; }); }
  sync();
  window.addEventListener("resize", sync);
  function spy() {
    if (!desktop() || !secs.length) return;
    var line = 140, current = secs[0].id;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top <= line) current = secs[i].id;
    }
    // At the very bottom the last section can never reach the reading line.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      current = secs[secs.length - 1].id;
    }
    links.forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("href") === "#" + current);
    });
  }
  spy();
  window.addEventListener("scroll", spy, { passive: true });
})();
`;

/**
 * Render one legal page in the accommodation's skin.
 *
 * `who` carries what we know about the tenant; missing facts render as the loud
 * marker rather than being dropped. `host` is us, named as the hosting provider.
 */
export function renderTenantLegalPage(opts: {
  readonly recipe: Recipe;
  readonly data: SiteData;
  readonly kind: TenantLegalKind;
  readonly who: TenantLegalIdentity;
  readonly host: HostingProviderIdentity;
  /** From the buyer record: a private person owes no registry number or tax number. */
  readonly buyerType?: "individual" | "business" | null;
}): string {
  const { recipe, data, kind, who, host } = opts;
  const skin = SKINS[recipe.skin] ?? SKINS[Object.keys(SKINS)[0]!]!;
  const sections =
    kind === "privacy"
      ? tenantPrivacySections(who, host)
      : tenantImprintSections(who, host, opts.buyerType ?? "business");
  const other: TenantLegalKind = kind === "privacy" ? "imprint" : "privacy";
  const lang = data.lang ?? "hu";

  const toc =
    `<nav class="cit-lg-toc" aria-label="Tartalomjegyzék">` + // i18n-exempt: legal pack (§H.22)
    `<p class="cit-lg-toc__title">Tartalom</p><ol>` + // i18n-exempt: legal pack (§H.22)
    sections.map((s) => `<li><a href="#${esc(s.id)}">${esc(s.heading)}</a></li>`).join("") +
    `</ol><p class="cit-lg-toc__foot"><a href="${TENANT_LEGAL_PATHS[other]}">` +
    `${esc(PAGE_TITLE[other])}</a></p></nav>`;

  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(PAGE_TITLE[kind])} — ${esc(data.name)}</title>
  ${renderSkinFontLinks(skin)}
  <style>
  ${renderSkinVars(skin, data.palette?.accent)}
${PAGE_CSS}
  </style>
</head>
<body>
  <nav class="cit-lg-nav">
    <div class="cit-lg-nav__inner">
      <a class="cit-lg-brand" href="/">${esc(data.name)}</a>
      <a class="cit-lg-back" href="/">Vissza a honlapra</a>
    </div>
  </nav>
  <main class="cit-lg-doc">
    <p class="cit-lg-crumb"><a href="/">Kezdőlap</a> › ${esc(PAGE_TITLE[kind])}</p>
    ${toc}
    <div class="cit-lg-body-col">
      <h1 class="cit-lg-title">${esc(PAGE_TITLE[kind])}</h1>
      <p class="cit-lg-meta">${esc(PAGE_LEAD[kind])}</p>
      ${kind === "privacy" ? renderTldr() : ""}
      ${sections.map(renderSection).join("")}
    </div>
  </main>
  <footer class="cit-lg-foot">
    <div class="cit-lg-foot__inner">
      <span>© ${esc(data.name)}</span>
      <span><a href="${TENANT_LEGAL_PATHS[other]}">${esc(PAGE_TITLE[other])}</a></span>
    </div>
  </footer>
  ${renderLegalStrip(who)}
  <script>${PAGE_JS}</script>
</body>
</html>
`;
}
