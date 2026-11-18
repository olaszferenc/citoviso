// The COLD-OUTREACH LANE (owner, 2026-11-18): the cold letter and its follow-ups leave from a
// SEPARATE sending domain, over its own SMTP, with our own DKIM key, and every link they carry
// points at that domain. Nothing of the main domain appears in them.
//
// WHY (measured 2026-11-16..18, prod DB prospect × mock_view): 400–500 cold letters/day from the
// main domain's single Zoho mailbox put citoviso.com into Gmail's spam folder for every FRESH
// recipient — the 24-hour view rate of Gmail recipients fell from 21–39% to 0–1% within an
// afternoon, and a fresh Gmail test account got every variant in spam. The customer mail
// (login, invoices) rides on the same domain reputation. The lane keeps the two apart: the
// cold volume can only burn the cold domain.
//
// The lane is CONFIG (COLD_OUTREACH_*). Unset → everything behaves as before (SMTP_URL,
// OUTREACH_FROM, PUBLIC_BASE_URL), so dev boxes and the test suites see no change.
import { config } from "../config.js";
import { PLATFORM_DOMAIN } from "../domains.js";
import { bareAddress } from "../email/sender.js";

/** True when the lane has its own transport AND sender — the two things a send needs. */
export function coldLaneActive(): boolean {
  return Boolean(config.coldOutreach.smtpUrl && config.coldOutreach.from);
}

/**
 * The base URL every link of a cold letter is built from: the lane's own domain when
 * configured, else PUBLIC_BASE_URL (the pre-lane behaviour). No trailing slash.
 */
export function coldLinkBase(): string {
  return (config.coldOutreach.baseUrl || config.publicBaseUrl || "").trim().replace(/\/+$/, "");
}

/** The bare host of the cold link base ("getcitoviso.com"); the platform domain when unset. */
export function coldHost(): string {
  try {
    return new URL(coldLinkBase()).hostname.toLowerCase() || PLATFORM_DOMAIN;
  } catch {
    return PLATFORM_DOMAIN;
  }
}

/**
 * The address the cold letter's identity row (§C.2) and its From carry: the lane's own
 * mailbox when the lane is active — a letter from getcitoviso.com must not point the reply
 * at the main domain — else the configured outreach sender e-mail.
 */
export function coldSenderEmail(): string {
  return coldLaneActive() ? bareAddress(config.coldOutreach.from) : config.outreachSender.email;
}

/**
 * The company line of the signature when the configured value is just the PLATFORM HOST
 * ("citoviso.com" — prod has used the host as the company since 2026-08): on the cold lane
 * that line names the cold host instead, so the letter mentions one domain only.
 */
export function coldSenderCompany(): string {
  const company = (config.outreachSender.company || "").trim();
  if (coldLaneActive() && company.toLowerCase() === PLATFORM_DOMAIN) return coldHost();
  return company;
}
