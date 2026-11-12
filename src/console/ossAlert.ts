// OSS-THRESHOLD ALERT (ADR-XXXX) — the AAM alert's twin for the EU-wide 10 000 € B2C
// threshold of electronically supplied services (billing/taxCounters.ts ossStatus).
// Two tiers per calendar year: the warning (taxThresholds.warnPct, default 80 %) and the
// HOLD (threshold reached, or the sum could not be computed — every new EU-consumer sale
// is then held back by requestPayment). Each tier is signalled ONCE per year and channel
// (stamped in app_setting); with no recipient it stays loud and unstamped, like aamAlert.
// What to do is the OWNER's decision (OSS registration) — the text says so, nothing more.
import { budapestYear } from "../text/budapestTime.js";
import { getEmailSender } from "../email/sender.js";
import { sendOperatorSms } from "./operatorSms.js";
import { getAlertRecipients, getSetting, setSetting } from "./appSettings.js";
import { ossStatus } from "../billing/taxCounters.js";

export interface OssAlertResult {
  readonly pct: number;
  readonly blocked: boolean;
  readonly sent: string[];
}

/** Internal operator text — outside the §B.18 customer-facing i18n scope. */
function texts(tier: "warn" | "hold", reason: string): { sms: string; subject: string; text: string } {
  return tier === "hold"
    ? {
        sms: `Citoviso: OSS-kuszob — az EU-s maganszemely-eladasok VISSZATARTVA (${reason}). Dontes kell: OSS-regisztracio. Reszletek a konzolon.`,
        subject: "Citoviso — OSS-küszöb: az EU-s magánszemély-eladások visszatartva",
        text:
          `Az elektronikus szolgáltatás EU-s, nem magyar magánszemélyeknek eladott forgalma elérte ` +
          `a 10 000 €-s uniós küszöböt, vagy nem számolható (${reason}).\n\n` +
          `Amíg nincs döntés, az újabb ilyen eladás ZÁRTAN visszatartva (nincs fizetési link).\n` +
          `A teendő: OSS-regisztráció (a vevő országának áfája) — a döntés a tiéd.`,
      }
    : {
        sms: `Citoviso: OSS-kuszob kozeleg (${reason}). A 10 000 EUR felett az EU-s maganszemely-eladas OSS-t igenyel.`,
        subject: "Citoviso — közeleg az OSS-küszöb",
        text:
          `Az EU-s, nem magyar magánszemélyeknek eladott elektronikus szolgáltatás forgalma: ${reason}.\n\n` +
          `A 10 000 €-s küszöb elérésekor az újabb ilyen eladást a rendszer visszatartja, amíg az ` +
          `OSS-regisztrációról nincs döntés.`,
      };
}

/** One daily check (rides the billing-cycle tick next to the AAM alert). */
export async function checkOssAlert(now: Date): Promise<OssAlertResult> {
  const st = await ossStatus(now);
  const year = budapestYear(now);
  const sent: string[] = [];
  const tiers: ("warn" | "hold")[] = [...(st.warn ? ["warn" as const] : []), ...(st.blocked ? ["hold" as const] : [])];
  if (!tiers.length) return { pct: st.pct, blocked: st.blocked, sent };
  const rcpt = await getAlertRecipients();
  for (const tier of tiers) {
    if (!rcpt.phone && !rcpt.email) {
      console.error(`[oss-alert] OSS ${tier} (${st.reason}), de nincs riasztási címzett — értesítés NEM ment ki.`);
      continue;
    }
    const t = texts(tier, st.reason);
    const key = (ch: string) => `oss_alert:${year}:${tier}:${ch}`;
    if (rcpt.phone && !(await getSetting(key("sms")))) {
      await sendOperatorSms({ tag: "oss", to: rcpt.phone, text: t.sms });
      await setSetting(key("sms"), new Date().toISOString());
      sent.push(`${tier}/sms`);
    }
    if (rcpt.email && !(await getSetting(key("email")))) {
      await getEmailSender().send({ to: rcpt.email, audience: "platform", subject: t.subject, text: t.text });
      await setSetting(key("email"), new Date().toISOString());
      sent.push(`${tier}/email`);
    }
  }
  if (sent.length) console.log(`[oss-alert] jelezve: ${sent.join(", ")} (${st.reason}).`);
  return { pct: st.pct, blocked: st.blocked, sent };
}
