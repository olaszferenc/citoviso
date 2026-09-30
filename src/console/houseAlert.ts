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
// the address the stuck-order, AAM and held-cancellation alerts already use. No new
// channel, no SMS (OWNER_ALERT_PHONE is empty on prod).
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

import { config } from "../config.js";
import { getEmailSender, type EmailMessage } from "../email/sender.js";
import { isLiveHost } from "../invoicing/keyGuard.js";
import { getAlertRecipients } from "./appSettings.js";

export interface HouseAlert {
  /** Short machine tag for the log line: unit / booking-mail / webhook. */
  readonly tag: string;
  readonly subject: string;
  readonly text: string;
}

/** Injectable for the guard script (scripts/house-alert-check.mts) — the real ones by default. */
export interface HouseAlertDeps {
  recipientEmail(): Promise<string | null>;
  send(msg: EmailMessage): Promise<unknown>;
  /** The base URL the live-host verdict is made from (config.publicBaseUrl by default). */
  publicBaseUrl?(): string;
}

const realDeps: HouseAlertDeps = {
  recipientEmail: async () => (await getAlertRecipients()).email,
  send: (msg) => getEmailSender().send(msg),
  publicBaseUrl: () => config.publicBaseUrl,
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

/**
 * Mail the house. Returns true when the mail went out. Never throws: every caller is
 * already on a failure path, and an alert must not turn that into a second failure.
 */
export async function alertHouse(input: HouseAlert): Promise<boolean> {
  try {
    const a = { ...input, subject: alertSubject(input.subject, (deps.publicBaseUrl ?? realDeps.publicBaseUrl!)()) };
    const to = await deps.recipientEmail();
    if (!to) {
      // The missing-recipient branch fails VISIBLY — a silent "nobody to tell" would
      // recreate exactly the blind spot this module was written for.
      console.error(
        `[house-alert:${a.tag}] ${a.subject} — de nincs riasztási e-mail cím ` +
          `(konzol /settings → alert_email) — a ház NEM lett értesítve.`,
      );
      return false;
    }
    await deps.send({ to, audience: "platform", subject: a.subject, text: a.text });
    console.log(`[house-alert:${a.tag}] riasztás elküldve → ${to}: ${a.subject}`);
    return true;
  } catch (e) {
    // ⛔ Log only — never alert about a failed alert (that is the loop).
    console.error(`[house-alert:${input.tag}] a riasztó levél maga is elhasalt (${input.subject}):`, e);
    return false;
  }
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.stack ?? `${err.name}: ${err.message}`;
  return String(err);
}

/** ② A booking mail (to the owner or the guest) did not go out. */
export function alertBookingMailFailure(label: string, bookingRequestId: string, err: unknown): Promise<boolean> {
  return alertHouse({
    tag: "booking-mail",
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
    subject: `Citoviso: időzített feladat elhasalt — ${unit}`,
    text:
      `A(z) ${unit} systemd-egység hibával állt le (failed állapot).\n\n` +
      `Utolsó naplósorok (journalctl -u ${unit}):\n\n${journal || "(a napló nem olvasható)"}\n\n` +
      `Teendő: journalctl -u ${unit} -n 200 --no-pager a gépen; az időzítő a következő ` +
      `ütemben magától újrapróbál, de a kihagyott futás eredménye addig hiányzik.`,
  });
}
