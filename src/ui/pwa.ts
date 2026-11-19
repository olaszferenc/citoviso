/**
 * Installable app (PWA) — 2026-11-19, owner request ("csináld meg!", OF brief).
 *
 * Android Chrome refused to install the site ("nem telepíthető alkalmazásként"): there was no
 * Web App Manifest and no service worker, so a home-screen shortcut opened a new browser tab on
 * every tap. Two separate apps, one per origin (each origin is its own app identity):
 *
 *   console  admin.citoviso.com (:4600) — the operator console the owner uses daily
 *   public   citoviso.com (:4800)       — the homepage + the customer login
 *
 * Scope is "/" on both, so the login page and every redirect after it stay inside the
 * installed window. Tenant sites (<slug>.citoviso.com, custom domains) get NOTHING from here:
 * the public server answers these paths only on platform hosts, and only the homepage and the
 * platform /login carry the <link rel="manifest">.
 *
 * ⛔ The service worker caches NOTHING (live system: stale data = a bug). It exists to make the
 * app installable and to show a small offline page when a GET navigation cannot reach the
 * network. Data, API calls, assets and every POST go straight to the network, untouched.
 */

import { readFile } from "node:fs/promises";
import type http from "node:http";
import path from "node:path";
import { jsonForScript } from "../text/jsonForScript.js";

export type PwaApp = "console" | "public";

/** Splash + toolbar colour: the brand navy (--citui-navy-900). A manifest is JSON, it cannot
 *  read a CSS token, so the value is mirrored here — keep it equal to citui.css. */
export const PWA_BG = "#0e2a47"; // token-exempt: manifest/meta need a literal (= --citui-navy-900)

const ICONS = [
  { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
] as const;

export function pwaManifest(app: PwaApp): Record<string, unknown> {
  const isConsole = app === "console";
  return {
    id: isConsole ? "/?app=citoviso-console" : "/?app=citoviso",
    name: isConsole ? "Citoviso konzol" : "Citoviso",
    short_name: isConsole ? "Konzol" : "Citoviso",
    description: isConsole ? "Citoviso belső konzol" : "Citoviso – honlap szálláshelyeknek",
    lang: "hu",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PWA_BG,
    theme_color: PWA_BG,
    icons: ICONS,
  };
}

/**
 * The tags every in-scope page carries in its <head>. iOS (Safari "Add to Home Screen") reads the
 * manifest's `display` but takes the icon from apple-touch-icon (opaque, 180 px — transparent
 * corners turn black) and the label from apple-mobile-web-app-title (else the page <title>,
 * e.g. "Belépés — Citoviso konzol").
 */
export function pwaHead(app: PwaApp): string {
  return (
    `<link rel="manifest" href="/manifest.webmanifest">` +
    `<meta name="theme-color" content="${PWA_BG}">` +
    `<link rel="apple-touch-icon" sizes="180x180" href="/pwa/apple-touch-icon.png">` +
    `<meta name="apple-mobile-web-app-title" content="${app === "console" ? "Konzol" : "Citoviso"}">` +
    `<meta name="apple-mobile-web-app-capable" content="yes">` +
    `<meta name="mobile-web-app-capable" content="yes">` +
    `<script>if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(function(){});</script>`
  );
}

/** Insert pwaHead() before </head> of a full HTML document (no-op if there is no </head>). */
export function withPwaHead(html: string, app: PwaApp): string {
  const i = html.search(/<\/head>/i);
  return i < 0 ? html : html.slice(0, i) + pwaHead(app) + html.slice(i);
}

const OFFLINE_HTML =
  `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1"><title>Nincs kapcsolat — Citoviso</title></head>` +
  `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
  `background:${PWA_BG};color:#eaf3f8;font:16px/1.5 system-ui,sans-serif;text-align:center">` + // token-exempt: offline page has no stylesheet
  `<div style="padding:24px;max-width:420px"><h1 style="font-size:1.4rem;margin:0 0 8px">Nincs internetkapcsolat</h1>` +
  `<p style="margin:0 0 20px">Az oldal most nem érhető el. Ellenőrizd a kapcsolatot, és próbáld újra.</p>` +
  `<button onclick="location.reload()" style="font:inherit;padding:10px 20px;border:0;border-radius:10px;` +
  `background:#1fb6d6;color:#06131b;font-weight:600">Újra</button></div></body></html>`; // token-exempt

/** The service worker. Caches nothing; only a failed GET navigation gets the offline page. */
export const PWA_SW_JS =
  `// Citoviso PWA service worker (src/ui/pwa.ts). Caches NOTHING — live data only.\n` +
  `const OFFLINE = ${jsonForScript(OFFLINE_HTML)};\n` +
  `self.addEventListener("install", () => self.skipWaiting());\n` +
  `self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));\n` +
  `self.addEventListener("fetch", (e) => {\n` +
  `  const req = e.request;\n` +
  `  if (req.mode !== "navigate" || req.method !== "GET") return;\n` +
  `  e.respondWith(fetch(req).catch(() => new Response(OFFLINE, {\n` +
  `    status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },\n` +
  `  })));\n` +
  `});\n`;

const ICON_FILES: Record<string, string> = {
  "/pwa/icon-192.png": "icon-192.png",
  "/pwa/icon-512.png": "icon-512.png",
  "/pwa/icon-maskable-512.png": "icon-maskable-512.png",
  "/pwa/apple-touch-icon.png": "apple-touch-icon.png",
};

/**
 * Answer the PWA paths (/manifest.webmanifest, /sw.js, /pwa/icon-*.png). Returns true when it
 * handled the request. Must run BEFORE any auth gate: Chrome fetches the manifest and its icons
 * without cookies.
 */
export async function servePwa(
  app: PwaApp,
  method: string,
  pathname: string,
  res: http.ServerResponse,
): Promise<boolean> {
  if (method !== "GET" && method !== "HEAD") return false;
  if (pathname === "/manifest.webmanifest") {
    res.writeHead(200, { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "max-age=3600" });
    res.end(method === "HEAD" ? undefined : JSON.stringify(pwaManifest(app)));
    return true;
  }
  if (pathname === "/sw.js") {
    // no-cache: a fixed worker must reach installed apps on their next start.
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" });
    res.end(method === "HEAD" ? undefined : PWA_SW_JS);
    return true;
  }
  const file = ICON_FILES[pathname];
  if (file) {
    try {
      const buf = await readFile(path.resolve(process.cwd(), "public/assets/pwa", file));
      res.writeHead(200, { "content-type": "image/png", "cache-control": "max-age=86400" });
      res.end(method === "HEAD" ? undefined : buf);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
    }
    return true;
  }
  return false;
}
