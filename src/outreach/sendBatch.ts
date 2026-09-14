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
import { assessMockPhotos, brokenPhotoAckOf, photoGateBlocks } from "./mockPhotoHealth.js";
import { buildOutreachEmail } from "../email/outreachEmail.js";
import { getEmailSender } from "../email/sender.js";
import { sql } from "kysely";
import { normalizeEmail } from "../email/address.js";
import { db } from "../db/client.js";
import { huArticleLower } from "../hu.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { ensureLanguagePack, missingPackStrings } from "../i18n/packs.js";
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
  const key = normalizeEmail(email);
  if (!key) return false;
  const hit = await db
    .selectFrom("prospect")
    .select("id")
    // ⛔ NORMALISED comparison (2026-09-12). This used to be a raw string equality,
    // which held only because every scraper path happens to lowercase what it
    // extracts. The operator-typed address did not: `Info@Panzio.hu` entered on a
    // second tracked link would not have matched an opt-out stored as
    // `info@panzio.hu`, and we would have mailed someone who said stop. The mobile
    // channel has compared normalised values since day one (isPhoneSuppressed) —
    // this is its twin. See src/email/address.ts for what the rule does NOT fold.
    .where(sql<boolean>`lower(trim(contact_email)) = ${key}`)
    .where("unsubscribed_at", "is not", null)
    .limit(1)
    .executeTakeFirst();
  return Boolean(hit);
}

/**
 * ⛔ ADDRESS-level one-shot: has a cold mail ALREADY gone to this address, on ANY
 * prospect row? (Elek FK-004 ③.)
 *
 * The "one cold outreach per channel" promise used to be keyed on the prospect
 * RECORD (`prospect.email_sent_at` of that row), which is not what the promise
 * means: generate a second tracked link for the same lead — a new mock, a re-run,
 * an operator creating a fresh row — and the SAME PERSON receives a second cold
 * letter with the same subject. Measured 2026-09-11 on the test park: two prospect
 * rows, one address, two sendable mails.
 *
 * Normalised comparison (`normalizeEmail`): the promise is about the human being
 * written to, and `Elek@…` / `elek@…` is the same mailbox at every provider we can
 * reach. Since 2026-09-12 `isEmailSuppressed` uses the SAME rule — the opt-out and the
 * one-shot may not disagree about who the recipient is.
 */
export async function emailAlreadyMailed(email: string): Promise<boolean> {
  const key = normalizeEmail(email);
  if (!key) return false;
  const hit = await db
    .selectFrom("prospect")
    .select("id")
    .where(sql<boolean>`lower(trim(contact_email)) = ${key}`)
    .where("email_sent_at", "is not", null)
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
      "prospect.created_at as createdAt",
    ])
    .where("prospect.status", "in", ["created", "sent"])
    .where("prospect.email_sent_at", "is", null)
    .where("mock_artifact.status", "=", "approved")
    .where("prospect.contact_email", "is not", null)
    .where("prospect.unsubscribed_at", "is", null)
    // ADDRESS-level opt-out, on the NORMALISED value — same rule as isEmailSuppressed
    // below, which re-checks it per prospect. Two places may not disagree about who
    // said stop.
    .where(
      sql<boolean>`not exists (
        select 1 from prospect unsub
        where lower(trim(unsub.contact_email)) = lower(trim(prospect.contact_email))
          and unsub.unsubscribed_at is not null
      )`,
    )
    // ADDRESS-level one-shot (Elek FK-004 ③): a second prospect row pointing at an
    // address we already mailed is NOT sendable — the per-row email_sent_at above
    // only ever spoke for its own row.
    .where(
      sql<boolean>`not exists (
        select 1 from prospect mailed
        where lower(trim(mailed.contact_email)) = lower(trim(prospect.contact_email))
          and mailed.email_sent_at is not null
      )`,
    )
    // ONE ROW PER ADDRESS, the oldest (Elek FK-004 ③). Without this the batch would
    // still only send once — `sendOutreachMail` re-checks the address before the claim
    // — but the list an operator reads as "ennyi megy ki" would count the same person
    // twice, and a run would report a skip that looks like a failure. The rule and what
    // the screen says about it have to be the same rule.
    .distinctOn(sql`lower(trim(prospect.contact_email))`)
    .orderBy(sql`lower(trim(prospect.contact_email))`)
    .orderBy("prospect.created_at", "asc")
    .execute();
  return rows
    .filter((r) => Boolean(r.contactEmail))
    // distinctOn forced the address into the primary sort key — restore the queue order.
    .sort((a, b) => new Date(a.createdAt as unknown as string).getTime() - new Date(b.createdAt as unknown as string).getTime())
    .map(({ id, leadName, contactEmail, segment }) => ({
      id,
      leadName,
      contactEmail: contactEmail as string,
      segment,
    }));
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

export interface MailSendability {
  /** True only if the send path would REALLY proceed right now. */
  readonly sendable: boolean;
  /**
   * Why not, in the send path's OWN words — never a second copy of the rule.
   * Null when the §C gate is the blocker (the screen renders those reasons in full)
   * or when the mail is sendable.
   */
  readonly reason: string | null;
  /** The §C gate is what blocks — its reasons are rendered separately. */
  readonly gateBlocked: boolean;
}

/**
 * „Mehet ki most?" — answered by the SAME function the button runs (Elek FK-004 Z1/Z2).
 *
 * ⛔ WHY THIS EXISTS: the draft screen used to answer that question with the §C verdict
 * badge („PASS — küldhető"), and §C is ONE of NINE gates in sendOutreachMail. Measured
 * 2026-09-13: three ELEK prospects would have shown „küldhető" while the send path
 * refused them with „a mock kurátori jóváhagyásra vár", and the FK-004 letter kept
 * claiming „küldhető" AFTER it had already gone out (the one-shot had closed the
 * channel). A screen that re-derives the answer from the half of the state it happens
 * to hold is the same rule in two copies; this asks the predicate itself.
 *
 * Read-only: `dryRun` returns before anything is sent, `probe` keeps the language-pack
 * step from provisioning.
 */
export async function describeMailSendability(prospectId: string): Promise<MailSendability> {
  const r = await sendOutreachMail(prospectId, { dryRun: true, probe: true });
  switch (r.outcome.kind) {
    case "dry-run":
      return { sendable: true, reason: null, gateBlocked: false };
    case "flagged":
      return { sendable: false, reason: null, gateBlocked: true };
    case "skipped":
      return { sendable: false, reason: r.outcome.reason, gateBlocked: false };
    case "sent":
      // Unreachable with dryRun — and if it ever happens, the screen must not call it
      // sendable: a probe that SENT is a defect, not a green light.
      return { sendable: false, reason: "a próba tévedésből küldött — ez hiba, jelezd", gateBlocked: false };
  }
}

/**
 * Send ONE prospect's outreach mail through the full gate. Safe to call for
 * any prospect id — every precondition is re-checked here (not only in the
 * batch query), so the console button and the CLI share one guarded path.
 *
 * `probe` (Elek FK-004 Z1/Z2): run the gate sequence WITHOUT provisioning anything,
 * so a SCREEN can ask the very same question the button answers. The only difference
 * is the language-pack step — `ensureLanguagePack` would pay an AI call and write the
 * DB, which a GET render must never do; in probe mode the gap is MEASURED instead
 * (missingPackStrings), so the probe is never more permissive than the real send. Use
 * with `dryRun`, or nothing will stop it from actually sending.
 */
export async function sendOutreachMail(
  prospectId: string,
  opts: { dryRun?: boolean; probe?: boolean } = {},
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

  // ADDRESS-level one-shot: the promise is "one cold mail per address", not "per
  // prospect row" (Elek FK-004 ③). The atomic claim below enforces the same rule
  // against concurrent senders; this check exists to give a HONEST reason instead of
  // the generic "párhuzamos küldés claimelte" the race path would report.
  if (await emailAlreadyMailed(p.contactEmail)) {
    return {
      ...base,
      outcome: {
        kind: "skipped",
        reason: "erre a CÍMRE már ment hideg megkeresés (cím-szintű egy-lövés) — nincs újraküldés",
      },
    };
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
    // ⚠️ The ONE step where probe and send may differ, and it differs by DESIGN:
    // ensureLanguagePack PROVISIONS (AI call + DB write). A screen asking "would this
    // go out?" must not spend money, so it measures the gap instead. Measuring is the
    // STRICTER of the two — it reports a gap the send would have filled — so the probe
    // can never claim sendable where the send would refuse.
    const missing = opts.probe
      ? (await missingPackStrings(d.lang)).length
      : (await ensureLanguagePack(d.lang)).missing;
    if (missing > 0) {
      return {
        ...base,
        outcome: {
          kind: "skipped",
          reason: `${huArticleLower(d.lang)} ${d.lang} nyelvi csomagból ${missing} string hiányzik — rossz nyelvű levél helyett NEM küldünk`,
        },
      };
    }
  }

  // §C gate — a FLAGged draft must not be sent, ever.
  const check = checkOutreachDraft(d.draft, d.input.leadName, d.lang, d.market);
  if (check.verdict === "FLAG") {
    return { ...base, outcome: { kind: "flagged", reasons: check.reasons } };
  }

  // ⛔⛔ KÉP-EGÉSZSÉG KAPU a KISZÁLLÍTOTT lapon (ADR-0134, Elek FK-003b L01).
  // A ház alapinvariánsa: amit a leadnek MEGAJÁNLUNK, az pontosan az legyen, amit
  // kap. Eddig a törött kép NEM állította meg a küldést: a `heroShot` ugyan MEGMÉRTE
  // az első képernyő képeit, de a null visszatérését „kép nélkül megy a levél"-ként
  // nyeltük el — a LINK mögötti lap pedig 10+ üres kép-hellyel érkezett a leadhez.
  // A mérés tehát megvolt, a KÖVETKEZTETÉS hiányzott.
  //
  // ⚠️ A mérés a küldés PILLANATÁBAN fut, nem a jóváhagyáskori emlékből: a portál a
  // jóváhagyás óta letörölhetett még egy fotót (pont ez történt a hovamenjek.hu-val).
  // A kurátor tudomásulvétele csak arra a NÉVSORRA szól, amit látott.
  if (p.artifactId) {
    const health = await assessMockPhotos(p.artifactId);
    const art = await db
      .selectFrom("mock_artifact")
      .select("inputs")
      .where("id", "=", p.artifactId)
      .executeTakeFirst();
    const ack = brokenPhotoAckOf(art?.inputs);
    if (health.verdict === "unknown") {
      return {
        ...base,
        outcome: {
          kind: "flagged",
          reasons: [
            `A kiszállított mock képei nem ellenőrizhetők (${health.note ?? "ismeretlen ok"}) — ellenőrizetlen lap nem mehet ki`,
          ],
        },
      };
    }
    if (photoGateBlocks(health, ack)) {
      return {
        ...base,
        outcome: {
          kind: "flagged",
          reasons: [
            `${health.broken.length} kép forrása nem érhető el a kiszállított lapon — a lead törött képeket kapna. ` +
              (ack
                ? "A kurátor korábbi tudomásulvétele NEM fedi a mostani törést (új kép esett ki a jóváhagyás óta)."
                : "Kurátori döntés kell: generálj újat friss adattal, vagy a konzolon vedd tudomásul kifejezetten."),
            ...health.broken.slice(0, 6).map((b) => `${b.url} — ${b.reason}`),
          ],
        },
      };
    }
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
    // "flag" = a guard caught a violation; "error" = the FACT verifier itself failed, so
    // the mock's truthfulness is UNKNOWN — unverified must not auto-send any more than
    // failed (the missing guard is quieter than the bad one). A MISSING key still passes:
    // the deterministic paths legitimately never run the verifier.
    const blocked = (["designVerdict", "demoFraming", "factVerdict", "marketVerdict"] as const)
      .map((k) => ({ k, v: inputs[k] }))
      .filter(({ v }) => v === "flag" || v === "error");
    if (blocked.length) {
      return {
        ...base,
        outcome: {
          kind: "flagged",
          reasons: blocked.map(({ k, v }) =>
            v === "flag"
              ? `Kép-jog/tényhűség: az artifact generáláskori őr-verdiktje FLAG (${k}) — kurátor-rendezésig nem küldhető`
              : `Kép-jog/tényhűség: az őr nem tudta ellenőrizni az artifactot (${k}=error) — ellenőrizetlen mock nem küldhető, generáld újra vagy kurátor döntsön`,
          ),
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
  //
  // ⛔ The claim is ADDRESS-scoped, not row-scoped (Elek FK-004 ③). Two prospect rows
  // carrying the same address are two DIFFERENT rows, so the row-level `WHERE
  // email_sent_at IS NULL` lets both through and the recipient gets two letters. The
  // advisory lock serialises the check+stamp per normalised address: without it both
  // transactions read "nobody has mailed this address" under READ COMMITTED and both
  // proceed — the exact race the row-level claim was written to prevent, one level up.
  const now = new Date();
  const addressKey = normalizeEmail(p.contactEmail);
  const claimed = await db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(hashtext(${addressKey}))`.execute(trx);
    const already = await trx
      .selectFrom("prospect")
      .select("id")
      .where(sql<boolean>`lower(trim(contact_email)) = ${addressKey}`)
      .where("email_sent_at", "is not", null)
      .limit(1)
      .executeTakeFirst();
    if (already) return { won: false, reason: "address" as const };
    const r = await trx
      .updateTable("prospect")
      .set({ email_sent_at: now })
      .where("id", "=", prospectId)
      .where("email_sent_at", "is", null)
      .executeTakeFirst();
    return { won: Boolean(r.numUpdatedRows), reason: "row" as const };
  });
  if (!claimed.won) {
    return {
      ...base,
      outcome: {
        kind: "skipped",
        reason:
          claimed.reason === "address"
            ? "erre a CÍMRE közben kiment egy hideg megkeresés (cím-szintű egy-lövés) — nincs újraküldés"
            : "párhuzamos küldés claimelte a prospectet",
      },
    };
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
