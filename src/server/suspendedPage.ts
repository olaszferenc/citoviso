// The courtesy page a FROZEN site serves to its GUESTS (ADR-0080 ⑥, ADR-0119 ③,
// approved plan `assets/design-refs/console/freeze-state/`).
//
// ⛔ WHY THIS LIVES IN ITS OWN MODULE. It used to sit inside public.ts, whose
// import boots an HTTP server — so no guard could render it, and the only
// machine check of the freeze wording (`scripts/frozen-claim-check.mts`) could
// only ever see the OWNER's admin surface. The guest half went unmeasured for
// three days after the rule that governs it was written (ADR-0119 ⑧). Rendering
// is therefore pure here: data in, HTML out, no DB, no server.
//
// ⛔ The page must NOT say WHY. "Rendezetlen díj" in front of a guest damages the
// very tenant this page exists to protect; the reason is between us and the owner.
//
// ⛔ And it must not promise a RETURN we do not control (ADR-0157). The freeze
// lifts on payment — an event that belongs to the owner, not to us. Everything
// this page states must stay true in the branch where the payment never arrives
// and the site closes for good on T+30.

import { esc } from "../console/views.js";
import { T } from "../i18n/mail.js";

/**
 * ADR-0157 — the language the courtesy page must speak.
 *
 * Measured 2026-09-14 (Elek FK-006a GYANÚ-4): the freeze branch answered EVERY
 * path in the site's primary language, because it runs before the `/<lang>/`
 * router. A tenant who paid 14 900 Ft for three languages therefore had their
 * English guest — arriving on a bookmarked or indexed `/en/` URL — met in
 * Hungarian, at the exact moment the page has nothing left to offer but a phone
 * number. The freeze is not the moment to withdraw what they bought.
 *
 * Only a language whose snapshot actually EXISTS counts: those are the versions
 * the tenant paid for and we generated. Anything else falls back to the primary
 * language rather than inventing a translation the guest would read as broken.
 */
export function suspendedLang(
  pathname: string,
  paidLangs: readonly string[],
  primary: string,
): string {
  const wanted = /^\/([a-z]{2})(?:\/|$)/.exec(pathname)?.[1];
  return wanted && paidLangs.includes(wanted) ? wanted : primary;
}

/**
 * What the guest is told about the property. The source is the property's OWN
 * site data (the same details the live site shows guests) — NOT `tenant_legal`,
 * which is the billing identity (often a private address, and frequently empty).
 */
export interface SuspendedPageData {
  readonly name: string;
  readonly city: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
}

/** Pure render — the guard calls exactly this, so the sentences it measures are
 *  the sentences the guest is served. */
export function renderSuspendedPage(d: SuspendedPageData, lang: string): string {
  const title = d.name || T(lang, "Az oldal jelenleg nem érhető el");
  // Each contact line renders ONLY if we really have it: an empty "Telefon:" row
  // would be a promise of a channel that does not exist (§B.17).
  // ⛔ MÉRVE (B8 szál, 2026-09-14 — a landolási rebase hozta ide): these two are the
  // page's ONLY way to reach the host, and with `text-decoration:none` neither LOOKED
  // clickable — navy-700 at weight 600 renders exactly like the heading above them, so
  // the guest read them as printed text. A contact line that IS a link must LOOK like
  // one; the underline is the only cue that survives without colour vision.
  const rows = [
    d.email
      ? `<a href="mailto:${esc(d.email)}" style="color:var(--citui-navy-700);font-weight:600;text-decoration:underline">${esc(d.email)}</a>`
      : "",
    d.phone
      ? `<a href="tel:${esc(d.phone.replace(/[^\d+]/g, ""))}" style="color:var(--citui-navy-700);font-weight:600;text-decoration:underline">${esc(d.phone)}</a>`
      : "",
    d.address ? `<span style="color:var(--citui-muted)">${esc(d.address)}</span>` : "",
  ].filter(Boolean);
  // ⛔ The heading says what these lines ARE, not what they are "until then":
  // „Addig is…” presupposes a return date the page no longer claims to know.
  const contactBox = rows.length
    ? `<div style="display:grid;gap:8px;padding:16px;margin:18px 0 0;text-align:left;` +
      `background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm)">` +
      `<h2 style="font-family:var(--citui-font-display);font-size:15px;margin:0">${T(lang, "A szállás elérhetőségei")}</h2>` +
      rows.map((r) => `<div>${r}</div>`).join("") +
      `</div>` +
      `<p style="margin:12px 0 0;font-size:13.5px;color:var(--citui-muted)">${T(lang, "Foglalással, érkezéssel kapcsolatos kérdésével forduljon közvetlenül a szállásadóhoz a fenti elérhetőségen.")}</p>`
    : "";
  return (
    `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<link rel="stylesheet" href="/assets/ui/citui.css">` +
    `<title>${esc(title)}</title></head>` +
    `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `padding:28px;background:var(--citui-surface);font-family:var(--citui-font-text);color:var(--citui-ink)">` +
    `<div style="max-width:520px;text-align:center">` +
    (d.name
      ? `<h1 style="font-family:var(--citui-font-display);font-size:27px;margin:0">${esc(d.name)}</h1>` +
        (d.city ? `<p style="margin:6px 0 0;font-size:14px;color:var(--citui-muted)">${esc(d.city)}</p>` : "")
      : `<h1 style="font-family:var(--citui-font-display);font-size:24px;margin:0">${T(lang, "Az oldal jelenleg nem érhető el")}</h1>`) +
    `<p style="margin:16px 0 0;font-size:16px;line-height:1.6">${T(lang, "Ez az oldal jelenleg nem érhető el.")}</p>` +
    contactBox +
    `</div></body></html>`
  );
}
