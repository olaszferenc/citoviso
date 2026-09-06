// AAM-cap SMS alert (ADR-0098, owner: "mehet az sms őr") — the dashboard chip
// only speaks when the owner looks at the console; the threshold CROSSING must
// reach him unprompted. Rides the daily billing-cycle tick.
//
// Semantics:
//   - tiers 80% and 100% of AAM_ANNUAL_LIMIT_HUF, each signalled ONCE per
//     calendar year (aam_alert stamp table = idempotency, dunning_event style);
//   - crossing 100% also fires even if 80% was already stamped (separate rows);
//   - both pending tiers fire on the same tick if revenue jumped past both;
//   - no OWNER_ALERT_PHONE → loud error, NO stamp (the missing-data branch must
//     fail visibly, not swallow the alert — and retry once the number exists).

import { config } from "../config.js";
import { db } from "../db/client.js";
import { sendSms } from "../sms/sender.js";
import { AAM_ANNUAL_LIMIT_HUF, getAamYearNet } from "./partnerData.js";

const TIERS = [80, 100] as const;

export interface AamAlertResult {
  readonly pct: number;
  /** Tiers actually sent this tick (empty = nothing new crossed). */
  readonly sent: number[];
}

/** Internal operator text — outside the §B.18 customer-facing i18n scope. */
function alertText(tier: number, pct: number, netHuf: number): string {
  const m = (netHuf / 1e6).toFixed(1).replace(".", ",");
  const limitM = (AAM_ANNUAL_LIMIT_HUF / 1e6).toFixed(0);
  return tier >= 100
    ? `Citoviso: AAM-limit ATLEPVE — ${pct}% (${m}/${limitM} M Ft). Az atlepo szamla mar teljes egeszeben afas + 15 napon belul NAV-bejelentes jar. Reszletek a konzolon.`
    : `Citoviso: AAM-limit ${pct}%-on (${m}/${limitM} M Ft). Kozeledik a 18 M Ft-os plafon — ideje a konyvelovel egyeztetni. Reszletek a konzolon.`;
}

/** One daily check: stamp-guarded SMS per crossed tier. Injected `now` keeps it
 *  testable the same way the dunning ladder is. */
export async function checkAamAlert(now: Date): Promise<AamAlertResult> {
  const { netHuf } = await getAamYearNet();
  const pct = Math.round((netHuf / AAM_ANNUAL_LIMIT_HUF) * 100);
  const year = now.getFullYear();
  const sent: number[] = [];

  for (const tier of TIERS) {
    if (pct < tier) continue;
    const stamped = await db
      .selectFrom("aam_alert")
      .select("tier")
      .where("year", "=", year)
      .where("tier", "=", tier)
      .executeTakeFirst();
    if (stamped) continue;

    if (!config.ownerAlertPhone) {
      // Loud, unstamped: the alert stays due until OWNER_ALERT_PHONE exists.
      console.error(
        `[aam-alert] AAM ${tier}% ÁTLÉPVE (${pct}%), de OWNER_ALERT_PHONE nincs beállítva — SMS NEM ment ki.`,
      );
      continue;
    }

    // Send FIRST, stamp after: a failed send throws and the stamp never lands,
    // so the next tick retries. The reverse order would swallow the alert.
    await sendSms({ to: config.ownerAlertPhone, text: alertText(tier, pct, netHuf) });
    await db
      .insertInto("aam_alert")
      .values({ year, tier })
      // Two overlapping ticks: the PK makes the second insert a no-op, and the
      // duplicate SMS is an accepted (rare, harmless) race cost.
      .onConflict((oc) => oc.columns(["year", "tier"]).doNothing())
      .execute();
    sent.push(tier);
    console.log(`[aam-alert] ${tier}% küszöb jelezve SMS-ben (${pct}%, ${netHuf} Ft).`);
  }

  return { pct, sent };
}
