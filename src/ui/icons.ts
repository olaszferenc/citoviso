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
  close: `<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/>`,
};

/** Render an icon by name (rounded-stroke wrapper; unknown name → empty svg). */
export function ic(name: string, size = 20): string {
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? ""}</svg>`
  );
}
