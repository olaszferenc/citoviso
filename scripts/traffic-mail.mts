// Havi forgalmi levél futtató (ADR-0108) — a citoviso-traffic-mail.timer indítja.
//
// Naponta fut, de tenantonként havonta EGYSZER küld: az idempotenciát a tenant_message
// napló adja, nem a futtatás gyakorisága. Így egy kihagyott nap (leállás, hiba) nem
// veszít levelet, és egy újraindítás nem küld duplát.
//
//   npx tsx scripts/traffic-mail.mts            # éles kiküldés
//   npx tsx scripts/traffic-mail.mts --dry-run  # csak megmutatja, kinek menne

import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { sendMonthlyTrafficMails, trafficMailEligible, trafficPeriodLabel, TRAFFIC_WINDOW_DAYS } from "../src/analytics/trafficMail.js";
import { getTrafficReport } from "../src/analytics/trafficReport.js";

const dry = process.argv.includes("--dry-run");

if (dry) {
  const tenants = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select([
      "site.tenant_id as tenantId",
      "tenant.display_name as name",
      sql<Date | null>`coalesce(site.live_at, site.provisioned_at)`.as("liveSince"),
    ])
    .where("site.status", "=", "live")
    .execute();
  console.log(`[traffic-mail] DRY-RUN — ${tenants.length} élő tenant`);
  const now = new Date();
  for (const t of tenants) {
    const liveSince = t.liveSince ? new Date(t.liveSince) : null;
    if (!trafficMailEligible(liveSince, now)) {
      console.log(`  · kihagyva (még fiatal)  ${t.name ?? t.tenantId}`);
      continue;
    }
    const r = await getTrafficReport(t.tenantId, TRAFFIC_WINDOW_DAYS);
    console.log(
      `  ${r.isEmpty ? "· kihagyva (üres)" : "→ menne"}  ${t.name ?? t.tenantId}` +
        (r.isEmpty ? "" : `  ${r.visitors} vendég · ${r.contacts} megkeresés · ${trafficPeriodLabel(liveSince, now, "hu")}`),
    );
  }
} else {
  const r = await sendMonthlyTrafficMails();
  console.log(
    `[traffic-mail] kiküldve: ${r.sent} · üres hónap: ${r.skippedEmpty} · ` +
      `már ment: ${r.skippedAlready} · még fiatal: ${r.skippedYoung} · hiba: ${r.failed}`,
  );
}
await db.destroy();
