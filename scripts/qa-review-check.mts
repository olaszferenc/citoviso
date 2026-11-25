// gate-runner: land-blocking — kiküldési minőség (tulaj 2026-11-25: minőségi kolléga + tulaj-jóváhagyás minden levél előtt + engedélylistás képszűrő)
//
// ① No letter leaves without the quality colleague's pass on THIS mock file (src/outreach/mockQaReview.ts):
//    the dispatcher's claim, its per-row check and the shared send path all ask for it; only the
//    owner's sample letter (`sampleTo`) is exempt. ② The photo filter is an ALLOW-list
//    (src/media/photoKind.ts): a picture that is not surely the lodging, or too small / dark / blurred,
//    is "junk" and stays off the page, out of the hero and out of the opening. Hermetic: no DB, no model.
import { readFileSync } from "node:fs";
import { isHeroWorthy, isOffPagePhoto, isShowcase, PHOTO_OK_MIN, type PhotoKind } from "../src/media/photoKind.js";
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
check("a jóváhagyó lap csak a teljes kört mutatja (kapu + kolléga + 5 saját kép + új generátor)",
  /qaReviewState\(r\.main_id\)/.test(aq) && /cachedRenderGate\(/.test(aq) && /LEAD_OWN_PHOTOS_SQL/.test(aq) && /MOCK_CURRENT_GENERATOR_SQL/.test(aq));
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

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — kolléga-jóváhagyás vagy engedélylistás képszűrő nélkül menne ki levél.`);
  process.exit(1);
}
console.log("✅ qa-review-check: minőségi kolléga és tulaj-jóváhagyás nélkül nincs levél, a képszűrő engedélylistás.");
