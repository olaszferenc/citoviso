// A `.hu` Nyilvántartó megerősítő levelének FIGYELÉSE (tulaj-rendelet, 2026-09-09).
//
// MIÉRT: a `.hu` regisztráció nem zárul le a fizetéssel. A Nyilvántartó (cfm.drr.hu)
// egy megerősítő linket küld a REGISTRANT-nak, és amíg arra nem kattint valaki, a
// domain nem delegálódik. A registrar API nem fogad rendelésenkénti kontaktot, ezért
// a registrant MINDIG a mi fiókunk alapértelmezett kontaktja — a levél tehát HOZZÁNK
// jön (2026-09-09 óta `olasz.ferenc@citoviso.com`), nem a vevőhöz.
//
// ⛔ A GÉP NEM KATTINT (tulaj-döntés 2026-09-09). Precedens: 2026-09-06-án a megerősítő
// űrlapot Playwrighttal végigkattintottam — a gomb aktiválódott, a link utána „nem
// elérhető" lett, DE siker-visszajelzés SOHA nem jelent meg, és a Nyilvántartó nem kapta
// meg a megerősítést (13 óra után is NXDOMAIN). A tulaj kézzel, új kóddal megismételte:
// ott zöld „Sikeres beküldés" jött. Amíg nincs POZITÍV siker-jelünk, a kód a tulajé.
//
// ⚠️ AMIT NEM TUDUNK, ÉS EZÉRT MÉRÜNK: a hibaoldal szövege kétértelmű — „lejárt az
// érvényessége VAGY felhasználásra került". Egy korábbi jegyzet ebből „felhasznált"-at
// állított; ez ÉRTELMEZÉS volt, nem mérés (tulaj-korrekció: „szerintem nem egyszer
// használatos, hanem időkorlátos"). Ezért minden észlelést IDŐBÉLYEGGEL rögzítünk (mikor
// érkezett a levél, mikor vettük észre) — a következő valódi vétel eldönti a kérdést.
//
// A KERESÉS HORGONYA A LINK, NEM A FELADÓ. Mérve a saját postafiókban: a 09-06-i levél
// `Fwd:`-ként, `info@minerallog.hu`-ról érkezett — egy feladóra szűrő detektor pont ezt
// az egyetlen valódi példányt nem találta volna meg.

import tls from "node:tls";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { config } from "../config.js";
import { getAlertRecipients } from "../console/appSettings.js";
import { getEmailSender } from "../email/sender.js";
import { sendSms } from "../sms/sender.js";

/** The registry's confirmation URL. The token is the dedupe key. */
const CONFIRM_LINK = /https:\/\/cfm\.drr\.hu\/(?:hu|en)\/confirmations\/([0-9a-f]{16,})/gi;

/** Operational state (not business data), so it lives outside the DB and the repo. */
const STATE_PATH =
  process.env.REGISTRY_CONFIRM_STATE ?? `${process.env.HOME}/.citoviso/registry-confirm.json`;

/** Only look at recent mail — the box holds years, the timer runs every 2 minutes. */
const LOOKBACK_DAYS = 14;

interface SeenEntry {
  /** When the mail arrived at the mailbox (IMAP INTERNALDATE). */
  readonly mailAt: string;
  /** When THIS watcher first saw it — the gap answers the time-limit question. */
  readonly seenAt: string;
  readonly notified: boolean;
}
type State = Record<string, SeenEntry>;

function loadState(): State {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8")) as State;
  } catch {
    return {};
  }
}

function saveState(s: State): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

/**
 * IMAP credentials. The mailbox that receives the registry mail is the SAME Zoho
 * account we send from, so the SMTP_URL already carries them — no second secret to
 * provision, and no way for the two to drift apart. Zoho's IMAP host mirrors the
 * SMTP one (smtppro -> imappro); an explicit override wins when set.
 */
function imapCreds(): { host: string; user: string; pass: string } | null {
  const explicit = process.env.REGISTRY_IMAP_URL;
  const raw = explicit || config.smtpUrl;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const user = decodeURIComponent(u.username);
    const pass = decodeURIComponent(u.password);
    if (!user || !pass) return null;
    const host = explicit ? u.hostname : u.hostname.replace(/^smtp/, "imap");
    return { host, user, pass };
  } catch {
    return null;
  }
}

/** Minimal read-only IMAP client — EXAMINE and BODY.PEEK only, never a write. */
async function fetchRecentConfirmations(): Promise<{ token: string; link: string; mailAt: string }[]> {
  const creds = imapCreds();
  if (!creds) throw new Error("nincs IMAP hitelesítő (SMTP_URL vagy REGISTRY_IMAP_URL)");

  const sock = tls.connect(993, creds.host, { servername: creds.host });
  sock.setEncoding("utf8");
  let tag = 0;
  let buf = "";

  const send = (cmd: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const t = `w${++tag}`;
      buf = "";
      const onData = (d: string): void => {
        buf += d;
        if (new RegExp(`^${t} (OK|NO|BAD)`, "m").test(buf)) {
          sock.off("data", onData);
          if (new RegExp(`^${t} (NO|BAD)`, "m").test(buf)) {
            // The command name is safe to echo; the arguments may hold the password.
            reject(new Error(`IMAP ${cmd.split(" ")[0]} elutasítva`));
            return;
          }
          resolve(buf);
        }
      };
      sock.on("data", onData);
      sock.write(`${t} ${cmd}\r\n`);
    });

  try {
    await new Promise<void>((res, rej) => {
      sock.once("data", () => res());
      sock.once("error", rej);
      setTimeout(() => rej(new Error("IMAP időtúllépés (üdvözlés)")), 20_000);
    });
    await send(`LOGIN "${creds.user}" "${creds.pass}"`);
    // EXAMINE, not SELECT: read-only by construction — this watcher can never
    // change a flag or delete a mail in the owner's own mailbox.
    await send("EXAMINE INBOX");

    const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5);
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
      since.getUTCMonth()
    ];
    const sinceStr = `${since.getUTCDate()}-${mon}-${since.getUTCFullYear()}`;
    // TEXT search on the host, so a forwarded copy from any sender still matches.
    const res = await send(`SEARCH SINCE ${sinceStr} TEXT "cfm.drr.hu"`);
    const ids = (/\* SEARCH([\d ]*)/.exec(res)?.[1] ?? "").trim().split(/\s+/).filter(Boolean);

    const out: { token: string; link: string; mailAt: string }[] = [];
    for (const id of ids.slice(-20)) {
      const body = await send(`FETCH ${id} (INTERNALDATE BODY.PEEK[TEXT]<0.20000>)`);
      const mailAt = /INTERNALDATE "([^"]+)"/.exec(body)?.[1] ?? "";
      // Quoted-printable soft breaks split URLs across lines; undo them first.
      const text = body.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
      for (const m of text.matchAll(CONFIRM_LINK)) {
        out.push({ token: m[1].toLowerCase(), link: m[0], mailAt });
      }
    }
    await send("LOGOUT");
    return out;
  } finally {
    sock.end();
  }
}

async function alertOwner(link: string, mailAt: string): Promise<boolean> {
  const rcpt = await getAlertRecipients();
  if (!rcpt.phone && !rcpt.email) {
    console.error(
      "[registry-confirm] MEGERŐSÍTŐ LINK érkezett, de nincs riasztási címzett " +
        "(konzol /settings vagy OWNER_ALERT_PHONE) — értesítés NEM ment ki. Link: " +
        link,
    );
    return false;
  }
  // Internal operator text — outside the §B.18 customer-facing i18n scope.
  if (rcpt.phone) {
    await sendSms({
      to: rcpt.phone,
      text:
        "Citoviso: .hu MEGEROSITO LINK erkezett a Nyilvantartotol. Amig nem kattintasz ra, " +
        "a domain NEM delegalodik. Reszletek e-mailben. " + link,
    });
  }
  if (rcpt.email) {
    await getEmailSender().send({
      to: rcpt.email,
      audience: "platform",
      subject: "Citoviso: .hu megerősítő link érkezett — kattintás kell",
      text:
        `A .hu Nyilvántartó megerősítő levele megérkezett (a levél ideje: ${mailAt}).\n\n` +
        `${link}\n\n` +
        `Amíg erre nem kattintasz és nem jön a ZÖLD „Sikeres beküldés" képernyő, a domain NEM ` +
        `delegálódik — a fizetés önmagában nem elég.\n\n` +
        `A gép SZÁNDÉKOSAN nem kattintott rá: 2026-09-06-án a gépi kattintás némán elbukott ` +
        `(a link „nem elérhető" lett, de a Nyilvántartó nem kapta meg a megerősítést, és 13 órán ` +
        `át NXDOMAIN maradt). Amíg nincs pozitív siker-jelünk, a kód a tiéd.\n\n` +
        `⚠️ Ha a link már nem él, kérj újat a szolgáltatónál — és szólj, mert az eldönti a nyitott ` +
        `kérdést: időkorlátos-e a kód, vagy egyszer használatos.\n`,
    });
  }
  return true;
}

export interface Finding {
  readonly token: string;
  readonly link: string;
  readonly mailAt: string;
}

/**
 * The DECISION, separated from the sending — so the guard can measure the promise
 * ("a tulaj értesítést kap") without a mailbox and without firing a REAL SMS on
 * every commit. The pair-repair guard learned this the hard way; the alert path is
 * exactly the part worth testing, and exactly the part that must not run for real.
 *
 * FIRST RUN SEEDS, IT DOES NOT SHOUT: a mailbox that already holds old confirmation
 * links (ours held the 2026-09-06 one) would otherwise fire an alert about a link
 * resolved days ago. An empty state records what is there and stays quiet — and says
 * so, rather than looking like "nothing to do".
 */
export async function processFindings(
  found: readonly Finding[],
  state: State,
  now: string,
  alert: (link: string, mailAt: string) => Promise<boolean> = alertOwner,
): Promise<string> {
  const firstRun = Object.keys(state).length === 0;
  let fresh = 0;
  let notified = 0;
  for (const f of found) {
    if (state[f.token]) continue;
    fresh++;
    if (firstRun) {
      state[f.token] = { mailAt: f.mailAt, seenAt: now, notified: false };
      continue;
    }
    const ok = await alert(f.link, f.mailAt);
    state[f.token] = { mailAt: f.mailAt, seenAt: now, notified: ok };
    if (ok) notified++;
  }
  if (firstRun) {
    return `[registry-confirm] első futás: ${fresh} meglévő link BEJEGYEZVE, riasztás nélkül (nem küldünk régi linkre).`;
  }
  return fresh
    ? `[registry-confirm] ${fresh} ÚJ megerősítő link, ${notified} riasztás kiment.`
    : "[registry-confirm] nincs új megerősítő link.";
}

/** One pass: read the mailbox, decide, persist. Returns a line for the caller's log. */
export async function watchRegistryConfirmations(): Promise<string> {
  const state = loadState();
  const found = await fetchRecentConfirmations();
  const msg = await processFindings(found, state, new Date().toISOString());
  saveState(state);
  return msg;
}

/** Test seam: the link detector, so the guard measures the SHIPPED regex. */
export function extractConfirmLinks(text: string): Finding[] {
  const undone = text.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
  const out: Finding[] = [];
  for (const m of undone.matchAll(CONFIRM_LINK)) {
    out.push({ token: m[1].toLowerCase(), link: m[0], mailAt: "" });
  }
  return out;
}
