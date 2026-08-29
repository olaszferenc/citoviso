// Outreach SMS channel — REAL transport (ADR-0082). Until 2026-08-29 the console
// button was an ADR-0030 placeholder: it transmitted nothing yet stamped the
// prospect as sent, which (through the shared sent_at) also closed the e-mail
// channel forever. Owner decree: wire it to the GSM modem that already exists
// (src/sms/sender.ts — the dunning ladder has been driving it since ADR-0080 ⑦).
//
// The gate order mirrors sendOutreachMail deliberately: opt-out → channel
// one-shot → curator sign-off → language completeness → §A artifact verdicts →
// §C verdict ON THE SMS TEXT → phone-level suppression → sending window →
// atomic claim → send. A cold SMS is the same legal act as a cold mail
// (Grt./GDPR), so it gets the same gates, not fewer.
//
// ⚠️ The first version of this file CLAIMED that and did not deliver it: four
// gates present on the mail path were missing here (person-level suppression,
// the artifact's stored guard verdicts, a verifier on the outgoing text, and the
// legal-basis line in the message). The jog/provenance-őr caught it before the
// first real send — see ADR-0082. Whatever is added to the mail gate belongs
// here too; the two paths are compared in that ADR, not by memory.
//
// KNOWN, ACCEPTED RESIDUAL RISK (owner decision, pilot): the SIM is shared with
// Mineral, so the recipient sees an unfamiliar number and cannot reply "STOP" to
// a handled inbox — the opt-out route is the link. Revisit with a dedicated
// number + inbound handling before volume outreach.

import { buildDraftForProspect } from "./draft.js";
import { checkOutreachSms } from "./outreachCheck.js";
import { db } from "../db/client.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { ensureLanguagePack } from "../i18n/packs.js";
import { normalizePhone, sendSms } from "../sms/sender.js";
import { config } from "../config.js";

export interface SmsSendReport {
  readonly ok: boolean;
  /** Operator-facing notice for the console banner (already human-readable). */
  readonly message: string;
}

const no = (message: string): SmsSendReport => ({ ok: false, message });

/** Local hours in which a cold SMS may go out. A marketing SMS at 23:00 lands on a
 *  private phone and turns a lead into a complaint; the mail has no such problem,
 *  so this gate exists only on this channel (jog/provenance-őr finding). */
const SEND_WINDOW = { fromHour: 8, toHour: 20 } as const;

/**
 * ALLOWLIST (owner decision 2026-08-29): the path is fully live, but while the SIM
 * is shared with Mineral and no "STOP" reply is processed, a cold SMS may only reach
 * the numbers the owner listed (his own, for end-to-end testing). Empty list = no
 * restriction. Returns the operator-facing reason, or null when the number may be
 * texted — the DRAFT SURFACE calls it too, so a blocked number is stated before the
 * click rather than after it (the same lesson as the channel stamps).
 */
export function smsAllowlistBlocks(phoneE164: string): string | null {
  const allow = config.outreachSmsAllowlist
    .split(",")
    .map((s) => normalizePhone(s.trim()))
    .filter((s): s is string => Boolean(s));
  if (!allow.length || allow.includes(phoneE164)) return null;
  return `${phoneE164} nincs a hideg-SMS engedélyezési listán (OUTREACH_SMS_ALLOWLIST) — a megosztott SIM és a hiányzó STOP-kezelés miatt valós leadre egyelőre nem megy ki; az e-mail csatorna korlátlan`;
}

/**
 * PERSON-level opt-out for the SMS channel — the mirror of isEmailSuppressed().
 * The opt-out belongs to the PERSON, not to the tracking token: a re-generated
 * mock creates a NEW prospect row with a NULL unsubscribed_at, so keying only on
 * the current row would re-text someone who already said stop. The phone lives on
 * lead.raw.phone (no prospect column), so we compare NORMALISED numbers — the raw
 * strings differ by spacing/prefix ("06 30 …" vs "+3630…") and a string equality
 * would silently miss the match.
 */
export async function isPhoneSuppressed(phoneE164: string): Promise<boolean> {
  const rows = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select(["lead.raw as raw"])
    .where("prospect.unsubscribed_at", "is not", null)
    .execute();
  for (const r of rows) {
    const raw = (r.raw ?? {}) as { phone?: string };
    if (raw.phone && normalizePhone(raw.phone) === phoneE164) return true;
  }
  return false;
}

/**
 * Send ONE prospect's outreach SMS through the full gate. Safe to call for any
 * prospect id — every precondition is re-checked here, so the console button and
 * any future CLI share one guarded path.
 */
export async function sendOutreachSms(prospectId: string): Promise<SmsSendReport> {
  const p = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select([
      "prospect.id as id",
      "prospect.sms_sent_at as smsSentAt",
      "prospect.unsubscribed_at as unsubscribedAt",
      "prospect.mock_artifact_id as artifactId",
      "lead.name as leadName",
    ])
    .where("prospect.id", "=", prospectId)
    .executeTakeFirst();

  if (!p) return no("nincs ilyen prospect");
  if (p.unsubscribedAt) return no("a címzett leiratkozott — küldés tilos");
  // Channel one-shot (ADR-0082): the SMS stamp gates the SMS channel only.
  if (p.smsSentAt) return no("ennek a prospectnek már kiment az SMS (nincs újraküldés)");

  // CURATOR SIGN-OFF gate — the SMS carries the same tracked mock link as the mail,
  // so an un-reviewed mock must not be pushed onto a phone either.
  if (!p.artifactId) return no("nincs mock-artifact — nincs mit kurátornak jóváhagynia");
  const artStatus = await db
    .selectFrom("mock_artifact")
    .select("status")
    .where("id", "=", p.artifactId)
    .executeTakeFirst();
  if (artStatus?.status !== "approved") {
    return no(
      `a mock kurátori jóváhagyásra vár (artifact: '${artStatus?.status ?? "ismeretlen"}') — küldés csak 'approved' után`,
    );
  }

  const d = await buildDraftForProspect(prospectId);
  if (!d) return no("a piszkozat nem állítható elő");

  // ADR-0070 §3 — LANGUAGE gate: a half-translated cold message reads as a scam.
  if (d.lang !== DEFAULT_LANG) {
    const pack = await ensureLanguagePack(d.lang);
    if (pack.missing > 0) {
      return no(
        `a(z) ${d.lang} nyelvi csomagból ${pack.missing} string hiányzik — rossz nyelvű SMS helyett NEM küldünk (ADR-0070)`,
      );
    }
  }

  // §A assert on the ARTIFACT's stored guard verdicts — the SMS pushes the SAME mock
  // link onto a phone, so a generation-time FLAGged mock must not go out here either
  // (this block existed only on the mail path until 2026-08-29).
  const art = await db
    .selectFrom("mock_artifact")
    .select("inputs")
    .where("id", "=", p.artifactId)
    .executeTakeFirst();
  const inputs = (art?.inputs ?? {}) as Record<string, unknown>;
  const flagged = (["designVerdict", "demoFraming", "factVerdict"] as const).filter(
    (k) => inputs[k] === "flag",
  );
  if (flagged.length) {
    return no(
      `§A: az artifact generáláskori őr-verdiktje FLAG (${flagged.join(", ")}) — kurátor-rendezésig nem küldhető`,
    );
  }

  // §C gate on the TEXT THAT ACTUALLY GOES OUT (not the mail body — that was the
  // structural hole: the SMS never met a verifier).
  const check = checkOutreachSms(d.sms, d.input.leadName, d.lang);
  if (check.verdict === "FLAG") {
    return no(`§C-kapu FLAG — nem küldhető: ${check.reasons.join(" · ")}`);
  }

  const to = d.phone ? normalizePhone(d.phone) : null;
  if (!to) {
    return no(
      d.phone
        ? `érvénytelen telefonszám a leaden: "${d.phone}"`
        : "nincs telefonszám a leaden — add meg a lead Begyűjtött adatok paneljén",
    );
  }

  // PERSON-level opt-out (mirror of the mail's address-level suppression).
  if (await isPhoneSuppressed(to)) {
    return no("erre a telefonszámra korábban leiratkoztak (szám-szintű suppression) — küldés tilos");
  }

  const blocked = smsAllowlistBlocks(to);
  if (blocked) return no(blocked);

  // Sending window — a cold SMS at night is a complaint, not a lead.
  const hour = new Date().getHours();
  if (hour < SEND_WINDOW.fromHour || hour >= SEND_WINDOW.toHour) {
    return no(
      `hideg SMS csak ${SEND_WINDOW.fromHour}:00–${SEND_WINDOW.toHour}:00 között megy ki (most ${hour}:00 van) — a levél-csatorna éjjel is használható`,
    );
  }

  // Atomic CLAIM before the send: stamp sms_sent_at only if still NULL, so a double
  // click (or a concurrent run) can never put the same cold SMS on a phone twice.
  const now = new Date();
  const claimed = await db
    .updateTable("prospect")
    .set({ sms_sent_at: now })
    .where("id", "=", prospectId)
    .where("sms_sent_at", "is", null)
    .executeTakeFirst();
  if (!claimed.numUpdatedRows) return no("párhuzamos küldés claimelte a prospectet");

  const result = await sendSms({ to, text: d.sms.text });
  if (result.provider === "blocked") {
    // Transport failed → release the claim so the operator can retry. Nothing else
    // was touched yet (first-touch stamp and status advance happen only on success).
    await db
      .updateTable("prospect")
      .set({ sms_sent_at: null })
      .where("id", "=", prospectId)
      .execute();
    return no("az SMS küldése nem sikerült (modem/relay hiba) — a szerver-log mondja meg, miért; újra próbálható");
  }

  // First-touch stamp (H1 funnel base) — only if no channel got there first (ADR-0082).
  await db
    .updateTable("prospect")
    .set({ sent_at: now })
    .where("id", "=", prospectId)
    .where("sent_at", "is", null)
    .execute();
  await db
    .updateTable("prospect")
    .set({ status: "sent" })
    .where("id", "=", prospectId)
    .where("status", "=", "created")
    .execute();

  return {
    ok: true,
    message:
      result.provider === "mock"
        ? `SMS a lokális outbox-sms/ mappába írva (SMS_PROVIDER=mock) — valódi üzenet NEM ment ki. Címzett: ${to}`
        : `SMS kiküldve — ${to} (${result.provider})`,
  };
}
