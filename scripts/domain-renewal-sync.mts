// Daily own-domain renewal sync (ADR-XXXX). Prod timer citoviso-domain-renewal.timer runs:
//
//   npx tsx scripts/domain-renewal-sync.mts            # read + flip the auto-renew switch
//   npx tsx scripts/domain-renewal-sync.mts --dry      # read only, nothing written anywhere
//
// For every name we hold: the registrar's real expiry and auto-renew switch go to the site
// row, the switch is put where the rule wants it (src/domains/domainRenewal.ts), and any
// problem is recorded on the row — the hourly stall watch alerts the house from it.
//
// ⛔ The switch lives in the LIVE registrar account. Off the live host this script never
// flips it (a dev database pointed at the live registrar would steer real names): it reads,
// and reports what it would do.

import { config } from "../src/config.js";
import { isLiveHost } from "../src/invoicing/keyGuard.js";
import { getRegistrar } from "../src/domains/registrar/index.js";
import type { RegistrarAdapter } from "../src/domains/registrar/registrar.js";
import { loadRenewalRows, reconcileRenewal, syncDomainRenewals } from "../src/domains/domainRenewal.js";

const dry = process.argv.includes("--dry") || process.argv.includes("-n");
const real = getRegistrar();
const mayWrite = real.name === "mock" || isLiveHost(config.publicBaseUrl);

if (dry || !mayWrite) {
  // Read-only: the same decision, with a registrar whose switch only reports.
  // reconcileRenewal() only reads the service and flips the switch — nothing else is reached.
  const readOnly = {
    name: real.name,
    getService: (d: string) => real.getService(d),
    accountCredit: () => real.accountCredit(),
    setAutoRenew: async (ref: string, on: boolean) => {
      throw new Error(`(szárazon: a(z) ${ref} kapcsolóját ${on ? "BE" : "KI"} kapcsolnám)`);
    },
  } as unknown as RegistrarAdapter;
  const now = new Date();
  for (const r of await loadRenewalRows()) {
    const o = await reconcileRenewal(r, readOnly, now);
    console.log(
      `[domain-renewal] ${o.domain}: lejár ${o.service?.expiresAt?.toISOString().slice(0, 10) ?? "?"}, ` +
        `kapcsoló ${o.service ? (o.service.autoRenew ? "BE" : "KI") : "?"}, kívánt ${o.want ? "BE" : "KI"}` +
        (o.problems.length ? ` · ${o.problems.join(" · ")}` : ""),
    );
  }
  if (!mayWrite) console.log("[domain-renewal] nem az éles gépen fut — semmit nem írtam (se a regisztrátornál, se az adatbázisban).");
  process.exit(0);
}

const outcomes = await syncDomainRenewals(real);
if (!outcomes.length) console.log("[domain-renewal] nincs saját domain a fiókban.");
for (const o of outcomes) {
  console.log(
    `[domain-renewal] ${o.domain}: lejár ${o.service?.expiresAt?.toISOString().slice(0, 10) ?? "?"}, ` +
      `kapcsoló ${o.service ? (o.service.autoRenew ? "BE" : "KI") : "?"}` +
      (o.flipped ? ` (most ${o.want ? "BE" : "KI"}kapcsolva)` : "") +
      (o.renewEnd ? `, megújítás vége ${o.renewEnd.toISOString().slice(0, 10)}` : "") +
      (o.problems.length ? ` · HIBA: ${o.problems.join(" · ")}` : ""),
  );
}
process.exit(0);
