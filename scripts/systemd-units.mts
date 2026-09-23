/**
 * The systemd units' single source of truth and their PROD form.
 *
 * WHY: until 2026-09-23 the live VPS's timers were installed BY HAND. The repo units carry
 * dev paths (/home/citoviso/citoviso, a file log); the live ones were edited to
 * /opt/citoviso/app + npx + journal — so every new timer was a note in a README that a
 * deploy could simply not read. The weekly program recommender needs two timers, and
 * without them it gathers NOTHING in production while every page says it does. The
 * owner's ask: make installing them impossible to skip.
 *
 *   npx tsx scripts/systemd-units.mts check                 # pre-commit: manifest ↔ files
 *   npx tsx scripts/systemd-units.mts render <unit-file>     # the prod form, to stdout
 *   npx tsx scripts/systemd-units.mts render-prod <src> <out> # every prod timer + service
 *   npx tsx scripts/systemd-units.mts --self-test            # the rules, proven both ways
 *
 * deploy-prod.sh GATE 6 renders from the TARGET commit, installs what differs, and
 * verifies every prod timer is enabled + active on the VPS — or the deploy fails.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PROD_DIR = "/opt/citoviso/app";

export interface Manifest {
  timers: Record<string, { target: "prod" | "dev"; why?: string }>;
}

/**
 * Dev unit → prod unit. The measured difference between the repo and the hand-installed
 * VPS units (2026-09-23, billing / booking-maintenance / domain-resume) is exactly these
 * three lines; a unit already in prod form passes through unchanged.
 */
export function renderProd(unit: string): string {
  return unit
    .split("\n")
    .map((l) => {
      if (/^WorkingDirectory=/.test(l)) return `WorkingDirectory=${PROD_DIR}`;
      const m = /^ExecStart=\S*\/node_modules\/\.bin\/tsx\s+(.*)$/.exec(l);
      if (m) return `ExecStart=/usr/bin/npx tsx ${m[1]}`;
      if (/^StandardOutput=append:/.test(l)) return "StandardOutput=journal";
      return l;
    })
    .join("\n");
}

/** Problems of a manifest against the unit files present. Empty = OK. */
export function checkUnits(manifest: Manifest, files: Record<string, string>): string[] {
  const problems: string[] = [];
  const timers = Object.keys(files).filter((f) => f.endsWith(".timer"));
  for (const t of timers) {
    if (!manifest.timers[t]) problems.push(`${t}: NINCS a targets.json-ban — döntsd el: prod vagy dev (indoklással)`);
  }
  for (const [t, e] of Object.entries(manifest.timers)) {
    if (!files[t]) problems.push(`${t}: a targets.json-ban van, de a fájl hiányzik`);
    if (e.target !== "prod" && e.target !== "dev") problems.push(`${t}: ismeretlen target „${e.target}"`);
    if (e.target === "dev" && !(e.why ?? "").trim()) problems.push(`${t}: dev-időzítő indoklás (why) nélkül`);
    if (e.target === "prod") {
      const svc = t.replace(/\.timer$/, ".service");
      if (!files[svc]) {
        problems.push(`${t}: prod-időzítő, de a ${svc} hiányzik`);
        continue;
      }
      for (const u of [t, svc]) {
        const out = renderProd(files[u]!);
        if (/\/home\//.test(out)) problems.push(`${u}: az éles alakban dev útvonal maradt (/home/…)`);
        if (u.endsWith(".service") && !/^WorkingDirectory=\/opt\/citoviso\/app$/m.test(out)) {
          problems.push(`${u}: az éles alakban nincs WorkingDirectory=${PROD_DIR}`);
        }
      }
    }
  }
  return problems;
}

function readDir(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir)) if (/\.(timer|service)$/.test(f)) out[f] = readFileSync(path.join(dir, f), "utf8");
  return out;
}

function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(path.join(dir, "targets.json"), "utf8")) as Manifest;
}

/** Render every prod timer + its service from `src` into `out`; returns the file names. */
export function renderProdDir(src: string, out: string): string[] {
  const manifest = readManifest(src);
  const files = readDir(src);
  const problems = checkUnits(manifest, files);
  if (problems.length) throw new Error(problems.join("\n"));
  mkdirSync(out, { recursive: true });
  const names: string[] = [];
  for (const [t, e] of Object.entries(manifest.timers)) {
    if (e.target !== "prod") continue;
    for (const u of [t, t.replace(/\.timer$/, ".service")]) {
      writeFileSync(path.join(out, u), renderProd(files[u]!));
      names.push(u);
    }
  }
  return names;
}

// ── self-test: every rule must be able to go RED ────────────────────────────────
function selfTest(): number {
  let fails = 0;
  const ok = (c: boolean, m: string) => {
    console.log(`${c ? "  ok " : "  FAIL"} ${m}`);
    if (!c) fails++;
  };
  const dev = [
    "[Service]",
    "WorkingDirectory=/home/citoviso/citoviso",
    "ExecStart=/home/citoviso/citoviso/node_modules/.bin/tsx scripts/billing-cycle.ts",
    "StandardOutput=append:/home/citoviso/.claude/citoviso-billing.log",
  ].join("\n");
  const prod = renderProd(dev);
  ok(prod.includes("WorkingDirectory=/opt/citoviso/app"), "WorkingDirectory → /opt/citoviso/app");
  ok(prod.includes("ExecStart=/usr/bin/npx tsx scripts/billing-cycle.ts"), "ExecStart → npx tsx");
  ok(prod.includes("StandardOutput=journal"), "file log → journal");
  ok(!/\/home\//.test(prod), "no /home/ remains");
  ok(renderProd(prod) === prod, "an already-prod unit passes through unchanged");

  const svc = (wd: string) => `[Service]\nWorkingDirectory=${wd}\nExecStart=/usr/bin/npx tsx x.mts\n`;
  const base = { "a.timer": "[Timer]\n", "a.service": svc(PROD_DIR) };
  ok(checkUnits({ timers: { "a.timer": { target: "prod" } } }, base).length === 0, "valid prod timer passes");
  ok(checkUnits({ timers: {} }, base).some((p) => p.includes("NINCS a targets.json")), "unlisted timer → RED");
  ok(checkUnits({ timers: { "a.timer": { target: "dev" } } }, base).some((p) => p.includes("indoklás")), "dev without why → RED");
  ok(
    checkUnits({ timers: { "a.timer": { target: "prod" } } }, { "a.timer": "[Timer]\n" }).some((p) => p.includes("hiányzik")),
    "prod timer without its service → RED",
  );
  ok(
    checkUnits({ timers: { "a.timer": { target: "prod" } } }, { ...base, "a.service": svc(PROD_DIR) + "Environment=X=/home/citoviso/y\n" })
      .some((p) => p.includes("dev útvonal")),
    "a /home/ path the renderer cannot fix → RED",
  );
  ok(checkUnits({ timers: { "b.timer": { target: "prod" } } }, base).some((p) => p.includes("fájl hiányzik")), "listed but missing file → RED");
  console.log(fails ? `\n⛔ systemd-units önteszt: ${fails} FAIL` : "\n✅ systemd-units önteszt: minden szabály pirosra is tud menni");
  return fails;
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
const [cmd, a, b] = process.argv.slice(2);
if (cmd === "--self-test") process.exit(selfTest() ? 1 : 0);
if (cmd === "check") {
  const dir = a ?? "deploy/systemd";
  const problems = checkUnits(readManifest(dir), readDir(dir));
  const m = readManifest(dir);
  const prodN = Object.values(m.timers).filter((e) => e.target === "prod").length;
  if (problems.length) {
    console.error(`⛔ systemd-units: ${problems.length} hiba\n   · ${problems.join("\n   · ")}`);
    process.exit(1);
  }
  const st = selfTest();
  if (st) process.exit(1);
  console.log(`✅ systemd-units: ${Object.keys(m.timers).length} időzítő deklarálva (${prodN} prod) — a deploy mindet telepíti és visszaméri.`);
  process.exit(0);
}
if (cmd === "render" && a) {
  if (!existsSync(a)) throw new Error(`nincs ilyen fájl: ${a}`);
  process.stdout.write(renderProd(readFileSync(a, "utf8")));
  process.exit(0);
}
if (cmd === "render-prod" && a && b) {
  for (const n of renderProdDir(a, b)) console.log(n);
  process.exit(0);
}
console.error("használat: systemd-units.mts check [dir] | render <fájl> | render-prod <src> <out> | --self-test");
process.exit(2);
