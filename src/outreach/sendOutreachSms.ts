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

const no = (message: string): { readonly ok: false; readonly message: string } => ({
  ok: false,
  message,
});

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
function allowlist(): string[] {
  return config.outreachSmsAllowlist
    .split(",")
    .map((s) => normalizePhone(s.trim()))
    .filter((s): s is string => Boolean(s));
}

export function smsAllowlistBlocks(phoneE164: string): string | null {
  const allow = allowlist();
  if (!allow.length || allow.includes(phoneE164)) return null;
  return `${phoneE164} nincs a hideg-SMS engedélyezési listán (OUTREACH_SMS_ALLOWLIST) — a megosztott SIM és a hiányzó STOP-kezelés miatt valós leadre egyelőre nem megy ki; az e-mail csatorna korlátlan`;
}

/** An explicitly allowlisted number is BY DEFINITION the owner's test phone —
 *  recipient-protecting gates (sending window) do not apply to it. An empty
 *  list means unrestricted REAL outreach, so no exemption there. */
function isAllowlistedTestNumber(phoneE164: string): boolean {
  const allow = allowlist();
  return allow.length > 0 && allow.includes(phoneE164);
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

/** What the shared gate chain yields when every check passed. */
export interface MobileGatePass {
  readonly ok: true;
  readonly d: NonNullable<Awaited<ReturnType<typeof buildDraftForProspect>>>;
  readonly to: string;
  readonly artifactId: string;
}
export type MobileGateResult = MobileGatePass | { readonly ok: false; readonly message: string };

/**
 * The gate chain SHARED by every cold mobile send (standalone SMS and the
 * ADR-0083 MMS+SMS pair): opt-out → curator sign-off → language completeness →
 * §A artifact verdicts → phone extract/normalize → person-level suppression →
 * allowlist → sending window. The channel one-shot and the §C text check stay
 * with the caller (they differ per channel). One function ON PURPOSE — ADR-0082
 * proved that "the same gates" enforced by memory drifts within a day.
 */
export async function mobileOutreachGates(prospectId: string): Promise<MobileGateResult> {
  const p = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select([
      "prospect.id as id",
      "prospect.unsubscribed_at as unsubscribedAt",
      "prospect.mock_artifact_id as artifactId",
      "lead.name as leadName",
    ])
    .where("prospect.id", "=", prospectId)
    .executeTakeFirst();

  if (!p) return no("nincs ilyen prospect");
  if (p.unsubscribedAt) return no("a címzett leiratkozott — küldés tilos");

  // CURATOR SIGN-OFF gate — the message carries the tracked mock link (or its very
  // image), so an un-reviewed mock must not be pushed onto a phone.
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
        `a(z) ${d.lang} nyelvi csomagból ${pack.missing} string hiányzik — rossz nyelvű üzenet helyett NEM küldünk (ADR-0070)`,
      );
    }
  }

  // §A assert on the ARTIFACT's stored guard verdicts — a generation-time FLAGged
  // mock must not go out on any channel (mirrors the mail path).
  const art = await db
    .selectFrom("mock_artifact")
    .select("inputs")
    .where("id", "=", p.artifactId)
    .executeTakeFirst();
  const inputs = (art?.inputs ?? {}) as Record<string, unknown>;
  // "flag" = guard violation; "error" = the fact verifier itself failed → truthfulness
  // UNKNOWN, treated as blocking (mirrors the mail path). Missing key still passes.
  const guardBlocked = (["designVerdict", "demoFraming", "factVerdict"] as const)
    .map((k) => ({ k, v: inputs[k] }))
    .filter(({ v }) => v === "flag" || v === "error");
  if (guardBlocked.length) {
    return no(
      `§A: az artifact őr-verdiktje blokkol (${guardBlocked.map(({ k, v }) => `${k}=${v}`).join(", ")}) — ` +
        `FLAG: kurátor-rendezésig nem küldhető; error: a tényhűség nem ellenőrizhető, generáld újra`,
    );
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

  // Sending window — a cold message at night is a complaint, not a lead. It
  // protects the RECIPIENT, so the owner's allowlisted test number is exempt.
  const hour = new Date().getHours();
  if (
    !isAllowlistedTestNumber(to) &&
    (hour < SEND_WINDOW.fromHour || hour >= SEND_WINDOW.toHour)
  ) {
    return no(
      `hideg mobil-megkeresés csak ${SEND_WINDOW.fromHour}:00–${SEND_WINDOW.toHour}:00 között megy ki (most ${hour}:00 van) — a levél-csatorna éjjel is használható`,
    );
  }

  return { ok: true, d, to, artifactId: p.artifactId };
}

/**
 * Send ONE prospect's STANDALONE outreach SMS through the full gate. Since
 * ADR-0083 the console no longer offers this (the MMS+SMS pair replaced it —
 * a bare link from an unknown number is a phishing signature); the path stays
 * for CLI/backcompat and as the tested base of the pair's SMS half.
 */
export async function sendOutreachSms(prospectId: string): Promise<SmsSendReport> {
  const gate = await mobileOutreachGates(prospectId);
  if (!gate.ok) return gate;
  const { d, to } = gate;

  // Channel one-shot (ADR-0082): the SMS stamp gates the SMS channel only.
  const prior = await db
    .selectFrom("prospect")
    .select("sms_sent_at")
    .where("id", "=", prospectId)
    .executeTakeFirst();
  if (prior?.sms_sent_at) return no("ennek a prospectnek már kiment az SMS (nincs újraküldés)");

  // §C gate on the TEXT THAT ACTUALLY GOES OUT (not the mail body — that was the
  // structural hole: the SMS never met a verifier).
  const check = checkOutreachSms(d.sms, d.input.leadName, d.lang);
  if (check.verdict === "FLAG") {
    return no(`§C-kapu FLAG — nem küldhető: ${check.reasons.join(" · ")}`);
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
