// MAIL OPEN WITHOUT A PIXEL (ADR-0462 kiserlet-motor-hideg-megkereses, brief kiserlet-motor-20261121 ②).
//
// Until now the cold letter's hero screenshot rode CID-inline (553 KB per letter) and nothing
// measured whether the letter was opened at all (`src/email/sender.ts`: "no open-tracking") —
// the three non-opener groups (spam / saw the subject / read it, did not click) could not be
// told apart. Now, on the COLD lane only, the hero image loads from the cold host on a URL that
// is unique per lead (the prospect's unguessable token): the fetch is the open. No invisible
// pixel — the image is the letter's own content, the same one the recipient saw before.
//
// Classification (who fetched, not who the person is):
//   GoogleImageProxy        → open (Gmail fetches through its proxy when the letter is opened)
//   YahooMailProxy          → open
//   Apple Mail fetch        → proxy_prefetch: Mail Privacy Protection downloads every image at
//                             DELIVERY, opened or not — counted apart, never as an open. A Mac
//                             Mail client without MPP sends the same User-Agent, so a real Apple
//                             open is undercounted rather than an Apple prefetch overcounted.
//   BOT_PATTERN             → bot (the list mock_view uses for device 'bot')
//   anything else           → open (a mail client loading the image itself)
// The owner's pilot copy carries `?sajat=1` (markOwnViewLinks) and is never written.
//
// ⛔ Nothing raw is stored: no User-Agent, no IP (ADR-0322 ③ — the report needs the class).

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "../db/client.js";
import { BOT_PATTERN } from "../analytics/userAgent.js";
import { coldLaneActive, coldLinkBase } from "./coldLane.js";

export type EmailOpenKind = "open" | "proxy_prefetch" | "bot";
export type EmailOpenClient = "gmail_proxy" | "yahoo_proxy" | "apple_proxy" | "client" | "bot";

/** Where the per-lead mail copy of the hero lives (data plane, next to the hero shots). */
export const MAIL_HERO_DIR = path.resolve(process.cwd(), "sites/_outreach-shots/mail");

/** The path segment after /p/<token>/ — one name, used by the URL, the route and the own-view mark. */
export const MAIL_HERO_FILE = "kep.jpg";

/** Route shape: /p/<token>/kep.jpg (the console answers /p/ on every host, edgeRoutes.ts). */
export const RE_MAIL_HERO = /^\/p\/([A-Za-z0-9_-]{16,})\/kep\.jpg$/;

const TOKEN_SAFE = /^[A-Za-z0-9_-]{16,}$/;

/** Apple IP block (17.0.0.0/8) — Apple's own egress, used by its mail proxy. */
function isAppleIp(ip: string | null | undefined): boolean {
  const v4 = (ip ?? "").replace(/^::ffff:/i, "");
  return /^17\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4);
}

/**
 * Pure classification of one fetch. `ip` is read for the Apple block only, never stored.
 * Order matters: the Gmail proxy UA mentions "Firefox" and would read as a client.
 */
export function classifyMailFetch(ua: string | null | undefined, ip?: string | null): { kind: EmailOpenKind; client: EmailOpenClient } {
  const s = (ua ?? "").trim();
  if (/GoogleImageProxy/i.test(s)) return { kind: "open", client: "gmail_proxy" };
  if (/YahooMailProxy/i.test(s)) return { kind: "open", client: "yahoo_proxy" };
  // Apple MPP: Apple's egress, the bare "Mozilla/5.0", or the WebKit Mac UA without a browser token.
  const appleMailUa = /Macintosh/i.test(s) && /AppleWebKit/i.test(s) && !/Safari\/|Version\/|Chrome\/|Firefox\//i.test(s);
  if (isAppleIp(ip) || s === "Mozilla/5.0" || appleMailUa) return { kind: "proxy_prefetch", client: "apple_proxy" };
  if (!s || BOT_PATTERN.test(s)) return { kind: "bot", client: "bot" };
  return { kind: "open", client: "client" };
}

/** True when the hero should load remotely: the cold lane is configured (prod), else CID as before. */
export function remoteHeroActive(): boolean {
  return coldLaneActive();
}

/** The per-lead hero URL on the cold host. */
export function mailHeroUrl(token: string): string {
  return `${coldLinkBase()}/p/${token}/${MAIL_HERO_FILE}`;
}

/** Local file of a lead's mail hero. */
export function mailHeroPath(token: string): string {
  if (!TOKEN_SAFE.test(token)) throw new Error("mail hero: invalid token");
  return path.join(MAIL_HERO_DIR, `${token}.jpg`);
}

/**
 * Freeze the hero for THIS letter: a JPEG copy of the shot under the prospect's token, so a
 * later re-render of the mock (new mtime → new shot name) never breaks an image already in a
 * mailbox. 1120 px = 2× the 560 px slot. Returns the file or null when the conversion failed
 * (the caller then sends the letter with the CID image, as before).
 */
export async function storeMailHero(token: string, shotPath: string): Promise<string | null> {
  try {
    const out = mailHeroPath(token);
    await mkdir(MAIL_HERO_DIR, { recursive: true });
    await sharp(shotPath).resize({ width: 1120, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(out);
    return (await stat(out)).size > 0 ? out : null;
  } catch (e) {
    console.error(`[email-open] a levél-kép nem készült el (${token.slice(0, 6)}…): ${(e as Error).message}`);
    return null;
  }
}

/** Record one fetch of a lead's hero. Never throws: the image must be served either way. */
export async function recordMailFetch(prospectId: string, ua: string | null | undefined, ip: string | null | undefined): Promise<EmailOpenKind | null> {
  try {
    const c = classifyMailFetch(ua, ip);
    await db.insertInto("email_open").values({ prospect_id: prospectId, kind: c.kind, client: c.client }).execute();
    return c.kind;
  } catch (e) {
    console.error(`[email-open] nem rögzíthető: ${(e as Error).message}`);
    return null;
  }
}
