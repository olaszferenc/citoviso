// VENDÉG-KONTAKT KAPU — „amit a kontakt-főkönyv elutasított, az nem kerül a vendég elé".
//
// A LELET (2026-10-04, Kerekerdő élesen, csak olvasva): a mock „Írjon nekünk" alatt
// `kuci01@axelero.hu` állt, miközben a lead `raw.contacts` főkönyve ugyanerre `accepted:false`,
// „idegen domain". Leltárban élesen 17/1734 lead mostani e-mailje volt elutasított — köztük egy
// polgármesteri cím (`mpolgarmester@keszthely.hu`, Rozé Fogadó) és egy tourinform-iroda
// (`info@keszthelyinfo.hu`, Ferenc Vendégház). A `leadToSiteData` a `lead.email`-t vakon
// rakta a lapra; a főkönyvet senki nem olvasta.
//
// A MÁSIK FELE: a Kerekerdő címe NEM idegen — az axelero.hu a volt Matáv ISP-postafiók (ma
// t-online), és a `t-online`/`invitel`/`upcmail` már átment a FREEMAIL-listán. Az osztályozó
// hiányos listája ítélte el. Ezért a szűrő egy esetben ÚJRAÍTÉL: „idegen domain" ítéletet
// freemail/ISP-postafiókra a mai lista szerint — a lista bővítése így újra-scrape nélkül hat.
//
//   npx tsx scripts/guest-contact-check.mts             # zöld futás
//   npx tsx scripts/guest-contact-check.mts --self-test # PIROS kontroll (a régi viselkedés)
//
// Se AI, se hálózat, se DB: tiszta függvény-viselkedés + forrás-olvasás.

import { readFileSync } from "node:fs";
import path from "node:path";

import { leadToSiteData } from "../src/engine/siteData.js";
import { FOREIGN_DOMAIN_REASON } from "../src/scraper/contactLedger.js";
import type { ContactCandidate, QualifiedLead } from "../src/scraper/types.js";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");

const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

/** A 2026-10-04-ig kiszállított viselkedés: a lead mezői vakon a lapra. */
const OLD = (lead: QualifiedLead) => ({
  email: lead.email?.trim() || undefined,
  phone: lead.phone?.trim() || undefined,
});
const shown = (lead: QualifiedLead) => (SELF_TEST ? OLD(lead) : leadToSiteData(lead).contact);

const row = (kind: "email" | "phone", value: string, accepted: boolean, rejectedReason?: string): ContactCandidate =>
  ({ kind, value, source: "korábbi adat", accepted, firstSeen: "2026-09-28", ...(rejectedReason ? { rejectedReason } : {}) }) as ContactCandidate;

const lead = (name: string, email: string | undefined, phone: string | undefined, contacts?: ContactCandidate[]) =>
  ({ name, email, phone, industry: "accommodation", ...(contacts ? { contacts } : {}) }) as unknown as QualifiedLead;

// ── ① Valódi idegen cím (élesen mért) → NEM kerül a lapra ─────────────────────
for (const [name, email] of [
  ["Rozé Fogadó", "mpolgarmester@keszthely.hu"],
  ["Ferenc Vendégház", "info@keszthelyinfo.hu"],
  ["Monte Balaton", "info@chiantiapartments.hu"],
] as const) {
  const c = shown(lead(name, email, undefined, [row("email", email, false, FOREIGN_DOMAIN_REASON)]));
  check(c.email === undefined, `[${name}] elutasított idegen cím nem kerül a vendég elé (kapott: ${c.email ?? "—"})`);
}
// Más okból elutasított (több leadnél felbukkanó = közvetítő) e-mail és telefon sem.
{
  const e = "eva492899@gmail.com";
  const c = shown(lead("Hanna Apartman", e, undefined, [row("email", e, false, "több leadnél is felbukkant — közvetítő/iroda száma lehet")]));
  check(c.email === undefined, `közvetítő-gyanús (megosztott) freemail sem kerül ki — a freemail-újraítélés csak az idegen-domain ítéletre szól (kapott: ${c.email ?? "—"})`);
  const p = "06-1-261 5556";
  const cp = shown(lead("Teszt", undefined, "+36 1 261 5556", [row("phone", p, false, "több leadnél is felbukkant — közvetítő/iroda száma lehet")]));
  check(cp.phone === undefined, `elutasított telefon más írásmóddal is felismerve és kiszűrve (kapott: ${cp.phone ?? "—"})`);
}

// ── ② ISP-postafiók: a régi ítélet újraítélve → kint marad (Kerekerdő) ─────────
for (const email of ["kuci01@axelero.hu", "dorimel@t-email.hu", "sandorsai@gmx.de", "laszlo.witzmann@web.de"]) {
  const c = SELF_TEST
    ? { email: undefined } // a régi FREEMAIL-lista ezeket elutasította volna — a pozitív kontroll itt piros
    : leadToSiteData(lead("Kerekerdő vendégház", email, undefined, [row("email", email, false, FOREIGN_DOMAIN_REASON)])).contact;
  check(c.email === email, `[${email}] ISP/freemail postafiók nem „idegen domain" — a mai lista szerint kint marad (kapott: ${c.email ?? "—"})`);
}

// ── ③ Pozitív kontrollok: elfogadott és főkönyv nélküli érték kint marad ───────
{
  const e = "info@kerekerdo.hu";
  const c = shown(lead("Kerekerdő", e, "+36 30 111 2222", [row("email", e, true)]));
  check(c.email === e && c.phone === "+36 30 111 2222", "elfogadott e-mail és főkönyv nélküli telefon megjelenik");
  const legacy = shown(lead("Régi lead", "a@b.hu", undefined));
  check(legacy.email === "a@b.hu", "főkönyv nélküli (régi) lead e-mailje megjelenik — a főkönyv csak ott dönt, ahol szólt");
}

// ── ④ SZERKEZETI IKER: a vendég-kontakt egyetlen kapun megy át ─────────────────
{
  const src = SELF_TEST
    ? "  if (clean(lead.email)) contact.email = clean(lead.email);\n"
    : readFileSync(path.join(ROOT, "src/engine/siteData.ts"), "utf8");
  const raw = src.split("\n").filter((l) => /contact\.(email|phone)\s*=/.test(l));
  const guarded = src.match(/guestVisibleContact\(lead\.contacts,\s*"(email|phone)"/g) ?? [];
  check(raw.length > 0 && guarded.length >= raw.length, `siteData: minden contact.email/phone írás a guestVisibleContact mögött (${guarded.length}/${raw.length})`);
}

for (const o of oks) console.log(`  ✓ ${o}`);
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(`\nguest-contact-check: ${oks.length} pass / ${fails.length} fail${SELF_TEST ? " (ÖNTESZT: a pirosnak KELL buknia)" : ""}`);
if (SELF_TEST) {
  if (fails.length === 0) {
    console.error("\n⛔ ÖNTESZT-BUKÁS: a visszarontott viselkedésre az őr ZÖLDET adott — nem azt méri, amit állít.");
    process.exit(1);
  }
  console.log(`✅ ÖNTESZT RENDBEN: ${fails.length} állításon pirosra ment a visszarontott viselkedésen.`);
  process.exit(0);
}
if (fails.length) process.exit(1);
console.log("✅ elutasított kontakt nem kerül a vendég elé; ISP-postafiók nem idegen domain");
