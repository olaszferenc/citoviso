// Owner re-entry on the LIVE tenant site. Once a site goes public the owner has no in-page
// path back to their admin: the go-live e-mail is the only pointer and it gets lost. Two quiet
// affordances close that gap — this line under the Citoviso credit strip (visitors skip it, the
// owner always finds it), and the guessable /admin redirect in serveTenantHost.
//
// Injected at SERVE time (the demoFrame.ts pattern) rather than baked into the artifact: the
// engine output stays pure, and the link can never leak onto an outreach mock — at that phase
// there is no account to log into, so a "log in" prompt would be a false promise (§I).

import { PLATFORM_DOMAIN } from "../domains.js";
import { T } from "../engine/templateKit.js";
import { loadPack } from "../i18n/packs.js";

/** The TENANT admin login (data-plane, ADR-0023) — not the operator console. */
export const TENANT_LOGIN_URL = `https://${PLATFORM_DOMAIN}/login`;

const MARKER = "data-cit-owner-login";

/** The snapshot's own `<html lang="xx">` drives the strip's language (ADR-0036). */
function snapshotLang(html: string): string | undefined {
  return /<html[^>]*\blang="([a-zA-Z-]{2,8})"/i.exec(html)?.[1]?.toLowerCase();
}

/**
 * Append the owner-login line before </body>. Idempotent via the marker attribute.
 * Deliberately borderless and muted: it reads as a continuation of the credit strip instead
 * of stacking a second banded footer. Neutral system colors on purpose — `--citui-*` is OUR
 * design core (console/admin/homepage); a tenant page carries the engine's `--cit-*` skin,
 * so the strip must stay skin-agnostic and legible on any background.
 */
export async function injectOwnerLogin(html: string): Promise<string> {
  if (html.includes(MARKER)) return html;
  const lang = snapshotLang(html);
  await loadPack(lang ?? "hu"); // T() resolves synchronously — the pack must be warm first
  const d = { lang };
  const strip =
    `<div ${MARKER} style="font:400 12px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;` +
    `text-align:center;padding:0 20px 16px;color:#9a9a9a">` +
    `<a href="${TENANT_LOGIN_URL}" rel="nofollow" ` +
    `style="color:inherit;text-decoration:none;border-bottom:1px solid rgba(128,128,128,.35)">` +
    T(d, "Tulajdonosi belépés") +
    `</a></div>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${strip}</body>`);
  return html + strip;
}
