// ŐR — az ÜZEMI RIASZTÁS tényleg MINDEN beállított címre elmegy (tulaj-kérés, 2026-09-12).
//
// MIÉRT KELL: a riasztási címzettet beállítani ADDITÍV ÍRÁS — attól, hogy a mezőben ott a
// három cím, még semmi nem bizonyítja, hogy a levél mindhármat eléri
// (feedback_additive_write_is_not_a_gate). A mező eddig EGY címre volt méretezve: az
// `<input type="email">` böngésző-szinten elutasította a vesszős listát, a szerver
// validátora pedig az EGÉSZ karakterláncra illesztett egy cím-mintát. Ez az őr a TELJES
// utat méri: mentés-normalizálás → getAlertRecipients → a levél To: fejléce.
//
// ⛔⛔ EZ A FÁJL EGYSZER MÁR KÜLDÖTT KI VALÓDI LEVELET (2026-09-12, saját hiba). Az
// `process.env.EMAIL_PROVIDER = "mock"` a fájl tetején állt, DE az ESM a static importokat
// ELŐBB futtatja, mint a modul törzsét — mire az értékadás lefutott, a `config.ts` már
// beolvasta az .env `EMAIL_PROVIDER=smtp`-jét, és a próba-levél a HÁLÓZATRA ment. Ezért
// minden projekt-modul DINAMIKUSAN (`await import`) töltődik be, az értékadás UTÁN.
// Ugyanez a csapda él minden `process.env.X = …` sorra a scriptek tetején.
//
// Amit mér:
//   ① a mentés-normalizálás elfogadja a vesszős listát, és kanonikus alakot csinál
//   ② EGYETLEN rossz cím az EGÉSZ mentést visszadobja, és megnevezi, melyik
//   ③ a getAlertRecipients a listát adja vissza (To:-ra kész alak + darabszám)
//   ④ a levél To: fejléce MINDEN címet tartalmaz — a kimenő levélből visszaolvasva
//   ⑤ az SMS-csatorna is él (env-alap vagy DB-érték), tehát a riasztás nem néma
//
//   npx tsx scripts/alert-recipients-check.mts
//   npx tsx scripts/alert-recipients-check.mts --self-test
//     ⛔ NEGATÍV FUTÁS: a régi, EGY-CÍMES viselkedést szimulálja (a lista első címe, a
//     többi eldobva), és elvárja, hogy a rá épülő mérések elbukjanak.

process.env.DATABASE_URL = "";
// A levél az OUTBOX-ba megy, nem a hálózatra. ⚠️ Ez CSAK azért hat, mert alább minden
// projekt-modul dinamikus importtal jön — static importtal elkésne (lásd a fenti bekezdést).
process.env.EMAIL_PROVIDER = "mock";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const { getAlertRecipients } = await import("../src/console/appSettings.js");
const { getEmailSender } = await import("../src/email/sender.js");
const { config } = await import("../src/config.js");
const { db } = await import("../src/db/client.js");

const SELF_TEST = process.argv.includes("--self-test");
const OUTBOX = path.resolve(import.meta.dirname, "..", "outbox");
const failures: string[] = [];

function inv(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}
function fix(name: string, ok: boolean, detail = ""): void {
  const want = SELF_TEST ? !ok : ok;
  if (want) console.log(`  ✅ ${name}${SELF_TEST ? " (helyesen PIROS az egy-címes viselkedésen)" : ""}`);
  else {
    console.log(
      `  ⛔ ${name}${detail ? ` — ${detail}` : ""}${SELF_TEST ? " ← az önteszten ZÖLD maradt: ez a mérés nem mér semmit" : ""}`,
    );
    failures.push(name);
  }
}

// ⛔ FAIL-CLOSED: ha a mock adapter mégsem aktív, az őr MEGÁLL, nem küld. Ez a sor a
// 2026-09-12-i hibából született — a szándék („outboxba megy") nem elég, meg kell mérni.
if (config.emailProvider === "smtp") {
  console.error(
    "⛔ az e-mail adapter SMTP-n áll — az őr nem futhat, mert valódi levelet küldene.\n" +
      "   (A dinamikus import-sorrend sérült; lásd a fájl fejlécét.)",
  );
  process.exit(2);
}

/**
 * A /settings POST normalizálása, kiemelve — az őr PONTOSAN ezt méri, nem egy hasonlót.
 * (A ④ pont ezért NEM ezen megy, hanem a tényleges kimenő levélen.)
 */
function normalizeSaved(raw: string): { clean: string; bad: string | null } {
  // Öntesztben a RÉGI szabály fut: a validátor az EGÉSZ karakterláncra illesztett egy
  // cím-mintát, tehát a vesszős listát érvénytelennek látta — ettől kell pirosra
  // váltania a „mind a három megmarad" mérésnek.
  if (SELF_TEST) {
    const one = raw.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(one)
      ? { clean: one.toLowerCase(), bad: null }
      : { clean: "", bad: one };
  }
  const emails = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const bad = emails.find((e) => !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(e)) ?? null;
  if (bad) return { clean: "", bad };
  return { clean: [...new Set(emails.map((e) => e.toLowerCase()))].join(", "), bad: null };
}

// ── ① a mentés elfogadja a vesszős listát ───────────────────────────────────
const THREE = " Olasz.Ferenc@citoviso.com ,olaszferenc@gmail.com,  info@citoviso.com ";
const saved = normalizeSaved(THREE);
fix("a vesszős listát elfogadja a mentés", saved.bad === null, saved.bad ?? "");
fix(
  "a mentés MIND A HÁROM címet megtartja (trim + kisbetűsítés)",
  saved.clean === "olasz.ferenc@citoviso.com, olaszferenc@gmail.com, info@citoviso.com",
  saved.clean,
);

// ── ② egyetlen rossz cím az EGÉSZ mentést visszadobja, megnevezve ───────────
const withBad = normalizeSaved("jo@citoviso.com, ez-nem-cim, masik@citoviso.com");
inv("rossz cím esetén a mentés elbukik", withBad.bad !== null);
inv("a jó címek NEM mentődnek el félig", withBad.clean === "");
fix(
  "és a hibaüzenet MEGNEVEZI a rossz címet (nem az egész mezőt idézi vissza)",
  withBad.bad === "ez-nem-cim",
  withBad.bad ?? "",
);

// ── ③ a getAlertRecipients a ténylegesen beállított listát adja ─────────────
const r = await getAlertRecipients();
const rEmails = SELF_TEST ? r.emails.slice(0, 1) : r.emails; // a régi, egy-címes olvasat
const rTo = SELF_TEST ? (r.emails[0] ?? "") : (r.email ?? "");
inv("van beállított e-mail címzett", r.emails.length > 0, `${r.emails.length} db`);
fix("mind a három cím ott van a beállításban", rEmails.length === 3, `${rEmails.length} db: ${rEmails.join(", ")}`);
inv(
  "az SMS-csatorna is él (a riasztás nem néma)",
  Boolean(r.phone),
  r.phone ? `${r.phone.slice(0, 6)}…${r.phone.slice(-2)}` : "(nincs szám)",
);

// ── ④ a levél To: fejléce mindet tartalmazza ───────────────────────────────
// Nem a beállítást olvassuk vissza, hanem a KIMENŐ LEVELET: a mező tartalma és a
// tényleges címzett két külön dolog — pont ez a mérés lényege.
const before = new Set(await readdir(OUTBOX).catch(() => []));
await getEmailSender().send({
  to: rTo,
  audience: "platform",
  subject: "Citoviso őr-próba: üzemi riasztás címzettjei",
  text: "Ez az alert-recipients-check mérése. Az outboxba megy, a hálózatra nem.",
});
const after = (await readdir(OUTBOX).catch(() => [])).filter((f) => !before.has(f));
if (after.length !== 1) {
  console.log(`  ⛔ a próba-levél nem íródott ki egyetlen fájlba (${after.length} db)`);
  failures.push("a próba-levél kiírása");
} else {
  const body = await readFile(path.join(OUTBOX, after[0]), "utf8");
  const toLine = body.split("\n").find((l) => l.toLowerCase().startsWith("to:")) ?? "";
  // A fixture bizonyítja a saját útját: ha nem a mi levelünket olvasnánk, ez sem állna.
  inv("a próba-levél tárgya a mienk", body.includes("Citoviso őr-próba"), toLine);
  // Az ELSŐ cím a régi, egy-címes viselkedéssel is ott lenne — az invariáns. A mérés
  // tárgya a MÁSIK KETTŐ: pontosan ők vesztek volna el.
  inv(
    "a levél To: fejlécében ott az első cím",
    toLine.toLowerCase().includes("olasz.ferenc@citoviso.com"),
    toLine,
  );
  for (const addr of ["olaszferenc@gmail.com", "info@citoviso.com"]) {
    fix(`a levél To: fejlécében ott van a további cím is: ${addr}`, toLine.toLowerCase().includes(addr), toLine);
  }
}

await db.destroy();

if (failures.length) {
  console.error(`\n⛔ riasztás-címzett őr: ${failures.length} mérés BUKOTT`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(
  SELF_TEST
    ? "\n✅ ÖNTESZT: az egy-címes viselkedésen a mérések átbillennek — az őr tényleg a listát méri."
    : "\n✅ Az üzemi riasztás minden beállított címre elmegy (levél To: + SMS-szám is él).",
);
