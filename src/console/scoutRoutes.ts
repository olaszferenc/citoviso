// `/scout` routes — the scout worksheet (ADR-0336). Mounted by server.ts in ONE block
// behind the operator auth gate. The page is HTML; every mutation is a small JSON POST
// that answers with the region's tiles, the counters and the selected tile's rows, so
// the page always shows what the DB holds (ADR-0331: saved on change, nothing in memory).

import type http from "node:http";
import { T } from "../i18n/mail.js";
import { webClass } from "../scout/rules.js";
import {
  addLinks,
  closeScoutTile,
  ensureTiles,
  getTile,
  listScoutRegions,
  listTiles,
  reapStuckScoutTiles,
  reopenScoutTile,
  savePlaceField,
  scoutStats,
  setKeyword,
  splitScoutTile,
  tilePlaces,
  type ScoutRegion,
  type TileView,
} from "../scout/store.js";
import { consoleLang } from "./i18nCtx.js";
import { runningScoutTile, startScoutJob } from "./scrapeJob.js";
import { scoutPage } from "./scoutViews.js";

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function body(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The tile to show first: the URL's, else one in progress, else the first open one. */
function pickTile(tiles: readonly TileView[], wanted: string | null): string | null {
  const leaf = (t: TileView) => t.state !== "split" && t.state !== "out";
  if (wanted && tiles.some((t) => t.id === wanted && leaf(t))) return wanted;
  return (
    tiles.find((t) => t.state === "work" || t.state === "sat")?.id ??
    tiles.find((t) => t.state === "todo")?.id ??
    tiles.find(leaf)?.id ??
    null
  );
}

async function regionState(region: ScoutRegion, sel: string | null, lang: string) {
  await reapStuckScoutTiles(region.id, runningScoutTile());
  const tiles = await listTiles(region.id, lang);
  const stats = await scoutStats(region, tiles);
  const places = sel ? await tilePlaces(sel) : [];
  return { tiles, stats, places, sel };
}

async function regionOf(id: string): Promise<ScoutRegion | null> {
  return (await listScoutRegions()).find((r) => r.id === id) ?? null;
}

/** Returns true when the request was a `/scout` route (answered here). */
export async function handleScoutRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  method: string,
  path: string,
  url: URL,
): Promise<boolean> {
  if (path !== "/scout" && !path.startsWith("/scout/")) return false;
  const lang = consoleLang();

  // GET /scout — the worksheet of one region (tiles created on the first visit).
  if (method === "GET" && path === "/scout") {
    const regions = await listScoutRegions();
    const region = regions.find((r) => r.id === url.searchParams.get("region")) ?? regions[0];
    if (!region) {
      res.writeHead(303, { location: "/scrape/regions" });
      res.end();
      return true;
    }
    await ensureTiles(region);
    const tiles0 = await listTiles(region.id, lang);
    const sel = pickTile(tiles0, url.searchParams.get("tile"));
    const st = await regionState(region, sel, lang);
    const html = scoutPage({ regions, region, ...st });
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return true;
  }

  // GET /scout/check?web=… — the website field's live verdict (classifyWebsite, server-side).
  if (method === "GET" && path === "/scout/check") {
    json(res, 200, { webC: webClass(url.searchParams.get("web") ?? "") });
    return true;
  }

  const tileM = /^\/scout\/tile\/([0-9a-f-]{36})(?:\/(kw|split|links|close))?$/i.exec(path);
  if (tileM) {
    const tile = await getTile(tileM[1]!);
    if (!tile) return json(res, 404, { error: "nf" }), true;
    const region = await regionOf(tile.region);
    if (!region) return json(res, 404, { error: "nf" }), true;
    const action = tileM[2];

    if (method === "GET" && !action) {
      json(res, 200, await regionState(region, tile.id, lang));
      return true;
    }
    if (method !== "POST" || !action) return false;
    const b = await body(req);

    if (action === "kw") {
      const err = await setKeyword(tile, String(b.kw ?? ""), String(b.value ?? ""));
      if (err) {
        json(res, 200, {
          error: err.error,
          soft: true,
          message: err.error === "int" ? T(lang, "Csak egész szám: hány találatot mutatott a lista.") : T(lang, "Lezárt csempe nem szerkeszthető."),
        });
        return true;
      }
      json(res, 200, await regionState(region, tile.id, lang));
      return true;
    }
    if (action === "split") {
      const r = await splitScoutTile(tile, region.circle);
      if ("error" in r) {
        json(res, 200, { error: r.error, soft: true, message: T(lang, "Csak telített csempe bontható négyfelé.") });
        return true;
      }
      json(res, 200, await regionState(region, r.first, lang));
      return true;
    }
    if (action === "links") {
      const r = await addLinks(tile, String(b.links ?? ""));
      if ("error" in r) {
        json(res, 200, {
          error: r.error,
          soft: true,
          message: r.error === "empty" ? T(lang, "Illessz be legalább egy Térkép-hely linket.") : T(lang, "Válassz egy nyitott csempét."),
        });
        return true;
      }
      json(res, 200, { ...r, ...(await regionState(region, tile.id, lang)) });
      return true;
    }
    if (action === "close") {
      const r = await closeScoutTile(tile, lang);
      if ("error" in r) {
        json(res, 200, { error: "gate", soft: true, message: r.error, ...(await regionState(region, tile.id, lang)) });
        return true;
      }
      if (r.procRows > 0) {
        const busy = startScoutJob(region.id, tile.id, (code) => {
          if (code !== 0) {
            console.error(`[scout] a csempe (${tile.label}) feldolgozása nem futott végig (exit ${code}) — a csempe újra nyitott.`);
            void reopenScoutTile(tile.id).catch(() => {});
          }
        });
        if (busy) {
          await reopenScoutTile(tile.id);
          json(res, 200, {
            error: "busy",
            soft: true,
            message: T(lang, "Már fut egy scrape — a lezárás most nem indítható, próbáld újra pár perc múlva."),
            ...(await regionState(region, tile.id, lang)),
          });
          return true;
        }
      }
      json(res, 200, await regionState(region, tile.id, lang));
      return true;
    }
    return false;
  }

  // POST /scout/place/:id — one field of one row, saved on change.
  const placeM = /^\/scout\/place\/([0-9a-f-]{36})$/i.exec(path);
  if (placeM && method === "POST") {
    const b = await body(req);
    const r = await savePlaceField(placeM[1]!, String(b.field ?? ""), String(b.value ?? ""));
    if ("error" in r) {
      // A refused value (not a whole number, bad rating…) is an answer, not a transport error.
      json(res, r.error === "nf" ? 404 : 200, { error: r.error, soft: r.error !== "nf" });
      return true;
    }
    const tile = await getTile(r.tileId);
    const region = tile ? await regionOf(tile.region) : null;
    if (!tile || !region) return json(res, 404, { error: "nf" }), true;
    json(res, 200, await regionState(region, tile.id, lang));
    return true;
  }
  return false;
}
