// Facebook-pilot CLI — proves that a Business-portfolio SYSTEM USER token can publish to
// the Citoviso's own Page (brief facebook-pilot-20261104, step 3). Pilot only: it posts
// ONLY to the page id in the config, never to a lodging's page or a group.
//
// Config (outside the repo, mode 600): ~/.config/citoviso/fb-pilot.json
//   { "pageId": "…", "systemUserToken": "…" }
//
//   npx tsx scripts/fb-pilot.mts check                      token type, scopes, pages it can manage
//   npx tsx scripts/fb-pilot.mts photo <kép> <szövegfájl> [--go]
//   npx tsx scripts/fb-pilot.mts reel  <mp4> <szövegfájl> [--go]
//   npx tsx scripts/fb-pilot.mts status <video-id>
//   npx tsx scripts/fb-pilot.mts delete <object-id> --go
//
// Without --go nothing is published (dry run). Tokens are never printed.

import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  deleteObject,
  GRAPH_VERSION,
  inspectToken,
  managedPages,
  pageToken,
  postPhoto,
  publishReel,
  reelStatus,
} from "../src/social/facebookGraph.js";

const CONFIG = join(homedir(), ".config/citoviso/fb-pilot.json");

interface PilotConfig {
  readonly pageId: string;
  readonly systemUserToken: string;
}

function loadConfig(): PilotConfig {
  const st = statSync(CONFIG);
  if ((st.mode & 0o077) !== 0) throw new Error(`${CONFIG} jogosultsága legyen 600`);
  const c = JSON.parse(readFileSync(CONFIG, "utf8")) as Partial<PilotConfig>;
  if (!c.pageId || !c.systemUserToken) throw new Error(`${CONFIG}: pageId és systemUserToken kell`);
  return { pageId: c.pageId, systemUserToken: c.systemUserToken };
}

async function main(): Promise<void> {
  const [cmd, a1, a2] = process.argv.slice(2);
  const go = process.argv.includes("--go");
  const cfg = loadConfig();

  if (cmd === "check") {
    const info = await inspectToken(cfg.systemUserToken);
    console.log(`Graph ${GRAPH_VERSION}`);
    console.log(`token: típus=${info.type} érvényes=${info.valid} lejár=${info.expiresAt ? new Date(info.expiresAt * 1000).toISOString() : "soha"}`);
    console.log(`jogok: ${info.scopes.join(", ")}`);
    for (const g of info.granularScopes) console.log(`  ${g.scope}: ${g.targetIds.join(", ") || "(minden)"}`);
    const pages = await managedPages(cfg.systemUserToken);
    for (const p of pages) console.log(`oldal: ${p.id} ${p.name} tasks=${p.tasks.join("/")}${p.id === cfg.pageId ? "  ← a pilot oldala" : ""}`);
    await pageToken(cfg.pageId, cfg.systemUserToken);
    console.log("✅ a pilot oldalára oldal-token kérhető a rendszerfelhasználóval");
    return;
  }
  if (cmd === "photo" || cmd === "reel") {
    if (!a1 || !a2) throw new Error(`${cmd}: fájl és szövegfájl kell`);
    const text = readFileSync(a2, "utf8").trim();
    console.log(`${cmd} → oldal ${cfg.pageId}: ${a1}\n---\n${text}\n---`);
    if (!go) {
      console.log("(szárazfuttatás — közzétételhez: --go)");
      return;
    }
    const token = await pageToken(cfg.pageId, cfg.systemUserToken);
    const id = cmd === "photo" ? await postPhoto(cfg.pageId, token, a1, text) : await publishReel(cfg.pageId, token, a1, text);
    console.log(`✅ közzétéve: ${id}`);
    return;
  }
  if (cmd === "status" && a1) {
    const token = await pageToken(cfg.pageId, cfg.systemUserToken);
    console.log(JSON.stringify(await reelStatus(a1, token), null, 2));
    return;
  }
  if (cmd === "delete" && a1) {
    if (!go) throw new Error("törléshez --go kell");
    const token = await pageToken(cfg.pageId, cfg.systemUserToken);
    console.log((await deleteObject(a1, token)) ? "✅ törölve" : "❌ nem törlődött");
    return;
  }
  throw new Error("parancs: check | photo | reel | status | delete");
}

main().catch((e: unknown) => {
  console.error(`❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
