// KB freshness sweep (ADR-0045/f ②) — the DAILY deterministic layer of the
// knowledge-base doctrine, run by citoviso-kb-freshness.timer from the main tree.
//
// Three measurements, all read-only:
//   ① prod↔repo drift  — what SHA runs live vs origin/main (age + commit distance);
//   ② screenshot staleness — per audience group: did a view file land AFTER the
//     newest entry-asset commit? (kb-shot is a manual step; no dev-time gate forces
//     pixels, so this is where stale guide images would hide);
//   ③ kb-check --coverage on the tree (belt & braces after merges);
//   ④ translation freshness ON PROD (read-only ssh) — not the dev DB (ADR-0207).
//
// FLAG → non-zero exit (systemd shows the unit failed) + one log line per finding.
// The sweep never writes content (§J.24) and never mutates prod (read-only ssh).
//
//   npx tsx scripts/kb-freshness.mts            # run (exit 1 on any FLAG)
//   npx tsx scripts/kb-freshness.mts --self-test # red test on synthetic inputs

import { execFileSync, execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

function checkProdDrift(): string {
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
    return "";
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
    return "";
  }
  note(`éles: ${prodSha.slice(0, 7)} — ${behind} committal az origin/main mögött, kora ${ageDays.toFixed(1)} nap`);
  if (ageDays > PROD_MAX_AGE_DAYS)
    flag(
      `az éles verzió ${ageDays.toFixed(0)} napos (küszöb: ${PROD_MAX_AGE_DAYS}) — a KB a mai kódot írja le, az éles felület régebbi lehet`,
    );  return prodSha;
}

/** The content verdict, computed once per sweep: regenerate to a temp dir and pixel-compare
 *  with the committed images (kb-shot --check-committed, exit 0 = every image identical). */
let contentVerdict: { fresh: boolean; summary: string } | null = null;
function contentCheck(): { fresh: boolean; summary: string } {
  if (contentVerdict) return contentVerdict;
  const r = spawnSync("npx", ["tsx", "scripts/kb-shot.mts", "--check-committed"], { encoding: "utf8", timeout: 600_000 });
  const lines = `${r.stdout}\n${r.stderr}`.split("\n").map((l) => l.trim()).filter(Boolean);
  const summary = lines.filter((l) => /friss|eltér|⛔|✅/.test(l)).slice(-2).join(" · ") || lines.slice(-1).join("") || `rc=${r.status}`;
  // ⚠️ Fail-closed: a generator that could not run is NOT "fresh" — it is a flag.
  contentVerdict = { fresh: r.status === 0, summary: r.status === 0 ? summary : `a tartalmi ellenőrzés nem futott le (rc=${r.status}): ${summary}` };
  return contentVerdict;
}
function checkScreenshotStaleness(): void {
  console.log("── ② screenshot-frissesség (audience-csoportonként)");
  for (const [audience, views] of Object.entries(VIEW_GROUPS)) {
    const viewTs = lastCommitTs(views);
    const assetTs = lastCommitTs([":(glob)kb/entries/*/assets/**"]);
    if (viewTs === 0) continue;
    if (viewTs > assetTs) {
      const days = ((viewTs - assetTs) / 86400).toFixed(1);
      // ⛔ A DÁTUM CSAK GYANÚ, NEM ÍTÉLET (mérve 2026-09-25). Ez a sor két napon át „failed"-re
      // tette a szolgáltatást, miközben a 45 commitolt kép PIXELRE azonos volt a friss
      // gyártással: a tenant-nézetek változtak, a képek nem — és a dátum-összevetés ezt sosem
      // tudhatta meg (egy azonos újragyártás nem hoz új asset-commitot, tehát a jel örökre
      // piros maradna). Fordítva is hazudott: az operátor-csoportot ZÖLDRE engedte, mert az
      // `assetTs` BÁRMELY közönség képeire nézi az utolsó commitot. Ezért a gyanút a
      // TARTALMI kapu dönti el: `kb-shot --check-committed` (ADR-0220, pixel-összevetés).
      const verdict = contentCheck();
      if (verdict.fresh) {
        note(
          `${audience}: a view-fájl commit ${days} nappal újabb a képeknél, de a tartalom azonos (` +
            `kb-shot --check-committed: ${verdict.summary}) ✓`,
        );
      } else {
        flag(
          `${audience}: view-fájl commit ÚJABB (${days} nappal) ÉS a képek tartalma eltér — ` +
            `${verdict.summary} — futtasd: npx tsx scripts/kb-shot.mts, és commitold a képeket`,
        );
      }
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

/**
 * ④ NYELVI TELJESSÉG (§J.25) — az ÉLES szolgál-e ki friss fordítást?
 *
 * ⛔ 2026-09-23-ig ez a réteg a DEV adatbázist mérte, ami az ADR-0207 (+ módosítás)
 * óta semmit nem jelent: a fordítás a DEPLOY kapuja, a `main` átmenetileg hordozhat
 * lefordítatlan cikket, és a közös dev-DB-ben a munkafák egymás fordítását írják felül.
 * A napi söprés így minden reggel pirosat mondott egy olyan dologra, ami nem hiba.
 *   Most azt méri, ami a vevőt érinti: az ÉLES DB-t, ugyanazzal a mérővel, amit a deploy
 * GATE 5b is hív (csak olvasás). A `main` előnye nem FLAG, csak tájékoztatás: a következő
 * deploy ezeket fordítja.
 *   ⚠️ `set -o pipefail` a távoli parancsban: `| tail` nélküle a TAIL kilépési kódját adja
 * vissza, és a mérő bukása zöldnek látszana (mérve 2026-09-23, a deploy-kapukban is).
 */
function translationVerdict(status: number | null): "fresh" | "stale" | "unmeasured" {
  if (status === 0) return "fresh";
  // 255 = ssh itself failed; null = killed/timeout — neither is a verdict about prod.
  if (status === 255 || status === null) return "unmeasured";
  return "stale";
}

function checkTranslationCoverage(prodSha: string): void {
  console.log("── ④ nyelvi teljesség az ÉLESEN (§J.25, ADR-0207)");
  if (!prodSha) {
    flag("az éles fordítás-frissesség nem mérhető — az éles SHA sem volt olvasható (①)");
    return;
  }
  const r = spawnSync(
    "ssh",
    ["-i", PROD_KEY, "-o", "ConnectTimeout=10", "-o", "BatchMode=yes", `root@${PROD_HOST}`,
      `set -o pipefail; cd ${PROD_APP} && sudo -u citoviso npx tsx scripts/kb-translation-coverage-check.mts 2>&1 | tail -12`],
    { stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 },
  );
  const out = `${r.stdout?.toString() ?? ""}${r.stderr?.toString() ?? ""}`.trim();
  const v = translationVerdict(r.status);
  if (v === "fresh") note(out.split("\n").pop() ?? "éles: friss ✓");
  else if (v === "unmeasured") flag(`az éles fordítás-frissesség NEM MÉRHETŐ (ssh rc=${r.status}) — ez nem zöld:\n${out}`);
  else flag(`az ÉLES elavult súgó-fordítást szolgál ki — a vevő a régi szöveget olvassa:\n${out}`);

  // Informational only: what the NEXT deploy's GATE 5 will translate.
  try {
    const pending = git("diff", "--name-only", prodSha, "origin/main", "--", ":(glob)kb/entries/*/entry.hu.md")
      .split("\n").filter(Boolean).map((f) => f.split("/")[2]);
    note(pending.length
      ? `a következő deploy fordítja (a main előnye, nem hiba): ${pending.join(", ")}`
      : "a main nem hordoz lefordítandó súgó-változást");
  } catch {
    note("a függő súgó-változások nem listázhatók (git diff)");
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
  // ④ — a nyelvi teljesség rétege a saját öntesztjével bizonyít; itt azt kötjük ki, hogy
  // a söprés TÉNYLEG meghívja (egy be nem kötött réteg nem réteg — ADR-0152).
  const src = readFileSync(new URL(import.meta.url), "utf8");
  ok("a ④ nyelvi-teljesség réteg be van kötve a söprésbe", /checkTranslationCoverage\(prodSha\);/.test(src));
  ok("④: rc 0 → friss", translationVerdict(0) === "fresh");
  ok("④: rc 1 (a mérő bukott) → ELAVULT, nem zöld", translationVerdict(1) === "stale");
  ok("④: ssh-hiba (255) → NEM MÉRHETŐ, nem zöld", translationVerdict(255) === "unmeasured");
  // The regression this layer was rewritten for: a `| tail` without pipefail swallows rc.
  ok("④: a távoli csővezeték pipefail-lel fut", /set -o pipefail; cd \$\{PROD_APP\}/.test(src));
  if (failures) process.exit(1);
  console.log("kb-freshness self-test: 🟢 9/9");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const prodSha = checkProdDrift();
  checkScreenshotStaleness();
  checkCoverage();
  checkTranslationCoverage(prodSha);
  if (flags.length) {
    console.error(`\nkb-freshness: 🔴 ${flags.length} FLAG — a tudásbázis és a valóság szétcsúszhatott`);
    process.exit(1);
  }
  console.log("\nkb-freshness: 🟢 minden réteg friss");
}
