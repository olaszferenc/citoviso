// Regression gate: the invoice address is the BUYER's, and an adószám never rides
// inside it (Elek F-1, owner-approved 2026-10-02).
//
// WHAT WAS MEASURED (production invoice CITO-2026-2, sent to NAV):
//   "8360 Keszthely, Ráckevei út 083/2 hrsz. 24393470213" — the zip and city were the
//   GUESTHOUSE's (prefilled from the lead), the street was the buyer's, and the
//   trailing 11 digits are a VALID Hungarian adószám (checksum, VAT code 2, county
//   13 = Pest). The tax field exists only on the company branch, so a sole trader on
//   "Magánszemélyként" had nowhere else to put it; the adószám field stayed empty.
//
// WHAT IT MEASURES:
//   1. buildBillingPrefill gives NO zip / city / street from the lead (e-mail stays);
//   2. the REAL validateBuyer refuses a valid adószám inside the address / city /
//      name, and accepts the same order once the number is in its own field;
//   3. the browser copy of the finder (cit-configurator.js huTaxInText) agrees with
//      the server's findHuTaxNumberInText on every vector — it is a mirror, and a
//      mirror that disagrees asks the wrong question.
//
// Run:  npx tsx scripts/billing-taxid-in-address-check.mts
//       npx tsx scripts/billing-taxid-in-address-check.mts --self-test   (must go RED:
//         runs the PRE-FIX prefill from git and a drifted browser copy)

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}

// ── 1. PREFILL ───────────────────────────────────────────────────────────────
let prefillMod: typeof import("../src/billing/prefill.js");
if (SELF_TEST) {
  // The prefill module imports only a TYPE, so the pre-fix file runs standalone.
  const dir = mkdtempSync(path.join(os.tmpdir(), "billing-prefill-"));
  const old = execFileSync("git", ["show", "8493d321:src/billing/prefill.ts"], { encoding: "utf8" });
  writeFileSync(path.join(dir, "prefill.ts"), old.replace(/^import type .*$/m, ""));
  prefillMod = await import(path.join(dir, "prefill.ts"));
} else {
  prefillMod = await import("../src/billing/prefill.js");
}
const pf = prefillMod.buildBillingPrefill(
  { address: "Keszthely, Ady Endre u. 1, 8360 Hungary", city: "Keszthely", country: "HU" },
  "tulaj@pelda.hu",
) as Record<string, string | undefined>;
ok(!pf.zip && !pf.city && !pf.address, "a szállás címe NEM töltődik a számlázási címbe (irsz / település / utca üres)", JSON.stringify(pf));
ok(pf.email === "tulaj@pelda.hu", "a tulaj e-mail címe továbbra is előtöltve", JSON.stringify(pf));

// ── 2. SERVER REFUSES AN ADÓSZÁM IN THE ADDRESS ──────────────────────────────
const { validateBuyer } = await import("../src/billing/buyer.js");
const base = {
  buyer_type: "individual", buyer_name: "Olasz-Balogh Viktória", buyer_country: "HU",
  buyer_zip: "2300", buyer_city: "Ráckeve", buyer_email: "tulaj@pelda.hu", withdrawal_waiver: true,
};
const live = await validateBuyer({ ...base, buyer_address: "Ráckevei út 083/2 hrsz. 24393470213" });
ok(!live.ok && /adószám/i.test((live as { errors: Record<string, string> }).errors.buyer_address ?? ""),
  "az élesben mért cím (adószámmal a végén) elutasítva, a buyer_address mezőn", JSON.stringify(live));
const inName = await validateBuyer({ ...base, buyer_name: "Kovács Anna 24393470-2-13", buyer_address: "Fő u. 1." });
ok(!inName.ok && Boolean((inName as { errors: Record<string, string> }).errors.buyer_name), "adószám a NÉV mezőben is elutasítva");
const fixed = await validateBuyer({ ...base, buyer_type: "business", buyer_name: "Olasz-Balogh Viktória e.v.",
  buyer_address: "Ráckevei út 083/2 hrsz.", buyer_tax_number: "24393470213" });
ok(fixed.ok && fixed.value.buyerTaxNumber === "24393470-2-13", "ugyanez a rendelés az Adószám mezőbe téve átmegy", JSON.stringify(fixed));
const hrsz = await validateBuyer({ ...base, buyer_address: "Külterület 0832/14 hrsz." });
ok(hrsz.ok, "helyrajzi szám / házszám nem vált ki hamis riasztást", JSON.stringify(hrsz));

// ── 3. THE BROWSER MIRROR AGREES ─────────────────────────────────────────────
const { findHuTaxNumberInText } = await import("../src/billing/taxId.js");
let js = readFileSync("assets/runtime/cit-configurator.js", "utf8");
if (SELF_TEST) js = js.replace("county <= 44", "county <= 4");
const at = js.indexOf("function huTaxInText(");
ok(at > -1, "a konfigurátorban van huTaxInText");
const body = js.slice(at, js.indexOf("\n  }\n", at) + 4);
const huTaxInText = new Function(`${body}; return huTaxInText;`)() as (t: string) => { norm: string } | null;
const vectors = [
  "Ráckevei út 083/2 hrsz. 24393470213", "24393470-2-13", "13421739-2-41 Kft", "Fő u. 12345678901",
  "06301234567", "Külterület 0832/14 hrsz.", "10625790244", "10773381-2-44", "", "Petőfi u. 2. 1/3",
];
for (const v of vectors) {
  const server = findHuTaxNumberInText(v);
  const browser = huTaxInText(v)?.norm ?? null;
  ok(server === browser, `paritás: „${v}” → szerver ${server ?? "—"} · böngésző ${browser ?? "—"}`);
}

console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ a számlázási cím a vevőé, és adószám nem kerül bele");
if (SELF_TEST) {
  if (!failed) { console.log("⛔ ÖNTESZT: a visszarontott változatot ZÖLDNEK látta — a kapu vak"); process.exit(1); }
  console.log("✓ ÖNTESZT: a visszarontás pirosat adott"); process.exit(0);
}
process.exit(failed ? 1 : 0);
