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
}): void {
  const list = opts.denylist ?? DENYLISTED_KEY_SHA256;
  if (!isLiveHost(opts.publicBaseUrl)) return;
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
