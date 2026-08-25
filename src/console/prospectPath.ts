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
