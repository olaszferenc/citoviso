// gate-runner: land-blocking — kiküldési minőség (tulaj 2026-11-25: minőségi kolléga + tulaj-jóváhagyás minden levél előtt + engedélylistás képszűrő)
// gate-scope: no-docs — kód-kapu: a kód-zárlata nem olvas MEMORY.md-t és _planning/-t (gate-scope-check méri)
//
// ① No letter leaves without the quality colleague's pass on THIS mock file (src/outreach/mockQaReview.ts):
//    the dispatcher's claim, its per-row check and the shared send path all ask for it; only the
//    owner's sample letter (`sampleTo`) is exempt. ② The photo filter is an ALLOW-list
//    (src/media/photoKind.ts): a picture that is not surely the lodging, or too small / dark / blurred,
//    is "junk" and stays off the page, out of the hero and out of the opening. Hermetic: no DB, no model.
import { readFileSync } from "node:fs";
import { isBandWorthy, isHeroWorthy, isOffPagePhoto, isShowcase, PHOTO_OK_MIN, type PhotoKind } from "../src/media/photoKind.js";
import { mockRatingShown } from "../src/engine/rating.js";
import { APPROVAL_PENDING_NOTE, ownerApprovalOf, QA_HOLD_PREFIX, QA_WAIT_NOTE, QA_STALE_NOTE, qaBlockReason, qaReviewOf, type QaReview } from "../src/outreach/mockQaReview.js";

let failed = 0;
function check(label: string, ok: boolean): void {
  console.log(`${ok ? "✓" : "✗"}  ${label}`);
  if (!ok) failed++;
}
const src = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── ① the review states ──
const R = (verdict: "pass" | "fail", note = "rendben"): QaReview => ({ verdict, note, by: "teszt", at: "2026-11-25T00:00:00Z", mtime: 1 });
check("jóváhagyott, friss → mehet", qaBlockReason({ state: "pass", review: R("pass") }) === null);
check("nem jóváhagyott → nem megy, az indokkal", (qaBlockReason({ state: "fail", review: R("fail", "WC a galériában") }) ?? "").includes("WC a galériában"));
check("nincs átnézés → nem megy", qaBlockReason({ state: "missing" }) !== null);
check("az átnézés óta változott mock → nem megy (újra át kell nézni)", qaBlockReason({ state: "stale", review: R("pass") }) === QA_STALE_NOTE);
check("hiányzó mockfájl → nem megy", qaBlockReason({ state: "nofile" }) !== null);
check("hibás tárolt ítélet nem számít átnézésnek", qaReviewOf({ qaReview: { verdict: "maybe", mtime: 1 } }) === null);
check("a fájl-időbélyeg nélküli ítélet nem számít átnézésnek", qaReviewOf({ qaReview: { verdict: "pass" } }) === null);

// ── ① the wiring ──
const dispatch = src("src/outreach/autoDispatch.ts");
check("bekötés: a kiküldő csak kolléga-jóváhagyott mockot vesz fel a sorból", /\$\{MOCK_QA_PASSED_SQL\}/.test(dispatch));
const one = dispatch.slice(dispatch.indexOf("async function dispatchOne("), dispatch.indexOf("export async function dispatchRecipient("));
check(
  "bekötés: a kiküldő soronként is ellenőrzi a friss jóváhagyást, a levél ELŐTT",
  one.includes("qaReviewState(artifactId)") && one.indexOf("qaReviewState(artifactId)") < one.indexOf("sendOutreachMail("),
);
const send = src("src/outreach/sendBatch.ts");
const fn = send.slice(send.indexOf("export async function sendOutreachMail("));
check(
  "bekötés: a közös küldési út (konzol, kiküldő) kolléga-jóváhagyás nélkül nem küld — csak a tulaj mintalevele kivétel",
  /if \(p\.artifactId && !opts\.sampleTo\) \{\s*const qaBlock = qaBlockReason\(await qaReviewState\(p\.artifactId\)\);\s*if \(qaBlock\) return/.test(fn) &&
    fn.indexOf("qaReviewState(p.artifactId)") < fn.indexOf("getEmailSender().send("),
);

// ── ①b the owner's yes on the approval page (owner 2026-11-25) ──
check("tulaj-jóváhagyás: fájl-időbélyeg nélkül nem számít", ownerApprovalOf({ ownerApproval: { by: "x" } }) === null);
check("tulaj-jóváhagyás: időbélyeggel számít", ownerApprovalOf({ ownerApproval: { by: "x", at: "y", mtime: 5 } })?.mtime === 5);
check("bekötés: a kiküldő csak tulaj-jóváhagyott mockot vesz fel a sorból", /\$\{MOCK_OWNER_APPROVED_SQL\}/.test(dispatch));
check(
  "bekötés: a kiküldő soronként is ellenőrzi a friss tulaj-jóváhagyást, a levél ELŐTT",
  one.includes("ownerApprovalBlock(artifactId)") && one.indexOf("ownerApprovalBlock(artifactId)") < one.indexOf("sendOutreachMail("),
);
check(
  "bekötés: a közös küldési út tulaj-jóváhagyás nélkül nem küld (csak a mintalevél kivétel)",
  /if \(p\.artifactId && !opts\.sampleTo\) \{[\s\S]{0,400}ownerApprovalBlock\(p\.artifactId\)/.test(fn) &&
    fn.indexOf("ownerApprovalBlock(p.artifactId)") < fn.indexOf("getEmailSender().send("),
);
const qaSrc = src("src/outreach/mockQaReview.ts");
check("a kolléga jóváhagyása NEM küld: a sort a tulaj lapjára teszi", /status: "held", note: APPROVAL_PENDING_NOTE/.test(qaSrc) && !/status: "queued"/.test(qaSrc));
const aq = src("src/console/approvalQueue.ts");
// 2026-11-25 (ADR-0479): DISPATCH_PHOTOS_OK_SQL = the ≥5 own-photo rule, or for fewer the CURRENT town pick (mockPhotoGate.ts).
check("a jóváhagyó lap csak a teljes kört mutatja (kapu + kolléga + 5 saját kép / aktuális településkép + új generátor)",
  /qaReviewState\(r\.main_id\)/.test(aq) && /cachedRenderGate\(/.test(aq) && /LEAD_OWN_PHOTOS_SQL|DISPATCH_PHOTOS_OK_SQL/.test(aq) && /MOCK_CURRENT_GENERATOR_SQL/.test(aq));
check("a „Mehet” a mockfájlra bélyegzi a tulaj jóváhagyását", /recordOwnerApproval\(row\.artifact_id/.test(aq));
check("a várakozó-jegyzet egy helyen él", APPROVAL_PENDING_NOTE.startsWith("JÓVÁHAGYÁSRA VÁR"));

const gateSrc = src("src/outreach/mockPhotoGate.ts");
check("nyitókép-javítás nélkül semmi: a küldési kapu a javítás élesítése utáni vagy az azzal újrarenderelt mockot kéri",
  /MOCK_HEROFIX_LIVE_AT/.test(gateSrc) && /terhatasAt/.test(gateSrc) && /STAMP = MOCK_HEROFIX_STAMP/.test(src("scripts/rerender-terhatas.mts")));

// ── ①b the CRM says „awaiting the owner” only for the whole chain (owner 2026-11-25: „1664 … ezek a régiek”) ──
check("a kollégára váró sor jegyzete NEM a tulaj-várakozóé, és a kolléga jóváhagyása átviszi (QA_HOLD_PREFIX)",
  QA_WAIT_NOTE !== APPROVAL_PENDING_NOTE && QA_WAIT_NOTE.startsWith(QA_HOLD_PREFIX));
check("a kolléga sora a kollégára váró sorokat is felveszi", /QA_WAIT_NOTE/.test(src("scripts/qa-review.mts")));
const stock = src("src/console/leadStock.ts");
check("Lead-állomány: „kiküldhető” csak kolléga-jóváhagyott, javított generátorú mock",
  /\$\{MOCK_QA_PASSED_SQL\}/.test(stock) && /\$\{MOCK_CURRENT_GENERATOR_SQL\}/.test(stock));

// ④ (owner 2026-11-25): <5 own photos go out only once the town library is ready AND the owner opened it —
// the town-pick branch sits behind the app_setting switch, default OFF (absent row = closed).
const photoGateSrc = src("src/outreach/mockPhotoGate.ts");
const townBranch = /export const MOCK_TOWN_PICK_OK_SQL = sql<boolean>`\(\s*exists \(select 1 from app_setting s where s\.key = \$\{TOWN_PHOTO_DISPATCH_KEY\} and s\.value = 'on'\)\s*and /.test(photoGateSrc);
check("KI kapcsolónál a <5 képes ág zárva (app_setting town_photo_dispatch, alapból ki)",
  townBranch && /TOWN_PHOTO_DISPATCH_KEY = "town_photo_dispatch"/.test(photoGateSrc) && /else \$\{MOCK_TOWN_PICK_OK_SQL\} end/.test(photoGateSrc));

// ── ② the allow-list ──
const K = (kind: PhotoKind["kind"], label: string, extra: Partial<PhotoKind> = {}): PhotoKind => ({
  kind, label, score: 0.5, sight: 0, never: 0, ok: kind === "ok" ? 0.9 : 0.2, probs: { "the outside of a house": kind === "ok" ? 0.8 : 0 }, ...extra,
});
const junk = K("junk", "a locomotive", { why: "nem biztosan szállás-kép (a locomotive)" });
check("a nem-szállás kép (mozdony) lekerül az oldalról", isOffPagePhoto(junk, false));
check("…nyitóképnek sem jó", !isHeroWorthy(junk) && isOffPagePhoto(junk, true));
check("…a nyitó-animációba sem kerül", !isShowcase(junk));
check("a szállás külső képe marad és nyitókép lehet", !isOffPagePhoto(K("ok", "the outside of a house"), true) && isHeroWorthy(K("ok", "the outside of a house")));
check("az engedélylista küszöbe 0,4 (mérve 11-25)", PHOTO_OK_MIN === 0.4);
check("teakonyha sem nyitókép, sem nyitó-animáció (Vörösmarty kapuszárny, 11-25)",
  !isShowcase(K("ok", "a small kitchenette")) && !isHeroWorthy(K("ok", "a small kitchenette")));
check("konyhasarok, aminek nem a konyha a legjobb címkéje, de konyha+fürdő ≥ 0,4 → nem nyitás (Mia, 11-25)",
  !isShowcase(K("ok", "a museum exhibit", { probs: { "a kitchen": 0.24, "a small kitchenette": 0.24, "the outside of a house": 0.3 } })));
const kindSrc = src("src/media/photoKind.ts");
check(
  "a besoroló engedélylistás: a legjobb címke szállás-címke ÉS a szállás-címkék együtt ≥ küszöb, különben junk",
  /ok < PHOTO_OK_MIN \|\| top\.kind !== "ok"/.test(kindSrc) && /kind = "junk"/.test(kindSrc),
);
check("minőség: túl kicsi, túl sötét, elmosódott kép junk", /PHOTO_MIN_LONG_EDGE/.test(kindSrc) && /PHOTO_MIN_LUMA/.test(kindSrc) && /PHOTO_MIN_SHARPNESS/.test(kindSrc));
const labels = JSON.parse(src("src/media/photoKindLabels.json")) as { labels: { label: string; kind: string }[] };
for (const l of ["a locomotive", "a car", "a dog", "a plate of food", "a close-up of a decorative pillow", "a coffee machine", "a refrigerator"]) {
  check(`címke a gagyi képre: ${l}`, labels.labels.some((x) => x.label === l && x.kind !== "ok"));
}

// ── ③ the quality colleague's first ten (2026-11-25): rating floor, band = a place, desktop word break, date stamp ──
check("1★ / 2,5★ nem kerül a mockra", !mockRatingShown({ rating: { value: 1, count: 40 } }) && !mockRatingShown({ rating: { value: 2.5, count: 12 } }));
check("4,6★ 2 véleményből sem (kevés vélemény)", !mockRatingShown({ rating: { value: 4.6, count: 2 } }));
check("4,6★ 30 véleményből marad", mockRatingShown({ rating: { value: 4.6, count: 30 } }));
check("a renderelés a mockon leveszi a gyenge értékelést (minden hely egy vágással)", /!mockRatingShown\(data\)/.test(src("src/engine/render.ts")));
check("sávkép: fürdő nem jó", !isBandWorthy(K("ok", "a sauna or jacuzzi", { probs: { "a sauna or jacuzzi": 0.6 } })));
check("sávkép: a ház kívülről jó", isBandWorthy(K("ok", "the outside of a house")));
check("sávkép: párna-közeli (közeli-címkék ≥ 0,2) nem jó",
  !isBandWorthy(K("ok", "a bedroom with a bed", { probs: { "a bedroom with a bed": 0.5, "a close-up of a decorative pillow": 0.25 } })));
check("a sávokat a közelkép-jelzés nélküli képek töltik", /bandFit/.test(src("src/engine/templateKit.ts")) && /notBand/.test(src("src/generator/photoCurate.ts")));
check("telefonon a sávkép nem képernyőnyi ablak (a fotó nagy része látszik)", /t-par--band'\)\)\{var h=Math\.round\(r\.height\*1\.25\)/.test(src("src/engine/templates/parallax.ts")));
const gate = src("src/outreach/mockRenderGate.ts");
check("a kapu a levél képét (asztali első képernyő) is nézi szótörésre", /DESKTOP_VIEWPORT/.test(gate) && /desktopBrokenWords/.test(gate));
check("a kapu a sávképet is méri (bandScore)", /bandScore\(v\)/.test(gate));
check("a dátumbélyegzős fotó junk (helyi szövegfelismerő)", /dátumbélyegző a fotón/.test(kindSrc) && /readPhotoText/.test(kindSrc));
check("az e-mail a kapcsolat-sorban nem nagybetűs, a @ előtt törhet", /a\.t-mail\{text-transform:none/.test(src("src/engine/templates/parallax.ts")) && /<wbr>@/.test(src("src/engine/templates/parallax.ts")));

// ── ④ the pipeline refreshes its own mocks (owner 2026-11-25: „Ha te manuálisan javítasz valamit … semmi értelme”) ──
const tick = src("scripts/outreach-dispatch.mts");
check("a kiküldő időzítője minden futásban frissíti a léc alatti várakozó mockokat", /refreshStaleQueue\(budget\)/.test(tick));
const refresh = src("src/generator/mockRefresh.ts");
check("a frissítés a léc alattiakat veszi (not MOCK_CURRENT_GENERATOR_SQL) és a kollégához küldi vissza",
  /not \$\{MOCK_CURRENT_GENERATOR_SQL\}/.test(refresh) && /note: QA_WAIT_NOTE/.test(refresh));
check("a kézi kör ugyanazt a függvényt hívja (egy út)", /refreshMock\(row\)/.test(src("scripts/rerender-terhatas.mts")));

// ── ⑤ two plans or no letter (owner 2026-11-25: „Csak az hagyható jóvá, ahol van második terv is.”) ──
const aq2 = src("src/console/approvalQueue.ts");
check("jóváhagyó lap: csak ha a 2. terv is végigjárta a láncot", /planChainPassed\(alt\)/.test(aq2) && /secondPlanOf\(r\.lead_id, r\.main_id\)/.test(aq2));
check("a tulaj igenje mindkét tervre kerül", /recordOwnerApproval\(alt\.id, by\)/.test(aq2));
const ad2 = src("src/outreach/autoDispatch.ts");
check("kiküldő: 2. terv nélkül (vagy láncon kívüli 2. tervvel) nem küld", /secondPlanBlock\(leadId, artifactId\)/.test(ad2) && /if \(!att\.ok\) return \{ ok: false, status: "held"/.test(ad2));
check("a csatolt 2. terv pontosan a láncot megjárt terv", /m\.id === chosen\?\.id/.test(ad2));
check("a frissítés a 2. tervet is frissíti", /secondPlanOf\(w\.leadId, w\.mainId\)/.test(src("src/generator/mockRefresh.ts")));
check("a kolléga sora a 2. tervet is adja", /secondPlanOf\(r\.leadId, r\.artifactId\)/.test(src("scripts/qa-review.mts")));

check("nyitókép: sötét (fényerő < 80) nem lehet", !isHeroWorthy(K("ok", "the outside of a house", { quality: { long: 1600, luma: 60, lap: 300 } })));
check("sáv: a legjobb pontszámú kép, nem a soron következő", /bestBand\(\)/.test(src("src/engine/templateKit.ts")));

check("fürdő/WC sehol nincs az oldalon (galéria sem)", isOffPagePhoto(K("ok", "a bathroom with a shower", { probs: { "a bathroom with a shower": 0.5 } }), false));
check("a kártyaképek nem fürdő/konyha, és nincs rajtuk jármű/ember/állat", /take\(\(x\) => notBath\(x\) && !x\.notCard\)/.test(src("src/engine/templateKit.ts")));

check("kapuszárny: a legjobb széles kép, közeli/sötét csak végső esetben", /b\.p\.bandScore \?\? -1/.test(src("src/engine/templates/gateOpening.ts")));

{
  const { matchIcon } = await import("../src/engine/icons.js");
  const want: [string, string][] = [["Kutyusokat ingyen fogadnak", "pet"], ["Légkondicionálás és padlófűtés", "ac"], ["Konyha mosogatógéppel", "kitchen"], ["Kiságy és etetőszék", "child"], ["Agyagos talaj", "dot"], ["Saját stég", "view"]];
  for (const [l, n] of want) check(`ikon: „${l}” → ${n} (egész szó, nem szótöredék)`, matchIcon(l) === n);
}

check("nyitókép: a kolléga választ (heroes/hero), a sor előbb ezt kéri", /HERO_PICK_PREFIX/.test(src("scripts/qa-review.mts")) && /pinnedUrl/.test(src("src/generator/mockRefresh.ts")));

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — kolléga-jóváhagyás vagy engedélylistás képszűrő nélkül menne ki levél.`);
  process.exit(1);
}
console.log("✅ qa-review-check: minőségi kolléga és tulaj-jóváhagyás nélkül nincs levél, a képszűrő engedélylistás.");
