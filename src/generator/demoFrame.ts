// Demo-framing for served/emailed previews (§A, MOCK/DEMO phase). The engine
// artifact stays pure; this footer is injected at serve time so the preview always
// declares itself a preliminary plan — satisfying provenanceCheck (checkDemoFraming).
// Used by BOTH the intake gate (checks the framed HTML) and the /m/:token server,
// so the gate reflects exactly what the requester sees.
//
// ADR-0070: the footer renders in the MOCK's own language (a Polish lead reads the
// plan-framing in Polish), read from the snapshot's <html lang>. The §A gate keys
// on the STRUCTURAL data-cit-demo-framing marker, not on the Hungarian wording —
// a translated footer must not un-frame the mock.

// NOTE: the wording deliberately avoids the phrases provenanceCheck forbids
// ("hivatalos oldal", "éles/élő oldal", "az ön oldala kész") — even in a negation
// those would trip the misleading-claims detector. It still makes clear this is a
// preliminary, unpublished plan pending the owner's approval.

import { T } from "../i18n/mail.js";
import { loadPack } from "../i18n/packs.js";

const MARKER = 'data-cit-demo-framing="1"';

function framingFooter(lang: string | undefined): string {
  return (
    `<div ${MARKER} style="padding:14px 18px;text-align:center;` +
    "font:13px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;" +
    'color:#60748b;background:#eef7fa;border-top:1px solid #dfe5ec">' +
    T(lang, "Ez egy {b} — bemutató céllal, nyilvános adatok alapján készült a Citoviso rendszerével. Közzététel csak a tulajdonos jóváhagyásával.", {
      b: `<strong>${T(lang, "előzetes terv")}</strong>`,
    }) +
    ` <a href="/adatvedelem" style="color:#0e7d99">${T(lang, "Adatkezelési tájékoztató")}</a></div>`
  );
}

/** Inject the demo-framing footer before </body> (idempotent via the marker).
 *  The language is the snapshot's own (<html lang>); the pack is warmed lazily. */
export async function frameDemoMock(html: string): Promise<string> {
  if (html.includes("data-cit-demo-framing") || /előzetes terv/iu.test(html)) return html; // already framed
  const lang = /<html[^>]*\blang="([a-zA-Z-]{2,8})"/i.exec(html)?.[1]?.toLowerCase();
  if (lang && lang !== "hu") await loadPack(lang); // T() is sync — warm first
  const footer = framingFooter(lang);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${footer}</body>`);
  return html + footer;
}
