// Invoice-key guard — a TEST-MODE Számlázz.hu key must never serve production.
//
// ⛔ WHY THIS EXISTS (owner ruling, 2026-09-22). Dev deliberately uses the OLD
// (defunct E.V.) Számlázz.hu account's Agent key: that account sits permanently
// in test mode, so dev integration runs can exercise the real Számla Agent XML
// round without ever issuing a legal invoice. The price of that convenience is
// exactly one failure mode, and it is the silent kind we hate most: if that key
// ever reaches the LIVE host, production would "issue invoices" that legally do
// not exist — the customer pays, the log says invoiced, and nothing real was
// born. A diff or a deploy gate cannot catch this, because the live `.env` is
// edited by hand (the POS switch on 2026-09-22 did precisely that); the only
// point nothing can bypass is process boot. Hence: fail-closed at provider
// construction, on the live host, by key FINGERPRINT.
//
// The denylist stores SHA-256 fingerprints, never keys — the repo must not
// contain a working credential, and a fingerprint identifies without enabling.

import { createHash } from "node:crypto";

/**
 * Fingerprints of Agent keys that must never serve the live host.
 *
 * ⚠️ Entries land here the moment such a key enters ANY of our `.env` files —
 * compute one with: node -e 'console.log(require("crypto").createHash("sha256")
 * .update(process.argv[1]).digest("hex"))' '<key>'
 */
export const DENYLISTED_KEY_SHA256: readonly string[] = [
  // Old defunct-E.V. Számlázz.hu account (permanently test-mode; dev-only key,
  // swapped into the dev .env on 2026-09-22). Cross-checked against the live
  // key's fingerprint at freeze time: they differ.
  "80c8ef5590a1bc5ad506a2b623a6ebe106983d0a620ce0e14cd99c969e7b0807",
];

/**
 * Fingerprints of keys belonging to a TEST-MODE Számlázz.hu account — the only
 * Agent keys dev may use. Számlázz.hu binds an account to the TAX NUMBER, so the
 * second (test) account cannot be created from the public registration form; it
 * is opened from inside the live account ("Új számlázó fiókot hozok létre") and
 * switched to test mode while still empty. Its key is allowlisted here.
 *
 * ⛔ An allowlist, not a denylist, on purpose: an unknown key in dev is refused,
 * so a pasted live key cannot quietly start issuing real, NAV-reported invoices.
 */
export const TEST_ACCOUNT_KEY_SHA256: readonly string[] = [
  // "TESZT OLASZ Ferenc (OV)" — our own permanently test-mode account (the
  // dashboard shows the TESZTÜZEM badge). Its invoices carry the TST- prefix and
  // a "minta" watermark, never reach NAV, and unlike the public demo account
  // they show OUR OWN seller data — so dev sees exactly what a buyer would get.
  "38a29c639cc212d5803e6bbce7abeddb1fe07a6fb92dae27a2a059121a09bace",
];

export const keyFingerprint = (key: string): string =>
  createHash("sha256").update(key).digest("hex");

/** The single definition of "this process serves paying customers". */
export const isLiveHost = (publicBaseUrl: string): boolean =>
  /(^|\/\/|\.)citoviso\.com(\/|$)/i.test(publicBaseUrl);

/**
 * Throws when a denylisted key would serve the live host. Pure on purpose —
 * the checker script feeds it synthetic lists to prove BOTH verdicts (a guard
 * that cannot go red guards nothing).
 */
export function assertInvoiceKeyAllowed(opts: {
  agentKey: string;
  publicBaseUrl: string;
  denylist?: readonly string[];
  /** SZAMLAZZ_DEMO=1 — the public demo account, which cannot issue a legal invoice. */
  demo?: boolean;
  allowlist?: readonly string[];
}): void {
  const list = opts.denylist ?? DENYLISTED_KEY_SHA256;
  const allow = opts.allowlist ?? TEST_ACCOUNT_KEY_SHA256;
  if (!isLiveHost(opts.publicBaseUrl)) {
    // Dev may reach the real endpoint on exactly two proven-harmless routes:
    // the public demo account, or a key belonging to OUR test-mode account.
    if (opts.demo) return;
    if (opts.agentKey && allow.includes(keyFingerprint(opts.agentKey))) return;
    // ⛔⛔ THE OTHER DIRECTION, AND TODAY THE SHARPER ONE (2026-09-22, evening).
    // We no longer have ANY test-mode Számlázz.hu account: the live account left
    // test mode so production can issue real invoices, and a second test account
    // is refused by Számlázz.hu ("Ennek a vállalkozásnak már van számlázási
    // fiókja" — the tax number binds the account, not the e-mail). Meanwhile the
    // working Agent key still sits in the dev .env. That means a single edited
    // env line — or one script that sets INVOICE_PROVIDER inline — would make a
    // DEV run issue a REAL, NAV-reported invoice under the owner's company, from
    // a machine where ~25 parallel threads run automated payment tests.
    // There is no legitimate reason for dev to reach the real invoicing API
    // anymore, so the answer is structural, not disciplinary: off the live host,
    // the szamlazz provider simply cannot be constructed.
    throw new Error(
      "⛔ SZÁMLÁZÁS LETILTVA DEV KÖRNYEZETBEN: ismeretlen Számla Agent kulccsal a " +
        "dev VALÓDI, NAV-hoz beküldött számlát állítana ki. Dev-ben három út van:\n" +
        "  · INVOICE_PROVIDER=mock — a napi fejlesztéshez (nincs hálózati hívás);\n" +
        "  · SZAMLAZZ_DEMO=1 — a nyilvános demo fiók: VALÓDI teszt-PDF, TST- " +
        "sorszámmal, NAV nélkül (⛔ csak szintetikus adattal, a fiók nyilvános!);\n" +
        "  · a SAJÁT teszt-módú fiókunk kulcsa — az ujjlenyomatát fel kell venni a " +
        "TEST_ACCOUNT_KEY_SHA256 listára (a fiókot az ÉLES fiókba belépve kell " +
        "létrehozni: Új számlázó fiókot hozok létre, majd Tesztüzem bekapcsolása).\n" +
        "(src/invoicing/keyGuard.ts — 2026-09-22)",
    );
  }
  if (!opts.agentKey) return; // a missing key fails later, loudly, on its own
  if (list.includes(keyFingerprint(opts.agentKey))) {
    throw new Error(
      "⛔ SZÁMLÁZÁS LEÁLLÍTVA: a beállított SZAMLAZZ_AGENT_KEY egy TILTÓLISTÁS " +
        "(teszt-módú, régi fiókhoz tartozó) kulcs, és ez a folyamat az ÉLES hostot " +
        "szolgálja ki. Teszt-módú kulccsal az éles rendszer jogilag nem létező " +
        "számlákat állítana ki fizető vevőknek. Cseréld az éles fiók kulcsára " +
        "(src/invoicing/keyGuard.ts — tulajdonosi döntés, 2026-09-22).",
    );
  }
}
