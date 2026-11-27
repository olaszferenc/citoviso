// gate-runner: land-blocking — kiküldési minőség: a lánc-utánpótlás szabályai (ADR-0500, tulaj „Mehet” 2026-11-27)
// gate-scope: no-docs — kód-kapu: a kód-zárlata nem olvas MEMORY.md-t és _planning/-t (gate-scope-check méri)
//
// The chain feeds itself (src/generator/chainSupply.ts): ① the old-generator stock is regenerated from its own words,
// ③ a ready mock without a row is queued, ⑤ a failed plan re-tries by itself (photos → template → hold, counted).
// Hermetic: the pure rules are run, the wiring is read from the files. No DB, no browser.
import { readFileSync } from "node:fs";
import { chainSupplyEnabled, curatedFieldsOf, GATE_RETRY_LEAD_MAX, GATE_RETRY_PHOTO_MAX, retryPlanFor, SECOND_PLAN_TEMPLATES } from "../src/generator/chainSupply.js";
import { memoryHasRoom, regateConcurrency, REGATE_MIN_FREE_MB } from "../src/generator/mockRefresh.js";
import type { RenderFinding } from "../src/outreach/mockRenderGate.js";
import { renderSkinVars, SKINS } from "../src/engine/skins.js";
import { headingKey, withUniqueSectionHeadings } from "../src/engine/render.js";
import { bandCaption } from "../src/engine/templates/parallax.js";
import { isRoomHero, withBestHeroFirst } from "../src/media/photoKind.js";
import { heroScreenStats, HERO_SCREEN_DARK, HERO_SCREEN_DIM } from "../src/outreach/mockRenderGate.js";
import { contrastRatio, parseHex, TEXT_MIN_CONTRAST } from "../src/engine/palette.js";

let failed = 0;
function check(label: string, ok: boolean): void {
  console.log(`${ok ? "✓" : "✗"}  ${label}`);
  if (!ok) failed++;
}
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const f = (code: RenderFinding["code"], url?: string): RenderFinding => ({ code, detail: `${code} lelet`, ...(url ? { url } : {}) });
const fail = (...findings: RenderFinding[]) => ({ verdict: "fail" as const, findings });
const fresh = { planPhoto: 0, lead: 0, templateLeft: true };

// ⑤ the retry ladder, driven by the finding codes
{
  const r = retryPlanFor(fail(f("repeat", "https://x.hu/a.jpg"), f("subject", "https://x.hu/b.jpg")), fresh);
  check("képlelet (ismétlés / nem szálláskép) → ugyanaz a terv más képkiosztással, a megnevezett képek nélkül", r.step === "photos" && r.step === "photos" && r.exclude.length === 2);
  check("második képes bukás után (a terv képes próbái elfogytak) → a másik sablon", retryPlanFor(fail(f("stock", "https://x.hu/c.jpg")), { ...fresh, planPhoto: GATE_RETRY_PHOTO_MAX }).step === "template");
  check("oldal-lelet (kilógó szöveg / üres sáv / üres nyitókép) → nem képcsere, hanem a másik sablon", retryPlanFor(fail(f("overflow"), f("subject", "https://x.hu/d.jpg")), fresh).step === "template" && retryPlanFor(fail(f("gap")), fresh).step === "template");
  check("nincs több sablon → tartva a lelettel", retryPlanFor(fail(f("thin")), { ...fresh, templateLeft: false }).step === "hold");
  check("leadenkénti próbakorlát → tartva (nem pörög)", retryPlanFor(fail(f("repeat", "https://x.hu/a.jpg")), { ...fresh, lead: GATE_RETRY_LEAD_MAX }).step === "hold");
  check("renderelési hiba (a böngésző dőlt el) → nem újrapróba, a kapu méri újra", retryPlanFor(fail(f("render")), fresh).step === "hold");
  check("településkép-nyitókép bukása is képlelet (subject + URL) → képcsere: a galéria következő képe nyit", retryPlanFor(fail(f("subject", "https://upload.wikimedia.org/x.jpg")), fresh).step === "photos" && /sd\.townPhoto = next/.test(read("../src/generator/chainSupply.ts")));
  check("képlelet URL nélkül → nem képcsere (nincs mit kivenni), a másik sablon", retryPlanFor(fail(f("broken")), fresh).step === "template");
  check("átment terv → semmi", retryPlanFor({ verdict: "pass", findings: [] }, fresh).step === "hold");
}
// the render gate names the picture of every photo finding (the retry leaves it out)
{
  const gate = read("../src/outreach/mockRenderGate.ts");
  const pushes = gate.split("\n").filter((l) => /findings\.push\(\{ code: "(subject|stock|broken)"/.test(l) && /fileOf\(/.test(l));
  check(`a render-kapu minden kép-lelete (subject / stock / broken, ${pushes.length} hely) megnevezi a kép URL-jét`, pushes.length >= 10 && pushes.every((l) => /url: /.test(l)));
  const mjs = gate.slice(gate.indexOf("const MEASURE_JS = `"), gate.indexOf("})()`;", gate.indexOf("const MEASURE_JS = `")));
  check("a kapu oldalon futó szkriptjében nincs egyszeres \\s / \\d (a template-literál elnyeli: /s+/g minden „s” betűt kivett a mért címekből)", mjs.length > 1000 && !/[^\\]\\[sd]/.test(mjs));
  check("az ismétlés-lelet is megnevezi a képet", /ugyanaz a kép \$\{places\.length\} helyen[\s\S]{0,200}url: places\[0\]!\.u/.test(gate));
}
// ① the words of a plan, never a writer call
{
  check("a terv szövege a copyManual-ból jön (kurátori csomag, író-hívás nélkül)", JSON.stringify(curatedFieldsOf({ copyManual: { tagline: { value: "Csend" }, intro: { value: "Szia" } } })) === JSON.stringify({ tagline: "Csend", intro: "Szia" }) && curatedFieldsOf({}) === null);
  const src = read("../src/generator/chainSupply.ts");
  check("az átvitel csak bájtra azonos copyHash mellett történik", /oh !== nh\) return \{ review: false, approved: false/.test(src));
  check("a régi terv nem törlődik, csak fölérendelt (superseded_by)", /superseded_by:/.test(src) && !/deleteFrom\("mock_artifact"\)/.test(src));
  check("③ csak jóváhagyott + Vera-PASS-os mock kap sort, és az enqueueDispatch kizárásain át", /a\.status", "=", "approved"/.test(src) && /reviewStateOf\(r\.inputs\) !== "pass"/.test(src) && /enqueueDispatch\(/.test(src));
  check("③ a saját-honlap kapu áll (VAN_HONLAP / GYANUS nem kap sort)", /ownSiteCheck'->>'verdict', ''\) = 'NINCS'/.test(src));
  check("automata jóváhagyás nincs: a sor a tulaj lapjára vár (held + gépi kapura vár)", !/status: "queued"/.test(src));
}
// switch + pace
{
  check("CHAIN_SUPPLY=off leállítja", !chainSupplyEnabled({ CHAIN_SUPPLY: "off" }) && chainSupplyEnabled({}));
  check("a párhuzamosság kevés szabad memórián 1", regateConcurrency({}, { freeMb: 100, availMb: REGATE_MIN_FREE_MB - 1 }) === 1);
  check("a párhuzamosság a szabad memóriához igazodik (egy mérés ~350 MB)", regateConcurrency({ RENDER_GATE_CONCURRENCY: "8" }, { freeMb: 0, availMb: REGATE_MIN_FREE_MB + 400 }) === 2);
  check("a párhuzamosság szabad gépen az alapérték (2), a beállítás felülírja", regateConcurrency({}, { freeMb: 4000, availMb: 4000 }) === 2 && regateConcurrency({ RENDER_GATE_CONCURRENCY: "3" }, { freeMb: 4000, availMb: 4000 }) === 3);
  check("a nehéz lépés (generálás) kevés memórián kimarad", !memoryHasRoom({ freeMb: 0, availMb: REGATE_MIN_FREE_MB - 1 }) && memoryHasRoom({ freeMb: 0, availMb: REGATE_MIN_FREE_MB }));
  const mr = read("../src/generator/mockRefresh.ts");
  check("⑧ félkész ajánlat elöl, az országok felváltásán belül (FAIR_ORDER: országon belül a lapon volt / félkész (bármely kapu-verzió), a mai passz, aztán a kor)", /partition by \$\{LEAD_COUNTRY_SQL\} order by \$\{OFFER_PROGRESS_SQL\} desc, \$\{sql`\(select \$\{HALF_DONE_SQL\}\)`\} desc, d\.queued_at/.test(mr) && /renderGate'->>'verdict' = 'pass' and \(hm\.inputs->'renderGate'->>'version'\)::int = \$\{RENDER_GATE_VERSION\}/.test(mr));
  check("⑧ a frissítés és a kapu nem tesz globális kulcsot a FAIR_ORDER elé (az országok felváltva maradnak)", !/qaReview'->>'verdict' = 'pass'\) desc`\)\s*\n?\s*\.orderBy\(FAIR_ORDER\)/.test(mr) && !/m\.inputs->'qaReview'->>'verdict' = 'pass'\) desc/.test(mr));
  check("a kapu-újramérésnek kemény határideje van (keret + türelem után a böngésző zár, a lépés visszatér) és a kiküldő tick folyamata a parancs végén kilép (a 600 s-os systemd-kilövés ellen, 11-27)",
    /REGATE_GRACE_MS/.test(mr) && /Promise\.race\(\[/.test(mr) && /cut = true/.test(mr) && /process\.exit\(process\.exitCode \?\? 0\)/.test(read("./outreach-dispatch.mts")));
  check("⑧ a lánc-utánpótlás lépései is a FAIR_ORDER-t használják", (read("../src/generator/chainSupply.ts").match(/orderBy\(FAIR_ORDER\)/g) ?? []).length >= 2);
  check("a regate közös böngészőt ad a kapunak (nem mérésenként indít)", /renderGateFor\(id, \{ browser: await sharedBrowser\(\) \}\)/.test(read("../src/generator/mockRefresh.ts")));
}
// ⑦ text on a band ≥ 4.5:1 — generator (band tokens from the page's own tokens) and render gate (measured)
{
  const all = Object.values(SKINS);
  let worst = 99;
  for (const sk of all) for (const ac of [undefined, "#6d8fc0", "#966241", "#e8d36a"]) {
    const v = renderSkinVars(sk, ac);
    const g = (k: string) => new RegExp(`${k}: (#[0-9a-f]{6})`).exec(v)?.[1];
    const band = g("--cit-band");
    if (!band) continue;
    for (const k of ["--cit-on-band", "--cit-on-band-soft", "--cit-accent-on-band"]) worst = Math.min(worst, contrastRatio(parseHex(g(k)!)!, parseHex(band)!));
    worst = Math.min(worst, contrastRatio(parseHex(g("--cit-on-accent")!)!, parseHex(g("--cit-accent")!)!));
    worst = Math.min(worst, contrastRatio(parseHex(g("--cit-accent-text")!)!, parseHex(g("--cit-bg")!)!));
  }
  check(`a sáv minden szövege (alap, halk, akcent), a gomb szövege az akcenten és az akcent-címke a lapon ≥ 4.5:1 minden skinen és akcenttel (legrosszabb ${worst.toFixed(2)}, ${all.length} skin)`, worst >= TEXT_MIN_CONTRAST);
  check("a szín igazodik, nem cserélődik fixre (éjkék-arany: a sötét sáv-szöveg árnyalatos, nem fekete)", (() => { const v = renderSkinVars(SKINS["night-azure-gold"]!, "#966241"); const c = /--cit-accent-on-band: (#[0-9a-f]{6})/.exec(v)?.[1]; return !!c && c !== "#000000" && c !== "#ffffff"; })());
  const px = read("../src/engine/templates/parallax.ts");
  check("a Parallax sávjai (alsó ragadós sáv, dokk, menüsáv, vélemények, lábléc) a sáv-tokenekkel festenek", /\.t-mobcta span\{color:var\(--cit-on-band\)/.test(px) && /\.t-mobcta b\{color:var\(--cit-accent-on-band\)/.test(px) && /\.t-foot\{background:var\(--cit-band\);color:var\(--cit-on-band-soft\)/.test(px) && !/var\(--cit-bg\) 92%, #fff\)/.test(px));
  check("a Névből növő gombja nem örökli a tintát (az `a{color:inherit}` a .cit-btn-t kihagyja)", /a:where\(:not\(\.cit-btn\)\)\{color:inherit\}/.test(read("../src/engine/templates/wordmarkGrow.ts")) && !/\na\{color:inherit\}/.test(read("../src/engine/templates/wordmarkGrow.ts")));
  check("a „Minta” címke a mért akcent-szöveg tokennel fest", /\.cit-modsec__minta\{[^}]*color:var\(--cit-accent-text/.test(read("../src/engine/moduleSections.ts")));
  const gate = read("../src/outreach/mockRenderGate.ts");
  check("a kapu a hős alatt megjelenő sávot is méri (lapközépi pillanat)", /const midway = \(await page\.evaluate\(MEASURE_JS\)\)/.test(gate));
  check("a render-kapu méri a kontrasztot (ragadós sáv + h1/h2/gomb, a festett háttérhez) → „contrast” kód, a kapu verziója 16+", /code: "contrast"/.test(gate) && /p === "fixed" \|\| p === "sticky"/.test(gate) && Number(/RENDER_GATE_VERSION = (\d+)/.exec(gate)?.[1]) >= 16);
  check("kontraszt-bukás nem képcsere, hanem a másik sablon (oldal-lelet)", retryPlanFor(fail(f("contrast")), fresh).step === "template");
}
// ⑨ two sections never carry one heading — generator (final page, every template) and render gate
{
  const page = `<section><h2 data-cit-copy="features.title">Ami nálunk vár</h2></section><section><p class="t-eyebrow">Kiemelt</p>\n<h2>Ami nálunk vár</h2></section><section><h2>Ami  nálunk VÁR!</h2></section><h2>Árak</h2>`;
  const out = withUniqueSectionHeadings(page);
  check("a későbbi azonos szakaszcím a szakasz saját felcímét kapja (Anikó: „Ami nálunk vár” → „Kiemelt”), a felcím nem áll kétszer", /<h2>Kiemelt<\/h2>/.test(out) && !/t-eyebrow">Kiemelt/.test(out) && (out.match(/Ami nálunk vár/gi) ?? []).length === 1 && /<h2>Árak<\/h2>/.test(out));
  check("normalizált egyezés (kis/nagybetű, írásjel, szóköz)", headingKey("Ami  nálunk VÁR!") === headingKey("Ami nálunk vár"));
  check("a generátor a közös befejező lépésben futtatja (minden sablon)", /const noted = withUniqueSectionHeadings\(withLongWordBreak\(/.test(read("../src/engine/render.ts")));
  check("a kapu két azonos h2-t ismétlésnek vesz, modultól függetlenül", /két szakasz ugyanazzal a címmel/.test(read("../src/outreach/mockRenderGate.ts")) && /tag: el\.classList\.contains\("t-quote"\) \? "caption" : el\.tagName\.toLowerCase\(\)/.test(read("../src/outreach/mockRenderGate.ts")));
}
// ⑭ no e-mail → no chain (owner 2026-11-20; coordinator 11-27)
{
  const mr = read("../src/generator/mockRefresh.ts");
  const cs = read("../src/generator/chainSupply.ts");
  const aq = read("../src/console/approvalQueue.ts");
  check("⑭ a frissítés, a kapu és az újratervezés minden lánc-lekérdezése e-mailes leadre szűr", (mr.match(/\.where\(CHAIN_ROWS\)\n\s*\.where\(LEAD_HAS_EMAIL_SQL\)/g) ?? []).length >= 4 && /\.where\(LEAD_HAS_EMAIL_SQL\)/.test(mr.slice(mr.indexOf("export async function replanUnfitQueue"))));
  check("⑭ a lánc-utánpótlás (újragenerálás, újrapróba) e-mailes leadre szűr", (cs.match(/\.where\(WAITING_SQL\)\n\s*\.where\(LEAD_HAS_EMAIL_SQL\)/g) ?? []).length >= 2);
  check("⑭ a jóváhagyó lap csak e-mailes leadet listáz, és a csatornája mindig e-mail", /and \$\{LEAD_HAS_EMAIL_SQL\}/.test(aq) && !/expectedChannel\(presence/.test(aq));
  check("⑭ a söprő lépés: e-mail nélkül → TARTVA, e-maillel → vissza a láncba; mindkét időzítő futtatja", /export async function syncNoEmailHolds/.test(mr) && /syncNoEmailHolds\(\)/.test(read("./outreach-dispatch.mts")) && /syncNoEmailHolds\(\)/.test(read("./chain-supply.mts")));
}
// ⑩–⑬ (coordinator 11-27, the owner's „fill, never drop” principle)
{
  const pt = read("../src/media/photoText.ts");
  check("⑩ dátumbélyeg: a sarkokon második OCR-menet nagyítva, sárgaság-csatornán (R−B), a részleges alak (évszám + elválasztó) csak ott számít", /async function readCornerStamp/.test(pt) && /Math\.min\(img\.data\[i\]!, img\.data\[i \+ 1\]!\) - img\.data\[i \+ 2\]!/.test(pt) && /PARTIAL_DATE_RE\.exec\(text\)/.test(pt) && !/PARTIAL_DATE_RE\.exec\(all\)/.test(pt));
  check("⑪ a sáv felirata mondat (≥ 4 szó), szakaszcímet nem ismétel; nincs mondat → felirat nélkül", bandCaption("Galerija", []) === "" && bandCaption("Fotók a házról", ["Fotók a házról"]) === "" && bandCaption("Csendes reggelek a tó partján, a kertben", ["Galéria"]) !== "" && bandCaption("Vendégek véleménye rólunk itt", ["Vendégek véleménye rólunk itt"]) === "");
  const room = { kind: "ok", label: "a bedroom with a bed", probs: { "a bedroom with a bed": 0.77 }, quality: { long: 1600, short: 1200, luma: 120, lap: 900 } } as never;
  const lake = { kind: "ok", label: "a lake shore", probs: { "a lake shore": 0.6 }, quality: { long: 1600, short: 1200, luma: 120, lap: 900 } } as never;
  check("⑫ szoba csak akkor nyit, ha nincs kültéri / kilátásos jelölt (elsőbbség, nem tiltás)", isRoomHero(room) && !isRoomHero(lake) && withBestHeroFirst(["szoba", "to"], [room, lake])[0] === "to" && withBestHeroFirst(["szoba"], [room])[0] === "szoba");
  const dark = Buffer.alloc(390 * 506, 40);
  const bright = Buffer.alloc(390 * 506, 140);
  check("⑫ a telefonos első képernyő képsávja mérve: sötét → bukás, világos → átmegy", heroScreenStats(dark, 390, 506).midMean < HERO_SCREEN_DARK && heroScreenStats(bright, 390, 506).midMean > HERO_SCREEN_DIM && /a nyitóképernyő telefonon sötét \/ fakó/.test(read("../src/outreach/mockRenderGate.ts")));
  const ms = read("../src/engine/moduleSections.ts");
  check("⑬ a felszereltség-modul mindig feltöltve (forrás → standard tételek, MINTA), üres keret és elhagyás nincs", /function withStandardFill/.test(ms) && !/szándékosan nincs kitalált szolgáltatás/.test(ms) && !/items\.length < SAMPLE_AMENITY_MIN && \(d\.highlights/.test(ms));
  check("⑬ a Parallax-rács és a modul ugyanabból a standard készletből tölt", /GRID_FILL = STANDARD_FACILITY_FILL/.test(read("../src/engine/templates/parallax.ts")) && /STANDARD_FACILITY_FILL/.test(ms));
}
// ⑰ the Parallax is always one of the two plans (owner 11-27, „Parallax ok”)
{
  const cs = read("../src/generator/chainSupply.ts");
  check("⑰ a Parallax terv újrapróbája csak képkiosztás: oldal-lelet vagy elfogyott képpróba → tartás, sablonváltás soha", retryPlanFor(fail(f("overflow")), { ...fresh, parallax: true }).step === "hold" && retryPlanFor(fail(f("repeat", "https://x.hu/a.jpg")), { ...fresh, parallax: true }).step === "photos" && retryPlanFor(fail(f("repeat", "https://x.hu/a.jpg")), { ...fresh, planPhoto: GATE_RETRY_PHOTO_MAX, parallax: true }).step === "hold");
  check("⑰ sablont csak a 2. terv cserél, a Kapunyitás és a Névből növő között", /const freeTemplate = isParallax \? null : \(\[\.\.\.SECOND_PLAN_TEMPLATES\]/.test(cs) && SECOND_PLAN_TEMPLATES.has("gate-opening") && SECOND_PLAN_TEMPLATES.has("wordmark-grow") && !SECOND_PLAN_TEMPLATES.has("parallax"));
  check("⑰ az újragenerálás fő terve Parallax, a 2. terv tartaléka sosem Parallax", /const newMain = await generatePlan\(leadId, "parallax", fields, new Set\(\)\)/.test(cs) && /const other = \["wordmark-grow"\]\.find/.test(cs));
  check("⑰ a Parallax nélküli pár Parallaxot kap (az időzítő futtatja), kép nélkül nem próbálja újra", /export async function restoreParallaxQueue/.test(cs) && /parallaxRestore/.test(cs) && /restoreParallaxQueue\(/.test(read("./chain-supply.mts")));
}
// ⑱–㉑ (coordinator 11-27, 3rd round: „tölts, ne hagyj el”)
{
  const tk = read("../src/engine/templateKit.ts");
  check("⑱ a minta-szobablokk nem marad el: a kép nélküli kártya MINTA stock hálószobát kap (5+ fotónál is)", !/rooms\.every\(\(r\) => !r\.photo\)\) return null/.test(tk) && !/rs\.every\(\(r\) => !r\.photo\)/.test(read("../src/engine/moduleSections.ts")) && /a short styled library is topped up from the general one/.test(read("../src/engine/stock.ts")));
  const px = read("../src/engine/templates/parallax.ts");
  check("⑳ a cím doboza sosem keskenyebb a leghosszabb szónál (em-ben, a kicsinyítéssel együtt), a mobil fix méret is a plafonhoz igazodik", /--cit-hero-wmeasure:/.test(tk) && /max-width:max\(var\(--cit-hero-measure,16ch\),var\(--cit-hero-wmeasure,0px\)\)/.test(px) && /\.t-hero h1\{font-size:min\(30px,var\(--cit-hero-cap,999px\)\)\}/.test(px));
  check("⑳ a Névből növő címe is a leghosszabb szóhoz igazodik (vegyes betűs szorzóval)", /export function heroWordFit/.test(tk) && /<h1\$\{heroWordFit\(data\.name\)\}>/.test(read("../src/engine/templates/wordmarkGrow.ts")) && /max-width:max\(12ch,var\(--cit-hero-wmeasure,0px\)\)/.test(read("../src/engine/templates/wordmarkGrow.ts")));
  const pt2 = read("../src/media/photoText.ts");
  check("㉒ feliratos nyitókép: forgatott OCR (0°, ±28°) címke-mintára, a nyitókép-választás a következő jelöltre lép, a kapu jelez (URL-lel)", /export async function readOverlayLabels/.test(pt2) && /for \(const deg of \[0, 28, -28\]\)/.test(pt2) && /photoOverlayLabels\(hero\.url\)/.test(read("../src/generator/photoCurate.ts")) && /feliratos nyitókép/.test(read("../src/outreach/mockRenderGate.ts")));
  check("㉑ a semleges „Galéria” cím a saját képek számán dől el (< 3), nem a lefordított szövegen", /const GALLERY_OWN_MIN = 3;/.test(read("../src/engine/render.ts")) && /if \(ownPhotoCount\(data\) >= GALLERY_OWN_MIN\) return recipe;/.test(read("../src/engine/render.ts")));
}
// wiring
{
  const tick = read("./chain-supply.mts");
  check("az időzítő futtatja mindhármat (③ sorba · ⑤ újrapróba · ① újragenerálás)", /enqueueReadyWithoutRow\(\)/.test(tick) && /retryFailedQueue\(/.test(tick) && /regenerateOldQueue\(/.test(tick));
  const unit = read("../deploy/systemd/citoviso-chain-supply.service");
  check("saját egység, a kiküldőnél alacsonyabb CPU-súllyal", /chain-supply\.mts tick/.test(unit) && /CPUWeight=10/.test(unit) && /Nice=15/.test(unit));
  check("az időzítő élesre megy (targets.json prod)", /"citoviso-chain-supply\.timer": \{ "target": "prod" \}/.test(read("../deploy/systemd/targets.json")));
}

console.log(failed ? `\n✗ chain-supply-check: ${failed} hiba` : "\n✓ chain-supply-check: minden szabály zöld");
process.exit(failed ? 1 : 0);
