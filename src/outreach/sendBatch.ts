// Outreach send pipeline (PILOT.md §7d ② — B szelet). Turns the §C-gated
// draft surface into an actual sender: eligible prospects → draft → §C gate →
// e-mail (EmailSender adapter: mock/outbox locally, SMTP once creds exist) →
// created→sent funnel edge. The gate is IN the pipe — a FLAGged draft is
// skipped and reported, never sent (§C: judge, don't fix).
//
// Volume discipline: cold-mail deliverability needs low, paced sends (fresh
// sending domain). Default cap + inter-send delay are deliberately conservative;
// the operator raises them consciously per run, not by default.

import { buildDraftForProspect } from "./draft.js";
import { checkOutreachDraft } from "./outreachCheck.js";
import { ensureHeroShot } from "./heroShot.js";
import { buildOutreachEmail } from "../email/outreachEmail.js";
import { getEmailSender } from "../email/sender.js";
import { db } from "../db/client.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { ensureLanguagePack } from "../i18n/packs.js";
import { config } from "../config.js";

export interface SendableProspect {
  readonly id: string;
  readonly leadName: string;
  readonly contactEmail: string;
  readonly segment: string | null;
}

/**
 * ADDRESS-level suppression (§C, Grt. opt-out): true if this e-mail address
 * ever unsubscribed on ANY prospect row. The opt-out belongs to the PERSON,
 * not to the tracking token — a re-generated mock (new prospect row) for the
 * same recipient must never re-mail them. Guard-agent finding, 2026-08-01.
 */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const hit = await db
    .selectFrom("prospect")
    .select("id")
    .where("contact_email", "=", email)
    .where("unsubscribed_at", "is not", null)
    .limit(1)
    .executeTakeFirst();
  return Boolean(hit);
}

/**
 * Prospects eligible for a cold send: the E-MAIL channel is still unused
 * (email_sent_at IS NULL, ADR-0082), they have a recipient address, and have not
 * unsubscribed — checked at ADDRESS level (no prospect row with the same e-mail
 * may carry an opt-out).
 *
 * Status filter: 'created' (untouched) OR 'sent' (contacted on the OTHER channel,
 * e.g. SMS — the mail is still a first e-mail, not a re-send). Anything further
 * (opened/engaged/converted) means the lead already reacted; a BULK cold mail is
 * the wrong instrument there, so the batch leaves it to the operator's per-prospect
 * button, which applies the same channel guard.
 */
export async function listSendableProspects(): Promise<SendableProspect[]> {
  const rows = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    // Curator sign-off gate (owner rule, 2026-08-06): only prospects whose mock artifact a human
    // curator has APPROVED are sendable. The inner join drops prospects with no artifact, and the
    // status filter drops un-reviewed ('generated') / 'rejected' mocks → no blind auto-send.
    .innerJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
    .select([
      "prospect.id as id",
      "lead.name as leadName",
      "prospect.contact_email as contactEmail",
      "prospect.segment as segment",
    ])
    .where("prospect.status", "in", ["created", "sent"])
    .where("prospect.email_sent_at", "is", null)
    .where("mock_artifact.status", "=", "approved")
    .where("prospect.contact_email", "is not", null)
    .where("prospect.unsubscribed_at", "is", null)
    .where(({ not, exists, selectFrom, ref }) =>
      not(
        exists(
          selectFrom("prospect as unsub")
            .select("unsub.id")
            .whereRef("unsub.contact_email", "=", ref("prospect.contact_email"))
            .where("unsub.unsubscribed_at", "is not", null),
        ),
      ),
    )
    .orderBy("prospect.created_at", "asc")
    .execute();
  return rows.filter((r): r is SendableProspect => Boolean(r.contactEmail));
}

export type SendOutcome =
  | { readonly kind: "sent"; readonly emailId: string; readonly provider: string }
  | { readonly kind: "dry-run"; readonly subject: string }
  | { readonly kind: "flagged"; readonly reasons: readonly string[] }
  | { readonly kind: "skipped"; readonly reason: string };

export interface SendReport {
  readonly prospectId: string;
  readonly leadName: string;
  readonly to: string;
  readonly outcome: SendOutcome;
}

/**
 * Send ONE prospect's outreach mail through the full gate. Safe to call for
 * any prospect id — every precondition is re-checked here (not only in the
 * batch query), so the console button and the CLI share one guarded path.
 */
export async function sendOutreachMail(
  prospectId: string,
  opts: { dryRun?: boolean } = {},
): Promise<SendReport> {
  const p = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select([
      "prospect.id as id",
      "prospect.status as status",
      "prospect.email_sent_at as emailSentAt",
      "prospect.contact_email as contactEmail",
      "prospect.unsubscribed_at as unsubscribedAt",
      "prospect.mock_artifact_id as artifactId",
      "lead.name as leadName",
    ])
    .where("prospect.id", "=", prospectId)
    .executeTakeFirst();

  const base = { prospectId, leadName: p?.leadName ?? "?", to: p?.contactEmail ?? "?" };
  if (!p) return { ...base, outcome: { kind: "skipped", reason: "nincs ilyen prospect" } };
  if (p.unsubscribedAt) {
    return { ...base, outcome: { kind: "skipped", reason: "leiratkozott — küldés tilos" } };
  }
  // Re-send guard keys on WHETHER THE MAIL WAS SENT (email_sent_at), not the view-status: an
  // operator can legitimately send the initial outreach even if the prospect already
  // 'opened'/'engaged' by viewing the /p link (e.g. the operator tested it) — as long as no
  // mail actually went out yet. A stamped email_sent_at means it was mailed → no re-send.
  // ⚠️ ADR-0082: this is the E-MAIL channel's own stamp, NOT the shared sent_at. Keying it on
  // sent_at made an SMS (or any first touch) close the mail channel forever — measured
  // 2026-08-29 with a placeholder SMS that transmitted nothing yet burned the prospect.
  if (p.emailSentAt) {
    return { ...base, outcome: { kind: "skipped", reason: "ennek a prospectnek már kiküldtük az E-MAILT (nincs újraküldés)" } };
  }
  if (!p.contactEmail) {
    return { ...base, outcome: { kind: "skipped", reason: "nincs contact_email a prospecten" } };
  }

  // ADDRESS-level suppression: an opt-out on ANY row with this e-mail wins.
  if (await isEmailSuppressed(p.contactEmail)) {
    return {
      ...base,
      outcome: { kind: "skipped", reason: "a címzett korábban leiratkozott (cím-szintű suppression) — küldés tilos" },
    };
  }

  // CURATOR SIGN-OFF gate (owner rule, 2026-08-06): a mock may be mailed ONLY after a HUMAN
  // curator approved its artifact (mock_artifact.status === 'approved', set via curateArtifact).
  // No blind auto-send — an un-reviewed ('generated') or 'rejected' mock is never sent, and a
  // prospect with no artifact has nothing to approve → not sendable. Belt-and-braces with the
  // per-verdict FLAG check below (an approved artifact should carry no FLAG, but we still assert).
  if (!p.artifactId) {
    return { ...base, outcome: { kind: "skipped", reason: "nincs mock-artifact — nincs mit kurátornak jóváhagynia" } };
  }
  const artStatus = await db
    .selectFrom("mock_artifact")
    .select("status")
    .where("id", "=", p.artifactId)
    .executeTakeFirst();
  if (artStatus?.status !== "approved") {
    return {
      ...base,
      outcome: { kind: "skipped", reason: `a mock kurátori jóváhagyásra vár (artifact: '${artStatus?.status ?? "ismeretlen"}') — küldés csak 'approved' után` },
    };
  }

  const d = await buildDraftForProspect(prospectId);
  if (!d) return { ...base, outcome: { kind: "skipped", reason: "a piszkozat nem állítható elő" } };

  // ADR-0070 §3 — LANGUAGE gate: for a non-Hungarian lead the draft must have a
  // COMPLETE pack behind it. A missing translation falls back to Hungarian per
  // string (tSync), which a green pipeline would happily send — and a half-Polish,
  // half-Hungarian cold mail reads as a scam. Not sending beats sending wrong.
  if (d.lang !== DEFAULT_LANG) {
    const pack = await ensureLanguagePack(d.lang);
    if (pack.missing > 0) {
      return {
        ...base,
        outcome: {
          kind: "skipped",
          reason: `a(z) ${d.lang} nyelvi csomagból ${pack.missing} string hiányzik — rossz nyelvű levél helyett NEM küldünk (ADR-0070)`,
        },
      };
    }
  }

  // §C gate — a FLAGged draft must not be sent, ever.
  const check = checkOutreachDraft(d.draft, d.input.leadName, d.lang);
  if (check.verdict === "FLAG") {
    return { ...base, outcome: { kind: "flagged", reasons: check.reasons } };
  }

  if (opts.dryRun) {
    return { ...base, outcome: { kind: "dry-run", subject: d.draft.subject } };
  }

  // §A assert on the ARTIFACT's stored guard verdicts (guard-agent finding,
  // 2026-08-01): a generation-time FLAGged mock must not be pushed into a
  // mailbox (its hero image would arrive without any click). Missing keys are
  // fine (the deterministic engine path stores only designVerdict); an explicit
  // "flag" on any stored verdict blocks the send.
  if (p.artifactId) {
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
      return {
        ...base,
        outcome: {
          kind: "flagged",
          reasons: flagged.map((k) => `§A: az artifact generáláskori őr-verdiktje FLAG (${k}) — kurátor-rendezésig nem küldhető`),
        },
      };
    }
  }

  // Hero shot of the mock's opening screen (best-effort — its absence must never
  // block a §C-PASS send; the mail is valid text+link without it).
  const heroShotPath = p.artifactId ? await ensureHeroShot(p.artifactId) : null;
  // ADR-0067: the draft prose is already in the lead's language (draft.ts) —
  // declare it on the message too, and localize the image alt text.
  const msg = buildOutreachEmail(d.draft, p.contactEmail, { heroShotPath, lang: d.lang });
  // Belt-and-braces: refuse to hand anything UNSUBSCRIBABLE to the raw adapter.
  // What the law requires (Grt./GDPR) is a working opt-out the recipient can act
  // on — that is the IN-BODY link, which §C.1 separately checks for presence and
  // reachability. The List-Unsubscribe header is an extra convenience, and since
  // it is what banishes the mail to Gmail's "Frissítések" tab (ADR-0069), it is
  // now switchable; this gate therefore measures the opt-out itself, not the
  // header that happens to carry it.
  if (!msg.text.includes(d.draft.unsubscribeLink)) {
    return {
      ...base,
      outcome: {
        kind: "skipped",
        reason: "hiányzó leiratkozó-link a levél szövegében — hideg levél nem mehet ki nélküle",
      },
    };
  }
  if (config.outreachListUnsubscribe && !msg.headers?.["List-Unsubscribe"]) {
    return {
      ...base,
      outcome: {
        kind: "skipped",
        reason: "OUTREACH_LIST_UNSUBSCRIBE=on, de a fejléc nem került rá a levélre",
      },
    };
  }

  // Atomic CLAIM before the send: stamp email_sent_at only if still NULL, so a concurrent
  // batch/console click loses the row here and the prospect can never be mailed twice.
  const now = new Date();
  const claimed = await db
    .updateTable("prospect")
    .set({ email_sent_at: now })
    .where("id", "=", prospectId)
    .where("email_sent_at", "is", null)
    .executeTakeFirst();
  if (!claimed.numUpdatedRows) {
    return { ...base, outcome: { kind: "skipped", reason: "párhuzamos küldés claimelte a prospectet" } };
  }
  // First-touch stamp (H1 funnel base) — only if no channel got there first (ADR-0082).
  await db
    .updateTable("prospect")
    .set({ sent_at: now })
    .where("id", "=", prospectId)
    .where("sent_at", "is", null)
    .execute();
  // Advance the funnel to 'sent' ONLY if the prospect hasn't already moved further
  // (opened/engaged from viewing the link) — never regress the furthest stage.
  await db
    .updateTable("prospect")
    .set({ status: "sent" })
    .where("id", "=", prospectId)
    .where("status", "=", "created")
    .execute();

  try {
    const result = await getEmailSender().send(msg);
    return { ...base, outcome: { kind: "sent", emailId: result.id, provider: result.provider } };
  } catch (e) {
    // Send failed after the claim → best-effort revert so a later run retries: clear the
    // e-mail channel stamp, and only un-advance status if WE moved it to 'sent' (never touch a
    // further stage the buyer reached by viewing the link).
    await db
      .updateTable("prospect")
      .set({ email_sent_at: null })
      .where("id", "=", prospectId)
      .execute();
    // The first-touch stamp is only ours to clear if no OTHER channel reached the
    // prospect (ADR-0082) — an SMS that did go out must keep its funnel base.
    await db
      .updateTable("prospect")
      .set({ sent_at: null })
      .where("id", "=", prospectId)
      .where("sms_sent_at", "is", null)
      .execute();
    await db
      .updateTable("prospect")
      .set({ status: "created" })
      .where("id", "=", prospectId)
      .where("status", "=", "sent")
      .where("sms_sent_at", "is", null)
      .execute();
    throw e;
  }
}

export interface BatchOptions {
  /** Max mails this run (default 20 — deliverability pacing on a fresh domain). */
  readonly limit?: number;
  /** Delay between sends in ms (default 5000). */
  readonly delayMs?: number;
  /** Build + gate everything but send nothing and change nothing. */
  readonly dryRun?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run the batch over all eligible prospects, paced, one guarded send at a time. */
export async function sendOutreachBatch(opts: BatchOptions = {}): Promise<SendReport[]> {
  const limit = opts.limit ?? 20;
  const delayMs = opts.delayMs ?? 5000;
  const candidates = (await listSendableProspects()).slice(0, limit);
  const reports: SendReport[] = [];
  for (const [i, c] of candidates.entries()) {
    if (i > 0 && !opts.dryRun && delayMs > 0) await sleep(delayMs);
    reports.push(await sendOutreachMail(c.id, { dryRun: opts.dryRun }));
  }
  return reports;
}
