// Bespoke Citoviso icon set — ONE source for every first-party surface (console,
// tenant admin, future internal modules), same doctrine as the design core
// (ADR-0021 ①): SVG, never emoji. Signature language: rounded strokes + one solid
// cyan accent element per feature icon (echoes the logo dot). Utility/state icons
// (check, alert) stay pure currentColor so semantic colors (ok/warn/bad) read true.

const CY_ACCENT = `fill="var(--citui-cyan-500)" stroke="none"`;

export const ICON: Readonly<Record<string, string>> = {
  // ── Feature icons (cyan accent) ──
  overview:
    `<rect x="3.5" y="3.5" width="7.5" height="9.5" rx="2.4"/><rect x="3.5" y="16.5" width="7.5" height="4" rx="2"/>` +
    `<rect x="14.5" y="10.5" width="6" height="10" rx="2.4"/><rect x="14.5" y="3.5" width="6" height="4" rx="2" ${CY_ACCENT}/>`,
  texts: `<path d="M5.5 6.5V5H16v1.5M10.75 5v14M8.5 19h4.5"/><circle cx="18.6" cy="17.6" r="2.1" ${CY_ACCENT}/>`,
  photos:
    `<rect x="3" y="4.5" width="18" height="15.5" rx="3.2"/><path d="m3.5 16 4.8-4.3 4.6 4.1 3.2-2.8 4.4 3.6"/>` +
    `<circle cx="15.8" cy="9.3" r="2" ${CY_ACCENT}/>`,
  modules:
    `<rect x="3.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2.2"/>` +
    `<rect x="3.5" y="13.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2.2" ${CY_ACCENT}/>`,
  account:
    `<circle cx="12" cy="7.8" r="3.6"/><path d="M4.8 20c.9-3.5 3.7-5.4 7.2-5.4s6.3 1.9 7.2 5.4"/>` +
    `<circle cx="17.8" cy="17.8" r="2.1" ${CY_ACCENT}/>`,
  external:
    `<path d="M13.5 5.5H7A2.5 2.5 0 0 0 4.5 8v9A2.5 2.5 0 0 0 7 19.5h9a2.5 2.5 0 0 0 2.5-2.5v-6.5"/>` +
    `<path d="M13 11 19.2 4.8"/><circle cx="19.4" cy="4.6" r="1.9" ${CY_ACCENT}/>`,
  // Saját webcím (ADR-0078) — földgömb; a hosszúsági ívek adják a „web" olvasatot.
  domain:
    `<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4"/>` +
    `<path d="M12 3.8c2.4 2.6 2.4 14 0 16.4M12 3.8c-2.4 2.6-2.4 14 0 16.4"/>` +
    `<circle cx="17.6" cy="6.4" r="1.9" ${CY_ACCENT}/>`,
  leads:
    `<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>` +
    `<circle cx="12" cy="12" r="2.2" ${CY_ACCENT}/>`,
  scrape:
    `<circle cx="12" cy="12" r="8.5"/><path d="m12 12 5.6-5.6"/><path d="M12 12a4.2 4.2 0 0 1 4.2 4.2"/>` +
    `<circle cx="7.6" cy="14.6" r="1.9" ${CY_ACCENT}/>`,
  report:
    `<path d="M4 20h16"/><rect x="5.5" y="11" width="3.4" height="6" rx="1.2"/><rect x="15.1" y="6" width="3.4" height="11" rx="1.2"/>` +
    `<rect x="10.3" y="8.5" width="3.4" height="8.5" rx="1.2" ${CY_ACCENT}/>`,
  pricing:
    `<path d="M12.6 3.5H6A2.5 2.5 0 0 0 3.5 6v6.6a2.5 2.5 0 0 0 .73 1.77l6.4 6.4a2.5 2.5 0 0 0 3.54 0l6.1-6.1a2.5 2.5 0 0 0 0-3.54l-6.4-6.4a2.5 2.5 0 0 0-1.77-.73Z"/>` +
    `<circle cx="8.4" cy="8.4" r="1.9" ${CY_ACCENT}/>`,
  settings:
    `<path d="M4 7h3M12.5 7H20M4 12h8.5M17.5 12H20M4 17h1.5M10.5 17H20"/>` +
    `<circle cx="9.75" cy="7" r="2.1"/><circle cx="15" cy="12" r="2.1" ${CY_ACCENT}/><circle cx="8" cy="17" r="2.1"/>`,
  help:
    `<circle cx="12" cy="12" r="8.4"/><path d="M9.55 9.35a2.45 2.45 0 1 1 3.55 2.18c-.75.4-1.1.88-1.1 1.67v.3"/>` +
    `<circle cx="12" cy="16.7" r="1.35" ${CY_ACCENT}/>`,
  mail:
    `<rect x="3" y="5.2" width="18" height="13.6" rx="3"/><path d="m3.8 7.6 7.1 4.9a2 2 0 0 0 2.2 0l7.1-4.9"/>` +
    `<circle cx="18.6" cy="17.4" r="2" ${CY_ACCENT}/>`,
  // ADR-0084: the Üzenetek tab must tell an SMS from an e-mail at a glance — with
  // a shared envelope the two channels were indistinguishable in the list.
  sms:
    `<path d="M20.5 12.4c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.6-3.7A6.6 6.6 0 0 1 3.5 12.4` +
    `c0-3.87 3.8-7 8.5-7s8.5 3.13 8.5 7Z"/>` +
    `<circle cx="15.7" cy="12.3" r="1.5" ${CY_ACCENT}/>`,
  partners:
    `<circle cx="8.6" cy="8.2" r="3.3"/><path d="M2.8 19.5c.8-3.2 3-4.9 5.8-4.9s5 1.7 5.8 4.9"/>` +
    `<path d="M15.2 5.4a3.3 3.3 0 0 1 0 5.6M17.5 14.9c2 .6 3.3 2.1 3.9 4.6"/>` +
    `<circle cx="18.9" cy="8.2" r="2" ${CY_ACCENT}/>`,
  docs:
    `<path d="M7 3.5h7.2L19 8.3V18a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18V6A2.5 2.5 0 0 1 7 3.5Z"/>` +
    `<path d="M14 3.8V8.5h4.7M8.4 12.4h7.2M8.4 15.6h4.6"/>` +
    `<circle cx="16.4" cy="17.2" r="1.9" ${CY_ACCENT}/>`,
  // ── Utility / state icons (pure currentColor) ──
  link:
    '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  check: `<circle cx="12" cy="12" r="8.4"/><path d="m8.6 12.3 2.3 2.3 4.6-4.9"/>`,
  clock: `<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4v5l3.3 2"/>`,
  zoom: `<circle cx="10.6" cy="10.6" r="6.6"/><path d="M15.4 15.4 20.5 20.5M10.6 7.9v5.4M7.9 10.6h5.4"/>`,
  alert:
    `<path d="M10.3 4.6 2.6 17.7a1.9 1.9 0 0 0 1.6 2.9h15.6a1.9 1.9 0 0 0 1.6-2.9L13.7 4.6a1.9 1.9 0 0 0-3.4 0Z"/>` +
    `<path d="M12 9.5v3.4"/><circle cx="12" cy="16.4" r="1.35" fill="currentColor" stroke="none"/>`,
  // ADR-0089 — "show me how this would look" (eye) and "add this" (plus).
  preview: `<path d="M2.6 12S6.4 5.6 12 5.6 21.4 12 21.4 12 17.6 18.4 12 18.4 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.9"/>`,
  // ADR-0088 ⑨: stored bank card (recurring mandate block). The cyan dot is
  // the house accent mark, same as the other icons.
  card:
    `<rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.6"/><path d="M2.8 9.8h18.4"/>` +
    `<circle cx="17.4" cy="14.6" r="1.7" ${CY_ACCENT}/>`,
  plus: `<path d="M12 5.4v13.2M5.4 12h13.2"/>`,
  // ADR-0106 ⑥ — guest reviews (source panel): a star with the house accent dot.
  star:
    `<path d="M12 3.6l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8 2.5-5Z"/>` +
    `<circle cx="18.8" cy="18.4" r="1.9" ${CY_ACCENT}/>`,
  close: `<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/>`,
  // ADR-0188 — oszlop-szűrő a lead-lista fejlécében. Tölcsér, mert a korábbi „három
  // vízszintes vonal" a rendezés-vezérlőtől volt megkülönböztethetetlen egy 38 px magas,
  // egysoros fejlécben. Utility-ikon: tiszta currentColor, hogy az AKTÍV állapot ciánja
  // az egész alakot átszínezze (a jelvény hordozza a számot, nem az ikon).
  filter: `<path d="M4.2 5.4h15.6l-6.1 7.1v5.4l-3.4 1.7v-7.1z"/>`,
  // Collapsible section marker (approved booking-screen contract, 2026-09-08): the
  // <details> summary rotates it, so the owner sees whether it opens or closes.
  "chevron-down": `<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>`,
  // Foglalások tab (approved plan 2026-09-06): calendar with a check + the cyan dot.
  bookings:
    `<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>` +
    `<path d="m8.6 14.6 2.2 2.2 4.4-4.4"/><circle cx="17.4" cy="17.6" r="1.9" ${CY_ACCENT}/>`,
};

// ── ADR-0224 — the tenant-admin's THIN set (stroke 1.7, NO accent dot) ────────
// The approved "Linear" language spends colour only on meaning, so the admin's
// icons are plain line drawings; the cyan-dot set above stays the CONSOLE's.
// Every key the admin renders has a thin variant here; `icAdmin()` falls back to
// the base set for anything else, so a missing variant degrades, never breaks.
export const ICON_THIN: Readonly<Record<string, string>> = {
  overview: `<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>`,
  texts: `<path d="M4 6h16M4 12h10M4 18h14"/>`,
  photos: `<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-4.5L8 19"/>`,
  modules:
    `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>` +
    `<rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,
  bookings: `<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  mail: `<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3 8 9 6 9-6"/>`,
  sms: `<path d="M20.5 12.4c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.6-3.7A6.6 6.6 0 0 1 3.5 12.4c0-3.87 3.8-7 8.5-7s8.5 3.13 8.5 7Z"/>`,
  domain: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>`,
  report: `<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`,
  docs: `<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>`,
  account: `<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>`,
  help: `<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>`,
  external: `<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>`,
  settings: `<path d="M4 7h3M12.5 7H20M4 12h8.5M17.5 12H20M4 17h1.5M10.5 17H20"/><circle cx="9.75" cy="7" r="2.1"/><circle cx="15" cy="12" r="2.1"/><circle cx="8" cy="17" r="2.1"/>`,
  pricing: `<path d="M12.6 3.5H6A2.5 2.5 0 0 0 3.5 6v6.6a2.5 2.5 0 0 0 .73 1.77l6.4 6.4a2.5 2.5 0 0 0 3.54 0l6.1-6.1a2.5 2.5 0 0 0 0-3.54l-6.4-6.4a2.5 2.5 0 0 0-1.77-.73Z"/><circle cx="8.4" cy="8.4" r="1.4"/>`,
  card: `<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/>`,
  star: `<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>`,
  starf: `<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" fill="currentColor"/>`,
  check: `<path d="m5 12 4.5 4.5L19 7"/>`,
  checkc: `<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-5.5"/>`,
  alert: `<path d="M12 3 2.5 20h19z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".7" fill="currentColor"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  back: `<path d="M15 5l-7 7 7 7"/>`,
  fwd: `<path d="m9 5 7 7-7 7"/>`,
  "chevron-down": `<path d="m6 9 6 6 6-6"/>`,
  trash: `<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>`,
  upload: `<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>`,
  camera: `<path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
  moreh: `<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>`,
  grip: `<circle cx="9" cy="6" r="1.1" fill="currentColor"/><circle cx="15" cy="6" r="1.1" fill="currentColor"/><circle cx="9" cy="12" r="1.1" fill="currentColor"/><circle cx="15" cy="12" r="1.1" fill="currentColor"/><circle cx="9" cy="18" r="1.1" fill="currentColor"/><circle cx="15" cy="18" r="1.1" fill="currentColor"/>`,
  select: `<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.5 2.5 2.5 5-5.5"/>`,
  preview: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>`,
  logout: `<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M9 12h10"/>`,
  collapse: `<path d="M15 6l-6 6 6 6M4 4v16"/>`,
  expand: `<path d="m9 6 6 6-6 6M20 4v16"/>`,
  grid: `<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>`,
  list: `<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
  moon: `<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>`,
  dot: `<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>`,
  clock: `<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4v5l3.3 2"/>`,
  link: `<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>`,
  zoom: `<circle cx="10.6" cy="10.6" r="6.6"/><path d="M15.4 15.4 20.5 20.5M10.6 7.9v5.4M7.9 10.6h5.4"/>`,
  filter: `<path d="M4 6h16l-6 7v5l-4 2v-7z"/>`,
  partners: `<circle cx="8.6" cy="8.2" r="3.3"/><path d="M2.8 19.5c.8-3.2 3-4.9 5.8-4.9s5 1.7 5.8 4.9"/><path d="M15.2 5.4a3.3 3.3 0 0 1 0 5.6M17.5 14.9c2 .6 3.3 2.1 3.9 4.6"/>`,
};

/** The tenant-admin icon (ADR-0224): thin line, no accent dot. Unknown thin name →
 *  the base glyph, so a key that only the console defines still renders. */
export function icAdmin(name: string, size = 18): string {
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_THIN[name] ?? ICON[name] ?? ""}</svg>`
  );
}

/** Render an icon by name (rounded-stroke wrapper; unknown name → empty svg). */
export function ic(name: string, size = 20): string {
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? ""}</svg>`
  );
}
