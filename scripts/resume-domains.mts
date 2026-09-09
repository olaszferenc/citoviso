// Scheduled nudge for in-flight custom-domain beszerzés (ADR-0071). NS-delegation and
// Universal SSL take MINUTES, so a beszerzés parked at dns_pending/tls_pending during
// the payment webhook needs a later push to reach 'live'. A systemd timer / cron runs:
//
//   npx tsx scripts/resume-domains.mts
//
// Idempotent and safe to run on any cadence: terminal rows (live/failed) are skipped,
// and each state re-enters only its own step (no double register, no crash). With the
// mock adapters it is a no-op once everything is already live.

import { resumePendingDomainProvisionings } from "../src/domains/provisionDomain.js";
import { watchRegistryConfirmations } from "../src/domains/registryConfirmWatch.js";
import { db } from "../src/db/client.js";

const results = await resumePendingDomainProvisionings();
if (results.length === 0) {
  console.log("[domain-resume] nincs függő beszerzés.");
} else {
  for (const r of results) {
    console.log(`[domain-resume] ${r.domain} → ${r.status}`);
  }
}

// A `.hu` Nyilvántartó megerősítő levelének figyelése (tulaj-rendelet 2026-09-09).
//
// UGYANEBBEN a timerben fut, nem külön cronban: a beszerzés folytatása és a
// megerősítés ugyanannak a folyamatnak a két fele, és két, egymásról nem tudó
// ütemező előbb-utóbb elcsúszik. A postafiók-hiba SOSEM boríthatja a beszerzést,
// ezért külön try/catch — a domain-léptetés már lefutott felette.
try {
  console.log(await watchRegistryConfirmations());
} catch (e) {
  console.error(`[registry-confirm] a postafiók-figyelő hibázott: ${(e as Error).message}`);
}

await db.destroy();
