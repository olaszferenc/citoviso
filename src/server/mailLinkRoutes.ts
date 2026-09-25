/**
 * The routes our E-MAILS link to — and which therefore must answer on the host the
 * mail was built from.
 *
 * ⛔ MEASURED 2026-09-24 (Elek FK-008 follow-up, live probe read-only): a guest books on
 * the tenant's own host (`<slug>.citoviso.com` or a custom domain), the mails are built
 * with `publicBaseUrl(req)` = THAT host, and `serveTenantHost()` answered every
 * non-root path with 404 "Nincs ilyen oldal." — so the owner's accept/decline link, the
 * guest's cancel link, the offer links and the review verdict link were all dead in
 * production (0 real bookings so far, so nobody was hit yet). The dev `/t/<slug>/` path
 * never showed it: there the request host is the platform, where these handlers live.
 *
 * The fix keeps the links as they are (the host the person is already on) and lets the
 * tenant host serve exactly these paths through the platform handlers. ONE list, used by
 * the server's dispatcher AND by `scripts/guest-link-host-check.mts` — a second copy is
 * how the next dead link gets written.
 */

/** GET confirms, POST cancels — the guest's key from the confirmation mail. */
export const RE_GUEST_CANCEL = /^\/foglalas\/([A-Za-z0-9_-]{16,80})\/lemondom$/;
/** Booking-offer ⑪: the guest's offer page (GET shows, POST answers) — the guest's key. */
export const RE_GUEST_OFFER = /^\/ajanlat\/([A-Za-z0-9_-]{16,80})(?:\/(elfogadom|nem-kerem))?$/;
/** Booking-offer ④: the owner's offer page — the owner's key (action_token). */
export const RE_OWNER_OFFER = /^\/foglalas\/([A-Za-z0-9_-]{16,80})\/ajanlat$/;
/** The owner's one-tap verdict on a request, from the notification mail. */
export const RE_OWNER_DECIDE = /^\/foglalas\/([A-Za-z0-9_-]{16,80})\/(elfogadom|elutasitom)$/;
/** The owner's one-tap verdict on a guest review, from the notification mail. */
export const RE_OWNER_REVIEW = /^\/velemeny\/([A-Za-z0-9_-]{16,80})\/(kiteszem|nem-teszem-ki)$/;

/**
 * Every mail-linked route, with a sample path the guard can knock on. The sample
 * token is syntactically valid and unknown, so the platform handler answers with
 * its own "link is dead" page (404) — which is exactly NOT the tenant host's
 * "Nincs ilyen oldal." page. A route added here without a sample is a type error.
 */
export const MAIL_LINK_ROUTES: readonly { readonly re: RegExp; readonly sample: string; readonly who: "vendég" | "tulaj" }[] = [
  { re: RE_GUEST_CANCEL, sample: "/foglalas/probe-token-000000000001/lemondom", who: "vendég" },
  { re: RE_GUEST_OFFER, sample: "/ajanlat/probe-token-000000000001", who: "vendég" },
  { re: RE_OWNER_OFFER, sample: "/foglalas/probe-token-000000000001/ajanlat", who: "tulaj" },
  { re: RE_OWNER_DECIDE, sample: "/foglalas/probe-token-000000000001/elfogadom", who: "tulaj" },
  { re: RE_OWNER_REVIEW, sample: "/velemeny/probe-token-000000000001/kiteszem", who: "tulaj" },
];

/**
 * Should a request on a TENANT host skip the tenant site handler and fall through to
 * the platform handlers? True for the mail-linked routes and for `/assets/…`: those
 * pages load `/assets/ui/citui.css`, and the tenant host served no assets at all
 * (measured live: 404) — the live snapshot inlines its own runtime, so nothing else
 * on the tenant host ever needed them.
 */
export function servesOnTenantHostToo(pathname: string): boolean {
  if (pathname.startsWith("/assets/")) return true;
  return MAIL_LINK_ROUTES.some((r) => r.re.test(pathname));
}
