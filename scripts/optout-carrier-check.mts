// Gate: the LINKED prospect page really carries the legal mandatories.
//
// Why this guard exists (ADR-0112): the outreach SMS no longer prints the
// opt-out link or the legal-basis sentence in its own text — the owner's wording
// is an invitation, and the mandatories moved one click away, onto the tracked
// preview page. That trade is only honest while the page ACTUALLY renders them.
//
// checkOutreachSms cannot see this: it measures strings in a message. So the
// structural twin lives here (03-INVARIANTS §C; "heuristic guard needs a
// structural twin"), and it measures three things that must all hold together:
//
//   1. injectTrackingNotice emits a legal-basis notice + an opt-out link
//      → run the REAL function, not a copy of its wording
//   2. the opt-out URL it emits is a route the server actually serves
//      → match it against the REAL router regex, through normalizeProspectPath,
//        in BOTH link shapes (bare token and readable slug)
//   3. the prospect-page handler still pipes its HTML through that function
//      → source-level check: this is the one link in the chain no unit call can
//        prove, and dropping it is exactly how the opt-out would vanish silently
//
// Usage: npx tsx scripts/optout-carrier-check.mts

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { config } from "../src/config.js";
import {
  injectOptedOutBanner,
  injectOptedOutNotice,
  injectTrackingNotice,
} from "../src/console/prospectNotice.js";
import { normalizeProspectPath } from "../src/console/prospectPath.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, "../src/console/server.ts");

/** The advertiser the footer must name (Grt.: no anonymous advertiser). */
const SENDER = [config.outreachSender.company, config.outreachSender.name]
  .map((v) => (v ?? "").trim())
  .find((v) => v.length > 0);

/** A real token shape from a sent message (24 chars, mixed case). */
const TOKEN = "hWAeKUweNOvCiAAMz6hlqUAA";
const SLUG = "dencs-apartmanhaz";

/** The router's own unsubscribe pattern — kept identical to server.ts on purpose. */
const UNSUB_ROUTE = /^\/p\/([A-Za-z0-9_-]{16,})\/unsubscribe$/;

const problems: string[] = [];

// ── 1. The notice carries the mandatories. ───────────────────────────────────
const MOCK_BODY = "<html><body><h1>Mock</h1><footer>A szállás lábléce</footer></body></html>";
const page = injectTrackingNotice(MOCK_BODY, TOKEN);

// The owner's ruling (2026-09-08): the opt-out lives AT THE BOTTOM of the page,
// and the recipient reaches it by opening the tracked preview. So "last thing on
// the page" is a stated requirement now, not an accident of the implementation —
// nothing of the mock may render below the legal footer.
const noticeAt = page.lastIndexOf("<div style=\"padding:14px 18px");
const mockTail = page.lastIndexOf("A szállás lábléce");
if (noticeAt < 0 || mockTail > noticeAt) {
  problems.push(
    "A jogi lábazat nem az oldal LEGALJÁN áll (a mock tartalma alá kerül) — a tulaj döntése szerint " +
      "a leiratkozás a lap legalján érhető el (ADR-0112).",
  );
}

// ⚠️ TWO different legal bases, and a plain "jogos érdek" match cannot tell them
// apart — the first version of this guard was green while the footer only ever
// stated the tracking one (jog/provenance-őr, 2026-09-08). The MEGKERESÉS basis
// is the one the SMS stopped carrying, so that is what must be found here.
if (!/(megkeres|kapcsolatfelvétel|azért.{0,40}(kapta|készítettük))/iu.test(page)) {
  problems.push(
    "A lábléc nem mondja ki, MIÉRT kereshettük meg (a megkeresés jogalapja). A 'megtekintés adatai rögzülnek' " +
      "mondat a TRACKING jogalapja — nem ugyanaz, és az SMS-ből a megkeresés-jogalap kikerült (ADR-0112).",
  );
}
if (!/Grt\.|GDPR|jogos érdek/iu.test(page)) {
  problems.push("A lábléc nem nevezi meg a jogalapot (Grt. 6. § / GDPR 6. cikk (1) f) / jogos érdek).");
}
if (!/megtekintés adatai|rögzül/iu.test(page)) {
  problems.push("A lábléc nem tájékoztat a megtekintés-adatok rögzítéséről (tracking-átláthatóság).");
}
// The advertiser may not be anonymous. Empty sender config = no invented identity,
// but then the gate must say so out loud rather than pass in silence.
if (SENDER && !page.includes(SENDER)) {
  problems.push(
    `A lábléc nem nevezi meg a hirdetőt ("${SENDER}") — az SMS csak márkanévvel ír alá, így a valós ` +
      "szolgáltató SEHOL nem jelenik meg a mobil-úton.",
  );
}
if (!SENDER) {
  problems.push(
    "Nincs beállítva OUTREACH_SENDER_COMPANY/NAME — a hirdető megnevezése így hiányzik a lábléc-ből " +
      "(a Grt. szerint a reklámozó nem lehet névtelen).",
  );
}
if (!/leiratkoz/iu.test(page)) {
  problems.push("A lábléc nem tartalmaz leiratkozás-feliratot — a címzett nem találja meg a kiutat.");
}
const hrefs = [...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
const unsubHref = hrefs.find((h) => /unsubscribe/i.test(h));
if (!unsubHref) {
  problems.push("A láblécben nincs leiratkozó LINK (csak felirat nem elég — az opt-outnak kattinthatónak kell lennie).");
}
if (!hrefs.some((h) => /\/privacy|\/adatvedelem/i.test(h))) {
  problems.push("A láblécből hiányzik az adatkezelési tájékoztató linkje.");
}

// ── 2. That opt-out URL is a route the server serves — in both link shapes. ──
if (unsubHref) {
  const shapes: ReadonlyArray<{ path: string; why: string }> = [
    { path: unsubHref, why: "a láblécben kiadott alak" },
    { path: `/p/${SLUG}${unsubHref.replace(/^\/p/, "")}`, why: "olvasható slug + token alak" },
  ];
  for (const s of shapes) {
    if (!UNSUB_ROUTE.test(normalizeProspectPath(s.path))) {
      problems.push(`A leiratkozó URL nem illeszkedik a szerver route-jára (${s.why}): ${s.path} — halott leiratkozás.`);
    }
  }
}

// ── 3. The prospect-page handler still routes its HTML through the notice. ───
const src = readFileSync(SERVER, "utf8");
if (!/injectTrackingNotice/.test(src)) {
  problems.push(
    "A konzol-szerver már NEM hívja az injectTrackingNotice-t — az előnézet-oldal jogi lábléc nélkül menne ki.",
  );
} else if (!/tracked\s*\n?\s*\?\s*injectTrackingNotice\(/.test(src)) {
  problems.push(
    "A /p/ oldal-ág nem az injectTrackingNotice kimenetét küldi a KÖVETETT ágon — " +
      "a lábléc létezik, de nem kerül bele a kiszolgált lapba.",
  );
}
// ── 4. The FAILING branch too: a missing mock file must not strand the recipient
// on a bare 404. The token is valid there, so the footer can and must be served.
//
// ⚠️ Anchored on the page's own TEXT, not on the call's formatting: the first
// version matched `send(res, 404, injectTrackingNotice(` literally and went red
// the moment a comment was added inside the call — a guard that breaks on
// reformatting trains you to ignore it.
const FALLBACK_COPY = "Ez az előnézet már nem érhető el";
const at = src.indexOf(FALLBACK_COPY);
if (at < 0) {
  problems.push(
    `A hiányzó mock-fájl ága már nem a várt hiba-lapot adja ("${FALLBACK_COPY}") — ` +
      "ellenőrizd, hogy a jogi lábazat még mindig kimegy rajta (ADR-0112).",
  );
} else if (!/injectTrackingNotice/.test(src.slice(src.lastIndexOf("send(", at), at + 200))) {
  // ⚠️ The window starts at the send( call that CONTAINS the copy, not at a fixed
  // character offset: with a ±600 window the guard could reach back to the
  // SUCCESS branch's injectTrackingNotice (measured 720 chars away) and stay
  // green while the 404 branch shipped no footer at all.
  problems.push(
    "A hiányzó mock-fájl 404-ága nem viszi a jogi lábazatot — a címzett egy csupasz hibalapon áll, " +
      "leiratkozás nélkül, pedig a tokenje érvényes (ADR-0112).",
  );
}

// ── 5. The OPTED-OUT visitor's page (owner's ruling, ADR-0112): they may look
// and they may buy — but we neither measure nor push, and the page must SAY so
// truthfully. This branch is easy to get subtly wrong: reusing the tracked
// footer would state "a megtekintés adatai rögzülnek" on a path that records
// nothing, i.e. a lie about ourselves (§B.17).
const optedOut = injectOptedOutNotice(injectOptedOutBanner(MOCK_BODY), TOKEN);

if (/rögzülnek|rögzítjük az/iu.test(optedOut.replace(/nem rögzítjük/giu, ""))) {
  problems.push(
    "A leiratkozott látogató lapja AZT ÁLLÍTJA, hogy rögzítjük a megtekintést — pedig ezen az ágon " +
      "nincs recordView és nincs beacon. §B.17: magunkról sem állíthatunk valótlant.",
  );
}
if (!/nem rögzítjük/iu.test(optedOut)) {
  problems.push("A leiratkozott látogató lapja nem mondja ki, hogy ezt a megtekintést NEM rögzítjük.");
}
if (!/leiratkozott/iu.test(optedOut)) {
  problems.push("A leiratkozott látogató lapja nem mondja ki, hogy a látogató korábban leiratkozott.");
}
if (/\/unsubscribe/.test(optedOut)) {
  problems.push(
    "A leiratkozott látogató lapja ÚJRA leiratkozást kínál — ez azt sugallja, hogy az első nem sikerült.",
  );
}
if (optedOut.indexOf("Leiratkozott, ezért nem keressük") > optedOut.indexOf("<h1>")) {
  problems.push("A leiratkozott-sáv nem a lap TETEJÉN áll (a látogatónak görgetnie kellene az indoklásért).");
}
// …and the route must actually turn the machinery OFF for that visitor.
for (const [needle, why] of [
  ["const tracked = !p.unsubscribed", "a leiratkozott/követett ág megkülönböztetése"],
  ["tracked\n        ? await recordView(", "látogatás-rögzítés KIHAGYÁSA leiratkozottnál"],
  ["tracked ? await ensureEscalationOffer", "eszkalációs ajánlat NEM keletkezhet leiratkozottnál"],
  ["tracked ? await bestActiveOfferForProspect", "ajánlat-kártya NEM jelenhet meg leiratkozottnál"],
  ["viewId ? { track:", "az esemény-beacon KIMARAD leiratkozottnál"],
] as const) {
  if (!src.includes(needle)) {
    problems.push(`A /p/ route-ból eltűnt: ${why} (keresett minta: \`${needle}\`) — ADR-0112.`);
  }
}

if (problems.length) {
  console.error("⛔ OPT-OUT HORDOZÓ ŐR — BUKÁS\n");
  for (const p of problems) console.error(`  ❌ ${p}`);
  console.error(
    "\nAz SMS szövege ADR-0112 óta nem hordozza a leiratkozást; ha a linkelt oldal sem, akkor a megkeresésnek " +
      "nincs kiútja (Grt. 6. §). Vagy állítsd helyre a láblécet, vagy tedd vissza a linket az SMS-be.",
  );
  process.exit(1);
}

console.log("✅ Opt-out hordozó őr: a linkelt előnézet-oldal viszi a jogalapot ÉS az élő leiratkozó linket.");
console.log(`   leiratkozó URL: ${unsubHref}  →  route: ${normalizeProspectPath(unsubHref!)}`);
