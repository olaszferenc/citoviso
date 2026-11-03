// Search Console submission tick (ADR-0415) — run by citoviso-search-console.timer.
//
//   npx tsx scripts/search-console-tick.mts            # one reconciliation pass
//
// ⛔ ONLY the live host talks to Google: isLiveHost(PUBLIC_BASE_URL) builds the real
// client from the service-account key; anywhere else the recording mock runs and the
// sitemaps are read from the LOCAL public server (Host header), so dev never reaches
// Google and never reads the production sites. The log rows carry live=false there.
// Live host without a key file = "beállításra vár" line, exit 0 (nothing to retry).
// Exit: 0 = the pass ran (individual target failures are logged + retried, not fatal),
//       1 = the pass itself crashed (→ OnFailure house mail).

import http from "node:http";
import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { getDns } from "../src/domains/dns/index.js";
import { isLiveHost } from "../src/invoicing/keyGuard.js";
import { alertHouse } from "../src/console/houseAlert.js";
import { googleClient, loadServiceAccountKey, mockClient } from "../src/visibility/googleSearchConsole.js";
import { runSearchConsoleTick, type SitemapFetch } from "../src/visibility/searchConsoleTick.js";

const stamp = (): string => new Date().toISOString();
const live = isLiveHost(config.publicBaseUrl);

/** Live: the public address, exactly as Google fetches it (a 301 is a 301, not followed). */
async function fetchPublic(host: string): Promise<SitemapFetch> {
  const res = await fetch(`https://${host}/sitemap.xml`, {
    redirect: "manual",
    headers: { "user-agent": "CitovisoSearchConsoleTick/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, body: await res.text() };
}

/** Dev: the local public server (PUBLIC_SITE_URL — the main tree's :4800, not a worktree's
 *  PUBLIC_PORT), addressed by Host header — the same routing code path. */
function fetchLocal(host: string): Promise<SitemapFetch> {
  const local = new URL(config.publicSiteUrl);
  return new Promise((resolve) => {
    const req = http.request(
      { host: local.hostname, port: Number(local.port || 80), path: "/sitemap.xml", headers: { host }, timeout: 10_000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("időtúllépés")));
    req.on("error", (e) => resolve({ status: 0, body: e.message }));
    req.end();
  });
}

let code = 0;
try {
  let client;
  if (live) {
    const key = await loadServiceAccountKey(config.searchConsoleKeyFile);
    if (!key) {
      console.log(`[${stamp()}] search-console: beállításra vár — nincs service-account kulcs (${config.searchConsoleKeyFile})`);
      await db.destroy();
      process.exit(0);
    }
    client = googleClient(key);
  } else {
    client = mockClient();
  }
  const owners = config.searchConsoleOwnerEmails.split(",").map((s) => s.trim()).filter(Boolean);
  const r = await runSearchConsoleTick({
    client,
    dns: getDns(),
    fetchSitemap: live ? fetchPublic : fetchLocal,
    platformProperty: config.searchConsolePlatformProperty,
    ownerEmails: owners,
    alert: (subject, text) => alertHouse({ tag: "search-console", subject, text }),
  });
  console.log(
    `[${stamp()}] search-console${live ? "" : " (MOCK — dev, a Google-t nem hívtuk)"}: ` +
      `új cél ${r.planned} · kivezetve ${r.retired} · beküldve ${r.submitted.length} · változatlan ${r.unchanged} · ` +
      `vár ${r.waiting.length} · hiba ${r.failed.length}`,
  );
  for (const u of r.submitted) console.log(`  ✓ ${u}`);
  for (const u of r.waiting) console.log(`  … ${u}`);
  for (const u of r.failed) console.log(`  ✗ ${u}`);
} catch (e) {
  console.error(`[${stamp()}] search-console: a futás elhasalt: ${(e as Error).stack ?? e}`);
  code = 1;
}
await db.destroy();
process.exit(code);
