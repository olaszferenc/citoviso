// ADR-0435 — WHERE the lead opened the link from (owner, 2026-11-09: „azt is szeretném látni, hogy
// ha tudjuk mérni, honnan nyitotta meg a lead a linket”; frozen plan:
// assets/design-refs/console/honnan-nyitottak/, variant B).
//
// Until this file the outreach link was the SAME on every channel (the lead's preview
// subdomain, one prospect token), so an open could not say which message it came from.
// Now each transport appends ONE letter to the link — `?e` mail, `?s` SMS, `?m` messenger
// (Viber/WhatsApp: the phone picks the app at send time, after the text is frozen — the
// mms_outbox row's `channel` says which), `?w` the automatic WhatsApp follow-up.
//
// ⛔ The tag is applied at the LAST step, on the text that goes to the transport — never
// on the draft. The draft link is what the §C gate, the owner's copy overrides, the
// approval queue and the own-view `?sajat=1` rewrite compare against; tagging it there
// would make every stored override "lose" its link. The tagged link still CONTAINS the
// draft link as a prefix, so every includes()-style check stays true on the sent text.
//
// The page (cit-configurator.js) reads the letter, sends it with the view beacon, and
// strips it from the address bar — a forwarded link no longer credits the first channel.

export type OpenViaTag = "e" | "s" | "m" | "w";
export type OpenVia = "email" | "sms" | "messenger" | "whatsapp";

export const OPEN_VIA_BY_TAG: Readonly<Record<OpenViaTag, OpenVia>> = {
  e: "email",
  s: "sms",
  m: "messenger",
  w: "whatsapp",
};

/** The beacon's `via` → the stored value; anything else is null (never trusted further). */
export function openViaFromTag(tag: unknown): OpenVia | null {
  return typeof tag === "string" && Object.prototype.hasOwnProperty.call(OPEN_VIA_BY_TAG, tag)
    ? OPEN_VIA_BY_TAG[tag as OpenViaTag]
    : null;
}

/**
 * The link with its channel letter. A bare host gets `/?e` (what the owner approved and
 * what a browser shows anyway); a path gets `?e`; a link that already has a query is left
 * alone (no such outreach link exists today — guessing a join would risk breaking it).
 */
export function tagLink(link: string, tag: OpenViaTag): string {
  if (!/^https?:\/\//i.test(link) || link.includes("?") || link.includes("#")) return link;
  return /^https?:\/\/[^/]+$/i.test(link) ? `${link}/?${tag}` : `${link}?${tag}`;
}

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Tag every occurrence of `link` in `text` that is the WHOLE link — not a prefix of a
 * longer URL (the opt-out link is `<link>/unsubscribe` when the link is a /p/ path).
 * Sentence punctuation right after the link (". , ! ?") still counts as the link's end.
 */
export function tagLinkInText(text: string, link: string, tag: OpenViaTag): string {
  const tagged = tagLink(link, tag);
  if (tagged === link || !link) return text;
  const re = new RegExp(`${escRe(link)}(?![\\w/#=&%~+-]|\\?[\\w])`, "g");
  return text.replace(re, tagged);
}

/** The WhatsApp follow-up copies the messenger caption: its `?m` links become `?w`. */
export function retagMessengerAsWhatsapp(text: string): string {
  return text.replace(/(https?:\/\/[^\s?#]+)\?m(?![\w=&])/g, "$1?w");
}
