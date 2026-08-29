// ADR-0083 — the MMS+SMS PAIR: the cold mobile outreach as ONE unit in two acts.
// ① MMS: the mock's hero image (the wow, no ask — §A framing is baked into the
//   ribbon on the image itself). ② companion SMS right after: live link + legal
//   basis + sender + opt-out (the legal mandatories the MMS cannot carry).
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

import { db } from "../db/client.js";
import { renderPairSmsDraft } from "./draft.js";
import { checkOutreachSms } from "./outreachCheck.js";
import { ensureHeroShot } from "./heroShot.js";
import { mobileOutreachGates } from "./sendOutreachSms.js";
import { sendSms } from "../sms/sender.js";
import { ensureMmsJpeg, sendMms } from "../mms/sender.js";

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

  // §C on the PAIR's companion text (the message that actually goes out).
  const pairSms = renderPairSmsDraft(d.input);
  const check = checkOutreachSms(pairSms, d.input.leadName, d.lang);
  if (check.verdict === "FLAG") {
    return { ok: false, message: `§C-kapu FLAG — nem küldhető: ${check.reasons.join(" · ")}` };
  }

  // The image must exist BEFORE we claim anything — its absence is an operator
  // problem, not a half-sent pair.
  const shot = await ensureHeroShot(artifactId);
  if (!shot) return { ok: false, message: "a mock hero-képe nem állítható elő — MMS nélkül a párnak nincs értelme" };
  const jpeg = await ensureMmsJpeg(shot);

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
  const check = checkOutreachSms(pairSms, gate.d.input.leadName, gate.d.lang);
  if (check.verdict === "FLAG") return fail(`§C-kapu FLAG az SMS-felén: ${check.reasons.join(" · ")}`);

  const result = await sendSms({ to: gate.to, text: pairSms.text });
  if (result.provider === "blocked") {
    // ADR-0083: the claim STAYS (the lead saw the image); only the SMS half retries.
    return fail("a kísérő SMS elhasalt (modem/relay hiba) — a pár claimje marad, az SMS-fele újraküldhető");
  }

  const now = new Date();
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
