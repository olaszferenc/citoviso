// SMS QUIET HOURS — the ONE definition of the night window for every operator alert SMS
// (ADR-0379; owner 2026-10-13: "Éjjel nagyon jönnek az SMS-ek."). The house alert
// (houseAlert.ts) and every other operator alert (operatorSms.ts) read it from here; the
// morning digest (houseAlert.flushNightSmsDigest) reads the 'night' rows written here.
// Kept free of the SMS adapter import, so houseAlert keeps loading the adapter lazily.

import { db } from "../db/client.js";
import { budapestMinutes } from "../text/budapestTime.js";

/** Quiet hours start (Budapest, inclusive): 22:00 — a phone that buzzes after this wakes
 *  the owner, and nothing an alert asks for is done by a person in the night anyway. */
export const SMS_QUIET_FROM_HOUR = 22;
/** Quiet hours end (Budapest, exclusive): 07:00 — the digest goes with the first hourly
 *  tick from here on, when the owner is up and can act on it. */
export const SMS_QUIET_TO_HOUR = 7;

/** Is `now` inside the alert-SMS quiet hours (Budapest wall clock, whatever the server's zone)? */
export function smsQuietHours(now: Date): boolean {
  const m = budapestMinutes(now);
  return m >= SMS_QUIET_FROM_HOUR * 60 || m < SMS_QUIET_TO_HOUR * 60;
}

/** Record an alert SMS the quiet hours held back; the morning digest reads these rows. */
export async function holdForNight(tag: string, key: string, subject: string): Promise<void> {
  await db.insertInto("house_alert_sms").values({ tag, dedupe_key: key, status: "night", subject }).execute();
}

/** The digest line of an operator SMS: its first sentence, without a trailing link. */
export function operatorSmsSubject(text: string): string {
  const first = text.replace(/\s+https?:\/\/\S+/g, "").split(/(?<=[.!])\s/)[0] ?? text;
  return first.length > 120 ? `${first.slice(0, 117)}...` : first;
}
