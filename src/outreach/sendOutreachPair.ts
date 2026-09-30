// ADR-0083 — the MMS+SMS PAIR: the cold mobile outreach as ONE unit in two acts.
// ① MMS: the mock's hero image (the wow, no ask — §A framing is baked into the
//   ribbon on the image itself). ② companion SMS right after: the LIVE LINK.
//
// ⚠️ Since ADR-0112 the SMS text itself no longer prints the legal basis, the
// sender identity or the opt-out — the owner's wording is an invitation, and
// those mandatories live one click away, in the footer of the linked preview
// page (console/prospectNotice.ts). So the chain is: MMS → SMS → LINK → legal.
// Two consequences this file must keep honest:
//   · the SMS half is not "the polite closing act" any more, it is the ONLY
//     thing that carries the way out — a broken pair leaves the recipient with
//     an advertising image and no opt-out at all, so it must stay LOUD;
//   · nothing here may send the MMS half without a gated SMS half queued.
//
// Bookkeeping (0043): mms_sent_at = the pair's CLAIM (stamped when the MMSC
// accepted the image — the lead SAW it, no re-MMS ever). sms_sent_at = the
// closing act. A stamped MMS with a NULL SMS is a BROKEN pair: loud to the
// operator, and only the SMS half may be retried.
//
// The real send is ~60–90 s (2G upload, exclusive modem) — far beyond a request
// cycle, so the console starts the pair as an in-process background job and the
// draft page polls the job registry. Single-process console; a restart mid-job
// loses only the progress DISPLAY — the DB stamps stay truthful.
//
// ADR-0282 — MMS_PROVIDER=queue (prod, no modem): the MMS half is only ENQUEUED
// into mms_outbox; the Debian-box relay sends it, and its ACK stamps mms_sent_at
// and starts the SMS half (src/mms/relayQueue.ts). So in queue mode nothing is
// claimed here — the one-pending-MMS-per-prospect index is the double-click
// guard — and the timeline reads the queue row (pairJobState), because the ack
// happens in the PUBLIC process, where this registry does not reach.

import { db } from "../db/client.js";
import { draftOfferPercent, renderPairSmsDraft } from "./draft.js";
import { stampOutreachOffer } from "../payment/offers.js";
import { checkOutreachSms } from "./outreachCheck.js";
import { ensureHeroShot } from "./heroShot.js";
import { mobileOutreachGates, pairWindowBlocks } from "./sendOutreachSms.js";
import { sendSms } from "../sms/sender.js";
import { ensureMmsJpeg, sendMms } from "../mms/sender.js";
import { config } from "../config.js";

export interface PairJobState {
  /** mms = uploading to the modem; sms = companion text; done/failed = terminal. */
  readonly phase: "mms" | "sms" | "done" | "failed";
  readonly startedAt: string;
  readonly error?: string;
  readonly mmsMessageId?: string;
}

/** In-process job registry — the draft page reads it to render the timeline. */
const jobs = new Map<string, PairJobState>();

export function getPairJob(prospectId: string): PairJobState | null {
  return jobs.get(prospectId) ?? null;
}

/**
 * The timeline's state. With the queue provider the newest mms_outbox row is the
 * truth (the relay's ack lands in another process); otherwise the in-process job.
 */
export async function pairJobState(prospectId: string): Promise<PairJobState | null> {
  if (config.mmsProvider !== "queue") return getPairJob(prospectId);
  const row = await db
    .selectFrom("mms_outbox")
    .innerJoin("prospect", "prospect.id", "mms_outbox.prospect_id")
    .select([
      "mms_outbox.status as status",
      "mms_outbox.last_error as lastError",
      "mms_outbox.message_id as messageId",
      "mms_outbox.created_at as createdAt",
      "prospect.sms_sent_at as smsSentAt",
    ])
    .where("mms_outbox.prospect_id", "=", prospectId)
    .orderBy("mms_outbox.created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!row) return getPairJob(prospectId);
  const startedAt = new Date(row.createdAt as unknown as string).toISOString();
  const messageId = row.messageId ?? undefined;
  if (row.status === "queued" || row.status === "sending") return { phase: "mms", startedAt };
  if (row.status === "sent") {
    // The SMS half is started by the ack; a missing sms_sent_at is the broken
    // pair the page already renders from the stamps (retry the SMS half only).
    return { phase: row.smsSentAt ? "done" : "failed", startedAt, mmsMessageId: messageId };
  }
  if (row.status === "unknown") {
    return {
      phase: "failed",
      startedAt,
      error: "az MMS kimenete ISMERETLEN (a relay nem nyugtázta) — automatikusan nem küldjük újra; a ház riasztást kapott",
    };
  }
  return {
    phase: "failed",
    startedAt,
    error: `MMS-hiba (relay): ${row.lastError ?? "ismeretlen"} — semmi nem ment ki, a pár újraindítható`,
  };
}

/** ASCII-only MMS subject (WSP text-string; the CLI transliterates, we pre-empt). */
function asciiSubject(leadName: string): string {
  const flat = leadName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "");
  return `Citoviso latvanyterv - ${flat}`.slice(0, 40).trim();
}

/**
 * Start the pair as a background job. Returns immediately: either an error the
 * operator must fix first (gates), or ok=true meaning "watch the timeline".
 * Every gate re-runs here — the button is a convenience, not an authority.
 */
export async function startOutreachPair(
  prospectId: string,
): Promise<{ ok: boolean; message: string }> {
  if (jobs.get(prospectId)?.phase === "mms" || jobs.get(prospectId)?.phase === "sms") {
    return { ok: false, message: "ennek a prospectnek már fut a páros küldése" };
  }

  const gate = await mobileOutreachGates(prospectId);
  if (!gate.ok) return { ok: false, message: gate.message };
  const { d, to, artifactId } = gate;

  // ADR-0112 PREVENTION: the owner ruled that the automatic repair never runs at
  // night, so a pair started minutes before the window closes could strand the
  // recipient with an image and no opt-out until morning. The MMS claim is
  // irreversible — the only real defence is not to start.
  const windowBlock = pairWindowBlocks(to);
  if (windowBlock) return { ok: false, message: windowBlock };

  // Pair one-shot (0043): a stamped MMS means the lead saw the image — never again.
  const prior = await db
    .selectFrom("prospect")
    .select(["mms_sent_at", "sms_sent_at"])
    .where("id", "=", prospectId)
    .executeTakeFirst();
  if (prior?.mms_sent_at && prior.sms_sent_at) {
    return { ok: false, message: "a mobil-páros már kiment (nincs újraküldés)" };
  }
  if (prior?.mms_sent_at) {
    return { ok: false, message: "az MMS már kint van — a megszakadt pár SMS-fele küldhető újra, nem az egész" };
  }
  const queueMode = config.mmsProvider === "queue";
  if (queueMode) {
    // A pending row = the pair is already on its way; an 'unknown' one may have
    // reached the lead — a human decides that, not a second click.
    const open = await db
      .selectFrom("mms_outbox")
      .select("status")
      .where("prospect_id", "=", prospectId)
      .where("status", "in", ["queued", "sending", "unknown"])
      .executeTakeFirst();
    if (open?.status === "unknown") {
      return { ok: false, message: "az előző MMS kimenete ismeretlen (a relay nem nyugtázta) — előbb nézd meg a relay naplóját" };
    }
    if (open) return { ok: false, message: "ennél a prospectnél már sorban áll az MMS — a dev gép relay-e küldi" };
  }

  // §C on the PAIR's companion text (the message that actually goes out).
  const pairSms = renderPairSmsDraft(d.input);
  const check = checkOutreachSms(pairSms, d.input.leadName, d.lang, d.market);
  if (check.verdict === "FLAG") {
    return { ok: false, message: `Jogszerűségi kapu FLAG — nem küldhető: ${check.reasons.join(" · ")}` };
  }

  // The image must exist BEFORE we claim anything — its absence is an operator
  // problem, not a half-sent pair.
  const shot = await ensureHeroShot(artifactId);
  if (!shot) return { ok: false, message: "a mock hero-képe nem állítható elő — MMS nélkül a párnak nincs értelme" };
  const jpeg = await ensureMmsJpeg(shot);

  if (queueMode) {
    // Enqueue only; the relay's ack claims (mms_sent_at) and starts the SMS half.
    const mms = await sendMms({ to, imagePath: jpeg, subject: asciiSubject(d.input.leadName), prospectId });
    if (!mms.ok) return { ok: false, message: `MMS-hiba: ${mms.error ?? "ismeretlen"} — semmi nem ment ki` };
    jobs.set(prospectId, { phase: "mms", startedAt: new Date().toISOString() });
    return { ok: true, message: "az MMS sorba került — a dev gép relay-e küldi (~1–3 perc), utána megy a kísérő SMS" };
  }

  // Atomic CLAIM: stamp mms_sent_at only if still NULL — a double click loses here.
  const now = new Date();
  const claimed = await db
    .updateTable("prospect")
    .set({ mms_sent_at: now })
    .where("id", "=", prospectId)
    .where("mms_sent_at", "is", null)
    .executeTakeFirst();
  if (!claimed.numUpdatedRows) return { ok: false, message: "párhuzamos küldés claimelte a prospectet" };

  jobs.set(prospectId, { phase: "mms", startedAt: now.toISOString() });

  // Background act — the request returns, the timeline follows the job.
  void (async () => {
    const mms = await sendMms({ to, imagePath: jpeg, subject: asciiSubject(d.input.leadName) });
    if (!mms.ok) {
      // MMS transport failed → NOTHING reached the lead: release the claim so the
      // operator can retry the whole pair, and be loud about why.
      await db.updateTable("prospect").set({ mms_sent_at: null }).where("id", "=", prospectId).execute();
      jobs.set(prospectId, {
        phase: "failed",
        startedAt: now.toISOString(),
        error: `MMS-hiba: ${mms.error ?? "ismeretlen"} — semmi nem ment ki, a pár újraindítható`,
      });
      return;
    }
    jobs.set(prospectId, { phase: "sms", startedAt: now.toISOString(), mmsMessageId: mms.messageId });
    await sendPairSmsHalf(prospectId, now);
  })();

  return { ok: true, message: "a páros küldése elindult — az idővonal mutatja, hol tart" };
}

/**
 * The SMS half — used by the pair job AND by the operator's retry button on a
 * broken pair. Stamps sms_sent_at + the first-touch/status only on success.
 */
export async function sendPairSmsHalf(
  prospectId: string,
  pairStartedAt?: Date,
): Promise<{ ok: boolean; message: string }> {
  const startedIso = (pairStartedAt ?? new Date()).toISOString();
  const fail = (message: string): { ok: false; message: string } => {
    jobs.set(prospectId, {
      phase: "failed",
      startedAt: startedIso,
      mmsMessageId: jobs.get(prospectId)?.mmsMessageId,
      error: message,
    });
    return { ok: false, message };
  };

  // Retry path re-checks the pair's shape: MMS must be out, SMS must not be.
  const prior = await db
    .selectFrom("prospect")
    .select(["mms_sent_at", "sms_sent_at"])
    .where("id", "=", prospectId)
    .executeTakeFirst();
  if (!prior?.mms_sent_at) return { ok: false, message: "nincs kint MMS — nincs minek az SMS-felét küldeni" };
  if (prior.sms_sent_at) return { ok: false, message: "az SMS-fele már kiment — a pár teljes" };

  // Gates re-run on retry too (opt-out may have arrived since the MMS went out!).
  const gate = await mobileOutreachGates(prospectId);
  if (!gate.ok) return fail(`SMS-fele blokkolva: ${gate.message}`);
  const pairSms = renderPairSmsDraft(gate.d.input);
  const check = checkOutreachSms(pairSms, gate.d.input.leadName, gate.d.lang, gate.d.market);
  if (check.verdict === "FLAG") return fail(`Jogszerűségi kapu FLAG az SMS-felén: ${check.reasons.join(" · ")}`);

  const result = await sendSms({ to: gate.to, text: pairSms.text });
  if (result.provider === "blocked") {
    // ADR-0083: the claim STAYS (the lead saw the image); only the SMS half retries.
    return fail("a kísérő SMS elhasalt (modem/relay hiba) — a pár claimje marad, az SMS-fele újraküldhető");
  }

  const now = new Date();
  // ADR-0286: the intro percent binds from the first message on.
  await stampOutreachOffer(prospectId, draftOfferPercent(gate.d.input));
  await db
    .updateTable("prospect")
    .set({ sms_sent_at: now })
    .where("id", "=", prospectId)
    .where("sms_sent_at", "is", null)
    .execute();
  // First-touch stamp (H1 funnel base) — only if no channel got there first.
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

  jobs.set(prospectId, {
    phase: "done",
    startedAt: startedIso,
    mmsMessageId: jobs.get(prospectId)?.mmsMessageId,
  });
  return { ok: true, message: "a pár teljes — MMS + SMS kint" };
}
