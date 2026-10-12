/**
 * ADR-0366 (Elek 10-11 B1) — WHICH SERVER ANSWERS A PATH on (*.)citoviso.com.
 *
 * In production nginx decides (deploy/nginx/citoviso.conf, a read-only copy of
 * /etc/nginx/sites-enabled/citoviso): these prefixes go to the console (:4600), everything
 * else to the public server (:4800) — on EVERY host of the block, the lead's own preview
 * subdomain (ADR-0330) included. ADR-0212 added all but /p/ on 2026-08-09.
 *
 * ⛔ This list is that routing as code, ONE copy. Until it existed the only statement in
 * the repo was a comment in public.ts saying "/p/ → console, the rest → public" — a test
 * harness built from that comment sent the configurator's /configure/… calls to the public
 * server, got 404, and the order fell back silently (Elek 10-11 B1). The dev public server
 * now forwards these prefixes on the preview host the way nginx does, and
 * scripts/edge-routing-check.mts fails when this list and the nginx copy disagree.
 *
 * nginx `location /x/` is a PREFIX match, so this is startsWith — `/privacy` (no slash)
 * also catches `/privacy…`, exactly as the location block does.
 */
export const CONSOLE_EDGE_PREFIXES: readonly string[] = ["/p/", "/configure/", "/pay/", "/privacy", "/mock/", "/site/"];

/** Does nginx send this path to the console (true) or the public server (false)? */
export function routesToConsole(pathname: string): boolean {
  return CONSOLE_EDGE_PREFIXES.some((p) => pathname.startsWith(p));
}
