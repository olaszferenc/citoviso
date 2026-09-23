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
import { assessMockPhotos, photoAcksOf, photoGateBlocks } from "./mockPhotoHealth.js";
import {
  ackCoversVerdicts,
  blockingVerdicts,
  verdictAckOf,
  verdictReasonLine,
} from "./mockVerdictGate.js";
import { buildOutreachEmail } from "../email/outreachEmail.js";
import { getEmailSender } from "../email/sender.js";
import { sql } from "kysely";
import { normalizeEmail } from "../email/address.js";
import { db } from "../db/client.js";
import { huArticleLower } from "../hu.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { ensureLanguagePack, missingPackStrings } from "../i18n/packs.js";
import { config } from "../config.js";
import { planCountStill } from "./planSet.js";

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

/**
 * MELYIK kapu adta a leletet.
 *
 * ⛔⛔ MÉRT HAZUGSÁG (2026-09-19, tulajdonosi bejelentés): a piszkozat-lap piros sávja
 * „a jogszerűségi kapu tiltja (az okok lent)"-et írt — miközben ugyanazon a képernyőn a
 * §C-jelvény ZÖLD PASS volt, és az „okok" sem voltak lent (a §C nem talált semmit). A
 * valódi visszatartó a DIZÁJN-ŐR leletének megerősítése volt. A `flagged` kimenet eddig
 * nem mondta meg, melyik kapuból jött, ezért a képernyő egy ártatlan kaput nevezett meg,
 * és elhallgatta az egyetlen dolgot, ami számít: hogy a kurátor egy kattintással kiküldheti.
 */
export type FlagGate =
  /** §C — jogszerűség (GDPR/Grt.): ez TILT, ezen a kurátor sem léphet át. */
  | "legal"
  /** ADR-0134/0150 — a kiszállított lap kép-egészsége: kurátori tudomásulvétellel átléphető. */
  | "photo"
  /** ADR-0126 — generáláskori őr-lelet: FIGYELMEZTET, a küldés-gomb felugrója kiküldi. */
  | "verdict";

export type SendOutcome =
  | { readonly kind: "sent"; readonly emailId: string; readonly provider: string }
  | { readonly kind: "dry-run"; readonly subject: string }
  | {
      readonly kind: "flagged";
      readonly reasons: readonly string[];
      readonly gate: FlagGate;
      /**
       * ⭐ A KURÁTOR EGY KATTINTÁSSAL KIKÜLDHETI (tulajdonosi rendelet, 2026-09-19).
       * True = a lelet FIGYELMEZTET: a küldés gomb felugrója megmutatja, és a megerősítés
       * kiküldi. False = nincs mit kiküldeni (nincs renderelt lap, vagy a link MÁS mock
       * tartalmát vinné a leadhez), vagy a JOG tiltja (§C) — ezeken a kurátor sem léphet át,
       * mert itt nem a rendszer bírálja felül a döntését, hanem a termék hiányzik mögüle.
       */
      readonly confirmable: boolean;
    }
  | { readonly kind: "skipped"; readonly reason: string };

export interface SendReport {
  readonly prospectId: string;
  readonly leadName: string;
  readonly to: string;
  readonly outcome: SendOutcome;
}

export interface MailSendability {
  /** True only if the send path would REALLY proceed right now, with ONE click. */
  readonly sendable: boolean;
  /**
   * Why not, in the send path's OWN words — never a second copy of the rule.
   * Null when a gate is the blocker (its reasons are in `reasons`) or when sendable.
   */
  readonly reason: string | null;
  /**
   * The §C LEGAL gate is what blocks. ⛔ ONLY §C — this used to be true for EVERY
   * `flagged` outcome, so the screen accused the legal gate of a design-guard finding
   * while its own badge showed „Jogszerűségi kapu: PASS" right above.
   */
  readonly gateBlocked: boolean;
  /**
   * ⭐ NEM TILTÁS, HANEM KÉRDÉS (tulajdonosi rendelet, 2026-09-19: „megtiltom, hogy a
   * rendszer felülbírálja a kurátori döntést"). True = a lelet figyelmeztet, és a küldés
   * gomb felugrója a kurátor megerősítésére KIKÜLDI. A képernyő ezt nem nevezheti
   * „nem küldhető"-nek: az a mondat a kurátort a saját döntésétől tiltja el.
   */
  readonly needsConfirm: boolean;
  /** Which gate spoke — the screen must name THIS one, never another. */
  readonly gate: FlagGate | null;
  /** The gate's OWN sentences, so the screen never has to say „az okok lent" in vain. */
  readonly reasons: readonly string[];
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
  const none = { needsConfirm: false, gate: null, reasons: [] as readonly string[] };
  switch (r.outcome.kind) {
    case "dry-run":
      return { sendable: true, reason: null, gateBlocked: false, ...none };
    case "flagged":
      return {
        sendable: false,
        reason: null,
        // ⛔ ONLY the legal gate may be called a block (see MailSendability.gateBlocked).
        gateBlocked: r.outcome.gate === "legal",
        // A guard finding is a WARNING with a second click behind it — the send route
        // (heldForSendConfirm) pops the dialog and sends on confirmation.
        needsConfirm: r.outcome.confirmable,
        gate: r.outcome.gate,
        reasons: r.outcome.reasons,
      };
    case "skipped":
      return { sendable: false, reason: r.outcome.reason, gateBlocked: false, ...none };
    case "sent":
      // Unreachable with dryRun — and if it ever happens, the screen must not call it
      // sendable: a probe that SENT is a defect, not a green light.
      return { sendable: false, reason: "a próba tévedésből küldött — ez hiba, jelezd", gateBlocked: false, ...none };
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
    return { ...base, outcome: { kind: "flagged", reasons: check.reasons, gate: "legal", confirmable: false } };
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
    const acks = photoAcksOf(art?.inputs);
    if (health.verdict === "unknown") {
      return {
        ...base,
        outcome: {
          kind: "flagged",
          reasons: [
            `A kiszállított mock képei nem ellenőrizhetők (${health.note ?? "ismeretlen ok"}) — ellenőrizetlen lap nem mehet ki`,
          ],
          gate: "photo",
          // ⛔ Itt nincs mit vállalni: nincs renderelt lap, a lead linkje üres oldalra vinne.
          // Ez nem a kurátor döntésének felülbírálása — a termék hiányzik. Újragenerálás.
          confirmable: false,
        },
      };
    }
    // ⛔⛔ KÉP NÉLKÜLI LAP (ADR-0150): az indok NEM a törött kép — a lapon EGYETLEN
    // fotó sincs. A törött-kép mondat itt hamis lenne („0 kép forrása nem érhető el"),
    // ezért saját indoklást kap, ami megnevezi a KÖVETKEZMÉNYT és a kiutat.
    if (health.verdict === "nophoto" && photoGateBlocks(health, acks)) {
      return {
        ...base,
        outcome: {
          kind: "flagged",
          reasons: [
            "A kiszállított lapon EGYETLEN szállás-fotó sincs — a lead kép nélküli oldalt kapna, " +
              "miközben a megkeresés lényege épp a látvány. Kurátori döntés kell: „Adatok újragyűjtése” " +
              "a lead lapján és új mock, vagy nyomd meg újra a küldés gombot: a felugróban vállalhatod a kép nélküli kiküldést.",
          ],
          gate: "photo",
          confirmable: true,
        },
      };
    }
    if (photoGateBlocks(health, acks)) {
      return {
        ...base,
        outcome: {
          kind: "flagged",
          reasons: [
            `${health.broken.length} kép forrása nem érhető el a kiszállított lapon — a lead törött képeket kapna. ` +
              (acks.broken
                ? "A kurátor korábbi tudomásulvétele NEM fedi a mostani törést (új kép esett ki a jóváhagyás óta)."
                : "Kiút: nyomd meg újra a küldés gombot — a felugróban vállalhatod, és kimegy. Vagy generálj újat friss adattal."),
            ...health.broken.slice(0, 6).map((b) => `${b.url} — ${b.reason}`),
          ],
          gate: "photo",
          confirmable: true,
        },
      };
    }
  }


  // §A assert on the ARTIFACT's stored guard verdicts (guard-agent finding,
  // 2026-08-01): a generation-time FLAGged mock must not be pushed into a
  // mailbox (its hero image would arrive without any click). Missing keys are
  // fine (the deterministic engine path stores only designVerdict); an explicit
  // "flag" on any stored verdict blocks the send.
  //
  // ⛔⛔ THIS GATE USED TO SIT BELOW THE dryRun RETURN (measured 2026-09-17), which made
  // the screen answer a DIFFERENT question than the button: `describeMailSendability`
  // probes with dryRun, so it turned back BEFORE this check and could report „most
  // kiküldhető — a küldő-út minden kapuja zöld" on a mock this gate would then refuse.
  // The operator learned it from the rejection banner AFTER clicking — exactly the
  // failure the probe was built to prevent. A read-only gate must run in the probe too;
  // only the SENDING itself belongs below the dryRun line.
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
    //
    // ⛔⛔ TWO THINGS THIS GATE USED TO GET WRONG (measured 2026-09-16 on the Myrna Haus
    // outreach, where a curator-APPROVED mock could not be sent): it named the KEY
    // ("FLAG (designVerdict)") instead of the FINDING, and it offered no way out at all
    // — "kurátor-rendezésig nem küldhető" pointed at an operation that did not exist.
    // The reason is now printed, and an explicit, REASONED, logged curator override
    // clears it (the photo gate's rule, reused): the ack covers only THIS finding.
    const blocking = blockingVerdicts(inputs);
    const ack = verdictAckOf(inputs);
    if (blocking.length && !ackCoversVerdicts(ack, blocking)) {
      const stale = ack ? " (a korábbi kurátori vállalás NEM fedi a mostani leletet)" : "";
      return {
        ...base,
        outcome: {
          kind: "flagged",
          reasons: [
            ...blocking.map(verdictReasonLine),
            // ⛔ A KIÚT A KÜLDÉS-GOMB MAGA (tulajdonosi rendelet, 2026-09-17): a lelet
            // figyelmeztet, nem tilt — a küldés felugróval kérdez, és a második,
            // kimondott kattintás kiküldi. ⚠️ Ez a mondat egy kört még a JÓVÁHAGYÁSRA
            // irányított (az előző terv maradéka): egy kiút-mondat, ami nem létező utat
            // ajánl, ugyanolyan zsákutca, mint a „kurátor-rendezésig" volt.
            `Kiút${stale}: nyomd meg újra a küldés gombot — a felugróban látod a leletet, és a megerősítéssel kimegy. Vagy generálj új mockot.`,
          ],
          gate: "verdict",
          confirmable: true,
        },
      };
    }
  }

  if (opts.dryRun) {
    return { ...base, outcome: { kind: "dry-run", subject: d.draft.subject } };
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
    // The letter was written for N plans — the link must still carry N at the claim
    // (plan-tabs; jog/provenance-őr FLAG 2026-09-23). Locks the row; the variant editor
    // takes the same lock, so after this claim the plan set cannot change.
    if (!(await planCountStill(trx, prospectId, d.input.planCount))) {
      return { won: false, reason: "plans" as const };
    }
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
            : claimed.reason === "plans"
              ? "a link tervei a levél megírása óta változtak — a következő futás a friss tervszámmal írja meg"
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
