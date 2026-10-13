// HOUSE ALERT — the house gets a mail when a timer, a booking mail or a payment webhook
// fails (ADR-0276).
//
// Why this exists: measured on prod 2026-09-29, three failure classes were SILENT.
// The citoviso-* timers had no OnFailure=, so a crashed billing tick left nothing but a
// journal line; a booking mail that bounced (to the owner OR the guest) was a
// console.error in mailSafe; and a Barion webhook we refused (400) or crashed on (500)
// was a status code that only Barion saw. The same lesson as ADR-0129: a failure the
// house does not hear about is a failure it cannot fix — the payer waits, nobody knows.
//
// ONE channel, the one that already exists: app_setting.alert_email (getAlertRecipients),
// the address the stuck-order, AAM and held-cancellation alerts already use.
//
// ADR-0374 (owner 2026-09-30: "ha valamely külső folyamat megakad, arról jöjjön értesítés +
// SMS"): a SEVERE alert (`sms: true` — money, a buyer waiting, a dead key) also goes as an
// accent-free SMS to the same recipients' phone (console /settings, fallback
// OWNER_ALERT_PHONE). The SMS waits in the modem's queue between MMS lanes and is not
// meant for volume, so it is filtered — the e-mail never is:
//   - the same dedupe key at most once per SMS_REPEAT_HOURS;
//   - at most SMS_HOURLY_CAP alert SMS per rolling hour;
//   - what was held back is counted onto the next SMS that goes out ("+N további").
// The SMS leg runs on the LIVE host only (the dev box's SMS provider is the real modem).
// Every decision is a house_alert_sms row (migration 0108), so the filter holds across
// the console, public and timer processes. A failed alert MAIL (SMTP down or its key
// dead) falls back to one SMS under the key "mail-down", whatever the alert's severity:
// otherwise a dead mail server would silence every alert, this one included.
//
// ⛔ NO LOOP: an alert that fails is ONLY logged. alertHouse never throws and never
// alerts about itself — the booking mail guard and the webhook route call it
// fire-and-forget, and the unit-failure template carries no OnFailure= of its own.
//
// Internal operator text — outside the §B.18 customer-facing i18n scope.
//
// ADR-0279: off the live host every subject starts with "[TESZT] " — dev still SENDS
// (the owner tests with it), but a test alert must never read like a production one.
// "Live" has ONE definition: isLiveHost(config.publicBaseUrl) (src/invoicing/keyGuard.ts).

import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { getEmailSender, type EmailMessage } from "../email/sender.js";
import { isLiveHost } from "../invoicing/keyGuard.js";
import { getAlertRecipients } from "./appSettings.js";

export interface HouseAlert {
  /** Short machine tag for the log line: unit / booking-mail / webhook. */
  readonly tag: string;
  readonly subject: string;
  readonly text: string;
  /** ADR-0374: severe — also an SMS (filtered: see the header). Default: e-mail only. */
  readonly sms?: boolean;
  /** The SMS repeat-filter key; defaults to the tag (one SMS per tag per window). */
  readonly smsKey?: string;
}

/** The same SMS key goes out at most once in this many hours. */
export const SMS_REPEAT_HOURS = 6;
/** At most this many alert SMS per rolling hour (all keys together). */
export const SMS_HOURLY_CAP = 4;

/** Injectable for the guard script (scripts/house-alert-check.mts) — the real ones by default. */
export interface HouseAlertDeps {
  recipientEmail(): Promise<string | null>;
  send(msg: EmailMessage): Promise<unknown>;
  /** The base URL the live-host verdict is made from (config.publicBaseUrl by default). */
  publicBaseUrl?(): string;
  /** ADR-0374: the SMS recipient. A deps set without it (the ADR-0276 guard) sends no SMS. */
  recipientPhone?(): Promise<string | null>;
  /** ADR-0374: the SMS channel; resolves false when the message did not go out. */
  sendSms?(msg: { to: string; text: string }): Promise<boolean>;
}

const realDeps: HouseAlertDeps = {
  recipientEmail: async () => (await getAlertRecipients()).email,
  send: (msg) => getEmailSender().send(msg),
  publicBaseUrl: () => config.publicBaseUrl,
  recipientPhone: async () => (await getAlertRecipients()).phone,
  // Lazy: the SMS adapter is only loaded on the (rare) path that needs it.
  sendSms: async (msg) => {
    const { sendSms } = await import("../sms/sender.js");
    return (await sendSms(msg)).provider !== "blocked";
  },
};

/** The subject as sent: "[TESZT] " in front of it unless this process serves the live host. */
export function alertSubject(subject: string, publicBaseUrl: string): string {
  return isLiveHost(publicBaseUrl) ? subject : `[TESZT] ${subject}`;
}
let deps: HouseAlertDeps = realDeps;

/** Test seam: swap the recipient lookup + the sender; `null` restores the real ones. */
export function setHouseAlertDeps(d: HouseAlertDeps | null): void {
  deps = d ?? realDeps;
}

/** Accent-free GSM-7 text: ő/ű would force unicode SMS (70 chars per segment). */
export function asciiFold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[„”“]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e]/g, "");
}

/** The alert SMS: the subject without the "Citoviso: " prefix, folded, at most two segments. */
export function alertSmsText(subject: string, held: number): string {
  const head = subject.startsWith("[TESZT] ") ? "[TESZT] " : "";
  const core = subject.replace(/^\[TESZT\] /, "").replace(/^Citoviso:\s*/, "");
  const tail = (held > 0 ? ` (+${held} tovabbi riasztas csak e-mailben)` : "") + " Reszletek e-mailben.";
  let body = asciiFold(`${head}Citoviso RIASZTAS: ${core}.`);
  const max = 300 - tail.length;
  if (body.length > max) body = body.slice(0, max - 3) + "...";
  return body + tail;
}

/**
 * The SMS leg: the noise filter decides under an advisory lock (two processes alerting at
 * once must not both pass the cap), writes its verdict, THEN sends. Never throws.
 */
async function smsHouse(tag: string, key: string, subject: string): Promise<boolean> {
  try {
    if (!deps.recipientPhone || !deps.sendSms) return false;
    // ⛔ LIVE HOST ONLY. Off the live host the mail still goes ("[TESZT] ", ADR-0279), the
    // SMS does not: the dev box's SMS_PROVIDER is the REAL modem and its OWNER_ALERT_PHONE a
    // real phone, so every pre-commit gate that drives a failure path would text the owner.
    if (!isLiveHost((deps.publicBaseUrl ?? realDeps.publicBaseUrl!)())) {
      console.log(`[house-alert:${tag}] SMS kihagyva — nem az éles host (a levél elment): ${subject}`);
      return false;
    }
    const phone = await deps.recipientPhone();
    if (!phone) {
      console.error(
        `[house-alert:${tag}] SÚLYOS riasztás, de nincs riasztási telefonszám ` +
          `(konzol /settings vagy OWNER_ALERT_PHONE) — SMS NEM ment ki: ${subject}`,
      );
      return false;
    }
    const verdict = await db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtext('house_alert_sms'))`.execute(trx);
      const repeat = await trx
        .selectFrom("house_alert_sms")
        .select("id")
        .where("dedupe_key", "=", key)
        .where("status", "=", "sent")
        .where(sql<boolean>`created_at > now() - make_interval(hours => ${SMS_REPEAT_HOURS})`)
        .executeTakeFirst();
      const lastHour = await trx
        .selectFrom("house_alert_sms")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("status", "=", "sent")
        .where(sql<boolean>`created_at > now() - interval '1 hour'`)
        .executeTakeFirstOrThrow();
      const why = repeat ? "repeat" : Number(lastHour.n) >= SMS_HOURLY_CAP ? "cap" : null;
      if (why) {
        await trx.insertInto("house_alert_sms").values({ tag, dedupe_key: key, status: "suppressed", subject }).execute();
        return { send: false as const, why };
      }
      const lastSent = await trx
        .selectFrom("house_alert_sms")
        .select("id")
        .where("status", "=", "sent")
        .orderBy("id", "desc")
        .executeTakeFirst();
      let heldQ = trx
        .selectFrom("house_alert_sms")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("status", "=", "suppressed");
      if (lastSent) heldQ = heldQ.where("id", ">", lastSent.id);
      const held = Number((await heldQ.executeTakeFirstOrThrow()).n);
      const row = await trx
        .insertInto("house_alert_sms")
        .values({ tag, dedupe_key: key, status: "sent", subject })
        .returning("id")
        .executeTakeFirstOrThrow();
      return { send: true as const, id: row.id, held };
    });
    if (!verdict.send) {
      console.log(
        `[house-alert:${tag}] SMS visszatartva (${verdict.why === "repeat" ? `ugyanez ${SMS_REPEAT_HOURS} órán belül már ment` : `óránként legfeljebb ${SMS_HOURLY_CAP}`}) — a levél viszi: ${subject}`,
      );
      return false;
    }
    const ok = await deps.sendSms({ to: phone, text: alertSmsText(subject, verdict.held) });
    if (!ok) {
      await db.updateTable("house_alert_sms").set({ status: "failed" }).where("id", "=", verdict.id).execute();
      console.error(`[house-alert:${tag}] a riasztó SMS NEM ment ki → ${phone}: ${subject}`);
      return false;
    }
    console.log(`[house-alert:${tag}] riasztó SMS → ${phone}: ${subject}`);
    return true;
  } catch (e) {
    // ⛔ Log only — never alert about a failed alert (that is the loop).
    console.error(`[house-alert:${tag}] a riasztó SMS maga is elhasalt (${subject}):`, e);
    return false;
  }
}

/**
 * Alert the house: the mail always, and for a severe alert (`sms: true`) a filtered SMS
 * too. Returns true when at least one channel carried it. Never throws: every caller is
 * already on a failure path, and an alert must not turn that into a second failure.
 */
export async function alertHouse(input: HouseAlert): Promise<boolean> {
  let subject = input.subject;
  let mailed = false;
  let mailTried = false;
  try {
    subject = alertSubject(input.subject, (deps.publicBaseUrl ?? realDeps.publicBaseUrl!)());
    const to = await deps.recipientEmail();
    if (!to) {
      // The missing-recipient branch fails VISIBLY — a silent "nobody to tell" would
      // recreate exactly the blind spot this module was written for.
      console.error(
        `[house-alert:${input.tag}] ${subject} — de nincs riasztási e-mail cím ` +
          `(konzol /settings → alert_email) — a ház NEM kapott levelet.`,
      );
    } else {
      mailTried = true;
      await deps.send({ to, audience: "platform", subject, text: input.text });
      mailed = true;
      console.log(`[house-alert:${input.tag}] riasztás elküldve → ${to}: ${subject}`);
    }
  } catch (e) {
    // ⛔ Log only — never alert about a failed alert (that is the loop).
    console.error(`[house-alert:${input.tag}] a riasztó levél maga is elhasalt (${subject}):`, e);
  }
  let smsed = false;
  if (input.sms) {
    smsed = await smsHouse(input.tag, input.smsKey ?? input.tag, subject);
  }
  if (mailTried && !mailed) {
    // The mail server (or its key) is down: one SMS says so, under ONE key — a burst of
    // failing alerts must not become a burst of texts.
    const pre = subject.startsWith("[TESZT] ") ? "[TESZT] " : "";
    const fallback = await smsHouse(
      "mail-down",
      "mail-down",
      `${pre}a riaszto LEVEL nem ment ki (levelkuldes hiba) - ${subject.slice(pre.length)}`,
    );
    smsed = smsed || fallback;
  }
  return mailed || smsed;
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.stack ?? `${err.name}: ${err.message}`;
  return String(err);
}

/** ② A booking mail (to the owner or the guest) did not go out. */
export function alertBookingMailFailure(label: string, bookingRequestId: string, err: unknown): Promise<boolean> {
  return alertHouse({
    tag: "booking-mail",
    sms: true,
    subject: `Citoviso: foglalási levél NEM ment ki — ${label} (${bookingRequestId})`,
    text:
      `Egy foglalási levél kiküldése elhasalt. A foglalás állapota rendben rögzült, ` +
      `de a címzett (tulaj vagy vendég) NEM kapta meg a levelet.\n\n` +
      `Levél: ${label}\n` +
      `Foglalási kérés (booking_request.id): ${bookingRequestId}\n\n` +
      `Hiba:\n${errText(err)}\n\n` +
      `Teendő: nézd meg a levélküldő állapotát, és szükség esetén értesítsd a címzettet kézzel.`,
  });
}

/** ③ The payment webhook answered 4xx/5xx — the gateway will retry, but a human must look. */
export function alertWebhookFailure(a: {
  readonly gateway: string;
  readonly paymentRef: string;
  readonly status: number;
  readonly reason: string;
}): Promise<boolean> {
  return alertHouse({
    tag: "webhook",
    sms: true,
    smsKey: `webhook:${a.paymentRef || "?"}`,
    subject: `Citoviso: fizetési webhook ${a.status} — ${a.paymentRef || "azonosító nélkül"}`,
    text:
      `A fizetési szolgáltató (${a.gateway}) visszahívását NEM tudtuk feldolgozni ` +
      `(${a.status}). Ha a fizetés sikeres volt, a vevő fizetett, de a rendelése nem aktiválódott.\n\n` +
      `Fizetés-azonosító (gateway): ${a.paymentRef || "—"}\n` +
      `HTTP: ${a.status}\n` +
      `Ok: ${a.reason}\n\n` +
      `Teendő: keresd ki a fizetést (npx tsx scripts/find-payment.mts ${a.paymentRef || "<azonosító>"}), ` +
      `és vesd össze a szolgáltató felületével.`,
  });
}

/** How many AUTOMATIC re-issues a failed invoice gets (daily, in the billing tick). */
export const INVOICE_AUTO_RETRY_LIMIT = 3;

/**
 * ④ A paid payment got NO invoice (ADR-0283). Measured on prod 2026-09-30: the 100 Ft
 * test purchase was paid, the Számlázz call answered error 378, and the only trace was
 * a 'failed' row + a console.error — the buyer paid and got no bizonylat, nobody knew.
 */
export function alertInvoiceFailure(a: {
  readonly paymentId: string;
  readonly paymentRef: string | null;
  readonly amount: number;
  readonly currency: string;
  readonly buyerName: string | null;
  readonly buyerEmail: string | null;
  readonly leadId: string | null;
  readonly error: string;
  /** Failed attempts for this payment so far, this one included. */
  readonly attempts: number;
  /** false → the automatic retries are used up (or there are none for this failure). */
  readonly willRetry: boolean;
  /** No checkout declaration: a retry cannot help, the invoice is issued by hand. */
  readonly manualOnly: boolean;
}): Promise<boolean> {
  const lead = a.leadId
    ? `${config.consoleUrl ? config.consoleUrl.replace(/\/$/, "") : ""}/lead/${a.leadId}#ls-orders`
    : "—";
  const next = a.manualOnly
    ? `Teendő: a számlát KÉZZEL kell kiállítani (nincs számlázási nyilatkozat, automatikus ` +
      `újrapróba ennél nem segít).`
    : a.willRetry
      ? `Az automatikus újrapróba naponta egyszer, a reggeli számlázási tickben fut ` +
        `(összesen legfeljebb ${INVOICE_AUTO_RETRY_LIMIT}-szer). Ha a hiba oka a Számlázz-fiók ` +
        `beállítása, javítsd, és azonnal kiadhatod a lead-lap „Számla újra ▸” gombjával ` +
        `(vagy: npx tsx scripts/invoice-retry.mts ${a.paymentId})`
      : `Az automatikus újrapróbák ELFOGYTAK — magától többet NEM próbálkozunk. A hiba ` +
        `elhárítása után a lead-lap „Számla újra ▸” gombjával adhatod ki ` +
        `(vagy: npx tsx scripts/invoice-retry.mts ${a.paymentId})`;
  return alertHouse({
    tag: "invoice",
    sms: true,
    smsKey: `invoice:${a.paymentId}`,
    subject:
      `Citoviso: a számla NEM készült el — ${a.paymentRef ?? a.paymentId}` +
      (a.willRetry || a.manualOnly ? "" : " (újrapróbák elfogytak)"),
    text:
      `Egy kifizetett rendeléshez NEM készült számla. A vevő fizetett, a bizonylatot nem kapta meg.\n\n` +
      `Fizetés: ${a.paymentRef ?? "—"} (payment.id: ${a.paymentId})\n` +
      `Összeg: ${a.amount} ${a.currency}\n` +
      `Vevő: ${a.buyerName ?? "—"}${a.buyerEmail ? ` <${a.buyerEmail}>` : ""}\n` +
      `Sikertelen kísérlet: ${a.attempts}\n` +
      `Konzol: ${lead}\n\n` +
      `A számlázó válasza:\n${a.error}\n\n` +
      next,
  });
}

/** What `systemctl show <unit>` says at the moment OnFailure= fired. */
export interface UnitState {
  /** "auto-restart" = Restart= will bring it back; anything else = it stays down. */
  readonly subState: string;
  /** Automatic restarts since the last manual start (0 at the first crash). */
  readonly nRestarts: number;
}

/**
 * Whether this OnFailure= firing deserves a mail. Measured 2026-09-30 on systemd 257
 * (RestartMode=normal): a Restart=always service passes through "failed" on EVERY
 * crash, so OnFailure= fires every time — the default start limit (5 / 10 s) never trips
 * with RestartSec=3, so a crash-looping public server would mail every ~4 s, forever.
 * During such a loop only the 1st, 11th, 101st, 1001st… crash is mailed (nRestarts 0 or
 * a power of ten ≥ 10). A unit that stays down (a failed timer tick) is always mailed.
 */
export function unitAlertDue(s: UnitState): boolean {
  if (s.subState !== "auto-restart") return true;
  let n = s.nRestarts;
  if (n === 0) return true;
  if (n < 10 || !Number.isInteger(n)) return false;
  while (n % 10 === 0) n /= 10;
  return n === 1;
}

/** ① A systemd unit entered the failed state (citoviso-alert@.service → scripts/unit-failure-alert.mts). */
export function alertUnitFailure(unit: string, journal: string, state?: UnitState): Promise<boolean> {
  if (state?.subState === "auto-restart") {
    const crash = state.nRestarts + 1;
    return alertHouse({
      tag: "unit",
      sms: true,
      smsKey: `unit:${unit}`,
      subject: `Citoviso: szolgáltatás összeomlott, újraindul — ${unit} (${crash}. összeomlás)`,
      text:
        `A(z) ${unit} systemd-egység összeomlott; a systemd automatikusan újraindítja (Restart=always). ` +
        `Ez a(z) ${crash}. összeomlás a legutóbbi kézi indítás (deploy) óta.\n\n` +
        `Utolsó naplósorok (journalctl -u ${unit}):\n\n${journal || "(a napló nem olvasható)"}\n\n` +
        `Ha újra és újra összeomlik, nem kapsz minden alkalommal levelet: a következő az ` +
        `1., 11., 101., 1001. … összeomlásnál jön.\n` +
        `Teendő: journalctl -u ${unit} -n 200 --no-pager a gépen; systemctl status ${unit}.`,
    });
  }
  return alertHouse({
    tag: "unit",
    sms: true,
    smsKey: `unit:${unit}`,
    subject: `Citoviso: időzített feladat elhasalt — ${unit}`,
    text:
      `A(z) ${unit} systemd-egység hibával állt le (failed állapot).\n\n` +
      `Utolsó naplósorok (journalctl -u ${unit}):\n\n${journal || "(a napló nem olvasható)"}\n\n` +
      `Teendő: journalctl -u ${unit} -n 200 --no-pager a gépen; az időzítő a következő ` +
      `ütemben magától újrapróbál, de a kihagyott futás eredménye addig hiányzik.`,
  });
}
