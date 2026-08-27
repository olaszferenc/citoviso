// Unified UI screenshot loop — ONE command to SEE any surface at phone AND
// desktop width, every iteration, not just before shipping (§B.19 visitor-eye
// judgment, ADR-0062). Replaces the habit of writing a new one-off shot-*.mts
// per page: routes are served by THIS worktree's code on an EPHEMERAL port, so
// the shared main-tree :4600/:4800 test surface is never touched or clobbered.
//
//   npx tsx scripts/ui-shot.mts <target> [<target> …] [--public] [--fold] [--out=<slug>]
//
// Target forms:
//   path/to/file.html   → rendered from disk (engine mocks, design refs, snapshots)
//   /route?query        → CONSOLE route (operator session minted from the stateless
//                         cookie secret — no password prompt, no DB write)
//   /route + --public   → PUBLIC server route instead of the console
//   /admin… + --tenant  → TENANT-ADMIN route (public server, logged-in tenant session)
//
// Flags:
//   --tenant      shoot the tenant admin as a signed-in tenant (implies --public)
//   --fold        viewport-only shot (above-the-fold judgment) instead of full page
//   --out=<slug>  output name override (single target only)
//
// Output: assets/Temp/ui-<slug>-{mobile,desktop}.png — the owner's drop folder,
// same place the existing shot-*.mts tools write. Never committed (pre-commit
// guards assets/Temp).

process.env.CIT_SHOT = "1"; // suppress server boot self-heal (no AI calls, no DB writes)

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Server } from "node:http";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "assets", "Temp");

const args = process.argv.slice(2);
const usePublic = args.includes("--public") || args.includes("--tenant");
// --tenant: a publikus szerver TENANT-ADMIN felületei (/admin…) — bejelentkezett
// tenantként lő, különben a /login-ra terelne. Magában foglalja a --public-ot.
const useTenant = args.includes("--tenant");
const foldOnly = args.includes("--fold");
const outOverride = (args.find((a) => a.startsWith("--out=")) ?? "").split("=")[1] ?? "";
const targets = args.filter((a) => !a.startsWith("--"));

if (!targets.length) {
  console.error(
    "használat: npx tsx scripts/ui-shot.mts <fájl.html | /route> [...] [--public] [--fold] [--out=slug]",
  );
  process.exit(1);
}
if (outOverride && targets.length > 1) {
  console.error("--out csak egyetlen célnál használható");
  process.exit(1);
}

/** A target is a FILE if it looks like an HTML file or exists on disk — an
 * absolute file path also starts with "/", so the prefix alone can't decide. */
function isFileTarget(t: string): boolean {
  return /\.html?$/i.test(t) || existsSync(path.resolve(process.cwd(), t));
}

const VIEWPORTS = [
  { tag: "mobile", width: 390, height: 844 }, // the owner works from a phone — not optional
  { tag: "desktop", width: 1280, height: 900 },
] as const;

/** Route targets need a live server from THIS worktree — boot it on an ephemeral port. */
async function bootServer(): Promise<{ port: number; cookie: string | null }> {
  if (usePublic) {
    process.env.PUBLIC_PORT = "0";
    const { server } = (await import("../src/server/public.js")) as { server: Server };
    if (!server.listening) await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("public szerver cím nélkül");
    // A TENANT-ADMIN (/admin) a publikus szerveren él és bejelentkezést kér — enélkül a
    // /login-ra terelne, és a doktrína ① célja (LÁSD, amit generálsz) teljesíthetetlen
    // lenne ezekre a felületekre. Ugyanaz a stateless HMAC-minta, mint az operátornál:
    // nem hitelesítés-megkerülés, hanem a szerver-folyamaton BELÜLI süti-aláírás.
    if (useTenant) {
      const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
      const { db } = await import("../src/db/client.js");
      const tu =
        (await db
          .selectFrom("tenant_user")
          .select("id")
          .where("username", "=", "claude-test")
          .executeTakeFirst()) ??
        (await db.selectFrom("tenant_user").select("id").limit(1).executeTakeFirst());
      if (!tu) throw new Error("nincs tenant_user a dev DB-ben — /admin route nem lőhető");
      return { port: addr.port, cookie: mintTenantCookieValue(tu.id) };
    }
    return { port: addr.port, cookie: null };
  }
  process.env.CONSOLE_PORT = "0";
  const { server } = (await import("../src/console/server.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
  // Mint an operator session against our own in-process server (stateless HMAC cookie).
  const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
  const { db } = await import("../src/db/client.js");
  const op =
    (await db
      .selectFrom("operator_user")
      .select("id")
      .where("username", "=", "claude-test")
      .executeTakeFirst()) ??
    (await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst());
  if (!op) throw new Error("nincs operator_user a dev DB-ben — konzol-route nem lőhető");
  return { port: addr.port, cookie: mintOperatorCookieValue(op.id) };
}

function slugFor(target: string): string {
  if (outOverride) return outOverride;
  const base = !isFileTarget(target)
    ? target
    : path.basename(target).replace(/\.html?$/i, "");
  const s = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "index";
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const needServer = targets.some((t) => !isFileTarget(t));
  const srv = needServer ? await bootServer() : null;

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const shots: string[] = [];
  for (const target of targets) {
    const url = !isFileTarget(target)
      ? `http://localhost:${srv!.port}${target}`
      : pathToFileURL(path.resolve(process.cwd(), target)).href;
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      if (!isFileTarget(target) && srv?.cookie) {
        await context.addCookies([
          {
            // A két realm külön sütit használ (ADR-0021 control/data plane): a
            // tenant-admin `cit_session`-t olvas, a konzol `cit_op_session`-t.
            name: useTenant ? "cit_session" : "cit_op_session",
            value: srv.cookie,
            url: `http://localhost:${srv.port}`,
          },
        ]);
      }
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(600); // let webfonts + lazy images settle
      const dest = path.join(OUT, `ui-${slugFor(target)}-${vp.tag}.png`);
      await page.screenshot({ path: dest, fullPage: !foldOnly });
      shots.push(dest);
      console.log(`  ${target} @${vp.width}px → ${dest}`);
      await context.close();
    }
  }
  await browser.close();
  console.log(`\n✅ ${shots.length} screenshot — MOST NÉZD MEG ŐKET (Read), ne csak hivatkozz rájuk.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`❌ ${(e as Error).message}`);
    process.exit(1);
  });
