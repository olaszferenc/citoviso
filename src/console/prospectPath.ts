// Shape of the tracked outreach link (/p/…), in one testable place.
//
// Why the slug exists (2026-08-25): the cold mail's only call to action used to be
// a bare random token — https://citoviso.com/p/zk5fv80Z4mMGN6gbQCp45XgU — which,
// arriving from an unknown sender, reads exactly like a phishing link. Putting the
// recipient's own business name in front of it (/p/napfeny-panzio/<token>) turns
// the URL itself into evidence that the mail is about THEM.
//
// The slug is COSMETIC. The unguessable token alone identifies the prospect and
// guards the preview, so a slug can never be used to browse another lead's page
// by typing their name.

/** Token shape embedded in the tracked link (kept in sync with the /p/ routes). */
const TOKEN = "[A-Za-z0-9_-]{16,}";

/**
 * Strip an optional readable slug segment: /p/<slug>/<token>… → /p/<token>…
 *
 * Links ALREADY SENT use the bare /p/<token> shape and must keep working forever,
 * so this is a normalization rather than a replacement. The trailing lookahead
 * means "unsubscribe" / "event" / "request" can never be mistaken for a token:
 * the segment after a slug must itself be 16+ chars to trigger the rewrite.
 */
export function normalizeProspectPath(path: string): string {
  return path.replace(
    new RegExp(`^/p/[a-z0-9][a-z0-9-]*/(${TOKEN})(?=$|/)`),
    "/p/$1",
  );
}

// ── The OWN-VIEW marker (owner's request, 2026-10-05) ─────────────────────────
//
// The owner opens the very links the leads get: the pilot copies (EMAIL_BCC mail,
// OUTREACH_COPY_PHONE SMS), the console's link and the e-mail preview. Measured
// live the same day: one of his opens (the SMS copy, 8 s after the Google Messages
// preview) was counted as the lead's visit and moved the prospect to "opened".
// The copies carry the SAME token as the lead's message, so the server cannot tell
// them apart — the link itself has to say it. A marked link serves the same page
// the lead sees, with no measurement at all (no mock_view, no events, no offer).
//
// The marker is not a secret: a lead who adds it only stops us measuring them.

/** Query parameter that marks an owner/operator open of a tracked link. */
export const OWN_VIEW_PARAM = "sajat";

/**
 * ADR-0330: the lead's preview host link — `https://<label>.citoviso.com`, bare (no path).
 * Recognized by shape: a bare platform-subdomain URL. A tenant's live-site link has the
 * same shape; marking it too is harmless (the tenant host ignores the parameter).
 */
const PREVIEW_HOST_LINK = /(https?:\/\/(?!www\.|admin\.)[a-z0-9][a-z0-9-]*\.citoviso\.com)\/?(?![A-Za-z0-9_/?#.-])/g;

/** `?sajat=1` appended to one tracked page link (no existing query expected). */
export function ownViewHref(link: string): string {
  return `${link}?${OWN_VIEW_PARAM}=1`;
}

/**
 * Mark every tracked PAGE link (/p/<token> or /p/<slug>/<token>) in a message body.
 * Sub-routes (/unsubscribe, /feedback, …) and links that already carry a query are
 * left alone: the lookahead refuses a following path, query or token character.
 */
export function markOwnViewLinks(body: string): string {
  return body
    .replace(
      new RegExp(`(/p/(?:[a-z0-9][a-z0-9-]*/)?${TOKEN})(?![A-Za-z0-9_/?#-])`, "g"),
      `$1?${OWN_VIEW_PARAM}=1`,
    )
    .replace(PREVIEW_HOST_LINK, `$1/?${OWN_VIEW_PARAM}=1`);
}

/** True when the message carries at least one tracked page link. */
export function hasTrackedLink(body: string): boolean {
  return markOwnViewLinks(body) !== body;
}
