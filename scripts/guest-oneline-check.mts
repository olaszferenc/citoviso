// ŐR: a vendég által beírt EGYSOROS mező (név, e-mail, telefon, vélemény-szerző) sortörés nélkül
// kerül a sorba és a levél fejlécébe (Elek 10-12 N3).
//
// A MÉRT LELET. A foglalási kérés vendégneve CR/LF-et is elfogadott: a sortörés a
// `booking_request.guest_name`-be került, a mock-postafiók `.eml`-jében pedig hamis fejléc
// jelent meg (`Bcc: …`, `X-Elek: 1`). Élesben a nodemailer a tárgy sortörését szóközzé teszi,
// tehát kihasználni nem lehetett — de a tárolt érték hibás volt, és minden mock-alapú teszt
// (Elek, kapuk) hamis fejlécet látott.
//
// MIT MÉR (offline, DB nélkül):
//   ① `oneLine()` — CR, LF, tab, U+2028/2029, NEL → egy szóköz; a szóköz-futás összevonva; trim.
//   ② a bemeneti pontok az `oneLine()`-t használják: foglalási kérés (név, e-mail, telefon),
//      érdeklődés (név, e-mail, telefon), vélemény (szerző neve, e-mail).
//   ③ a mock-postafiók a fejléc-értékben maradt sortörést szóközzé hajtja (ahogy a nodemailer):
//      egy `Subject: …\r\nBcc: …` nem gyárt külön `Bcc:` sort.
//
// Futtatás:      npx tsx scripts/guest-oneline-check.mts
// Piros önteszt: npx tsx scripts/guest-oneline-check.mts --self-test
//   (a javítás előtti világ: nyers `trim()` és nyers fejléc — mindhárom pontnak pirosnak kell lennie)

import { readFile, rm } from "node:fs/promises";
import path from "node:path";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");
process.env.EMAIL_PROVIDER = "mock";
delete process.env.ELEK_RUN;

let failures = 0;
const red: string[] = [];
function check(id: string, label: string, ok: boolean, detail?: unknown): void {
  if (!ok) {
    failures++;
    red.push(id);
  }
  console.log(`  ${ok ? "✅" : "❌"} ${label}${ok || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}

const { oneLine: realOneLine } = await import("../src/text/oneLine.ts");
// Self-test: the pre-fix world — a plain trim, and header values written raw.
const oneLine = SELF_TEST ? (s: string | null | undefined) => String(s ?? "").trim() : realOneLine;

// ① ─────────────────────────────────────────────────────────────────────────────────────────
console.log("① oneLine()");
const evil = "Elek Teszt\r\nBcc: x@example.com\r\nX-Elek: 1";
check("1", "CR/LF → szóköz, nincs több sor", !/[\r\n]/.test(oneLine(evil)) && oneLine(evil) === "Elek Teszt Bcc: x@example.com X-Elek: 1", oneLine(evil));
check("1", "tab, U+2028, U+2029, NEL → szóköz", oneLine("A\tB\u2028C\u2029D\u0085E") === "A B C D E", oneLine("A\tB\u2028C\u2029D\u0085E"));
check("1", "szóköz-futás összevonva, szélek levágva", oneLine("  Kovács \n\n  Anna  ") === "Kovács Anna", oneLine("  Kovács \n\n  Anna  "));
check("1", "null/undefined → üres", oneLine(null) === "" && oneLine(undefined) === "");

// ② ─────────────────────────────────────────────────────────────────────────────────────────
console.log("② a bemeneti pontok egysorosítanak");
const src = async (f: string): Promise<string> => {
  const s = await readFile(path.join(ROOT, f), "utf8");
  return SELF_TEST ? s.replace(/oneLine\(([^()]*)\)/g, "$1.trim()") : s;
};
const req = await src("src/booking/requests.ts");
check("2", "foglalási kérés: guest_name", /guest_name: oneLine\(input\.guestName\)/.test(req));
check("2", "foglalási kérés: guest_email", /const guestEmail = oneLine\(input\.guestEmail\)/.test(req) && /guest_email: guestEmail,/.test(req));
check("2", "foglalási kérés: guest_phone", /guest_phone: oneLine\(input\.guestPhone\)/.test(req));
const enq = await src("src/booking/enquiry.ts");
check("2", "érdeklődés: név, e-mail, telefon", /const name = oneLine\(input\.guestName\)/.test(enq) && /const email = oneLine\(input\.guestEmail\)/.test(enq) && /const phone = oneLine\(input\.guestPhone\)/.test(enq));
const rev = await src("src/reviews/reviews.ts");
check("2", "vélemény: szerző neve, e-mail", /const name = oneLine\(input\.authorName\)/.test(rev) && /const email = oneLine\(input\.authorEmail\)/.test(rev));

// ③ ─────────────────────────────────────────────────────────────────────────────────────────
console.log("③ a mock-postafiók nem gyárt hamis fejlécet");
const { getEmailSender } = await import("../src/email/sender.ts");
const to = `oneline-${Date.now().toString(36)}@example.com`;
const sent = await getEmailSender().send({
  to,
  subject: `Foglalási kérés: ${evil}`,
  text: "teszt",
  audience: "guest",
} as never);
const emlPath = path.join(ROOT, "outbox", `${sent.id}.eml`);
let eml = await readFile(emlPath, "utf8");
await rm(emlPath, { force: true });
if (SELF_TEST) eml = eml.replace("Foglalási kérés: Elek Teszt Bcc: x@example.com X-Elek: 1", `Foglalási kérés: ${evil}`);
const head = eml.split("\n\n")[0] ?? "";
check("3", "nincs „Bcc: x@example.com” és „X-Elek” fejléc-sor", !/^Bcc: x@example\.com/m.test(head) && !/^X-Elek:/m.test(head), head);
check("3", "a tárgy egy sor, a szöveg megvan benne", /^Subject: Foglalási kérés: Elek Teszt Bcc: x@example\.com X-Elek: 1$/m.test(head), head);

// ─────────────────────────────────────────────────────────────────────────────────────────────
if (SELF_TEST) {
  const want = ["1", "2", "3"];
  const missing = want.filter((w) => !red.includes(w));
  if (missing.length) {
    console.error(`\n⛔ guest-oneline-check --self-test: a szabotált világban ZÖLD maradt: ${missing.join(", ")} — az őr vak.`);
    process.exit(1);
  }
  console.log("\n✅ guest-oneline-check --self-test: mindhárom pont pirosra megy a javítás előtti világban.");
  process.exit(0);
}
if (failures) {
  console.error(`\n⛔ guest-oneline-check: ${failures} hiba — vendég-mezőben sortörés juthat a sorba vagy a fejlécbe.`);
  process.exit(1);
}
console.log("\n✅ guest-oneline-check: a vendég egysoros mezői sortörés nélkül kerülnek a sorba és a fejlécbe.");
