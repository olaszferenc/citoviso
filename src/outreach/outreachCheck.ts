// §C outreach gate (03-INVARIANTS §C, "Enforce NOW") — deterministic verifier
// for every outreach draft BEFORE it can be sent. Judges, does not fix: the
// console shows PASS/FLAG with reasons; a FLAGged draft must not be sent.
//
// The four mandatory elements + demo-framing:
//   C1  working one-click unsubscribe link
//   C2  identifiable, real sender identity (person/entity + reply contact)
//   C3  personalized content (references THIS lead's name — not mass text)
//   C4  non-misleading subject/sender (no "your site is READY/LIVE" claim —
//       §A demo-framing: the linked page is a preliminary PLAN/preview)
// Plus: the tracked link must be an absolute, reachable URL (no placeholder).

import { execFileSync } from "node:child_process";

import { isPricingConfirmed } from "../pricing.js";
import type { OutreachDraft } from "./draft.js";

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
 * §C gate for the SMS channel (ADR-0082). The mail gate cannot stand in for it:
 * it measures `draft.body`, so until now the text that actually reached a phone
 * passed through NO verifier at all (jog/provenance-őr finding, 2026-08-29 — a
 * later wording change in renderSmsDraft would have slipped through silently).
 *
 * The SMS carries less prose than the mail, so the elements are checked where
 * they belong: the transparency + privacy notice lives on the LINKED page
 * (injectTrackingNotice), while the message itself must state the legal basis
 * and carry a reachable one-click opt-out.
 */
export function checkOutreachSms(
  sms: { text: string; link: string; unsubscribeLink: string },
  leadName: string,
  lang?: string,
): OutreachCheckResult {
  const reasons: string[] = [];
  if (lang && lang !== "hu") {
    reasons.push(
      `C-ORSZÁG: a(z) "${lang}" nyelvterület jogi csomagja nincs jóváhagyva (ADR-0036) — outreach erre az országra tiltva`,
    );
  }
  const text = sms.text;

  // C1 — one-click opt-out, present and reachable.
  if (!text.includes(sms.unsubscribeLink)) {
    reasons.push("C1: a leiratkozó-link nincs az SMS szövegében");
  }
  if (isUnreachableForRecipient(sms.unsubscribeLink)) {
    reasons.push(
      "C1: a leiratkozó-link a címzett számára elérhetetlen (privát IP / nem-HTTPS / hiányzó PUBLIC_BASE_URL) — halott leiratkozás tilos",
    );
  }

  // Tracked link — present and reachable (it also carries the privacy notice).
  if (!text.includes(sms.link)) reasons.push("LINK: a követett mock-link nincs az SMS szövegében");
  if (isUnreachableForRecipient(sms.link)) {
    reasons.push("LINK: a mock-link a címzett számára elérhetetlen (privát IP / nem-HTTPS / hiányzó PUBLIC_BASE_URL)");
  }

  // C2 — the sender must be identifiable; an unset env may not hide behind a fallback.
  if (/\[[^\]]*OUTREACH_SENDER[^\]]*\]/.test(text) || /\[KÜLDŐ NEVE/iu.test(text)) {
    reasons.push("C2: a feladó-identitás kitöltetlen (OUTREACH_SENDER_* env hiányzik)");
  }
  if (PLACEHOLDER_CONTACT.test(text)) {
    reasons.push("C2: placeholder-gyanús elérhetőség az SMS-ben (nem valós identitás)");
  }
  // C2 — legal basis must be stated in the message itself (Grt./GDPR first contact).
  if (!/jogos érdek|GDPR|Grt/iu.test(text)) {
    reasons.push("C2: hiányzik a jogalap-tájékoztatás (Grt./GDPR) az SMS szövegéből");
  }

  // C3 — personalization.
  if (leadName && !text.toLowerCase().includes(leadName.toLowerCase())) {
    reasons.push("C3: az SMS nem hivatkozik a lead nevére (tömeg-szöveg gyanú)");
  }

  // C4 + §A — no finished-site claim; explicit preview framing required.
  for (const p of MISLEADING_PATTERNS) {
    if (p.test(text)) {
      reasons.push("C4: félrevezető állítás (kész/élő oldalt sugall) — §A demo-framing sérül");
      break;
    }
  }
  if (!FRAMING_PATTERN.test(text)) {
    reasons.push("C4: hiányzik az explicit terv/előzetes keretezés (§A demo-framing)");
  }

  // C4/Fttv. — an advertised price must be the OWNER-CONFIRMED real price.
  if (!isPricingConfirmed() && /forinttól|Ft-tól|havi\s[\d  ]+\s?(forint|Ft)/iu.test(text)) {
    reasons.push(
      "C4: az SMS árat hirdet, de az árazás még nincs véglegesítve (Konzol ▸ Árazás)",
    );
  }

  return { verdict: reasons.length ? "FLAG" : "PASS", reasons };
}

export function checkOutreachDraft(
  draft: OutreachDraft,
  leadName: string,
  /** ADR-0036 §C country gate: the lead's language area ("hu" = home market). */
  lang?: string,
): OutreachCheckResult {
  const reasons: string[] = [];
  // §C ORSZÁG-KAPU (ADR-0036): outreach to a non-Hungarian language area is blocked until the
  // country's LEGAL pack (lawful-basis text, opt-out rules — e.g. Polish opt-in regime) gets
  // owner approval. Mock/site/configurator flow freely; cold mail does not.
  if (lang && lang !== "hu") {
    reasons.push(
      `C-ORSZÁG: a(z) "${lang}" nyelvterület jogi csomagja nincs jóváhagyva (ADR-0036) — outreach erre az országra tiltva`,
    );
  }
  const text = draft.subject + "\n" + draft.body;

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
  if (PLACEHOLDER_CONTACT.test(draft.body)) {
    reasons.push("C2: placeholder-gyanús elérhetőség a feladó-blokkban (nem valós identitás)");
  }

  // C2 — the referenced privacy notice must actually be linked (Art. 13/14 page).
  if (!draft.body.includes(draft.privacyLink)) {
    reasons.push("C2: az adatkezelési tájékoztató linkje nincs a levélben");
  }
  if (isUnreachableForRecipient(draft.privacyLink)) {
    reasons.push("C2: az adatkezelési tájékoztató linkje a címzett számára elérhetetlen");
  }

  // C3 — personalization: the lead's own name must appear in subject or body.
  if (leadName && !text.toLowerCase().includes(leadName.toLowerCase())) {
    reasons.push("C3: a levél nem hivatkozik a lead nevére (tömeg-szöveg gyanú)");
  }

  // C4 + §A — no finished-site claim; explicit preview framing required.
  for (const p of MISLEADING_PATTERNS) {
    if (p.test(text)) {
      reasons.push("C4: félrevezető állítás (kész/élő oldalt sugall) — §A demo-framing sérül");
      break;
    }
  }
  if (!FRAMING_PATTERN.test(text)) {
    reasons.push("C4: hiányzik az explicit terv/előzetes keretezés (§A demo-framing)");
  }

  // Legal-basis note (Grt./GDPR transparency line).
  if (!/jogos érdek|GDPR|Grt/iu.test(draft.body)) {
    reasons.push("C2: hiányzik a jogalap-tájékoztatás (Grt./GDPR sor)");
  }

  // C4/Fttv. — an advertised price must be the OWNER-CONFIRMED real price.
  // While pricing is not owner-confirmed (default), any price claim in the mail is
  // a fabricated commercial promise → not sendable. Confirm on Konzol ▸ Árazás.
  if (!isPricingConfirmed() && /forinttól|Ft-tól|havi\s[\d  ]+\s?(forint|Ft)/iu.test(text)) {
    reasons.push(
      "C4: a levél árat hirdet, de az árazás még nincs véglegesítve — a Konzol ▸ Árazás felületen add meg a valós árakat és pipáld be az „Árak véglegesek” kapcsolót",
    );
  }

  return { verdict: reasons.length ? "FLAG" : "PASS", reasons };
}
