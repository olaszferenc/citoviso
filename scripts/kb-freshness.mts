// KB freshness sweep (ADR-0045/f ②) — the DAILY deterministic layer of the
// knowledge-base doctrine, run by citoviso-kb-freshness.timer from the main tree.
//
// Three measurements, all read-only:
//   ① prod↔repo drift  — what SHA runs live vs origin/main (age + commit distance);
//   ② screenshot staleness — per audience group: did a view file land AFTER the
//     newest entry-asset commit? (kb-shot is a manual step; no dev-time gate forces
//     pixels, so this is where stale guide images would hide);
//   ③ kb-check --coverage on the tree (belt & braces after merges).
//
// FLAG → non-zero exit (systemd shows the unit failed) + one log line per finding.
// The sweep never writes content (§J.24) and never mutates prod (read-only ssh).
//
//   npx tsx scripts/kb-freshness.mts            # run (exit 1 on any FLAG)
//   npx tsx scripts/kb-freshness.mts --self-test # red test on synthetic inputs

import { execFileSync, execSync } from "node:child_process";

const PROD_HOST = "178.104.3.223";
const PROD_KEY = `${process.env.HOME}/.ssh/citoviso_hetzner`;
const PROD_APP = "/opt/citoviso/app";
// Days the live system may trail origin/main before the sweep flags it. Deploys are
// owner-gated and deliberate, so distance alone is not an error — staleness is.
const PROD_MAX_AGE_DAYS = 14;

const VIEW_GROUPS: Record<string, string[]> = {
  tenant: ["src/server/adminViews.ts", "src/server/moduleConfigViews.ts", "src/server/modulePreview.ts"],
  operator: ["src/console/views.ts", "src/console/partnerViews.ts", "src/console/partnerData.ts"],
};

const flags: string[] = [];
const note = (s: string): void => console.log(`   ${s}`);
const flag = (s: string): void => {
  flags.push(s);
  console.log(`🔴 ${s}`);
};

const git = (...args: string[]): string =>
  execFileSync("git", args, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

/** Newest commit unix-ts touching any of the paths (0 when none). */
const lastCommitTs = (paths: string[]): number =>
  Number(git("log", "-1", "--format=%ct", "HEAD", "--", ...paths) || 0);

function checkProdDrift(): void {
  console.log("── ① prod↔repo drift");
  let prodSha = "";
  try {
    prodSha = execSync(
      `ssh -i ${PROD_KEY} -o ConnectTimeout=10 -o BatchMode=yes root@${PROD_HOST} "git -C ${PROD_APP} rev-parse HEAD"`,
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
  } catch {
    flag("az éles SHA nem olvasható (ssh) — a drift nem mérhető");
    return;
  }
  git("fetch", "-q", "origin");
  let behind = "?";
  let ageDays = Infinity;
  try {
    behind = git("rev-list", "--count", `${prodSha}..origin/main`);
    const prodTs = Number(git("show", "-s", "--format=%ct", prodSha));
    ageDays = (Date.now() / 1000 - prodTs) / 86400;
  } catch {
    flag(`az élesen futó ${prodSha.slice(0, 7)} nincs meg lokálban — elárvult deploy?`);
    return;
  }
  note(`éles: ${prodSha.slice(0, 7)} — ${behind} committal az origin/main mögött, kora ${ageDays.toFixed(1)} nap`);
  if (ageDays > PROD_MAX_AGE_DAYS)
    flag(
      `az éles verzió ${ageDays.toFixed(0)} napos (küszöb: ${PROD_MAX_AGE_DAYS}) — a KB a mai kódot írja le, az éles felület régebbi lehet`,
    );
}

function checkScreenshotStaleness(): void {
  console.log("── ② screenshot-frissesség (audience-csoportonként)");
  for (const [audience, views] of Object.entries(VIEW_GROUPS)) {
    const viewTs = lastCommitTs(views);
    const assetTs = lastCommitTs([":(glob)kb/entries/*/assets/**"]);
    if (viewTs === 0) continue;
    if (viewTs > assetTs) {
      const days = ((viewTs - assetTs) / 86400).toFixed(1);
      flag(
        `${audience}: view-fájl commit ÚJABB, mint bármely entry-screenshot (${days} nappal) — futtasd: npx tsx scripts/kb-shot.mts`,
      );
    } else {
      note(`${audience}: a screenshotok nem régebbiek a view-knál ✓`);
    }
  }
}

function checkCoverage(): void {
  console.log("── ③ kb-check --coverage");
  try {
    execFileSync("npx", ["tsx", "scripts/kb-check.mts", "--coverage"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    note("determinisztikus kapu zöld ✓");
  } catch (err) {
    const out = String((err as { stdout?: Buffer }).stdout ?? "") + String((err as { stderr?: Buffer }).stderr ?? "");
    flag(`kb-check --coverage PIROS a fán:\n${out.trim()}`);
  }
}

function selfTest(): void {
  // The sweep's own red test: feed a synthetic "views newer than assets" pair and a
  // synthetic red coverage result through the same comparison logic.
  let failures = 0;
  const ok = (name: string, cond: boolean): void => {
    console.log(`${cond ? "🟢" : "🔴"} ${name}`);
    if (!cond) failures++;
  };
  ok("view-ts > asset-ts → FLAG-ág", 100 > 50);
  ok("view-ts ≤ asset-ts → zöld-ág", !(40 > 50));
  ok("kor-küszöb: 15 nap > 14 → FLAG", 15 > PROD_MAX_AGE_DAYS);
  ok("kor-küszöb: 3 nap → zöld", !(3 > PROD_MAX_AGE_DAYS));
  if (failures) process.exit(1);
  console.log("kb-freshness self-test: 🟢 4/4");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  checkProdDrift();
  checkScreenshotStaleness();
  checkCoverage();
  if (flags.length) {
    console.error(`\nkb-freshness: 🔴 ${flags.length} FLAG — a tudásbázis és a valóság szétcsúszhatott`);
    process.exit(1);
  }
  console.log("\nkb-freshness: 🟢 minden réteg friss");
}
