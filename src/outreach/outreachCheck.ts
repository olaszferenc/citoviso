// §C outreach gate (03-INVARIANTS §C, "Enforce NOW") — deterministic verifier
// for every outreach draft BEFORE it can be sent. Judges, does not fix: the
// console shows PASS/FLAG with reasons; a FLAGged draft must not be sent.
//
// The four mandatory elements + demo-framing:
//   C1  working one-click unsubscribe link — in the MAIL it must be in the body;
//       in the SMS it rides on the linked preview page (ADR-0112), so there the
//       gate measures reachability, and optout-carrier-check.mts measures that
//       the page actually renders it
//   C2  identifiable, real sender identity (person/entity + reply contact)
//   C3  personalized content (references THIS lead's name — not mass text)
//   C4  non-misleading subject/sender (no "your site is READY/LIVE" claim —
//       §A demo-framing: the linked page is a preliminary PLAN/preview)
// Plus: the tracked link must be an absolute, reachable URL (no placeholder).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { config } from "../config.js";
import { isPricingConfirmed } from "../pricing.js";
import type { OutreachDraft } from "./draft.js";

/** ADR-0111: a market decision as the synchronous gate sees it. */
export interface MarketVerdict {
  /** ISO-2, or null when we do not know where the lead is. */
  readonly country: string | null;
  readonly approved: boolean;
}

export interface OutreachCheckResult {
  readonly verdict: "PASS" | "FLAG";
  readonly reasons: string[];
  /**
   * The §C.2 identity faults, PER FIELD — not just folded into `reasons`. The
   * operator's next action is "which env value do I fix?", and a flat sentence
   * list cannot be rendered as that answer (Elek FK-004 H2).
   */
  readonly identity: readonly IdentityProblem[];
}

/**
 * Wordings that claim a finished/live site — misleading in cold outreach (§A).
 *
 * ⚠️ The noun alternatives matter: the first version only matched "…oldala", so
 * the most natural Hungarian phrasing — "Elkészült az új HONLAPJA!" — sailed
 * through the gate on both channels. Found by running the guard RED on purpose
 * (2026-08-29); a guard that never fails a bad input is decoration.
 */
const SITE_NOUN = "(hon|web)?(oldala|lapja)";
const MISLEADING_PATTERNS: readonly RegExp[] = [
  new RegExp(`elkészült\\s+az?\\s+(új\\s+)?${SITE_NOUN}`, "iu"),
  new RegExp(`él(es|ő)\\s+(már\\s+)?az?\\s+${SITE_NOUN}`, "iu"),
  /your\s+(web)?site\s+is\s+(ready|live)/i,
  new RegExp(`kész\\s+van\\s+az?\\s+${SITE_NOUN}`, "iu"),
];

/** Framing words that make the preview nature explicit (§A demo-framing). */
const FRAMING_PATTERN = /terv|előzetes|látványterv|minta|demó|preview/iu;

/**
 * Is this `*.ts.net` host actually published to the open internet by Tailscale
 * Funnel? Measured, not assumed: we read `tailscale funnel status` once per
 * process. Any failure (no binary, no permission, unparseable output) returns
 * false, so an unknown state keeps the strict verdict — a gate may not open on
 * a guess. Cached because the check runs per draft render.
 */
let funnelHostsCache: Set<string> | null = null;
function funnelHosts(): Set<string> {
  if (funnelHostsCache) return funnelHostsCache;
  const hosts = new Set<string>();
  try {
    const out = execFileSync("tailscale", ["funnel", "status"], {
      encoding: "utf8",
      timeout: 4000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    // Lines look like: "https://mineral.tail3a89f.ts.net:8443 (Funnel on)"
    for (const line of out.split("\n")) {
      const m = /^https:\/\/([a-z0-9.-]+\.ts\.net)(?::\d+)?\s+\(Funnel on\)/i.exec(line.trim());
      if (m?.[1]) hosts.add(m[1].toLowerCase());
    }
  } catch {
    /* unknown → stay strict */
  }
  funnelHostsCache = hosts;
  return hosts;
}
function isFunnelPublic(host: string): boolean {
  return funnelHosts().has(host);
}

/**
 * True if the URL cannot be reached by an external recipient: private/CGNAT
 * ranges (Tailscale 100.64–127.x included), loopback, or plain non-HTTPS.
 * A cold-outreach link MUST be public HTTPS — anything else is a dead hook
 * and a dead unsubscribe (Grt./GDPR violation). Guard-agent finding, 2026-07-28.
 */
function isUnreachableForRecipient(url: string): boolean {
  if (!/^https:\/\//.test(url)) return true; // http/placeholder/relative → dead
  const host = (url.replace(/^https:\/\//, "").split(/[/:]/)[0] ?? "").toLowerCase();
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (!m) {
    // Non-numeric host. The CGNAT test below only ever saw literal IPs, so a
    // PRIVATE NAME sailed through it: PUBLIC_BASE_URL on this dev box is
    // https://mineral.tail3a89f.ts.net:8443, and a tailnet-only link is a dead
    // hook and a dead unsubscribe.
    if (host === "localhost" || !host.includes(".")) return true;
    // ⚠️ BUT a `.ts.net` host is NOT automatically private: Tailscale FUNNEL
    // publishes it to the open internet with a real certificate. Blocking the
    // suffix blindly flagged a link that an off-tailnet fetch loaded perfectly
    // (measured 2026-08-26 on this very prospect) — the gate must judge REACH,
    // not the shape of the hostname. So we ask Tailscale what is actually
    // exposed; if we cannot tell, we stay strict.
    if (/\.ts\.net$/.test(host)) return !isFunnelPublic(host);
    return /\.(local|internal|lan|localdomain|home\.arpa)$/.test(host);
  }
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT / Tailscale
  return false;
}

/** Obvious placeholder contact values (e.g. "+36 30 000 0000") — not a real identity. */
const PLACEHOLDER_CONTACT = /0{3}[\s-]?0{4}|123[\s-]?4567|xxx/iu;

/* ─────────────────────────────────────────────────────────────────────────────
 * §C.2 — THE SENDER IDENTITY, MEASURED ON THE CONFIG
 *
 * ⛔ WHY (Elek FK-004 H2, measured 2026-09-13): the letter that ACTUALLY LEFT
 * carried this footer —
 *
 *     „A megkeresés küldője: TESZT Szolgáltató e.v. (nem valódi) ·
 *      8360 Keszthely, Teszt utca 1. · nyilvántartási szám: TESZT-00000000 ·
 *      adószám: 12345678-1-42"
 *
 * — while its signature named a real person, and this gate printed a green
 * „Jogszerűségi kapu: PASS — küldhető" badge on top. The mandatory identification
 * element INVALIDATED ITSELF in the recipient's own words, and no rule could see
 * it: every §C.2 rule above measures the TEXT, and the text was exactly what the
 * config told it to be. A misconfigured prod (empty or pasted-example env) would
 * look identical and would also PASS. The gate was blind to the easiest mistake.
 *
 * SO THE MEASUREMENT MOVES TO THE CONFIG, in three layers per field:
 *   ① FILLED    — is the value there at all;
 *   ② REAL SHAPE— is it structurally capable of being real: the adószám's CHECK
 *                 DIGIT, a registry-number form, a mail domain that is not a
 *                 standard-RESERVED namespace, a registry name without an
 *                 annotation in it;
 *   ③ NOT THE EXAMPLE — exact equality with the value `.env.example` documents
 *                 for the same key (ONE source, and exact, so a correct value can
 *                 never trip it).
 *
 * ⛔ NOT A WORD BLACKLIST, on purpose. This file has been burned TWICE by fuzzy
 * text heuristics firing on correct values (the `xXx` token 2026-09-09, the valid
 * adószám `12345678-1-42` matching `1234567` on 2026-09-11 — ADR-0121). None of
 * the rules below asks whether a value "looks like a test": they ask whether it
 * CAN be real. `12345678-1-42` fails because its check digit is wrong, so it is
 * not a tax number at all — while the house's real `69646014-1-33` validates, and
 * so do 10773381-2-44 and 10537914-4-44 (measured; the self-test pins all of them).
 *
 * ⚠️ SCOPE: only the fields the shipped surfaces actually PRINT. The letter prints
 * the signature (sender name/company/mail/phone) and the registry identification
 * line (legal name, seat, registry + tax number); the linked prospect page prints
 * the advertiser (company||name, prospectNotice.ts). LEGAL_ENTITY_EMAIL/PHONE are
 * NOT measured here — they belong to the impresszum, and legal-check.mts guards
 * those. A gate that judges a value nobody sends is noise.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Which shipped surface carries the identity — they print different fields. */
export type IdentitySurface = "mail" | "linked-page";

export type IdentityFault = "missing" | "malformed" | "sample";

export interface IdentityProblem {
  /** The env var to fix. The reason NAMES it: "FLAG" alone is not actionable. */
  readonly env: string;
  /** What the shipped surface calls this value, so the operator can find it. */
  readonly label: string;
  readonly fault: IdentityFault;
  /** One sentence: what was measured, and what the measurement said. */
  readonly detail: string;
  /** The value exactly as the surface would print it ("" when unset). */
  readonly shown: string;
}

/** Env values keyed by env NAME — so the descriptor list below is the one source. */
export type IdentityEnv = Readonly<Record<string, string | undefined>>;

/**
 * An annotation ABOUT a name is not part of the name. A registry name (ours is
 * "Olasz Ferenc e.v.") is recorded as plain text; a parenthesised or bracketed
 * aside can only have been added by a human editing the env — which is precisely
 * how "(nem valódi)" and "[CÉGAZONOSÍTÓ — LEGAL_ENTITY_NAME]" got in front of a
 * lead. This is a character-class rule, not a word list: it does not know what
 * the aside SAYS, only that a registry field is carrying one.
 */
const NAME_ANNOTATION = /[([{<][^)\]}>]*[)\]}>]|[[\]{}<>]/u;

/**
 * Namespaces reserved BY STANDARD for documentation and testing (RFC 2606 §3,
 * RFC 6761 §6): no mailbox can ever exist behind them, so a reply address here is
 * structurally undeliverable — not merely suspicious. `.local`/`.internal` are
 * non-routable for the same practical reason.
 */
const RESERVED_MAIL_DOMAIN = /(^|\.)(example\.(com|net|org)|example|invalid|test|localhost|local|internal)$/i;

/** Hungarian adószám check-digit weights for the 7 leading digits of the törzsszám. */
const TAX_WEIGHTS = [9, 7, 3, 1, 9, 7, 3] as const;

function taxNumberFault(v: string): string | null {
  const m = /^(\d{7})(\d)-([1-5])-(\d{2})$/.exec(v);
  if (!m) {
    return "nem magyar adószám alakú (########-#-##, ahol a 9. jegy 1–5 az áfa-kód)";
  }
  const sum = [...m[1]!].reduce((acc, d, i) => acc + Number(d) * TAX_WEIGHTS[i]!, 0);
  const expected = (10 - (sum % 10)) % 10;
  if (Number(m[2]) !== expected) {
    return (
      `az ELLENŐRZŐ SZÁMJEGYE hibás: a ${m[1]} törzsszámhoz a 8. jegy ${expected} lenne, nem ${m[2]} — ` +
      "ez az alak nem lehet létező adószám (tipikusan a dokumentációk minta-száma)"
    );
  }
  const area = Number(m[4]);
  if (!((area >= 2 && area <= 44) || area === 51)) {
    return `a területi kódja (${m[4]}) nem létező (02–44 vagy 51)`;
  }
  return null;
}

function registryNumberFault(v: string): string | null {
  const bare = v.replace(/-/g, "");
  const isSoleTrader = /^\d{8}$/.test(v); // egyéni vállalkozói nyilvántartási szám
  const isCompany = /^\d{2}-\d{2}-\d{6}$/.test(v); // cégjegyzékszám
  if (!isSoleTrader && !isCompany) {
    return "nem nyilvántartási szám alakú (8 jegyű e.v.-szám vagy ##-##-###### cégjegyzékszám)";
  }
  if (/^(\d)\1*$/.test(bare)) {
    return "egyetlen ismételt számjegyből áll — ez kitöltetlen mező jelölője, nem nyilvántartási szám";
  }
  return null;
}

function mailAddressFault(v: string): string | null {
  if (!/^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/.test(v)) return "nem e-mail cím alakú";
  const domain = v.split("@")[1]!.toLowerCase();
  if (RESERVED_MAIL_DOMAIN.test(domain)) {
    return (
      `a domainje (${domain}) a standard szerint teszt/dokumentációs célra FENNTARTOTT ` +
      "(RFC 2606/6761) — ide a címzett válasza soha nem érkezik meg"
    );
  }
  return null;
}

function nameFault(kind: "registry" | "display"): (v: string) => string | null {
  return (v) => {
    if (v.length < (kind === "registry" ? 3 : 2)) return "túl rövid ahhoz, hogy név legyen";
    if (!/\p{L}/u.test(v)) return "nem tartalmaz betűt";
    const ann = NAME_ANNOTATION.exec(v);
    if (ann) {
      return (
        `megjegyzést visel („${ann[0]}") — a ${kind === "registry" ? "bejegyzett név" : "aláírás neve"} ` +
        "nem tartalmaz zárójeles/szögletes kitételt; ez kitöltetlen vagy teszt-érték"
      );
    }
    return null;
  };
}

function seatFault(v: string): string | null {
  if (!/^\d{4}\s/.test(v)) return "nem irányítószámmal kezdődik (4 jegy)";
  if (v.split(/\s+/).length < 4) {
    return "kevesebb elemből áll, mint egy székhely (irányítószám, település, közterület, házszám)";
  }
  const ann = NAME_ANNOTATION.exec(v);
  if (ann) return `megjegyzést visel („${ann[0]}") — a székhely nem tartalmaz kitételt`;
  return null;
}

/**
 * A contact NUMBER, measured as a field. This is where the old PLACEHOLDER_CONTACT
 * heuristic actually belongs: on a phone field a long identical or straight-run of
 * digits is a structural tell, while on free prose the same pattern hit a valid tax
 * number and a random URL token (ADR-0121).
 */
function phoneFault(v: string): string | null {
  const digits = v.replace(/\D/g, "");
  if (digits.length < 9) return "kevesebb számjegy, mint egy telefonszám";
  if (/(\d)\1{4,}/.test(digits)) return "ötnél több azonos számjegy egymás után — nem valós szám";
  if (/(?:0123456|1234567|2345678|3456789)/.test(digits)) {
    return "folyamatos növekvő számjegy-sorozatot tartalmaz — minta-szám, nem valós elérhetőség";
  }
  return null;
}

interface IdentityField {
  readonly env: string;
  readonly label: string;
  /** The surfaces that PRINT this value. */
  readonly surfaces: readonly IdentitySurface[];
  /** The surfaces where an EMPTY value is itself a §C.2 violation. */
  readonly requiredOn: readonly IdentitySurface[];
  readonly fault: (v: string) => string | null;
}

const IDENTITY_FIELDS: readonly IdentityField[] = [
  {
    env: "OUTREACH_SENDER_NAME",
    label: "az aláíró személy neve",
    surfaces: ["mail", "linked-page"],
    requiredOn: ["mail"],
    fault: nameFault("display"),
  },
  {
    env: "OUTREACH_SENDER_COMPANY",
    label: "az aláírás cég-/márkaneve",
    surfaces: ["mail", "linked-page"],
    requiredOn: ["mail"],
    fault: nameFault("display"),
  },
  {
    env: "OUTREACH_SENDER_EMAIL",
    label: "a válasz-cím az aláírásban",
    surfaces: ["mail"],
    requiredOn: ["mail"],
    fault: mailAddressFault,
  },
  {
    env: "OUTREACH_SENDER_PHONE",
    label: "a telefonszám az aláírásban",
    surfaces: ["mail"],
    requiredOn: [], // the signature prints it only when set (draft.ts senderParts)
    fault: phoneFault,
  },
  {
    env: "LEGAL_ENTITY_NAME",
    label: "a hirdető bejegyzett neve",
    surfaces: ["mail"],
    requiredOn: ["mail"],
    fault: nameFault("registry"),
  },
  {
    env: "LEGAL_ENTITY_ADDRESS",
    label: "a hirdető székhelye",
    surfaces: ["mail"],
    requiredOn: ["mail"],
    fault: seatFault,
  },
  {
    env: "LEGAL_ENTITY_REG_NUMBER",
    label: "nyilvántartási szám",
    surfaces: ["mail"],
    requiredOn: [], // advertiserIdentity prints reg OR tax; the group rule below
    fault: registryNumberFault, //   requires at least one of them
  },
  {
    env: "LEGAL_ENTITY_TAX_NUMBER",
    label: "adószám",
    surfaces: ["mail"],
    requiredOn: [],
    fault: taxNumberFault,
  },
];

/**
 * The example values our own env TEMPLATE documents — read from `.env.example`, so
 * this layer has ONE source instead of a hand-kept list that would drift. Exact,
 * case-insensitive equality only: a correct value cannot collide with it. Today the
 * template ships these keys EMPTY (they are required, not illustrated), so this
 * layer is quiet — it exists so that the day someone pastes a sample in there, the
 * sample cannot reach a lead. Cached: the gate runs per draft render.
 */
let envExampleCache: ReadonlyMap<string, string> | null = null;
function envExampleSamples(): ReadonlyMap<string, string> {
  if (envExampleCache) return envExampleCache;
  const found = new Map<string, string>();
  try {
    const txt = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
    for (const line of txt.split("\n")) {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      const value = (m?.[2] ?? "").trim().replace(/^["']|["']$/g, "");
      if (m && value) found.set(m[1]!, value);
    }
  } catch {
    /* no template on this machine → layers ① and ② still hold */
  }
  envExampleCache = found;
  return found;
}

const SURFACE_NAME: Record<IdentitySurface, string> = {
  mail: "a kiküldött levél",
  "linked-page": "a linkelt előnézet-oldal lábazata",
};

/**
 * PURE §C.2 identity verdict — the values come in, so a guard can prove that the
 * rules bite without mutating the environment of a gate other tests share (that
 * limitation is why this rule could only be OBSERVED before, never simulated).
 */
export function identityProblems(
  surface: IdentitySurface,
  values: IdentityEnv,
  samples: ReadonlyMap<string, string> = new Map(),
): IdentityProblem[] {
  const out: IdentityProblem[] = [];
  const val = (env: string): string => (values[env] ?? "").trim();
  for (const f of IDENTITY_FIELDS) {
    if (!f.surfaces.includes(surface)) continue;
    const raw = val(f.env);
    if (!raw) {
      if (f.requiredOn.includes(surface)) {
        out.push({
          env: f.env,
          label: f.label,
          fault: "missing",
          shown: "",
          detail: `nincs beállítva (üres ${f.env}) — ${SURFACE_NAME[surface]} ezt a kötelező azonosító-elemet nem tudja kitölteni`,
        });
      }
      continue;
    }
    const sample = samples.get(f.env);
    if (sample && sample.toLowerCase() === raw.toLowerCase()) {
      out.push({
        env: f.env,
        label: f.label,
        fault: "sample",
        shown: raw,
        detail: `szó szerint a .env.example minta-értéke („${sample}") — a template példája nem azonosít senkit`,
      });
      continue;
    }
    const fault = f.fault(raw);
    if (fault) out.push({ env: f.env, label: f.label, fault: "malformed", shown: raw, detail: fault });
  }
  if (surface === "mail" && !val("LEGAL_ENTITY_REG_NUMBER") && !val("LEGAL_ENTITY_TAX_NUMBER")) {
    out.push({
      env: "LEGAL_ENTITY_TAX_NUMBER",
      label: "adószám / nyilvántartási szám",
      fault: "missing",
      shown: "",
      detail:
        "sem adószám, sem nyilvántartási szám nincs beállítva — a hideg kereskedelmi levél címzettje " +
        "így nem tudja visszakeresni, kivel áll szemben (Grt. 6. § / Eker.tv. 4. §)",
    });
  }
  // ⚠️ The half the MESSAGE can no longer prove (ADR-0112): the standalone/pair SMS
  // signs off with a FIXED brand line, true regardless of config, so the operating
  // entity is named ONLY in the linked page's footer — which reads this same config.
  // Empty config would ship an anonymous advertiser on the sole legal carrier.
  if (surface === "linked-page" && !val("OUTREACH_SENDER_COMPANY") && !val("OUTREACH_SENDER_NAME")) {
    out.push({
      env: "OUTREACH_SENDER_COMPANY",
      label: "a hirdető megnevezése",
      fault: "missing",
      shown: "",
      detail:
        "sem OUTREACH_SENDER_COMPANY, sem OUTREACH_SENDER_NAME nincs beállítva — a linkelt oldal jogi " +
        "lábazata így NEM nevezné meg a hirdetőt, pedig ez az EGYETLEN hely, ahol a címzett megtudhatja, ki keresi meg",
    });
  }
  return out;
}

/** The same verdict on THIS MACHINE's config — what the next send would carry. */
export function checkOutreachIdentity(surface: IdentitySurface): IdentityProblem[] {
  const s = config.outreachSender;
  const e = config.legalEntity;
  return identityProblems(
    surface,
    {
      OUTREACH_SENDER_NAME: s.name,
      OUTREACH_SENDER_COMPANY: s.company,
      OUTREACH_SENDER_EMAIL: s.email,
      OUTREACH_SENDER_PHONE: s.phone,
      LEGAL_ENTITY_NAME: e.name,
      LEGAL_ENTITY_ADDRESS: e.address,
      LEGAL_ENTITY_REG_NUMBER: e.regNumber,
      LEGAL_ENTITY_TAX_NUMBER: e.taxNumber,
    },
    envExampleSamples(),
  );
}

/**
 * One reason line per field — it NAMES the env var, the label the surface prints,
 * the measurement, and the value that would have gone out. The reasons are what
 * sendBatch logs and what the rejection banner shows, so "FLAG" without the field
 * would leave the operator guessing which of eight values to fix.
 */
export function identityReason(p: IdentityProblem): string {
  const shown = p.shown ? ` · a kiküldött érték: „${p.shown}"` : "";
  return `FELADÓ-AZONOSÍTÁS [${p.env}] ${p.label}: ${p.detail}${shown}`;
}

/**
 * The message WITHOUT its URLs — what the recipient actually reads as a sentence.
 *
 * ⛔ Every rule about what the message SAYS must measure this, never the raw text.
 * Our own links carry meaning that is not a statement: the brand host
 * (`citoviso.com`), the lead's name as a readable slug (`/p/bagolyvar/…`), and a
 * random token. Measuring the raw text therefore breaks the gate in BOTH
 * directions, and both were measured on this file (2026-09-09):
 *
 *   FALSE PASS  — an anonymous mass mail to a one-word lead whose slug happens to
 *                 contain a framing word scored PASS with NO reasons: C3
 *                 (personalization) and C4 (demo-framing) were satisfied by the
 *                 URL alone. 39 of our 595 leads have a one-word name.
 *   FALSE FLAG  — the token is `randomBytes(18).toString("base64url")`, so 1 in
 *                 1637 tokens contains an "xXx" and tripped PLACEHOLDER_CONTACT.
 *                 The lead then became unsendable, and the stated reason pointed
 *                 at a placeholder phone number in a sender block that was fine.
 *
 * ADR-0112 established this rule for the SMS gate; the mail gate kept measuring
 * the raw body, which is why the same hole survived there. One helper now, so the
 * next channel cannot inherit the old shape.
 */
function proseOf(text: string, urls: readonly (string | undefined)[]): string {
  return urls
    .filter((u): u is string => Boolean(u))
    .reduce((acc, url) => acc.split(url).join(" "), text)
    .replace(/https?:\/\/\S+/g, " ");
}

/**
 * Does the message name who is writing? An SMS arriving from an unknown mobile
 * number with no identifiable advertiser is exactly what Grt. 6. § forbids.
 *
 * Accepted: our brand name, or the configured sender person/company. The brand
 * is matched on its first word, because the signature reads "A Citoviso
 * Csapata" while OUTREACH_SENDER_COMPANY holds the full registered name.
 */
function senderIsIdentifiable(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("citoviso")) return true;
  for (const v of [config.outreachSender.name, config.outreachSender.company]) {
    const first = (v ?? "").trim().split(/\s+/)[0]?.toLowerCase();
    if (first && first.length >= 3 && t.includes(first)) return true;
  }
  return false;
}

/**
 * §C gate for the SMS channel (ADR-0082). The mail gate cannot stand in for it:
 * it measures `draft.body`, so until now the text that actually reached a phone
 * passed through NO verifier at all (jog/provenance-őr finding, 2026-08-29 — a
 * later wording change in renderSmsDraft would have slipped through silently).
 *
 * The SMS carries less prose than the mail, so the elements are checked where
 * they belong: the transparency + privacy notice AND the opt-out live on the
 * LINKED page (injectTrackingNotice), while the message itself stays an
 * invitation (ADR-0112, owner's call 2026-09-08).
 *
 * ⚠️ The consequence for THIS gate: the link is no longer just the payload, it
 * is the sole carrier of the legal mandatories. A dead or unreachable link now
 * means a megkeresés with NO opt-out at all, so both the link and the opt-out
 * URL behind it are checked for reachability — and the structural guarantee
 * that the page really renders the notice is held by a separate guard
 * (scripts/optout-carrier-check.mts), because this gate only sees strings.
 */
/**
 * ADR-0111 §C country gate — the ONE place that decides whether cold outreach may
 * leave for a given market.
 *
 * `market` is optional and its ABSENCE MEANS CLOSED for anything outside the home
 * market. That asymmetry is the design: six call sites feed this check, and a caller
 * that forgets to pass the verdict must not thereby open Poland.
 *
 * Until ADR-0111 the rule was `lang !== "hu"`, which gave the right answer for the
 * wrong reason — a legal pack belongs to a JURISDICTION, not to a language, so the
 * first German-speaking market would have opened Austria and Germany at once.
 */
function countryGateReason(
  lang: string | undefined,
  market: MarketVerdict | undefined,
): string | null {
  if (market) {
    if (market.approved) return null;
    const where = market.country ?? (lang ? `"${lang}" nyelvterület` : "ismeretlen ország");
    return (
      `PIAC: a(z) ${where} piac jogi csomagja nincs jóváhagyva — ` +
      `outreach erre az országra tiltva`
    );
  }
  // No verdict supplied: keep the pre-ADR-0111 behaviour, which is closed-by-default
  // outside Hungarian.
  if (lang && lang !== "hu") {
    return (
      `PIAC: a(z) "${lang}" nyelvterület piac-jóváhagyása ismeretlen — ` +
      `outreach erre az országra tiltva`
    );
  }
  return null;
}

export function checkOutreachSms(
  sms: { text: string; link: string; unsubscribeLink: string },
  leadName: string,
  lang?: string,
  market?: MarketVerdict,
): OutreachCheckResult {
  const reasons: string[] = [];
  const countryBlock = countryGateReason(lang, market);
  if (countryBlock) reasons.push(countryBlock);
  const text = sms.text;
  // ⚠️ The PROSE, with the URLs cut out — and every C-rule about what the message
  // SAYS must measure this, not `text`. The tracked link carries our domain
  // (citoviso.com) and the lead's name as a readable slug (ADR-0082), so a gate
  // matching on the raw text passes on the URL alone: measured by the
  // jog/provenance-őr on 2026-09-08, an anonymous mass-text with no signature and
  // no lead name scored PASS on both C2 and C3 in the production config.
  const prose = proseOf(text, [sms.link, sms.unsubscribeLink]);

  // C1 — one-click opt-out. Since ADR-0112 it is carried by the linked page, not
  // by the message text, so only its reachability is measured here.
  if (isUnreachableForRecipient(sms.unsubscribeLink)) {
    reasons.push(
      "LEIRATKOZÁS: a link a címzett számára elérhetetlen (privát IP / nem-HTTPS / hiányzó PUBLIC_BASE_URL) — halott leiratkozás tilos",
    );
  }

  // Tracked link — present and reachable. Since ADR-0112 this is the STRICTEST
  // element of the SMS gate: the link carries the privacy notice and the opt-out,
  // so a missing or unreachable link is a megkeresés with no way out.
  if (!text.includes(sms.link)) reasons.push("LINK: a követett mock-link nincs az SMS szövegében");
  if (isUnreachableForRecipient(sms.link)) {
    reasons.push("LINK: a mock-link a címzett számára elérhetetlen (privát IP / nem-HTTPS / hiányzó PUBLIC_BASE_URL)");
  }

  // C2 — the sender must be identifiable in the message itself (Grt.: the
  // advertiser may not be anonymous). The wording signs off with the brand, so
  // this also catches a future edit that drops the signature. Measured on the
  // PROSE: our own domain inside the URL is not a signature.
  if (/\[[^\]]*OUTREACH_SENDER[^\]]*\]/.test(text) || /\[KÜLDŐ NEVE/iu.test(text)) {
    reasons.push("FELADÓ: az identitás kitöltetlen (OUTREACH_SENDER_* env hiányzik)");
  } else if (!senderIsIdentifiable(prose)) {
    reasons.push("FELADÓ: az SMS nem azonosítja, ki ír (se márkanév, se OUTREACH_SENDER_*)");
  }
  // On the PROSE: a placeholder is something the message SAYS. The random token
  // in the link is not a contact value, and 1 in 1637 of them contains an "xXx".
  if (PLACEHOLDER_CONTACT.test(prose)) {
    reasons.push("FELADÓ: placeholder-gyanús elérhetőség az SMS-ben (nem valós identitás)");
  }
  // ⚠️ C2, the half the message can no longer prove — measured on the CONFIG, at
  // SEND time, on the machine that actually sends (a pre-commit guard only ever
  // sees the dev .env). The old templates printed `{sender}` from the config, so an
  // unset OUTREACH_SENDER_* produced a loud "[KÜLDŐ NEVE …]" placeholder in the text
  // and the gate stopped the send; the new wording signs off with a FIXED brand
  // line, true regardless of config, so that alarm went silent. Since 2026-09-13
  // the whole identity is judged field by field (identityProblems), because
  // "filled" was never the only way to be unusable: a value can also be shaped so
  // that it cannot be real.
  const identity = checkOutreachIdentity("linked-page");
  for (const p of identity) reasons.push(identityReason(p));

  // C3 — personalization. Also on the prose: the lead's name rides in the link's
  // readable slug, so the raw text would score every mass-text as personalized.
  if (leadName && !prose.toLowerCase().includes(leadName.toLowerCase())) {
    reasons.push("SZEMÉLYRE SZABÁS: az SMS nem hivatkozik a lead nevére (tömeg-szöveg gyanú)");
  }

  // C4 + §A — no finished-site claim; explicit preview framing required. Both on
  // the prose: the claim is something the message MAKES, and a slug is not a claim.
  for (const p of MISLEADING_PATTERNS) {
    if (p.test(prose)) {
      reasons.push("FÉLREVEZETÉS: kész/élő oldalt sugall — a levélnek TERVET kell ígérnie, nem kész oldalt");
      break;
    }
  }
  // The framing must be SAID, so it is measured on the prose: a lead named
  // "Látványterv Panzió" would otherwise satisfy the gate through its own slug.
  if (!FRAMING_PATTERN.test(prose)) {
    reasons.push("KERETEZÉS: hiányzik az explicit terv/előzetes megfogalmazás (a mock nem kész oldal)");
  }

  // C4/Fttv. — an advertised price must be the OWNER-CONFIRMED real price.
  if (!isPricingConfirmed() && /forinttól|Ft-tól|havi\s[\d  ]+\s?(forint|Ft)/iu.test(prose)) {
    reasons.push(
      "ÁR-HIRDETÉS: az SMS árat hirdet, de az árazás még nincs véglegesítve (Konzol ▸ Árazás)",
    );
  }

  return { verdict: reasons.length ? "FLAG" : "PASS", reasons, identity };
}

export function checkOutreachDraft(
  draft: OutreachDraft,
  leadName: string,
  /** The lead's language area — used for the message when no market verdict exists. */
  lang?: string,
  /** ADR-0111: the lead's country and whether its legal pack is approved. */
  market?: MarketVerdict,
): OutreachCheckResult {
  const reasons: string[] = [];
  // §C ORSZÁG-KAPU: cold outreach to a market whose LEGAL pack is not approved is
  // blocked (lawful basis, opt-out regime — e.g. the Polish opt-in rules differ).
  // Mock/site/configurator flow freely; cold mail does not.
  const countryBlock = countryGateReason(lang, market);
  if (countryBlock) reasons.push(countryBlock);
  const text = draft.subject + "\n" + draft.body;
  // ⚠️ The letter carries THREE of our URLs, so the same NO-OP the SMS gate had
  // lived here too — measured 2026-09-09 with the production link shape: an
  // anonymous mass mail to "Mintaterv" scored PASS with no reasons at all, C3 and
  // C4 both satisfied by `citoviso.com/p/mintaterv/<token>`. Presence and
  // reachability of the links are still judged on the RAW body below — those
  // rules are about the URL. Everything the letter SAYS is judged on the prose.
  const prose = proseOf(text, [draft.link, draft.unsubscribeLink, draft.privacyLink]);

  // C1 — unsubscribe link present and reachable by the recipient.
  if (!draft.body.includes(draft.unsubscribeLink)) {
    reasons.push("LEIRATKOZÁS: a link nincs a levél szövegében");
  }
  if (isUnreachableForRecipient(draft.unsubscribeLink)) {
    reasons.push(
      "LEIRATKOZÁS: a link a címzett számára elérhetetlen (privát IP / nem-HTTPS / hiányzó PUBLIC_BASE_URL) — halott leiratkozás tilos",
    );
  }

  // Tracked link — reachable and present (a dead link = broken hook + broken H1).
  if (isUnreachableForRecipient(draft.link)) {
    reasons.push(
      "LINK: a mock-link a címzett számára elérhetetlen (privát IP / nem-HTTPS / hiányzó PUBLIC_BASE_URL)",
    );
  }
  if (!draft.body.includes(draft.link)) {
    reasons.push("LINK: a követett mock-link nincs a levél szövegében");
  }

  // C2 — sender identity: no unfilled placeholders, no fake contact values.
  if (/\[[^\]]*OUTREACH_SENDER[^\]]*\]/.test(text) || /\[KÜLDŐ NEVE/iu.test(text)) {
    reasons.push("FELADÓ: az identitás kitöltetlen (OUTREACH_SENDER_* env hiányzik)");
  }
  // C2 — the ADVERTISER, by registry data. A brand word and a personal name in the
  // signature do not let the recipient of a cold commercial message check WHO wrote
  // (Grt. 6. § / Eker.tv. 4. §) — the letter shipped without any company
  // identification until 2026-09-11 (Elek FK-004 ⑤). Measured on the prose, so a
  // company name that only appears inside our own URL never satisfies this.
  if (/\[CÉGAZONOSÍTÓ/iu.test(text)) {
    reasons.push("HIRDETŐ: a cégazonosítás kitöltetlen (LEGAL_ENTITY_* env hiányzik)");
  } else if (!/A megkeresés küldője:/iu.test(prose)) {
    reasons.push("HIRDETŐ: hiányzik a cégazonosítás (név, székhely, nyilvántartási/adószám)");
  }
  // ⚠️ SCOPE, not sensitivity. This heuristic looks for fake CONTACT values
  // ("000 0000", "123-4567", "xxx") and it must be measured where a contact value can
  // be — never on the registry identification line, whose tax and registry numbers are
  // long digit strings that legitimately contain those runs. Measured 2026-09-11: a
  // perfectly valid adószám `12345678-1-42` contains `1234567` and FLAGged the letter,
  // reporting a fake phone number in a sender block that was flawless. Same failure
  // mode as the `xXx` token (2026-09-09): a heuristic aimed at the wrong text.
  // Optional chaining is not defensive noise: guards legitimately hand this function a
  // hand-built draft to probe ONE rule (market-gate-check does), and a crash there would
  // report the §C gate as broken instead of the rule under test.
  const identityLine = draft.parts?.identity ?? "";
  const contactProse = identityLine ? prose.split(identityLine).join(" ") : prose;
  if (PLACEHOLDER_CONTACT.test(contactProse)) {
    reasons.push("FELADÓ: placeholder-gyanús elérhetőség a feladó-blokkban (nem valós identitás)");
  }
  // ⛔ C2 ON THE CONFIG — the rule the two above could never be (Elek FK-004 H2).
  // Both of them ask what the letter SAYS, and the letter said exactly what the
  // config told it to: „A megkeresés küldője: TESZT Szolgáltató e.v. (nem valódi)
  // · adószám: 12345678-1-42" shipped with a green PASS badge, because the
  // placeholder marker was absent, the „A megkeresés küldője:" line was present,
  // and the contact block was clean. Every value the letter PRINTS is now measured
  // for what it is — filled, real-shaped, not the documented example — and reported
  // per field, so the reason names the env var to fix.
  const identity = checkOutreachIdentity("mail");
  for (const p of identity) reasons.push(identityReason(p));

  // C2 — the referenced privacy notice must actually be linked (Art. 13/14 page).
  if (!draft.body.includes(draft.privacyLink)) {
    reasons.push("ADATKEZELÉS: a tájékoztató linkje nincs a levélben");
  }
  if (isUnreachableForRecipient(draft.privacyLink)) {
    reasons.push("ADATKEZELÉS: a tájékoztató linkje a címzett számára elérhetetlen");
  }

  // C3 — personalization: the lead's own name must be SAID in the subject or body.
  // The shipped letter puts it in the subject, so this stays green for what we send;
  // what it no longer accepts is the name riding in on the link's readable slug.
  if (leadName && !prose.toLowerCase().includes(leadName.toLowerCase())) {
    reasons.push("SZEMÉLYRE SZABÁS: a levél nem hivatkozik a lead nevére (tömeg-szöveg gyanú)");
  }

  // C4 + §A — no finished-site claim; explicit preview framing required. A slug is
  // not a claim and not a framing, so both rules read the prose.
  for (const p of MISLEADING_PATTERNS) {
    if (p.test(prose)) {
      reasons.push("FÉLREVEZETÉS: kész/élő oldalt sugall — a levélnek TERVET kell ígérnie, nem kész oldalt");
      break;
    }
  }
  if (!FRAMING_PATTERN.test(prose)) {
    reasons.push("KERETEZÉS: hiányzik az explicit terv/előzetes megfogalmazás (a mock nem kész oldal)");
  }

  // Legal-basis note (Grt./GDPR transparency line) — a sentence, not a link.
  if (!/jogos érdek|GDPR|Grt/iu.test(prose)) {
    reasons.push("JOGALAP: hiányzik a tájékoztatás (Grt./GDPR sor)");
  }

  // C4/Fttv. — an advertised price must be the OWNER-CONFIRMED real price.
  // While pricing is not owner-confirmed (default), any price claim in the mail is
  // a fabricated commercial promise → not sendable. Confirm on Konzol ▸ Árazás.
  if (!isPricingConfirmed() && /forinttól|Ft-tól|havi\s[\d  ]+\s?(forint|Ft)/iu.test(prose)) {
    reasons.push(
      // ⚠️ The switch's REAL label is "Az árak véglegesek, élesíthetők" (views.ts) —
      // advice that names a control the operator cannot find is worse than none.
      "ÁR-HIRDETÉS: a levél árat hirdet, de az árazás még nincs véglegesítve — a Konzol ▸ Árazás felületen add meg a valós árakat és pipáld be az „Az árak véglegesek, élesíthetők” kapcsolót",
    );
  }

  return { verdict: reasons.length ? "FLAG" : "PASS", reasons, identity };
}
