// AAM-cap alert (ADR-0098/b+c, owner: "mehet az sms őr" + "lehessen beállítani
// a beállításokban") — the dashboard chip only speaks when the owner looks at
// the console; the threshold CROSSING must reach him unprompted. Rides the
// daily billing-cycle tick.
//
// Semantics:
//   - tiers 80% and 100% of AAM_ANNUAL_LIMIT_HUF, each signalled ONCE per
//     calendar year AND channel (aam_alert stamp table, dunning_event style);
//   - crossing 100% also fires even if 80% was already stamped (separate rows);
//   - channels: SMS + email, recipients from the console /settings page
//     (app_setting, env OWNER_ALERT_PHONE as phone fallback). A failed email
//     retries next tick without re-sending the SMS — per-channel stamps;
//   - NO recipient on any channel → loud error, NO stamp (the missing-data
//     branch must fail visibly and stay due until a recipient exists).

import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { sendSms } from "../sms/sender.js";
import { getAlertRecipients } from "./appSettings.js";
import { AAM_ANNUAL_LIMIT_HUF, getAamYearNet } from "./partnerData.js";

const TIERS = [80, 100] as const;
type Channel = "sms" | "email";

export interface AamAlertResult {
  readonly pct: number;
  /** "<tier>/<channel>" entries actually sent this tick. */
  readonly sent: string[];
}

/** Internal operator text — outside the §B.18 customer-facing i18n scope. */
function smsText(tier: number, pct: number, netHuf: number): string {
  const m = (netHuf / 1e6).toFixed(1).replace(".", ",");
  const limitM = (AAM_ANNUAL_LIMIT_HUF / 1e6).toFixed(0);
  return tier >= 100
    ? `Citoviso: AAM-limit ATLEPVE — ${pct}% (${m}/${limitM} M Ft). Az atlepo szamla mar teljes egeszeben afas + 15 napon belul NAV-bejelentes jar. Reszletek a konzolon.`
    : `Citoviso: AAM-limit ${pct}%-on (${m}/${limitM} M Ft). Kozeledik a plafon — ideje a konyvelovel egyeztetni. Reszletek a konzolon.`;
}

function emailParts(tier: number, pct: number, netHuf: number): { subject: string; text: string } {
  const m = (netHuf / 1e6).toFixed(1).replace(".", ",");
  const limitM = (AAM_ANNUAL_LIMIT_HUF / 1e6).toFixed(0);
  return tier >= 100
    ? {
        subject: `Citoviso — AAM-limit ÁTLÉPVE (${pct}%)`,
        text:
          `Az idei nettó árbevétel átlépte az alanyi adómentesség ${limitM} M Ft-os plafonját: ` +
          `${m} M Ft (${pct}%).\n\n` +
          `Teendő: az átlépő számla már TELJES egészében áfás, és az átlépést 15 napon belül ` +
          `be kell jelenteni a NAV-nak. Két naptári évig nincs visszaút az AAM-be.\n\n` +
          `Részletek a konzol irányítópultján és a Bizonylatok modulban.`,
      }
    : {
        subject: `Citoviso — AAM-limit ${pct}%-on`,
        text:
          `Az idei nettó árbevétel elérte az alanyi adómentesség plafonjának ${pct}%-át: ` +
          `${m} / ${limitM} M Ft.\n\n` +
          `Teendő: ideje a könyvelővel egyeztetni az ÁFA-körbe lépés forgatókönyvét ` +
          `(ADR-0098) — az átlépő számla már teljes egészében áfás lesz.\n\n` +
          `Részletek a konzol irányítópultján.`,
      };
}

async function stamped(year: number, tier: number, channel: Channel): Promise<boolean> {
  const row = await db
    .selectFrom("aam_alert")
    .select("tier")
    .where("year", "=", year)
    .where("tier", "=", tier)
    .where("channel", "=", channel)
    .executeTakeFirst();
  return row !== undefined;
}

/** Send FIRST, stamp after: a failed send throws and the stamp never lands, so
 *  the next tick retries THIS channel only. */
async function stamp(year: number, tier: number, channel: Channel): Promise<void> {
  await db
    .insertInto("aam_alert")
    .values({ year, tier, channel })
    // Two overlapping ticks: the PK makes the second insert a no-op, and the
    // duplicate send is an accepted (rare, harmless) race cost.
    .onConflict((oc) => oc.columns(["year", "tier", "channel"]).doNothing())
    .execute();
}

/** One daily check. Injected `now` keeps it testable like the dunning ladder. */
export async function checkAamAlert(now: Date): Promise<AamAlertResult> {
  const { netHuf } = await getAamYearNet();
  const pct = Math.round((netHuf / AAM_ANNUAL_LIMIT_HUF) * 100);
  const year = now.getFullYear();
  const sent: string[] = [];
  const rcpt = await getAlertRecipients();

  for (const tier of TIERS) {
    if (pct < tier) continue;

    if (!rcpt.phone && !rcpt.email) {
      // Loud, unstamped: the alert stays due until a recipient exists.
      console.error(
        `[aam-alert] AAM ${tier}% ÁTLÉPVE (${pct}%), de nincs riasztási címzett ` +
          `(konzol /settings vagy OWNER_ALERT_PHONE) — értesítés NEM ment ki.`,
      );
      continue;
    }

    if (rcpt.phone && !(await stamped(year, tier, "sms"))) {
      await sendSms({ to: rcpt.phone, text: smsText(tier, pct, netHuf) });
      await stamp(year, tier, "sms");
      sent.push(`${tier}/sms`);
    }
    if (rcpt.email && !(await stamped(year, tier, "email"))) {
      const { subject, text } = emailParts(tier, pct, netHuf);
      await getEmailSender().send({ to: rcpt.email, audience: "platform", subject, text });
      await stamp(year, tier, "email");
      sent.push(`${tier}/email`);
    }
  }

  if (sent.length) console.log(`[aam-alert] jelezve: ${sent.join(", ")} (${pct}%, ${netHuf} Ft).`);
  return { pct, sent };
}
