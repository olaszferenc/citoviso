// OPERATOR SMS — the ONE road every operator alert SMS takes to the alert phone (ADR-XXXX).
//
// Owner 2026-10-13: "Éjjel nagyon jönnek az SMS-ek." — no alert SMS between
// SMS_QUIET_FROM_HOUR and SMS_QUIET_TO_HOUR (Budapest wall clock; the live VPS runs in UTC,
// the process clock would shift the window by 1–2 h). The house alert (ADR-0376) got the
// quiet hours first; the other operator alerts — AAM threshold, stuck order, undelivered
// upsell, broken mobile pair, trial watch, .hu confirmation link, module-dependency clash,
// stuck multilang generation — each called sendSms() on its own, so each would have needed
// its own copy of the window. They call sendOperatorSms() instead.
//
// At night the SMS is NOT sent: a 'night' row goes into house_alert_sms (migration 0109)
// with a short subject, and the morning digest (houseAlert.flushNightSmsDigest, from the
// hourly offer-followup tick) carries it with the house alerts in ONE SMS. The e-mail of
// every alert is untouched — it goes at any hour.
//
// A held SMS counts as DELIVERED for the caller (provider "night"): the alert is in the
// digest, and a caller that released its claim on "not sent" would re-alert every hour
// all night, a fresh mail each time.
//
// The window applies to the REAL channels only (gammu on the dev box, queue on prod). With
// SMS_PROVIDER=mock (every gate) nothing reaches a phone, and a gate committed at 23:00 must
// see the same SMS it sees at noon.

import { config } from "../config.js";
import { sendSms, type SmsMessage, type SmsSendResult } from "../sms/sender.js";
import { holdForNight, operatorSmsSubject, smsQuietHours, SMS_QUIET_FROM_HOUR, SMS_QUIET_TO_HOUR } from "./smsQuietHours.js";

export interface OperatorSmsDeps {
  now(): Date;
  /** Whether the SMS channel reaches a real phone (not the mock adapter). */
  realChannel(): boolean;
  send(msg: SmsMessage): Promise<SmsSendResult | { readonly id: string; readonly provider: string }>;
}

const realDeps: OperatorSmsDeps = {
  now: () => new Date(),
  realChannel: () => config.smsProvider !== "mock",
  send: (msg) => sendSms(msg),
};
let deps: OperatorSmsDeps = realDeps;

/** Test seam: swap the clock / channel / sender; `null` restores the real ones. */
export function setOperatorSmsDeps(d: OperatorSmsDeps | null): void {
  deps = d ?? realDeps;
}

/**
 * Send an operator alert SMS — or, in the quiet hours on a real channel, hold it for the
 * morning digest. `tag` names the alert family in the ledger (aam, pay-link, trial-watch…).
 */
export async function sendOperatorSms(
  msg: SmsMessage & { readonly tag: string },
): Promise<{ readonly id: string; readonly provider: string }> {
  if (deps.realChannel() && smsQuietHours(deps.now())) {
    const subject = operatorSmsSubject(msg.text);
    try {
      await holdForNight(msg.tag, msg.tag, subject);
    } catch (e) {
      // The mail still carries the alert; only the digest line is lost. Never text at night.
      console.error(`[operator-sms:${msg.tag}] az éjjeli visszatartás naplózása elbukott (${subject}):`, e);
    }
    console.log(
      `[operator-sms:${msg.tag}] SMS éjjelre visszatartva (${SMS_QUIET_FROM_HOUR}–${SMS_QUIET_TO_HOUR} csendes óra) — ` +
        `reggel összesítő SMS: ${subject}`,
    );
    return { id: `night-${msg.tag}`, provider: "night" };
  }
  return deps.send({ to: msg.to, text: msg.text });
}
