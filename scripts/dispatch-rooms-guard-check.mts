// Guard: a plan without the rooms module never goes out through the automatic dispatch
// (coordinator rule 2026-10-27 — Relax Balaton 91bd34f4 and PENNY 728499d5, Parallax mocks
// without `data-cit-module="rooms"`, were Vera-PASS and would have gone out as the second plan).
//
//   ① planHasRooms: a page with the rooms module → true; without it, a missing file or no
//      path → false (fixture files, no DB).
//   ② wiring: dispatchOne holds the row on a rooms-less main plan BEFORE createProspect (no
//      link is made), and attachSecondPlan only offers rooms-module plans.
//
// Run:  npx tsx scripts/dispatch-rooms-guard-check.mts

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planHasRooms } from "../src/outreach/autoDispatch.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const check = (ok: boolean, label: string, detail = ""): void => {
  console.log(`${ok ? "✓" : "✗"}  ${label}${detail ? `\n     ${detail}` : ""}`);
  if (!ok) failed++;
};

// ① planHasRooms on fixtures
const dir = await mkdtemp(path.join(tmpdir(), "rooms-guard-"));
try {
  const withRooms = path.join(dir, "with.html");
  const without = path.join(dir, "without.html");
  await writeFile(withRooms, `<section data-cit-module="gallery"></section><section data-cit-module="rooms"></section>`);
  await writeFile(without, `<section data-cit-module="gallery"></section><section data-cit-module="rooms-teaser"></section>`);
  check(await planHasRooms(withRooms), "szobamodulos oldal → kimehet");
  check(!(await planHasRooms(without)), "szobamodul nélküli oldal → nem mehet ki", "a „rooms-teaser” nem szobamodul");
  check(!(await planHasRooms(path.join(dir, "missing.html"))), "hiányzó fájl → nem mehet ki");
  check(!(await planHasRooms(null)), "útvonal nélküli mock → nem mehet ki");
} finally {
  await rm(dir, { recursive: true, force: true });
}

// ② wiring in the send path
const src = await readFile(path.join(ROOT, "src/outreach/autoDispatch.ts"), "utf8");
const body = (name: string): string => {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) return "";
  const next = src.indexOf("\nexport ", start + 1);
  const nextLocal = src.indexOf("\nasync function ", start + 1);
  const ends = [next, nextLocal].filter((i) => i > 0);
  return src.slice(start, ends.length ? Math.min(...ends) : undefined);
};
const one = body("dispatchOne");
const guardAt = one.indexOf("planHasRooms(art.path)");
const prospectAt = one.indexOf("createProspect(");
check(guardAt > 0 && prospectAt > guardAt, "főterv: a szobamodul-őr a link készítése ELŐTT fut, held-del",
  `planHasRooms @${guardAt} · createProspect @${prospectAt}`);
check(/planHasRooms\(art\.path\)\)\)\s*\{\s*return \{ status: "held"/.test(one), "főterv: hiányzó szobamodul → held (nem skipped)");
const second = body("attachSecondPlan");
check(/planHasRooms\(m\.path\)/.test(second) && /for \(const m of passed\)/.test(second),
  "2. terv: csak szobamodulos, Vera-PASS-os mock csatolható");

if (failed) {
  console.log(`\n❌ dispatch-rooms-guard-check: ${failed} hiba`);
  process.exit(1);
}
console.log("\n✅ Szobamodul nélküli terv nem megy ki az automatán (fő- és 2. terv).");
