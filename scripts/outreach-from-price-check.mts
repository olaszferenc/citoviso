// outreach-from-price-check (owner, 2026-10-12: „legyen dinamikus”): the cold letter's
// „…-tól” price IS the cheapest package card the configurator shows the same lead — under
// the seed AND under an edited /pricing (base, add-on prices, composition, a module taken
// off sale) — and with no valid package the §C gate stops the letter instead of printing
// an old number.
//
// Measured (Elek 10-11, A3): the letter read „3 900 → 2 925 Ft/hó-tól” (the bare base
// subscription, modules.ts constant), the cheapest card 4 880 → 3 660 Ft. On that code
// this guard is RED on case ① already.
//
// The expected price is computed INDEPENDENTLY of src/packageOffer.ts: from the manifest
// the configurator ships to the browser, with the client's own card formula
// (cit-configurator.js presetMonthly: base + Σ price of the preset's offered modules,
// minus a superseded one). The letter side is the real buildDraftForProspect → the real
// HTML mail (price box) and the real §C gate.
//
// Process-local and read-only: the dev DB is shared, so the pricing state and the
// module-sales switch are PINNED in this process (overridePricingStateInProcess,
// overrideDisabledModulesInProcess); the draft is built with reserveLabel:false (no
// preview label is written). ~3 s.
//
// Run: npx tsx scripts/outreach-from-price-check.mts

process.env.CIT_SHOT = "1"; // no AI calls

const pricing = await import("../src/pricing.js");
const { overrideDisabledModulesInProcess, getDisabledModules } = await import("../src/moduleSales.js");
const { buildManifest } = await import("../src/generator/configurator.js");
const { buildDraftForProspect } = await import("../src/outreach/draft.js");
const { checkOutreachDraft } = await import("../src/outreach/outreachCheck.js");
const { buildOutreachEmail } = await import("../src/email/outreachEmail.js");
const { applyOffer } = await import("../src/payment/offers.js");
const { seedAssignment } = await import("../src/packages.js");
const { db } = await import("../src/db/client.js");

let failures = 0;
function check(label: string, cond: boolean, detail = ""): void {
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${detail && !cond ? `\n     ↳ ${detail}` : ""}`);
  if (!cond) failures++;
}
const grp = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** Any space flavour (regular, no-break, narrow, &nbsp;) → one regular space. */
const sp = (s: string): string => s.replace(/&nbsp;|&#160;|[\s\u00a0\u202f]+/g, " ");
const digits = (s: string): string => s.replace(/\D/g, "");

// A real prospect of the shared park (read only).
// gate-subject-allow: bármelyik prospect megfelel — az ár leadtől független, a levél és a manifest UGYANAZT a leadet kapja, a %-ot a levélből olvassuk; hiányában hangos bukás
const row = await db
  .selectFrom("prospect")
  .innerJoin("lead", "lead.id", "prospect.lead_id")
  .select(["prospect.id as id", "lead.name as name"])
  .orderBy("prospect.created_at", "desc")
  .limit(1)
  .executeTakeFirst();
if (!row) {
  console.error("✗ FAIL  nincs prospect a dev DB-ben — az őr nem tud mit mérni");
  process.exit(1);
}

type Manifest = Awaited<ReturnType<typeof buildManifest>>;
/** The client's card formula, over what the browser receives. */
function cardPrices(m: Manifest): { id: string; monthly: number }[] {
  return m.presets.map((p) => {
    const set = new Set(p.modules);
    const superseded = (id: string): boolean =>
      m.modules.some((x) => (x.supersedes ?? []).includes(id) && (set.has(x.id) || (x.spine && x.present)));
    let t = m.pricing.base;
    for (const x of m.modules) if (set.has(x.id) && !superseded(x.id)) t += x.price;
    return { id: p.id, monthly: t };
  });
}

async function measure(tag: string): Promise<void> {
  const manifest = await buildManifest("<html><body></body></html>", "fromprice-check", row!.name);
  const cards = cardPrices(manifest);
  const cheapest = Math.min(...cards.map((c) => c.monthly));
  const d = await buildDraftForProspect(row!.id, { reserveLabel: false });
  if (!d) {
    check(`${tag}: a levél elkészül`, false, "buildDraftForProspect → null");
    return;
  }
  const percent = Number(d.draft.parts.percent);
  const offer = applyOffer(cheapest, { percent });
  const where = cards.map((c) => `${c.id} ${c.monthly}`).join(" · ");
  check(
    `${tag}: a levél listaára = a legolcsóbb kártya (${cheapest})`,
    digits(d.draft.parts.priceList) === String(cheapest),
    `levél: ${d.draft.parts.priceList} · kártyák: ${where}`,
  );
  check(
    `${tag}: a levél „-tól” ára = a legolcsóbb kártya −${percent}% (${offer})`,
    digits(d.draft.parts.priceOffer) === String(offer),
    `levél: ${d.draft.parts.priceOffer}`,
  );
  check(
    `${tag}: a szöveges levél ezt az árpárt írja`,
    sp(d.draft.body).includes(`${grp(cheapest)} forint helyett ${grp(offer)} forinttól`),
    d.draft.parts.p3,
  );
  const html = buildOutreachEmail(d.draft, "from-price-or@example.invalid", { lang: d.lang }).html ?? "";
  check(`${tag}: a HTML ár-doboz „${grp(offer)} Ft/hó-tól”`, sp(html).includes(`${grp(offer)} Ft/hó-tól`));
}

const seed = seedAssignment();
const realDisabled = [...(await getDisabledModules())];
const hu = pricing.pricingSnapshot("hu");

// ① the shared /pricing state as it is (read once, then frozen in-process)
await pricing.loadPricing(true);
pricing.overridePricingStateInProcess({});
overrideDisabledModulesInProcess(realDisabled);
await measure("① a mostani /pricing");

// ② edited prices: base and the Alap tier's add-ons change → the letter follows
pricing.overridePricingStateInProcess({
  baseMonthly: 5100,
  modulePrices: new Map([
    ["gallery", 700],
    ["rooms", 1300],
    ["pricing", 450],
  ]),
});
await measure("② módosított alapdíj + modulárak");

// ③ edited composition: everything priced moves up from the Alap (only the spine stays)
const lean = new Map(seed);
for (const [id, t] of lean) if (t === "alap" && id !== "enquiry") lean.set(id, "ajanlott");
pricing.overridePricingStateInProcess({ assignment: lean });
await measure("③ módosított összetétel (az Alap kiürítve a gerincig)");

// ④ a module of the Alap taken off sale → the card drops it, so must the letter
pricing.overridePricingStateInProcess({ assignment: seed });
overrideDisabledModulesInProcess([...realDisabled, "gallery"]);
await measure("④ egy Alap-modul nem eladó");

// ⑤ no valid package (every tier prices to 0) → no number, the §C gate stops the letter
overrideDisabledModulesInProcess(realDisabled);
pricing.overridePricingStateInProcess({
  baseMonthly: 0,
  modulePrices: new Map([...hu.modulePrices.keys()].map((id) => [id, 0] as [string, number])),
});
{
  const d = await buildDraftForProspect(row.id, { reserveLabel: false });
  check("⑤ nincs érvényes csomag: a levél nem ír számot árként", !!d && !/\d/.test(d.draft.parts.priceList + d.draft.parts.priceOffer), d?.draft.parts.priceList);
  const v = d ? checkOutreachDraft(d.draft, d.input.leadName, d.lang, d.market) : null;
  check(
    "⑤ nincs érvényes csomag: a §C-kapu megállítja (ÁR-HIRDETÉS ok)",
    !!v && v.verdict === "FLAG" && v.reasons.some((r) => r.includes("nincs érvényes kínált csomag")),
    JSON.stringify(v?.reasons),
  );
}

pricing.overridePricingStateInProcess(null);
overrideDisabledModulesInProcess(null);
await db.destroy();
console.log(failures ? `\n✗ ${failures} hiba` : "\n✓ minden eset zöld");
process.exit(failures ? 1 : 0);
