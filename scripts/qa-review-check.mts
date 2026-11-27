// gate-runner: land-blocking — kiküldési minőség (tulaj 2026-11-25: tulaj-jóváhagyás minden levél előtt + engedélylistás képszűrő; 2026-11-26: a minőségi kolléga szabályfelfedező, a passza nem kapu — a bukása tart)
// gate-scope: no-docs — kód-kapu: a kód-zárlata nem olvas MEMORY.md-t és _planning/-t (gate-scope-check méri)
//
// ① The quality colleague's FAIL on THIS mock file holds the letter on every path (src/outreach/mockQaReview.ts):
//    the dispatcher's per-row check and the shared send path ask it; the PASS is not required anywhere since
//    2026-11-26 (ADR-0495) — the machine render gate and the owner's yes decide; only the owner's sample letter
//    (`sampleTo`) is exempt from the fail too. ② The photo filter is an ALLOW-list
//    (src/media/photoKind.ts): a picture that is not surely the lodging, or too small / dark / blurred,
//    is "junk" and stays off the page, out of the hero and out of the opening. Hermetic: no DB, no model.
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bandScore, fitsBand, fitsContact, fitsHero, fitsOpening, focusXOfBuffer, signWords, heroSized, isNightShot, isBandWorthy, isHeroCandidate, isHeroWorthy, isOffPagePhoto, isShowcase, PHOTO_OK_MIN, type PhotoKind } from "../src/media/photoKind.js";
import LABELS_JSON from "../src/media/photoKindLabels.json" with { type: "json" };
import { slotMarks } from "../src/generator/photoCurate.js";
import { gatePhotoOf } from "../src/engine/templates/gateOpening.js";
import sharpLib from "sharp";
import { withRibbonStrip } from "../src/outreach/heroShot.js";
import { sampleRooms, galleryOrder, roomsForMock, allotPhotos, contactPhotoOf, fitsSlot } from "../src/engine/templateKit.js";
import { withoutAbsentPictureClaims, renderSite, isAddressLabel } from "../src/engine/render.js";
import { catalogueIdFor } from "../src/engine/amenityIcon.js";
import { showsBathroomFixture, showsBed, showsPerson, showsSittingArea, showsVehicleOrAnimal, type DetectedObject } from "../src/media/photoObjects.js";
import type { SiteData as SD, Photo as PH } from "../src/engine/recipe.js";
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
check("nincs átnézés → mehet (a kolléga passza nem kapu, tulaj 2026-11-26)", qaBlockReason({ state: "missing" }) === null);
check("az átnézés óta változott mock → mehet (a bukás a fájlhoz kötött, az új fájlt a gépi kapu ítéli)", qaBlockReason({ state: "stale", review: R("fail") }) === null);
check("az elavult-jegyzet még létezik (a régi sorok viselik)", QA_STALE_NOTE.length > 10);
check("hiányzó mockfájl → nem megy", qaBlockReason({ state: "nofile" }) !== null);
check("hibás tárolt ítélet nem számít átnézésnek", qaReviewOf({ qaReview: { verdict: "maybe", mtime: 1 } }) === null);
check("a fájl-időbélyeg nélküli ítélet nem számít átnézésnek", qaReviewOf({ qaReview: { verdict: "pass" } }) === null);

// ── ① the wiring ──
const dispatch = src("src/outreach/autoDispatch.ts");
check("bekötés: a kiküldő NEM kér kolléga-passzt a sorból (tulaj 2026-11-26)", !/\$\{MOCK_QA_PASSED_SQL\}/.test(dispatch));
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
check("a jóváhagyó lap csak a teljes kört mutatja (gépi kapu + 5 saját kép / aktuális településkép + új generátor; a kolléga bukása tart)",
  /qaReviewState\(r\.main_id\)/.test(aq) && /cachedRenderGate\(/.test(aq) && /LEAD_OWN_PHOTOS_SQL|DISPATCH_PHOTOS_OK_SQL/.test(aq) && /MOCK_CURRENT_GENERATOR_SQL/.test(aq));
check("a „Mehet” a mockfájlra bélyegzi a tulaj jóváhagyását", /recordOwnerApproval\(row\.artifact_id/.test(aq));
check("a Mehet / Nem mehet ki minden kapura váró sort elér (CHAIN_WAIT_NOTES a döntésben; tulaj 2026-11-26 22:43)",
  (aq.match(/\.where\("note", "in", \[\.\.\.CHAIN_WAIT_NOTES\]\)/g) ?? []).length >= 2);
check("a várakozó-jegyzet egy helyen él", APPROVAL_PENDING_NOTE.startsWith("JÓVÁHAGYÁSRA VÁR"));

const gateSrc = src("src/outreach/mockPhotoGate.ts");
check("nyitókép-javítás nélkül semmi: a küldési kapu a javítás élesítése utáni vagy az azzal újrarenderelt mockot kéri",
  /MOCK_HEROFIX_LIVE_AT/.test(gateSrc) && /terhatasAt/.test(gateSrc) && /STAMP = MOCK_HEROFIX_STAMP/.test(src("scripts/rerender-terhatas.mts")));

// ── ①b the CRM says „awaiting the owner” only for the whole chain (owner 2026-11-25: „1664 … ezek a régiek”) ──
check("a kapura váró sor jegyzete NEM a tulaj-várakozóé, és nem állítja, hogy a kolléga jóváhagyása kell",
  QA_WAIT_NOTE !== APPROVAL_PENDING_NOTE && !QA_WAIT_NOTE.startsWith(QA_HOLD_PREFIX) && !/jóváhagyása után/.test(QA_WAIT_NOTE));
check("a régi (11-26 előtti) várakozó-jegyzetet minden sor-illesztés ismeri (CHAIN_WAIT_NOTES)",
  /CHAIN_WAIT_NOTES/.test(src("src/generator/mockRefresh.ts")) && /CHAIN_WAIT_NOTES/.test(src("src/mms/messenger.ts")) && /CHAIN_WAIT_NOTES/.test(src("src/console/approvalQueue.ts")));
check("a kolléga eszköze mintát vesz és hiba-fajtát rögzít (sample / note / findings)",
  /cmd === "sample"/.test(src("scripts/qa-review.mts")) && /recordQaFinding\(/.test(src("scripts/qa-review.mts")) && /faultTally\(/.test(src("scripts/qa-review.mts")));
check("vak mérés: a kapu látatlan mintán, a kolléga és a tulaj által nem látott mockokon mér",
  /QA_REVIEW_KEY\} is null/.test(src("scripts/gate-blind-sample.mts")) && /ownerApproval.*is null/.test(src("scripts/gate-blind-sample.mts")) && /renderGateFor\(/.test(src("scripts/gate-blind-sample.mts")));
check("a kolléga sora a kollégára váró sorokat is felveszi", /QA_WAIT_NOTE/.test(src("scripts/qa-review.mts")));
const stock = src("src/console/leadStock.ts");
check("Lead-állomány: „kiküldhető” csak gépi kapun átment, javított generátorú mock",
  !/\$\{MOCK_QA_PASSED_SQL\}/.test(stock) && /renderGate'->>'verdict' = 'pass'/.test(stock) && /\$\{MOCK_CURRENT_GENERATOR_SQL\}/.test(stock));

// ④ (owner 2026-11-25): <N own photos go out only once the town library is ready AND the owner opened it —
// since 0155 the town-pick branch sits behind the lead's COUNTRY ROW switch (dispatch_photo_mode, default 'own' = closed).
const photoGateSrc = src("src/outreach/mockPhotoGate.ts");
const townBranch = /export const MOCK_TOWN_PICK_OK_SQL = sql<boolean>`\(\s*\$\{LEAD_TOWN_MODE_SQL\}\s*and /.test(photoGateSrc);
check("KI kapcsolónál a <N képes ág zárva (az ország sora: dispatch_photo_mode, alapból 'own')",
  townBranch && /c\.dispatch_photo_mode = 'own_town'/.test(photoGateSrc) && /< \$\{LEAD_MIN_OWN_PHOTOS_SQL\} and \$\{MOCK_TOWN_PICK_OK_SQL\}\)/.test(photoGateSrc));

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
check("a sávokat a sáv-alkalmas (okBand) képek töltik", /const bandFit = \(p: Photo\): boolean => fitsSlot\(p, "band"\);/.test(src("src/engine/templateKit.ts")) && /okBand: fitsBand\(v\)/.test(src("src/generator/photoCurate.ts")));
check("telefonon a sávkép nem képernyőnyi ablak (a fotó nagy része látszik)", /t-par--band'\)\)\{var h=Math\.round\(r\.height\*1\.25\)/.test(src("src/engine/templates/parallax.ts")));
const gate = src("src/outreach/mockRenderGate.ts");
check("a kapu a levél képét (asztali első képernyő) is nézi szótörésre", /DESKTOP_VIEWPORT/.test(gate) && /desktopBrokenWords/.test(gate));
check("a kapu a sávképet is méri (fitsBand ⊇ bandScore)", /!fitsBand\(v\)/.test(gate) && /bandScore\(v\) > 0/.test(kindSrc));
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
check("a kártyaképek nem fürdő/konyha, és nincs rajtuk jármű/ember/állat", /const ok = \(x: Photo\): boolean => notBath\(x\) && !x\.notCard;/.test(src("src/engine/templateKit.ts")));

check("kapuszárny: a legjobb széles kép, közeli/sötét csak végső esetben", /b\.p\.bandScore \?\? -1/.test(src("src/engine/templates/gateOpening.ts")));

{
  const { matchIcon } = await import("../src/engine/icons.js");
  const want: [string, string][] = [["Kutyusokat ingyen fogadnak", "pet"], ["Légkondicionálás és padlófűtés", "ac"], ["Konyha mosogatógéppel", "kitchen"], ["Kiságy és etetőszék", "child"], ["Agyagos talaj", "dot"], ["Saját stég", "view"]];
  for (const [l, n] of want) check(`ikon: „${l}” → ${n} (egész szó, nem szótöredék)`, matchIcon(l) === n);
}

check("nyitókép: a kolléga választ (heroes/hero), a sor előbb ezt kéri", /HERO_PICK_PREFIX/.test(src("scripts/qa-review.mts")) && /pinnedUrl/.test(src("src/generator/mockRefresh.ts")));

check("ember (bikinis nő, csoport) sehol az oldalon", isOffPagePhoto(K("ok", "a swimming pool", { probs: { "a swimming pool": 0.6, "a woman in a bikini": 0.2 } }), false));
check("a kiemelt sor képe a szövegéhez illik (ROW_LABELS), nem illőnél nincs csúsztatás", /ROW_LABELS\[matchIcon/.test(src("src/engine/templateKit.ts")) && /if \(!p\) break;/.test(src("src/engine/templateKit.ts")));
{
  const { matchIcon: mi } = await import("../src/engine/icons.js");
  check("ikon: Infraszauna → pool, Tárcsán sütés → grill", mi("Infraszauna") === "pool" && mi("Tárcsán sütés-főzés") === "grill");
}


// ── 11-26 colleague rounds after dbd49b42 ──
{
  // the plan-framing ribbon is a strip BELOW the page, never over a floating CTA
  const page = await sharpLib({ create: { width: 608, height: 363, channels: 3, background: "#ff8800" } }).png().toBuffer();
  const out = path.join(os.tmpdir(), `qa-ribbon-${process.pid}.png`);
  await withRibbonStrip(page, "ELŐZETES LÁTVÁNYTERV — CITOVISO", out);
  const meta = await sharpLib(out).metadata();
  const corner = await sharpLib(out).extract({ left: 600, top: 355, width: 4, height: 4 }).raw().toBuffer();
  check("levélkép: a sáv a kép ALATT, külön csíkban — a jobb alsó gomb nem kerül alá", meta.height === 363 + 34 && corner[0]! > 200 && corner[2]! < 60);
}
{
  const ph = (n: number, extra: Partial<PH> = {}): PH => ({ url: `https://x.test/${n}.jpg`, alt: "k", provenance: "portal", ...extra });
  const d = { name: "T", photos: [ph(1), ph(2), ph(3, { kindLabel: "a living room", lounge: true }), ph(4, { kindLabel: "a hotel room interior" }), ph(5, { kindLabel: "a kitchen", backstage: true })], sampleRoomCount: 0 } as unknown as SD;
  const card = sampleRooms(d)[0];
  check("szobakártya: hálószoba-kép nélkül a felismert ülősarok (kanapé) képe — a „hotel room” címkéjű folyosó nem", card?.photo?.url === ph(3).url);
  const g = galleryOrder([ph(5, { notCard: true }), ph(6), ph(7)], "");
  check("galéria: jármű/ember/állat-kép nem nyit, a végére kerül (kevés kép mellett)", g[0]?.url === ph(6).url && g.at(-1)?.url === ph(5).url);
  const g2 = galleryOrder([ph(5, { notCard: true }), ph(6), ph(7), ph(8), ph(9), ph(10)], "");
  check("galéria: 5+ tiszta kép mellett a jármű/állat-kép kimarad", !g2.some((p) => p.url === ph(5).url) && g2.length === 5);
  check("havas / éjszakai / karácsonyi kép lekerül az oldalról", isOffPagePhoto(K("ok", "the outside of a house", { probs: { "a house covered in snow": 0.3 } }), false) && isOffPagePhoto(K("ok", "the outside of a house", { probs: { "a building at night": 0.28 } }), true));
  check("egyedül ülő ember (stég) lekerül az oldalról", isOffPagePhoto(K("ok", "a garden with a terrace", { probs: { "a person sitting on a pier": 0.2 } }), false));
  check("nyitókép-jelölt: a terasz akkor is a kolléga elé kerül, ha a gépi pontszáma 0.25 alatt van",
    isHeroCandidate(K("ok", "a balcony with a table and chairs", { probs: { "a balcony with a view": 0.12 } })) && !isHeroWorthy(K("ok", "a balcony with a table and chairs", { probs: { "a balcony with a view": 0.12 } })));
  const stripes = await sharpLib({ create: { width: 400, height: 200, channels: 3, background: "#808080" } })
    .composite([{ input: await sharpLib({ create: { width: 60, height: 200, channels: 3, background: "#000" } }).png().toBuffer(), left: 320, top: 0 },
      { input: await sharpLib({ create: { width: 20, height: 200, channels: 3, background: "#fff" } }).png().toBuffer(), left: 340, top: 0 }]).png().toBuffer();
  const fx = await focusXOfBuffer(stripes);
  check("nyitókép mobilon: a kivágás a kép részletgazdag oldalára áll", fx != null && fx >= 80, `fx=${fx}`);
  check("parallax: a nyitókép a fókuszpont szerint vág (--cit-hero-fx), a mélységhatás vászna is", /--cit-hero-fx/.test(readFileSync(new URL("../src/engine/templates/parallax.ts", import.meta.url), "utf8")) && /uniform vec2 off,cover,sh/.test(readFileSync(new URL("../src/engine/depthHero.ts", import.meta.url), "utf8")));
  check("parallax mobil: a rögzített réteg is a fókuszpont szerint vág (nem kényszerített center)", /cs\.backgroundPosition\|\|'center'/.test(readFileSync(new URL("../src/engine/templates/parallax.ts", import.meta.url), "utf8")));
  check("„Amit kínálunk”: forrás-lista nélkül nem üres keret és nem a kiemelések duplája — kimarad", /if \(!items\.length && \(d\.highlights \?\? \[\]\)\.some\(\(h\) => catalogueIdFor\(h, d\.amenityIconMap\) !== null\)\) return "";/.test(readFileSync(new URL("../src/engine/moduleSections.ts", import.meta.url), "utf8")));
  {
    const ph2 = (n: number, kindLabel?: string): PH => ({ url: `https://y.test/${n}.jpg`, alt: "k", provenance: "portal", ...(kindLabel ? { kindLabel } : {}) });
    const c2 = sampleRooms({ name: "S", photos: [ph2(1), ph2(2), ph2(3, "a garden with a terrace"), ph2(4, "a kitchen")], sampleRoomCount: 0 } as unknown as SD)[0];
    check("szálláskártya: ágy/kanapé nélkül nincs kártyakép (konyha, kert, kapu soha) — a blokk elmarad (11-26 4–10. kör)", !c2?.photo);
  }
  {
    const r = withoutAbsentPictureClaims({ template: "parallax", skin: "", archetype: "", sections: [{ kind: "gallery", copy: { title: "Képek a házról és az alaprajzokról", eyebrow: "Galéria" } }] } as never) as { sections: { copy: { title?: string; eyebrow?: string } }[] };
    check("galéria-cím: alaprajzot nem ígér (alaprajz sosem kerül az oldalra)", r.sections[0]!.copy.title === undefined && r.sections[0]!.copy.eyebrow === "Galéria");
  }
  {
    const O = (label: string, score: number, a: number): DetectedObject => ({ label, score, x: 0, y: 0, w: Math.sqrt(a), h: Math.sqrt(a) });
    check("tárgyfelismerő: a kép szélén álló terepjáró (8%) → nem kártya, nem galéria-nyitó, nem sáv", showsVehicleOrAnimal([O("truck", 0.7, 0.085)]));
    check("tárgyfelismerő: kutya a ház előtt → ugyanígy", showsVehicleOrAnimal([O("dog", 0.6, 0.02)]));
    check("tárgyfelismerő: a stégen ülő ember (0.72, 0.9%) → le az oldalról", showsPerson([O("person", 0.72, 0.009)]));
    check("tárgyfelismerő: a távoli, bizonytalan alak (0.3) nem visz le képet", !showsPerson([O("person", 0.305, 0.003)]));
    check("tárgyfelismerő: WC → le; a dézsa „WC”-nek nézve (0.37, a képfelismerő szerint nem fürdő) marad",
      showsBathroomFixture([O("toilet", 0.6, 0.05)]) && !showsBathroomFixture([O("toilet", 0.368, 0.165)], 0.01, 0));
    check("tárgyfelismerő: fürdőszobai mosdó → le; konyhai mosogató (konyha a képen) marad",
      showsBathroomFixture([O("sink", 0.7, 0.02)], 0.2, 0) && !showsBathroomFixture([O("sink", 0.7, 0.02)], 0.02, 0.5));
    check("tárgyfelismerő: ágy → szobakártya-kép; kanapé → a magányos kártya képe; folyosó (semmi) → egyik sem",
      showsBed([O("bed", 0.7, 0.3)]) && showsSittingArea([O("couch", 0.8, 0.3)]) && !showsBed([]) && !showsSittingArea([]));
    check("kiemelt sor: csak a szövegéhez illő képet kap (nincs semleges/címke nélküli tartalék)", !/NEUTRAL_ROW/.test(readFileSync(new URL("../src/engine/templateKit.ts", import.meta.url), "utf8")));
    check("sáv és kapuszárny: jármű/ember/állat-kép nem (okBand ⊆ !notCard)", /okBand: fitsBand\(v\) && !notCard/.test(readFileSync(new URL("../src/generator/photoCurate.ts", import.meta.url), "utf8")));
  }
  {
    const base = { name: "Kevi", intro: "Ház a tónál.", tagline: "Ház a tónál", contact: { phone: "+36 30 111 2222" }, photos: [], highlights: ["Saját parkoló", "Wifi", "Grillsütő"] } as unknown as SD;
    const amenOf = (html: string): string => html.match(/<section[^>]*data-cit-module="amenities"[\s\S]*?<\/section>/)?.[0] ?? "";
    const r = { template: "parallax", skin: "", archetype: "", sections: [] } as never;
    const dup = amenOf(renderSite(r, { ...base, sampleAmenities: ["Parkoló", "Wifi", "Grill"] } as SD, { phase: "mock" }));
    check("„Amit kínálunk”: a feljebb már látott tételek (szöveg vagy fajta) nem ismétlődnek — ha nem marad új, a blokk elmarad", dup === "", dup.slice(0, 200));
    const extra = amenOf(renderSite(r, { ...base, sampleAmenities: ["Parkoló", "Medence"] } as SD, { phase: "mock" }));
    check("„Amit kínálunk”: 1 új tétel (Medence) a kiemelések mellett → nincs külön blokk (tulaj 2026-11-26: csonka minta-szekció)", !/Medence/.test(extra) && !/Parkol/.test(extra), extra.slice(0, 300));
    const four = amenOf(renderSite(r, { ...base, sampleAmenities: ["Parkoló", "Medence", "Szauna", "Kerékpárkölcsönzés", "Jacuzzi"] } as SD, { phase: "mock" }));
    check("„Amit kínálunk”: 4 új tétel → a blokk áll, a látott (Parkoló) kimarad", /Medence/.test(four) && /Szauna/.test(four) && !/Parkol/.test(four), four.slice(0, 300));
  }
  check("cím: a kettétörő szót a lap maga kicsinyíti (data-cit-fit-words, 60 % / 16 px alja)", /data-cit-fit-words/.test(readFileSync(new URL("../src/engine/render.ts", import.meta.url), "utf8")));
  check("gépi kapu: a nyitóképet a kolléga-jelölt szabálya méri (fitsHero = isHeroCandidate), nem írja felül a választását", /!fitsHero\(hv\)/.test(readFileSync(new URL("../src/outreach/mockRenderGate.ts", import.meta.url), "utf8")));
  check("kiemelés: utcacím („Balatonbogláron, a Fiumei utcában”) nem címke, a szolgáltatás marad", isAddressLabel("Balatonbogláron, a Fiumei utcában") && !isAddressLabel("Saját parkoló") && !isAddressLabel("Kilátás a Balatonra") && !isAddressLabel("Közvetlen vízpart"));
  check("nyitókép széles vágásnál a felső harmadra áll (35 %) — mindhárom sablon és a mélységhatás", ["gateOpening.ts", "wordmarkGrow.ts", "parallax.ts"].every((f) => /var\(--cit-hero-fx,50%\) 35%/.test(readFileSync(new URL(`../src/engine/templates/${f}`, import.meta.url), "utf8"))) && /\(0\.35-0\.5\)\*\(1-cy\)/.test(readFileSync(new URL("../src/engine/depthHero.ts", import.meta.url), "utf8")));
  check("kapu-újramérés: a kiküldő ütem a régebbi kapu-verzióval mért várakozó terveket maga méri újra (a jóváhagyó lapról nem esnek ki)", /regateStaleQueue\(gateBudget[,)]/.test(readFileSync(new URL("./outreach-dispatch.mts", import.meta.url), "utf8")) && /cachedRenderGate\(a\?\.inputs, mtime/.test(readFileSync(new URL("../src/generator/mockRefresh.ts", import.meta.url), "utf8")));
  {
    const rs = roomsForMock({ name: "A", photos: [], rooms: [{ name: "Kétszemélyes szoba" }, { name: "Kétszemélyes szoba" }, { name: "Családi" }] } as unknown as SD);
    check("azonos nevű szobák sorszámot kapnak (Anda: 3× „Kétszemélyes szoba”)", rs.map((r) => r.name).join("|") === "Kétszemélyes szoba 1|Kétszemélyes szoba 2|Családi", rs.map((r) => r.name).join("|"));
    const html = renderSite({ template: "parallax", skin: "", archetype: "", sections: [] } as never, { name: "J", intro: "x.", tagline: "x", contact: { phone: "+36 30 111 2222" }, photos: [], highlights: ["Napozóágyak és", "Wifi"] } as unknown as SD, { phase: "mock" });
    check("csonka címke („Napozóágyak és”) a lógó kötőszó nélkül jelenik meg", />Napozóágyak</.test(html) && !/Napozóágyak és/.test(html));
    check("parallax nyitókép-cím árnyékot kap (világos homlokzaton is olvasható kiemelés)", /\.t-hero h1\{[^}]*text-shadow/.test(readFileSync(new URL("../src/engine/templates/parallax.ts", import.meta.url), "utf8")));
    check("generátor-bélyeg qafix5+; a kolléga által átengedett qafix4-es terv aktuális marad (nem esik le a tulaj lapjáról)", /qafix5/.test(readFileSync(new URL("../src/outreach/mockPhotoGate.ts", import.meta.url), "utf8")) && /'2026-11-26-qafix4'\)\s*and a\.inputs->'qaReview'->>'verdict' = 'pass'/.test(readFileSync(new URL("../src/outreach/mockPhotoGate.ts", import.meta.url), "utf8")));
  }
  {
    const base2 = { name: "L", intro: "x.", tagline: "x", contact: { phone: "+36 30 111 2222" }, photos: [], highlights: ["Légkondicionálás", "Wifi", "Grillezési lehetőség"] } as unknown as SD;
    const amenOf2 = (html: string): string => html.match(/<section[^>]*data-cit-module="amenities"[\s\S]*?<\/section>/)?.[0] ?? "";
    const own = amenOf2(renderSite({ template: "parallax", skin: "", archetype: "", sections: [] } as never, { ...base2, amenities: ["Légkondicionálás", "Wifi a közösségi terekben", "Grillezési lehetőség", "Kiságy"] } as SD, { phase: "mock" }));
    check("„Amit kínálunk” a szállás SAJÁT listáján is szűr: 1 új tétel (Kiságy) a kiemelések mellett → nincs külön blokk", !/Kiságy/.test(own) && !/Légkond|Wifi|Grill/.test(own), own.slice(0, 300));
    const own4 = amenOf2(renderSite({ template: "parallax", skin: "", archetype: "", sections: [] } as never, { ...base2, amenities: ["Légkondicionálás", "Wifi a közösségi terekben", "Kiságy", "Szauna", "Jacuzzi", "Kerékpárkölcsönzés"] } as SD, { phase: "mock" }));
    check("„Amit kínálunk” a SAJÁT listán: 4 új tétel → a blokk áll, a látottak kimaradnak", /Kiságy/.test(own4) && /Szauna/.test(own4) && !/Légkond|Wifi/.test(own4), own4.slice(0, 300));
    check("éjszakai kültéri kép (sötét ég) le az oldalról; beltéri sötét plafon nem", isNightShot(K("ok", "a garden with a terrace", { quality: { long: 1600, luma: 80, lap: 300, top: 30 } })) && !isNightShot(K("ok", "a living room", { quality: { long: 1600, luma: 80, lap: 300, top: 30 } })) && !isNightShot(K("ok", "a garden with a terrace", { quality: { long: 1600, luma: 120, lap: 300, top: 140 } })));
    check("szobakártya: ház/kert tartalék nincs (kapu, kerítés, farakás soha) — csak ágy vagy beltéri kanapé", !/placeLabel/.test(readFileSync(new URL("../src/engine/templateKit.ts", import.meta.url), "utf8")) && /\["a living room", "a hotel room interior", "a bedroom with a bed"\]\.includes\(v\.label\)/.test(readFileSync(new URL("../src/generator/photoCurate.ts", import.meta.url), "utf8")));
  }
  check("fotótapéta / pálmás trópusi strand lekerül az oldalról (Vandus)", isOffPagePhoto(K("ok", "a living room", { probs: { "a photo wallpaper mural on a wall": 0.25 } }), false) && isOffPagePhoto(K("ok", "a lake shore", { probs: { "palm trees on a tropical beach": 0.3 } }), true));
  check("két kolléga megosztja a sort: qa-review queue --half 0-7 | 8-f (nincs dupla renderelés)", /--half/.test(readFileSync(new URL("./qa-review.mts", import.meta.url), "utf8")) && /inHalf\(r\.artifactId\)/.test(readFileSync(new URL("./qa-review.mts", import.meta.url), "utf8")));
  check("kolléga-sor: félkész ajánlat elöl (az egyik terve már átment), több kollégánál --shard k/n", /exists \(select 1 from mock_artifact m where m\.lead_id = outreach_dispatch\.lead_id/.test(readFileSync(new URL("./qa-review.mts", import.meta.url), "utf8")) && /--shard/.test(readFileSync(new URL("./qa-review.mts", import.meta.url), "utf8")));
  check("nyitókép csak mozgatható méretű kép (≥ 1000 × 700 px) — jelölt és gépi választás is", !heroSized(K("ok", "the outside of a house", { quality: { long: 960, short: 640, luma: 120, lap: 300 } })) && heroSized(K("ok", "the outside of a house", { quality: { long: 1440, short: 960, luma: 120, lap: 300 } })) && !isHeroCandidate(K("ok", "the outside of a house", { quality: { long: 960, short: 640, luma: 120, lap: 300 } })));
  check("qafix7: az átengedett, de nem mozgó nyitóképű terv is újragenerálódik", /qafix7/.test(readFileSync(new URL("../src/outreach/mockPhotoGate.ts", import.meta.url), "utf8")) && /heroDepthArm' = 'depth'/.test(readFileSync(new URL("../src/outreach/mockPhotoGate.ts", import.meta.url), "utf8")));
  {
    const sr = roomsForMock({ name: "Z", photos: [1, 2, 3, 4, 5].map((n) => ({ url: `https://z.test/${n}.jpg`, alt: "z", provenance: "portal", kindLabel: "the outside of a house" })) } as unknown as SD);
    check("szálláskártya: nincs szoba-kép → beltéri kép, ha az sincs, a szoba-blokk elmarad (nem szöveges kártya)", sr.every((r) => !r.photo) && /rooms\.every\(\(r\) => !r\.photo\)\) return null/.test(readFileSync(new URL("../src/engine/templateKit.ts", import.meta.url), "utf8")));
  }
  check("parallax „Egy pillantásra”: nem ismétli a képes sorokat, fajtánként egy, csak ikonos tétel", /x\.i >= plan\.rows\.length && x\.k !== null && !gridKinds\.has\(x\.k\)/.test(readFileSync(new URL("../src/engine/templates/parallax.ts", import.meta.url), "utf8")));
  check("szabványos tételek: a szolgáltatás a 70-es katalógus tételére képződik, a nem-szolgáltatás sor kimarad (nincs ikon nélküli csempe)",
    catalogueIdFor("Biliárd és darts") === "board_games" && catalogueIdFor("Televízió a szobákban") === "flat_tv" && catalogueIdFor("Jakuzzi") === "jacuzzi" && catalogueIdFor("Kisállattal") === "pet_friendly" && catalogueIdFor("Kúria több épülettel") === null && catalogueIdFor("Csendes kis utcában") === null);
  check("felirat a fotón (tábla, falfelirat) le az oldalról; házszám nem", signWords(["VILLA"]).length === 1 && signWords(["12", "A3"]).length === 0 && /felirat a fotón/.test(readFileSync(new URL("../src/media/photoKind.ts", import.meta.url), "utf8")));
  check("hero-jelöltek számozása stabil (URL szerint, a pintől független)", /urls\.sort\(\);/.test(readFileSync(new URL("./qa-review.mts", import.meta.url), "utf8")));
  {
    const ph3 = (n: number, extra: Partial<PH> = {}): PH => ({ url: `https://k.test/${n}.jpg`, alt: "k", provenance: "portal", ...extra });
    const rs3 = roomsForMock({ name: "K", photos: [ph3(1, { bedroom: true, subject: "interior" }), ph3(2), ph3(3, { bedroom: true, subject: "interior" })], rooms: [{ name: "Kétágyas" }] } as unknown as SD);
    check("megnevezett szoba kártyája nem a nyitókép (Kálvária)", rs3[0]?.photo?.url === ph3(3).url, String(rs3[0]?.photo?.url));
  }
  check("kapcsolat-kép: jármű/ember/állat nem; szobakártya csak ágy/kanapé (konyha, kályha nem), különben a szoba-blokk minden úton elmarad", /outdoor\(p\) && contactFit\(p\)/.test(readFileSync(new URL("../src/engine/templateKit.ts", import.meta.url), "utf8")) && /rs\.every\(\(r\) => !r\.photo\)/.test(readFileSync(new URL("../src/engine/moduleSections.ts", import.meta.url), "utf8")));
  check("parallax-rács: a címben/alcímben felsorolt tétel nem jön vissza csempeként", /firstSentence\(data\.intro\), \.\.\.headings\]\)/.test(readFileSync(new URL("../src/engine/templates/parallax.ts", import.meta.url), "utf8")));
  check("alkalmas nyitókép nélküli sor kikerül a kolléga-sorból (tartva), nem jön vissza ⭐-gal", /nincs mozgatható, alkalmas nyitókép/.test(readFileSync(new URL("./qa-review.mts", import.meta.url), "utf8")));
  check("rács és kiemelés-lista: a szakaszcímekben felsorolt tétel („Kert, terasz, parkoló”) nem jön vissza", /recipe\.sections\.flatMap\(\(s\) => \[s\.copy\?\.title/.test(readFileSync(new URL("../src/engine/templates/parallax.ts", import.meta.url), "utf8")) && /recipe\.sections\.flatMap\(\(s\) => \[s\.copy\?\.title/.test(readFileSync(new URL("../src/engine/templates/gateOpening.ts", import.meta.url), "utf8")));
  {
    const photos = [1, 2, 3, 4, 5, 6].map((n) => ({ url: `https://z.test/${n}.jpg`, alt: "z", provenance: "portal", kindLabel: "the outside of a house", subject: "exterior", bedroom: false }));
    const html = renderSite({ template: "parallax", skin: "", archetype: "", sections: [] } as never, { name: "H", intro: "x.", tagline: "x", contact: { phone: "+36 30 111 2222" }, photos, highlights: [] } as unknown as SD, { phase: "mock" });
    check("5+ saját fotó, nincs hálókép: a szobakártya vízjeles MINTA-illusztrációt kap (tulaj 11-26), a galériában stock nincs", (html.match(/\/assets\/stock\//g) ?? []).length === 1 && /data-cit-module="rooms"/.test(html));
  }
}

// ── ⑤ ONE PREDICATE PER SLOT (2026-11-27): what the generator puts in a slot, the render gate passes there ──
// Blind sample 11-27: Parallax 0/20 — the generator filled the band / opening / contact / hero with photos the gate
// then refused (two rules). Now photoCurate.slotMarks and the gate call the same photoKind functions; this proves it
// on 4 000 seeded random verdicts over the real label set, then through the templates' own slot pickers.
{
  const labels = (LABELS_JSON as { labels: { label: string; kind: string }[] }).labels;
  let seed = 20261127;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pickL = (): string => labels[Math.floor(rnd() * labels.length)]!.label;
  const kinds: PhotoKind["kind"][] = ["ok", "ok", "ok", "ok", "sight", "never", "junk"];
  const randomKind = (): PhotoKind => {
    const probs: Record<string, number> = {};
    const top = pickL();
    probs[top] = 0.3 + rnd() * 0.5;
    for (let j = 0; j < 4; j++) { const l = pickL(); probs[l] = (probs[l] ?? 0) + rnd() * (rnd() < 0.3 ? 0.3 : 0.08); }
    return {
      kind: kinds[Math.floor(rnd() * kinds.length)]!, label: top, score: probs[top]!, sight: rnd() * 0.7, never: rnd() * 0.4, ok: rnd(), probs,
      ...(rnd() < 0.9 ? { quality: { long: 600 + Math.floor(rnd() * 1600), short: 400 + Math.floor(rnd() * 1000), luma: 40 + rnd() * 120, lap: 20 + rnd() * 400, top: 20 + rnd() * 150 } } : {}),
    } as PhotoKind;
  };
  const car: DetectedObject[] = [{ label: "car", score: 0.8, x: 0.1, y: 0.5, w: 0.3, h: 0.2 }];
  let bad = 0;
  let filled = { opening: 0, band: 0, contact: 0, hero: 0 };
  const sample: PhotoKind[] = [];
  for (let n = 0; n < 4000; n++) {
    const v = randomKind();
    sample.push(v);
    const m = slotMarks(v, rnd() < 0.15 ? car : null);
    if (m.okOpening && !fitsOpening(v)) bad++;
    if (m.okBand && !fitsBand(v)) bad++;
    if (m.okContact && !fitsContact(v)) bad++;
    if (isHeroWorthy(v) && !fitsHero(v)) bad++;
    filled = { opening: filled.opening + +m.okOpening, band: filled.band + +m.okBand, contact: filled.contact + +m.okContact, hero: filled.hero + +isHeroWorthy(v) };
  }
  check(`slot-predikátum: 4000 véletlen ítéletből a generátor jelzője sosem enged, amit a kapu tilt (nyitás ${filled.opening}, sáv ${filled.band}, kapcsolat ${filled.contact}, gépi hős ${filled.hero})`,
    bad === 0 && filled.opening > 0 && filled.band > 0 && filled.contact > 0 && filled.hero > 0);
  const none = slotMarks(null, null);
  check("friss mock a generátor bélyegét viseli (a bélyeg-emelés egymagában frissíti a régebbi kóddal készült állományt)",
    /terhatasAt: MOCK_HEROFIX_STAMP,/.test(src("src/generator/generateEngine.ts")) && /\(coalesce\(a\.inputs->>'terhatasAt', ''\) >= \$\{MOCK_HEROFIX_STAMP\}\s*or \(\(a\.generated_at >= \$\{MOCK_HEROFIX_LIVE_AT\}/.test(src("src/outreach/mockPhotoGate.ts")));
  check("slot-predikátum: ítélet nélküli kép egyik slotra sem alkalmas (generátor és kapu)", !none.okOpening && !none.okBand && !none.okContact && !fitsOpening(null) && !fitsBand(null) && !fitsContact(null) && !fitsHero(null));
  check("sáv: egy luma-küszöb (a 70/85 kettősség megszűnt)", !/BAND_GOOD_LUMA/.test(kindSrc) && /export const BAND_MIN_LUMA = 85;/.test(kindSrc));
  // Through the templates' own slot pickers: random photo sets, marked by slotMarks, each filled slot re-judged by the gate's rule.
  const byUrl = new Map<string, PhotoKind>();
  let slotBad = 0;
  let slotsFilled = 0;
  for (let t = 0; t < 300; t++) {
    const photos: PH[] = [];
    for (let j = 0; j < 3 + Math.floor(rnd() * 9); j++) {
      const v = sample[Math.floor(rnd() * sample.length)]!;
      const url = `https://slot.test/${t}-${j}.jpg`;
      byUrl.set(url, v);
      const m = slotMarks(v, null);
      photos.push({ url, alt: "x", provenance: "portal", okOpening: m.okOpening, okBand: m.okBand, okContact: m.okContact, ...(m.notCard ? { notCard: true } : {}), ...(bandScore(v) ? { bandScore: bandScore(v) } : {}), kindLabel: v.label, ...(rnd() < 0.5 ? { subject: rnd() < 0.5 ? "exterior" : "interior" } : {}) } as PH);
    }
    const d = { name: "S", intro: "x.", tagline: "x", contact: {}, photos, highlights: ["Kert", "Parkoló"] } as unknown as SD;
    const plan = allotPhotos(d, { minGallery: 3, maxGallery: 6, maxRows: 2 });
    const judge = (p: PH | undefined | null, ok: (v: PhotoKind | null) => boolean): void => {
      if (!p) return;
      slotsFilled++;
      if (!ok(byUrl.get(p.url) ?? null)) slotBad++;
    };
    judge(plan.bandA, fitsBand);
    judge(plan.bandB, fitsBand);
    judge(plan.contact, fitsContact);
    judge(gatePhotoOf(photos), fitsOpening);
    const cp = contactPhotoOf(d, photos.at(-1));
    judge(cp ? photos.find((p) => p.url === cp.url) : undefined, fitsContact);
  }
  check(`slot-töltés: 300 véletlen lap sávja, kapcsolat-képe és kapuszárnya mind átmegy a kapu slot-szabályán (${slotsFilled} töltött slot)`, slotBad === 0 && slotsFilled > 100);
  check("slot-töltés: alkalmas kép nélkül a slot elmarad (nem tölt rosszal)",
    (() => { const p = [1, 2, 3, 4].map((n) => ({ url: `https://e.test/${n}.jpg`, alt: "e", provenance: "portal", okOpening: false, okBand: false, okContact: false, subject: "exterior" }) as PH); const d = { name: "E", photos: p, highlights: [] } as unknown as SD; const a = allotPhotos(d, { minGallery: 3, maxGallery: 6, maxRows: 0 }); return !a.bandA && !a.bandB && !a.contact && gatePhotoOf(p) === null && contactPhotoOf(d, p[3]) === null; })());
  check("slot-jelző: kurált kép hiányzó jelzője = nem alkalmas; kuráláson át nem ment kép (tulaj-feltöltés) a régi negatív jelzőkkel",
    !fitsSlot({ url: "u", alt: "", provenance: "owner", okOpening: true } as PH, "band") && fitsSlot({ url: "u", alt: "", provenance: "owner" } as PH, "band") && !fitsSlot({ url: "u", alt: "", provenance: "owner", backstage: true } as PH, "opening"));
  // The wiring: the gate judges each slot with exactly these functions, every template asks fitsSlot.
  const gateSrc2 = src("src/outreach/mockRenderGate.ts");
  check("bekötés: a kapu slotonként a photoKind predikátumával ítél (fitsHero / fitsOpening / fitsBand / fitsContact)",
    /!fitsHero\(hv\)/.test(gateSrc2) && /!fitsOpening\(v\)/.test(gateSrc2) && /bands\.has\(u\) && !fitsBand\(v\)/.test(gateSrc2) && /contacts\.has\(u\) && !fitsContact\(v\)/.test(gateSrc2) && !/isShowcase|bandScore\(/.test(gateSrc2));
  const curSrc = src("src/generator/photoCurate.ts");
  check("bekötés: a generátor jelzői ugyanabból a függvényből (slotMarks: fitsOpening / fitsBand / fitsContact), a kolléga-pin csak fitsHero mellett",
    /okOpening: fitsOpening\(v\)/.test(curSrc) && /okBand: fitsBand\(v\)/.test(curSrc) && /okContact: fitsContact\(v\)/.test(curSrc) && /fitsHero\(heroKinds\[pinnedAt\]/.test(curSrc) && !/notBand: true|backstage: true/.test(curSrc));
  const engineFiles = ["src/engine/templateKit.ts", ...["gateOpening", "wordmarkGrow", "parallax", "dopamine", "fullbleed", "darkLuxury"].map((f) => `src/engine/templates/${f}.ts`)];
  const stray = engineFiles.filter((f) => {
    const t = src(f);
    const body = f.endsWith("templateKit.ts") ? t.replace(/export function fitsSlot[\s\S]*?\n}\n/, "") : t;
    return /\.backstage\b|\.notBand\b|\.okOpening\b|\.okBand\b|\.okContact\b/.test(body);
  });
  check(`bekötés: sablon a slot-jelzőt csak fitsSlot-on át olvassa${stray.length ? ` (közvetlen olvasás: ${stray.join(", ")})` : ""}`, stray.length === 0);
}

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — kolléga-jóváhagyás vagy engedélylistás képszűrő nélkül menne ki levél.`);
  process.exit(1);
}
console.log("✅ qa-review-check: minőségi kolléga és tulaj-jóváhagyás nélkül nincs levél, a képszűrő engedélylistás.");
