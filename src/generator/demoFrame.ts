// Demo-framing for served/emailed previews (§A, MOCK/DEMO phase). The engine
// artifact stays pure; this footer is injected at serve time so the preview always
// declares itself a preliminary plan — satisfying provenanceCheck (checkDemoFraming).
// Used by BOTH the intake gate (checks the framed HTML) and the /m/:token server,
// so the gate reflects exactly what the requester sees.

// NOTE: the wording deliberately avoids the phrases provenanceCheck forbids
// ("hivatalos oldal", "éles/élő oldal", "az ön oldala kész") — even in a negation
// those would trip the misleading-claims detector. It still makes clear this is a
// preliminary, unpublished plan pending the owner's approval.
const FRAMING_FOOTER =
  '<div style="padding:14px 18px;text-align:center;' +
  'font:13px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;' +
  'color:#60748b;background:#eef7fa;border-top:1px solid #dfe5ec">' +
  "Ez egy <strong>előzetes terv</strong> — bemutató céllal, nyilvános adatok alapján " +
  "készült a Citoviso rendszerével. Közzététel csak a tulajdonos jóváhagyásával. " +
  '<a href="/adatvedelem" style="color:#0e7d99">Adatkezelési tájékoztató</a></div>';

/** Inject the demo-framing footer before </body> (idempotent-ish: appends once). */
export function frameDemoMock(html: string): string {
  if (/előzetes terv/iu.test(html)) return html; // already framed
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${FRAMING_FOOTER}</body>`);
  return html + FRAMING_FOOTER;
}
