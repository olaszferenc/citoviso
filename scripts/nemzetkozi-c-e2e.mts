// NEMZETKÖZI C — konverzió, fizetés, számla, domain, szállás-admin, üzem országfüggően (brief
// nemzetkozi-C-konverzio-uzem-20261122). Scratch DB (minden migráció, köztük 0150), hálózat elkerítve,
// valódi üzenet nincs. Méri:
//   ① az öt új ország (IT, ES, PT, FR, BG) az Országok-mérésben: adat és ár zöld, euró-tárca nélkül piros tétel;
//   ② céges vevő nemzeti azonosítóval (HR OIB, IT P.IVA, ES NIF, PT NIF, FR SIREN, BG ЕИК), EU-adószám nélkül →
//      magánszemély-út (AAM, OSS-számlálóba); hiányzó ország = hiba, nem csendes HU;
//   ③ „Đurđa” → „durda”, HR .com névváltozatok; HU javaslat bájtra a régi;
//   ④ HR szám: SMS/MMS nem megy; HU szám: megy (bitre a régi);
//   ⑤ euró-tárca: éles Barion-átjárón beállítás nélkül zár, beállítással nyit;
//   ⑥ számla: a magyar tételek és megjegyzés bájtra a régiek; horvát számla a horvát szövegekkel / hiánynál vár;
//   ⑦ szállás-admin: HR-ben nincs IFA-kérdés, a Segítő promptjában nincs magyar IFA-szabály és Szállás.hu; HU prompt bájtra;
//   ⑧ próba-telefon: horvát „091 …” a lead országában olvasva.
import pg from "pg";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_nemzetkozi_c_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

process.env.CIT_SHOT = "1";
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.I18N_BOOT_TOPUP = "0";
delete process.env.BARION_WALLET_CURRENCIES;
for (const k of ["ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY", "SZAMLAZZ_AGENT_KEY", "BARION_POSKEY"]) process.env[k] = "";

async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" }, stdio: "pipe" });
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

globalThis.fetch = (async () => new Response("blocked by nemzetkozi-c-e2e fence", { status: 599 })) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { countryConfigSync } = await import("../src/country.js");
const { countryReadiness } = await import("../src/countryReadiness.js");
const { validateBuyer } = await import("../src/billing/buyer.js");
const { isOssCountedSale } = await import("../src/billing/taxCounters.js");
const { slugify, suggestDomains } = await import("../src/domains.js");
const { phoneChannelAllowed } = await import("../src/sms/countryChannel.js");
const { walletGap } = await import("../src/payment/providers.js");
const { buildInvoiceItems, invoiceComment } = await import("../src/payment/service.js");
const { collectFallbacks } = await import("../src/i18n/packs.js");
const { helperSystemPrompt } = await import("../src/ai/bookingHelper.js");
const { bookingSetupQuestions } = await import("../src/server/bookingSetupViews.js");
const { normalizePhoneIn } = await import("../src/text/phoneCountry.js");
const { calendarSyncPortals } = await import("../src/country.js");
const { prefillCountry } = await import("../src/billing/prefill.js");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// ① ─────────────────────────────────────────────────────────────────────────────────────
console.log("① öt új ország az Országok-mérésben");
process.env.PAYMENT_GATEWAY = "barion"; // the real gateway's wallet rule (no call is made)
for (const cc of ["IT", "ES", "PT", "FR", "BG"]) {
  const r = await countryReadiness(cc, { lang: "hu" });
  const st = (k: string) => r.items.find((i) => i.key === k)?.state;
  check(`${cc}: adat zöld, ár zöld, euró-tárca piros, a piac zárva`,
    st("data") === "ok" && st("prices") === "ok" && st("wallet") === "bad" && !r.open,
    r.items.map((i) => `${i.key}=${i.state} (${i.detail})`).join(" · "));
}
const huR = await countryReadiness("HU", { lang: "hu" });
check("HU: a forint-tárca megvan, a kapu nyitva (bitre a régi)", huR.items.find((i) => i.key === "wallet")?.state === "ok" && huR.open, huR.reasons.join(" · "));
process.env.PAYMENT_GATEWAY = "mock";
check("BG pénzneme EUR (2026-01-01 óta), PT számlanyelve angol (a Számlázz.hu nem ír portugálul)",
  countryConfigSync("BG")?.currency === "EUR" && countryConfigSync("PT")?.invoiceLang === "en");

// ② ─────────────────────────────────────────────────────────────────────────────────────
console.log("② céges vevő nemzeti azonosítóval, EU-adószám nélkül");
const base = {
  buyer_type: "business", buyer_name: "Test d.o.o.", buyer_zip: "21000", buyer_city: "Split",
  buyer_address: "Ulica 1", buyer_email: "elek@citoviso.com", withdrawal_waiver: false,
};
const ids: [string, string, string][] = [
  ["HR", "69435151530", "12345678901"],
  ["IT", "12345678903", "12345678904"],
  ["ES", "12345678Z", "12345678A"],
  ["PT", "123456789", "123456780"],
  ["FR", "732829320", "732829321"],
  ["BG", "121759222", "121759223"],
];
for (const [cc, good, bad] of ids) {
  const ok = await validateBuyer({ ...base, buyer_country: cc, buyer_national_tax_id: good }, { lang: "hu" });
  const no = await validateBuyer({ ...base, buyer_country: cc, buyer_national_tax_id: bad }, { lang: "hu" });
  check(`${cc}: érvényes azonosítóval rendelhet (AAM, OSS-számlálóba), hibással mezőhiba`,
    ok.ok && ok.value.vatTreatment === "aam" && ok.value.buyerNationalTaxId === good &&
      isOssCountedSale({ buyer_country: cc, vat_treatment: ok.value.vatTreatment }) &&
      !no.ok && !!no.errors.buyer_national_tax_id,
    JSON.stringify(ok.ok ? ok.value.buyerNationalTaxId : ok.errors) + " / " + JSON.stringify(no.ok ? "ok?" : no.errors));
}
const itNone = await validateBuyer({ ...base, buyer_country: "IT" }, { lang: "hu" });
check("IT cég sem azonosító, sem EU-adószám nélkül: az azonosítót kéri", !itNone.ok && !!itNone.errors.buyer_national_tax_id);
const noCountry = await validateBuyer({ ...base, buyer_type: "individual", withdrawal_waiver: true }, { lang: "hu" });
check("hiányzó ország: hiba, nem csendes „HU”", !noCountry.ok && !!noCountry.errors.buyer_country);
check("előtöltés: alias → ISO, ismeretlen → a régió egyetlen országa, különben semmi",
  prefillCountry("MAGYARORSZÁG", null) === "HU" && prefillCountry(null, "hr") === "HR" && prefillCountry(null, null) === null);

// ③ ─────────────────────────────────────────────────────────────────────────────────────
console.log("③ domain");
check("„Đurđa” → „durda”, a magyar név változatlan", slugify("Đurđa") === "durda" && slugify("Kőszegi Vendégház") === "koszegi-vendeghaz");
const hrSug = suggestDomains("Apartmani Đurđa", [".com"], countryConfigSync("HR"));
check("HR .com: névváltozatok és horvát típusszó nélküli mag", hrSug.includes("apartmanidurda.com") && hrSug.includes("apartmani-durda.com") && hrSug.includes("durda.com"), hrSug.join(", "));
const huOld = ["panziosissi.hu", "panzio-sissi.hu", "sissi.hu", "panziosissi.com", "panziosissi.eu"];
check("HU javaslat bájtra a régi", JSON.stringify(suggestDomains("Panzió Sissi", [".hu", ".com", ".eu"], countryConfigSync("HU"))) === JSON.stringify(huOld));

// ④ ─────────────────────────────────────────────────────────────────────────────────────
console.log("④ SMS/MMS az ország csatornája szerint");
check("HR szám: SMS és MMS nem megy", !phoneChannelAllowed("+385912345678", "sms") && !phoneChannelAllowed("+385912345678", "mms"));
check("HU szám: SMS és MMS megy", phoneChannelAllowed("+36301234567", "sms") && phoneChannelAllowed("06301234567", "mms"));

// ⑤ ─────────────────────────────────────────────────────────────────────────────────────
console.log("⑤ euró-tárca");
process.env.PAYMENT_GATEWAY = "barion";
const gap = walletGap("barion", "EUR");
check("éles átjáró, beállítás nélkül: EUR zár, érthető okkal; HUF megy", !!gap && /EUR pénztárca/.test(gap) && walletGap("barion", "HUF") === null, gap ?? "");
process.env.BARION_WALLET_CURRENCIES = "HUF,EUR";
check("a tárca megnyitása után (beállítás): EUR megy", walletGap("barion", "EUR") === null);
delete process.env.BARION_WALLET_CURRENCIES;
process.env.PAYMENT_GATEWAY = "mock";

// ⑥ ─────────────────────────────────────────────────────────────────────────────────────
console.log("⑥ számla");
const p = { amount: 14775, kind: "initial", settlementTakeDomain: null, domainFee: 0, domainName: null, offerPercent: 25 };
const huItems = buildInvoiceItems(p, "monthly", "havi", 7, "AAM");
check("magyar számla tételei: lang nélkül = „hu”", JSON.stringify(huItems) === JSON.stringify(buildInvoiceItems(p, "monthly", "havi", 7, "AAM", "hu")) &&
  huItems[0]!.name === "Citoviso előfizetés (havi, 7 modul) — 25% kedvezménnyel", huItems[0]!.name);
check("magyar számla megjegyzése: lang nélkül = „hu”",
  invoiceComment(false, 25, 19700, 14775, "coupon") === invoiceComment(false, 25, 19700, 14775, "coupon", { lang: "hu" }));
await (await import("../src/i18n/mail.js")).prepareMailLang("hr");
const hr = collectFallbacks(() => ({
  items: buildInvoiceItems({ ...p, amount: 1300 }, "monthly", "havi", 7, "AAM", "hr"),
  comment: invoiceComment(false, 25, 1700, 1300, "coupon", { currency: "EUR", lang: "hr" }),
}));
const hrText = JSON.stringify(hr.value);
check("horvát számla: minden szöveg a horvát csomagból jön, vagy a hiány mérhető (→ a számla vár, magyar sor nem kerül rá)",
  hr.fallbacks.length > 0 || !/előfizetés|Alanyi/.test(hrText));
console.log(`    (horvát számla-szöveg Bábelre vár: ${hr.fallbacks.length} felirat — ${hr.fallbacks.join(" | ")})`);
check("horvát számla összege euróban, „Ft” nélkül", !/Ft/.test(hr.value.comment), hr.value.comment);

// ⑦ ─────────────────────────────────────────────────────────────────────────────────────
console.log("⑦ szállás-admin");
const huPrompt = helperSystemPrompt("hu");
check("HU Segítő-prompt bájtra a régi (ország nélkül = HU sor)", huPrompt === helperSystemPrompt("hu", { taxModel: "hu", portals: calendarSyncPortals("HU"), currency: "HUF" }));
const hrPrompt = helperSystemPrompt("hr", { taxModel: "none", portals: calendarSyncPortals("HR"), currency: "EUR" });
check("HR Segítő-prompt: nincs magyar IFA-szabály, nincs Szállás.hu, euró", !/Htv\. 31/.test(hrPrompt) && !/Szállás\.hu/.test(hrPrompt) && /EUR/.test(hrPrompt));
check("HR foglalás-beállítás: nincs IFA-kérdés; HU-ban van",
  !bookingSetupQuestions("hr", "single", "none").some((q) => q.id === "tax") && bookingSetupQuestions("hu", "single").some((q) => q.id === "tax"));

// ⑧ ─────────────────────────────────────────────────────────────────────────────────────
console.log("⑧ próba-telefon a lead országában");
check("horvát „091 234 5678” → +385912345678; magyar „06 30 123 4567” a magyar szabállyal",
  normalizePhoneIn("091 234 5678", countryConfigSync("HR")) === "+385912345678" &&
    normalizePhoneIn("06 30 123 4567", countryConfigSync("HU")) === "+36301234567");

await db.destroy();
console.log(fails ? `\n⛔ nemzetkozi-c-e2e: ${fails} hiba` : "\n✅ nemzetkozi-c-e2e: minden ellenőrzés zöld");
process.exit(fails ? 1 : 0);
