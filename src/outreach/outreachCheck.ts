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
      `C-ORSZÁG: a(z) ${where} piac jogi csomagja nincs jóváhagyva (ADR-0111) — ` +
      `outreach erre az országra tiltva`
    );
  }
  // No verdict supplied: keep the pre-ADR-0111 behaviour, which is closed-by-default
  // outside Hungarian.
  if (lang && lang !== "hu") {
    return (
      `C-ORSZÁG: a(z) "${lang}" nyelvterület piac-jóváhagyása ismeretlen (ADR-0111) — ` +
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
      "C1: a leiratkozó-link a címzett számára elérhetetlen (privát IP / nem-HTTPS / hiányzó PUBLIC_BASE_URL) — halott leiratkozás tilos",
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
    reasons.push("C2: a feladó-identitás kitöltetlen (OUTREACH_SENDER_* env hiányzik)");
  } else if (!senderIsIdentifiable(prose)) {
    reasons.push("C2: az SMS nem azonosítja a feladót (se márkanév, se OUTREACH_SENDER_*)");
  }
  // On the PROSE: a placeholder is something the message SAYS. The random token
  // in the link is not a contact value, and 1 in 1637 of them contains an "xXx".
  if (PLACEHOLDER_CONTACT.test(prose)) {
    reasons.push("C2: placeholder-gyanús elérhetőség az SMS-ben (nem valós identitás)");
  }
  // ⚠️ C2, the half the message can no longer prove. The old templates printed
  // `{sender}` from the config, so an unset OUTREACH_SENDER_* produced a loud
  // "[KÜLDŐ NEVE …]" placeholder right here and the gate stopped the send. The
  // new wording signs off with a FIXED brand line, which is true regardless of
  // config — so that alarm went silent, and the operating entity is now named
  // ONLY in the linked page's footer, which reads the same empty config
  // (prospectNotice.ts). Empty config would therefore ship an anonymous
  // advertiser on the sole legal carrier. Measured at SEND time, on the machine
  // that actually sends — a pre-commit guard only ever sees the dev .env.
  if (!config.outreachSender.company?.trim() && !config.outreachSender.name?.trim()) {
    reasons.push(
      "C2: nincs beállítva OUTREACH_SENDER_COMPANY/NAME — a linkelt oldal jogi lábazata így NEM nevezné meg a " +
        "hirdetőt, pedig ADR-0112 óta az az egyetlen hely, ahol a címzett megtudhatja, ki keresi meg",
    );
  }

  // C3 — personalization. Also on the prose: the lead's name rides in the link's
  // readable slug, so the raw text would score every mass-text as personalized.
  if (leadName && !prose.toLowerCase().includes(leadName.toLowerCase())) {
    reasons.push("C3: az SMS nem hivatkozik a lead nevére (tömeg-szöveg gyanú)");
  }

  // C4 + §A — no finished-site claim; explicit preview framing required. Both on
  // the prose: the claim is something the message MAKES, and a slug is not a claim.
  for (const p of MISLEADING_PATTERNS) {
    if (p.test(prose)) {
      reasons.push("C4: félrevezető állítás (kész/élő oldalt sugall) — §A demo-framing sérül");
      break;
    }
  }
  // The framing must be SAID, so it is measured on the prose: a lead named
  // "Látványterv Panzió" would otherwise satisfy the gate through its own slug.
  if (!FRAMING_PATTERN.test(prose)) {
    reasons.push("C4: hiányzik az explicit terv/előzetes keretezés (§A demo-framing)");
  }

  // C4/Fttv. — an advertised price must be the OWNER-CONFIRMED real price.
  if (!isPricingConfirmed() && /forinttól|Ft-tól|havi\s[\d  ]+\s?(forint|Ft)/iu.test(prose)) {
    reasons.push(
      "C4: az SMS árat hirdet, de az árazás még nincs véglegesítve (Konzol ▸ Árazás)",
    );
  }

  return { verdict: reasons.length ? "FLAG" : "PASS", reasons };
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
    reasons.push("C1: a leiratkozó-link nincs a levél szövegében");
  }
  if (isUnreachableForRecipient(draft.unsubscribeLink)) {
    reasons.push(
      "C1: a leiratkozó-link a címzett számára elérhetetlen (privát IP / nem-HTTPS / hiányzó PUBLIC_BASE_URL) — halott leiratkozás tilos",
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
    reasons.push("C2: a feladó-identitás kitöltetlen (OUTREACH_SENDER_* env hiányzik)");
  }
  if (PLACEHOLDER_CONTACT.test(prose)) {
    reasons.push("C2: placeholder-gyanús elérhetőség a feladó-blokkban (nem valós identitás)");
  }

  // C2 — the referenced privacy notice must actually be linked (Art. 13/14 page).
  if (!draft.body.includes(draft.privacyLink)) {
    reasons.push("C2: az adatkezelési tájékoztató linkje nincs a levélben");
  }
  if (isUnreachableForRecipient(draft.privacyLink)) {
    reasons.push("C2: az adatkezelési tájékoztató linkje a címzett számára elérhetetlen");
  }

  // C3 — personalization: the lead's own name must be SAID in the subject or body.
  // The shipped letter puts it in the subject, so this stays green for what we send;
  // what it no longer accepts is the name riding in on the link's readable slug.
  if (leadName && !prose.toLowerCase().includes(leadName.toLowerCase())) {
    reasons.push("C3: a levél nem hivatkozik a lead nevére (tömeg-szöveg gyanú)");
  }

  // C4 + §A — no finished-site claim; explicit preview framing required. A slug is
  // not a claim and not a framing, so both rules read the prose.
  for (const p of MISLEADING_PATTERNS) {
    if (p.test(prose)) {
      reasons.push("C4: félrevezető állítás (kész/élő oldalt sugall) — §A demo-framing sérül");
      break;
    }
  }
  if (!FRAMING_PATTERN.test(prose)) {
    reasons.push("C4: hiányzik az explicit terv/előzetes keretezés (§A demo-framing)");
  }

  // Legal-basis note (Grt./GDPR transparency line) — a sentence, not a link.
  if (!/jogos érdek|GDPR|Grt/iu.test(prose)) {
    reasons.push("C2: hiányzik a jogalap-tájékoztatás (Grt./GDPR sor)");
  }

  // C4/Fttv. — an advertised price must be the OWNER-CONFIRMED real price.
  // While pricing is not owner-confirmed (default), any price claim in the mail is
  // a fabricated commercial promise → not sendable. Confirm on Konzol ▸ Árazás.
  if (!isPricingConfirmed() && /forinttól|Ft-tól|havi\s[\d  ]+\s?(forint|Ft)/iu.test(prose)) {
    reasons.push(
      "C4: a levél árat hirdet, de az árazás még nincs véglegesítve — a Konzol ▸ Árazás felületen add meg a valós árakat és pipáld be az „Árak véglegesek” kapcsolót",
    );
  }

  return { verdict: reasons.length ? "FLAG" : "PASS", reasons };
}
