// ADR-XXXX — the AUTHORITATIVE availability answer of the tenant-admin „Webcím" tab.
//
// The old answer (domains.ts::checkAvailability, DNS + RDAP) could never say "free":
// rdap.org does not serve `.hu`, so every free Hungarian name read "nem tudjuk előre"
// — measured 2026-09-27: lidowellness.hu / lidowellness.com both "unknown" there, both
// "free" at the registrar. The registrar's own validate call is read-only and answers
// what the buyer actually asks: can this name be bought right now?
//
// Source, in order:
//   1) DOMAIN_AVAILABILITY_SOURCE=mock → the mock registrar's rule (gates, offline):
//      a label containing "taken" is taken, everything else free;
//   2) Websupport credentials present → the registrar's validate (independent of
//      REGISTRAR_PROVIDER: asking is free even while the PURCHASE runs on the mock);
//   3) neither → the DNS/RDAP layer, which may prove "taken" but never "free" —
//      without an authoritative source we do not claim a name is buyable (§B.17).
//
// Four verdicts, and the screen keeps them apart: "free" is orderable; "taken" is
// what the registrar calls taken; "unavailable" is any other refusal (unsupported
// ending…) — not "foglalt"; "unknown" = we could not ask (outage) → not orderable
// until a retry says otherwise.

import { config } from "../config.js";
import { checkAvailability as dnsRdapAvailability } from "../domains.js";
import { WebsupportRegistrar } from "./registrar/websupport.js";

export type WebcimAvailability = "free" | "taken" | "unavailable" | "unknown";

/** A registrar that does not answer in this long is an outage, not a verdict. */
const TIMEOUT_MS = 6000;

let oracle: WebsupportRegistrar | null = null;
function registrarOracle(): WebsupportRegistrar | null {
  const ws = config.domains.websupport;
  if (!ws.apiKey || !ws.apiSecret || !ws.userId) return null;
  oracle ??= new WebsupportRegistrar({
    apiKey: ws.apiKey,
    apiSecret: ws.apiSecret,
    userId: ws.userId,
    expectedRegistrant: ws.expectedRegistrant,
    hufPerEur: config.domains.hufPerEur,
  });
  return oracle;
}

export async function checkWebcimAvailability(domain: string): Promise<WebcimAvailability> {
  if ((process.env.DOMAIN_AVAILABILITY_SOURCE ?? "").toLowerCase() === "mock") {
    return /taken/i.test(domain) ? "taken" : "free";
  }
  const ws = registrarOracle();
  if (!ws) {
    const pre = await dnsRdapAvailability(domain);
    return pre === "taken" ? "taken" : "unknown";
  }
  try {
    return await Promise.race([
      ws.availability(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`időtúllépés (${TIMEOUT_MS} ms)`)), TIMEOUT_MS),
      ),
    ]);
  } catch (e) {
    console.warn(`[domain] elérhetőség nem ellenőrizhető (${domain}): ${(e as Error).message}`);
    return "unknown";
  }
}
