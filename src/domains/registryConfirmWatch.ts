// A REGISZTRÁTOR-SZÁL FIGYELÉSE a postafiókban (tulaj-rendelet 2026-09-09; ADR-0400 2026-10-22).
//
// Két dolgot keres, 2 percenként, az INBOX-ban ÉS a Spam mappában:
//
// ① A `.hu` Nyilvántartó MEGERŐSÍTŐ LINKJE (cfm.drr.hu). A `.hu` regisztráció nem zárul le
//   a fizetéssel: a Nyilvántartó egy linket küld a REGISTRANT-nak, és amíg arra nem kattint
//   valaki, a domain nem delegálódik. A registrar API nem fogad rendelésenkénti kontaktot,
//   ezért a registrant MINDIG a mi fiókunk domain-profilja — a levél HOZZÁNK jön
//   (2026-09-09 óta `olasz.ferenc@citoviso.com`), nem a vevőhöz.
//
//   ⛔ A GÉP NEM KATTINT (tulaj-döntés 2026-09-09). Precedens: 2026-09-06-án a megerősítő
//   űrlapot Playwrighttal végigkattintottam — a gomb aktiválódott, a link utána „nem
//   elérhető" lett, DE siker-visszajelzés SOHA nem jelent meg, és a Nyilvántartó nem kapta
//   meg a megerősítést (13 óra után is NXDOMAIN). A tulaj kézzel, új kóddal megismételte:
//   ott zöld „Sikeres beküldés" jött. Amíg nincs POZITÍV siker-jelünk, a kód a tulajé.
//
// ② A REGISZTRÁTOR EMBERI LEVELE egy folyamatban lévő névről (ADR-0400). Mérve: 2026-10-22
//   08:04-kor a Websupport support „[Websupport] - hiányzó adat - overseer.hu -" tárggyal
//   írt — a regisztrációt be sem adta, mert a domain-profilunkban nincs azonosító. A levél
//   16 órán át olvasatlanul állt, a gép 2 percenként „dns_pending"-et írt, a tenant képernyője
//   24 órát ígért. Ugyanez 2026-09-07-én (citoviso.hu, ticket NGW-NKDHD-903). Mostantól egy
//   ilyen levél = azonnali ház-riasztás (levél + SMS) + a beszerzés sorára írt jegyzet
//   (`registrar_note`), amiből a tenant képernyője tud „munkatársunk intézi"-t mondani.
//   A regisztrátor AUTOMATA levelei (díjbekérő, számla, „szinte a tiéd") nem riasztanak.
//
// ⚠️ AMIT NEM TUDUNK, ÉS EZÉRT MÉRÜNK: a hibaoldal szövege kétértelmű — „lejárt az
// érvényessége VAGY felhasználásra került". Egy korábbi jegyzet ebből „felhasznált"-at
// állított; ez ÉRTELMEZÉS volt, nem mérés (tulaj-korrekció: „szerintem nem egyszer
// használatos, hanem időkorlátos"). Ezért minden észlelést IDŐBÉLYEGGEL rögzítünk (mikor
// érkezett a levél, mikor vettük észre) — a következő valódi vétel eldönti a kérdést.
//
// A LINK KERESÉSÉNEK HORGONYA A LINK, NEM A FELADÓ. Mérve a saját postafiókban: a 09-06-i
// levél `Fwd:`-ként, `info@minerallog.hu`-ról érkezett — egy feladóra szűrő detektor pont
// ezt az egyetlen valódi példányt nem találta volna meg. A regisztrátor-levélnél viszont a
// feladó ÉS a folyamatban lévő név együtt a horgony (egy idegen levél, ami egy domaint
// megemlít, nem a regisztrátor szava).

import tls from "node:tls";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { config } from "../config.js";
import { db } from "../db/client.js";
import { getAlertRecipients } from "../console/appSettings.js";
import { alertHouse } from "../console/houseAlert.js";
import { getEmailSender } from "../email/sender.js";
import { sendOperatorSms } from "../console/operatorSms.js";

/** The registry's confirmation URL. The token is the dedupe key. */
const CONFIRM_LINK = /https:\/\/cfm\.drr\.hu\/(?:hu|en)\/confirmations\/([0-9a-f]{16,})/gi;

/** Operational state (not business data), so it lives outside the DB and the repo. */
const STATE_PATH =
  process.env.REGISTRY_CONFIRM_STATE ?? `${process.env.HOME}/.citoviso/registry-confirm.json`;

/** Only look at recent mail — the box holds years, the timer runs every 2 minutes. */
const LOOKBACK_DAYS = 14;

/** A registrar mail older than this at first sight is history (the owner already acted) — seeded, not shouted. */
export const REGISTRAR_MAIL_FRESH_HOURS = 48;

/** Who counts as "the registrar / the registry" writing to us. */
const REGISTRAR_SENDER = /@(?:websupport\.(?:hu|sk|eu)|domain\.hu|drr\.hu)\b/i;
/** The registrar's AUTOMATIC mails — billing, onboarding, password — carry no action. */
const AUTO_SUBJECT = /díjbekérő|dijbekero|számla|szamla|szinte a tiéd|üdvözlünk|udvozlunk|jelszó|jelszo|tulajdonosváltás|tulajdonosvaltas/i;

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

/** IMAP INTERNALDATE ("21-Oct-2026 13:55:04 +0000") → Date, or null when unparseable. */
export function parseImapDate(s: string): Date | null {
  const m = /^\s*(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\s*$/.exec(s);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${m[1]} ${m[2]} ${m[3]} ${m[4]}:${m[5]}:${m[6]} ${m[7]}`);
  return Number.isNaN(d.getTime()) ? null : d;
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

/** RFC 2047 encoded words in a header ("=?UTF-8?Q?hi=C3=A1nyz=C3=B3?=") → plain text. */
export function decodeMimeHeader(raw: string): string {
  return raw
    .replace(/\?=\s+=\?/g, "?==?") // adjacent encoded words: the whitespace between them is not content
    .replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_m, charset: string, enc: string, data: string) => {
      let bytes: Buffer;
      if (enc.toUpperCase() === "B") bytes = Buffer.from(data, "base64");
      else {
        const qp = data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x, h: string) => String.fromCharCode(parseInt(h, 16)));
        bytes = Buffer.from(qp, "latin1");
      }
      try {
        return new TextDecoder(charset.toLowerCase()).decode(bytes);
      } catch {
        return bytes.toString("utf8");
      }
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Quoted-printable body → text, then HTML stripped — enough to match a domain and quote an excerpt. */
function bodyToText(raw: string): string {
  const qp = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_x, h: string) => String.fromCharCode(parseInt(h, 16)));
  const utf = Buffer.from(qp, "latin1").toString("utf8");
  const plainPart = utf.split(/Content-Type: text\/html/i)[0];
  return plainPart
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export interface Finding {
  readonly token: string;
  readonly link: string;
  readonly mailAt: string;
}

/** A mail from the registrar / the registry, as the watcher sees it. */
export interface RegistrarMail {
  readonly msgId: string;
  readonly from: string;
  readonly subject: string;
  readonly mailAt: string;
  /** The text/plain part (QP decoded, tags stripped), capped. */
  readonly text: string;
}

export interface RegistrarMatch {
  readonly domain: string;
  /** support = a human at the registrar asks for something; registry = the .hu registry's own notice. */
  readonly kind: "support" | "registry";
}

/**
 * THE DECISION of ②, pure: is this mail the registrar writing about one of OUR in-flight
 * names? The sender must be the registrar/registry, the mail must name an in-flight domain,
 * an automatic billing/onboarding mail is not an action, and a registry mail that carries
 * the confirmation link is ①'s business (one alert, not two).
 */
export function matchRegistrarMail(mail: { from: string; subject: string; text: string }, inflight: readonly string[]): RegistrarMatch | null {
  if (!REGISTRAR_SENDER.test(mail.from)) return null;
  const hay = `${mail.subject}\n${mail.text}`.toLowerCase();
  const domain = inflight.find((d) => d && hay.includes(d.toLowerCase()));
  if (!domain) return null;
  const registry = /@(?:domain\.hu|drr\.hu)\b/i.test(mail.from);
  if (registry) {
    CONFIRM_LINK.lastIndex = 0;
    if (CONFIRM_LINK.test(hay)) return null;
    return { domain, kind: "registry" };
  }
  if (AUTO_SUBJECT.test(mail.subject)) return null;
  return { domain, kind: "support" };
}

/**
 * Minimal read-only IMAP client — EXAMINE and BODY.PEEK only, never a write. Scans the
 * INBOX and the spam folder (Zoho names it "Kéretlen levél"; the registry's mail landed in
 * spam elsewhere before), 14 days back, and returns both the confirmation links and the
 * registrar's mails.
 */
async function scanMailbox(): Promise<{ links: Finding[]; mails: RegistrarMail[] }> {
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

  const links: Finding[] = [];
  const mails: RegistrarMail[] = [];
  try {
    await new Promise<void>((res, rej) => {
      sock.once("data", () => res());
      sock.once("error", rej);
      setTimeout(() => rej(new Error("IMAP időtúllépés (üdvözlés)")), 20_000);
    });
    await send(`LOGIN "${creds.user}" "${creds.pass}"`);

    // The spam folder by its server-side name (modified UTF-7: "K&AOk-retlen lev&AOk-l").
    const list = await send('LIST "" "*"');
    const folders = [...list.matchAll(/\* LIST \([^)]*\) "[^"]*" "?([^"\r\n]+?)"?\r?$/gm)].map((m) => m[1]);
    const spam = folders.find((f) => /spam|junk|k&AOk-retlen|kéretlen/i.test(f));
    const boxes = ["INBOX", ...(spam ? [spam] : [])];

    const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5);
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][since.getUTCMonth()];
    const sinceStr = `${since.getUTCDate()}-${mon}-${since.getUTCFullYear()}`;

    for (const box of boxes) {
      // EXAMINE, not SELECT: read-only by construction — this watcher can never
      // change a flag or delete a mail in the owner's own mailbox.
      try {
        await send(`EXAMINE "${box}"`);
      } catch {
        continue; // a folder we may not open is not a reason to skip the INBOX
      }
      // TEXT search on the host, so a forwarded copy from any sender still matches the link;
      // the registrar's mails by sender.
      const res = await send(`SEARCH SINCE ${sinceStr} OR TEXT "cfm.drr.hu" OR FROM "websupport" FROM "domain.hu"`);
      const ids = (/\* SEARCH([\d ]*)/.exec(res)?.[1] ?? "").trim().split(/\s+/).filter(Boolean);
      for (const id of ids.slice(-30)) {
        const r = await send(`FETCH ${id} (INTERNALDATE BODY.PEEK[HEADER.FIELDS (MESSAGE-ID FROM SUBJECT)] BODY.PEEK[TEXT]<0.20000>)`);
        const mailAt = /INTERNALDATE "([^"]+)"/.exec(r)?.[1] ?? "";
        const headerBlock = /HEADER\.FIELDS[^\]]*\] \{\d+\}\r?\n([\s\S]*?)\r?\n\r?\n/.exec(r)?.[1] ?? "";
        const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
        const hdr = (name: string): string => decodeMimeHeader(new RegExp(`^${name}:\\s*(.*)$`, "im").exec(unfolded)?.[1] ?? "");
        const textBlock = /BODY\[TEXT\]<0> \{\d+\}\r?\n([\s\S]*)$/.exec(r)?.[1] ?? r;
        // Quoted-printable soft breaks split URLs across lines; undo them first.
        const linkText = textBlock.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
        for (const m of linkText.matchAll(CONFIRM_LINK)) {
          links.push({ token: m[1].toLowerCase(), link: m[0], mailAt });
        }
        const from = hdr("From");
        if (REGISTRAR_SENDER.test(from)) {
          mails.push({
            msgId: hdr("Message-ID") || `${box}:${id}:${mailAt}`,
            from,
            subject: hdr("Subject"),
            mailAt,
            text: bodyToText(textBlock).slice(0, 4000),
          });
        }
      }
    }
    await send("LOGOUT");
  } finally {
    sock.end();
  }
  return { links, mails };
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
    await sendOperatorSms({
      tag: "registry-confirm",
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

/**
 * The DECISION of ①, separated from the sending — so the guard can measure the promise
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
  const firstRun = Object.keys(state).filter((k) => !k.startsWith("mail:")).length === 0;
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

/** An in-flight beszerzés as ② needs it: the name and the row to annotate. */
export interface InflightDomain {
  readonly id: string;
  readonly domain: string;
}

export interface RegistrarMailDeps {
  /** The house alert (mail + SMS for a support mail, mail only for the registry's notice). */
  alert(a: { tag: string; subject: string; text: string; sms?: boolean; smsKey?: string }): Promise<boolean>;
  /** Annotate the beszerzés row (registrar_note / registrar_note_at). */
  note(provisioningId: string, note: string, at: Date): Promise<void>;
}

const realMailDeps: RegistrarMailDeps = {
  alert: alertHouse,
  note: async (id, note, at) => {
    await db.updateTable("domain_provisioning").set({ registrar_note: note, registrar_note_at: at }).where("id", "=", id).execute();
  },
};

/**
 * The DECISION of ②, with the sending injected (same reason as processFindings). Each
 * mail is judged once (its Message-ID is the key); a match that is older than
 * REGISTRAR_MAIL_FRESH_HOURS when first seen is seeded quietly (the owner has long read
 * it); a fresh one alerts the house NOW and — for a support request — annotates the row,
 * so the tenant's screen stops promising "tomorrow" and says a human is on it.
 */
export async function processRegistrarMails(
  mails: readonly RegistrarMail[],
  state: State,
  now: Date,
  inflight: readonly InflightDomain[],
  deps: RegistrarMailDeps = realMailDeps,
): Promise<string> {
  const names = inflight.map((d) => d.domain);
  let fresh = 0;
  let notified = 0;
  let seeded = 0;
  for (const m of mails) {
    const key = `mail:${m.msgId}`;
    if (state[key]) continue;
    const match = matchRegistrarMail(m, names);
    if (!match) {
      state[key] = { mailAt: m.mailAt, seenAt: now.toISOString(), notified: false };
      continue;
    }
    fresh++;
    const at = parseImapDate(m.mailAt);
    const ageH = at ? (now.getTime() - at.getTime()) / 3_600_000 : 0;
    if (ageH > REGISTRAR_MAIL_FRESH_HOURS) {
      seeded++;
      state[key] = { mailAt: m.mailAt, seenAt: now.toISOString(), notified: false };
      continue;
    }
    const row = inflight.find((d) => d.domain === match.domain);
    const excerpt = m.text.split("\n").filter((l) => l.trim() && !/^(\[!\[|!\[|\*\*Mennyire)/.test(l.trim())).slice(0, 14).join("\n");
    const support = match.kind === "support";
    const ok = await deps.alert({
      tag: support ? "registrar-mail" : "registry-notice",
      sms: support,
      smsKey: `registrar-mail:${match.domain}`,
      subject: support
        ? `Citoviso: a regisztrátor kér valamit a(z) ${match.domain} ügyében — „${m.subject}”`
        : `Citoviso: a .hu Nyilvántartó írt a(z) ${match.domain} ügyében — „${m.subject}”`,
      text:
        (support
          ? `A regisztrátor (Websupport) EMBERI levelet küldött a(z) ${match.domain} regisztrációjáról. Amíg erre nem ` +
            `válaszolunk / a hiányt nem pótoljuk, a regisztráció ÁLL — a gép ezt nem tudja helyettünk megtenni.\n\n`
          : `A .hu Nyilvántartó értesítése a(z) ${match.domain} névről (tájékoztatás; a megerősítő linkről külön riasztás jön).\n\n`) +
        `Feladó: ${m.from}\nTárgy: ${m.subject}\nÉrkezett: ${m.mailAt}\n` +
        (row ? `Beszerzés: ${row.id}\n` : "") +
        `\n----\n${excerpt}\n----\n\n` +
        (support
          ? `Teendő: olvasd el, és ha kérnek valamit, válaszolj a levélre a postafiókból (olasz.ferenc@citoviso.com). ` +
            `A domain-profil azonosító-mezői a Webadminban zároltak, azokat csak a Websupport írhatja be.\n`
          : ""),
    });
    if (ok && support && row) {
      await deps.note(row.id, `${m.mailAt} · ${m.from}: ${m.subject}`, now);
    }
    state[key] = { mailAt: m.mailAt, seenAt: now.toISOString(), notified: ok };
    if (ok) notified++;
  }
  if (!fresh) return "[registrar-mail] nincs új regisztrátor-levél a folyamatban lévő nevekről.";
  return `[registrar-mail] ${fresh} regisztrátor-levél a folyamatban lévő nevekről: ${notified} riasztás kiment${seeded ? `, ${seeded} régi bejegyezve riasztás nélkül` : ""}.`;
}

/**
 * Has a confirmation link arrived since `since`? (The hourly stall watch asks this for a
 * .hu name that sits in dns_pending: no link within hours = the registrar did not file.)
 * Reads the watcher's state, no mailbox round-trip.
 */
export function confirmLinkSeenSince(since: Date): boolean {
  const state = loadState();
  for (const [key, e] of Object.entries(state)) {
    if (key.startsWith("mail:")) continue;
    const at = parseImapDate(e.mailAt) ?? new Date(e.seenAt);
    if (at.getTime() >= since.getTime()) return true;
  }
  return false;
}

async function inflightDomains(): Promise<InflightDomain[]> {
  return db
    .selectFrom("domain_provisioning")
    .select(["id", "domain"])
    .where("status", "not in", ["live", "failed"])
    .execute();
}

/** One pass: read the mailbox, decide ① and ②, persist. Returns the lines for the caller's log. */
export async function watchRegistryConfirmations(): Promise<string> {
  const state = loadState();
  const { links, mails } = await scanMailbox();
  const now = new Date();
  const a = await processFindings(links, state, now.toISOString());
  let b: string;
  try {
    b = await processRegistrarMails(mails, state, now, await inflightDomains());
  } catch (e) {
    b = `[registrar-mail] a regisztrátor-levelek feldolgozása hibázott: ${(e as Error).message}`;
  }
  saveState(state);
  return `${a}\n${b}`;
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
