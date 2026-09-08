// SNAPSHOT-PROPAGÁCIÓ ŐR — "mentettem, de az oldalon nem látszik".
//
// Miért létezik (mérve 2026-09-08, a tulaj saját oldalán): a tenant-admin felvett két
// egységet (`site_unit`: 18:18 és 18:20), a kiszolgált `sites/<tenant>/index.html`
// viszont 18:16-os volt — egyetlen szobával. A publikus oldal STATIKUS PILLANATKÉP:
// a DB-írás önmagában semmit nem változtat azon, amit a vendég betölt. Az admin
// „Mentve"-t mondott, az oldal az ellenkezőjét, és semmi nem jelezte a rést.
//
// A hiba OSZTÁLYA, nem egy route: az /admin/units/save, /admin/units/delete,
// /admin/units/content, /admin/prices/* és /admin/module-config MIND így állt.
// Ezért ez az őr nem egy fájlt figyel, hanem KIKÉNYSZERÍTI A DÖNTÉST: minden
// tenant-admin POST route vagy újrarendereli a pillanatképet, vagy szerepel az
// alábbi listán azzal az indokkal, hogy miért nem érinti a publikus oldalt.
//
// Nincs DB, nincs hálózat — statikus forráselemzés, mehet a pre-commitba.
//
//   npx tsx scripts/snapshot-propagation-check.mts
//   npx tsx scripts/snapshot-propagation-check.mts --self-test   (a kapu tényleg harap-e)

import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");

const PUBLIC_TS = path.join(ROOT, "src/server/public.ts");
const EDITOR_TS = path.join(ROOT, "src/tenant/editor.ts");

/**
 * Routes that legitimately do NOT re-render, each with the reason it cannot change
 * what a visitor sees. A new admin route lands in neither category by accident —
 * that is the point: the author has to say which one it is.
 */
const NO_RENDER_NEEDED: Record<string, string> = {
  "/admin/password": "belépési jelszó — nem oldal-tartalom",
  "/admin/uzenetek/olvasott": "üzenet olvasottsága — admin-oldali állapot",
  "/admin/contact": "a tenant BELÉPÉSI e-mailje (tenant_user), nem a publikus elérhetőség",
  "/admin/subscription/cancel": "előfizetés — számlázás, nem oldal-tartalom",
  "/admin/subscription/resume": "előfizetés — számlázás, nem oldal-tartalom",
  "/admin/subscription/settlement": "előfizetés — számlázás, nem oldal-tartalom",
  "/admin/subscription/auto-charge-off": "előfizetés — számlázás, nem oldal-tartalom",
  "/admin/subscription/period-annual": "előfizetés — számlázás, nem oldal-tartalom",
  "/admin/subscription/period-monthly": "előfizetés — számlázás, nem oldal-tartalom",
  "/admin/multilang": "a fordítás SAJÁT rendereléssel jár (multilangGenerate.ts)",
  "/admin/domain/order": "a domain-átállás rendereli a pillanatképet (provisionDomain.ts)",
  "/admin/availability":
    "a szabad napokat a vendég-oldal ÉLŐBEN kérdezi (/api/foglaltsag/), nem a HTML hordozza",
  "/admin/calendar-link": "portál-naptár összekötése — a foglaltság élő lekérdezés",
  "/admin/calendar-link/delete": "portál-naptár leválasztása — a foglaltság élő lekérdezés",
  "/admin/booking/decide": "foglalási döntés — a foglaltság élő lekérdezés",
  "/admin/booking/cancel": "foglalás lemondása — a foglaltság élő lekérdezés",
};

/** `export async function NAME` … whose body calls renderAndPersist → writing it re-renders. */
async function renderingWriters(): Promise<Set<string>> {
  const src = (await readFile(EDITOR_TS, "utf8")).split("\n");
  const out = new Set<string>();
  let current: string | null = null;
  for (const line of src) {
    const decl = /^export async function (\w+)/.exec(line);
    if (decl) current = decl[1]!;
    if (current && /\brenderAndPersist\(/.test(line) && !/async function renderAndPersist/.test(line)) {
      out.add(current);
    }
  }
  return out;
}

interface RouteBlock {
  /** Every route the SAME handler serves — a condition may list several (cancel || resume). */
  readonly routes: string[];
  readonly line: number;
  readonly body: string;
}

/** Every `if (req.method === "POST" && pathname === "/admin/...")` block, brace-matched. */
function adminPostBlocks(src: string): RouteBlock[] {
  const lines = src.split("\n");
  const blocks: RouteBlock[] = [];
  let coveredUntil = -1;
  for (let i = 0; i < lines.length; i++) {
    if (i <= coveredUntil) continue;
    const line = lines[i]!;
    if (!/pathname === "\/admin[^"]*"/.test(line)) continue;
    // The method test may sit a line or two above (multi-line conditions).
    const context = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
    if (!/req\.method === "POST"/.test(context)) continue;
    // Walk forward to the matching closing brace of the if-block.
    let depth = 0;
    let started = false;
    let headerDone = false;
    const body: string[] = [];
    const header: string[] = [];
    let end = i;
    for (let j = i; j < lines.length; j++) {
      const l = lines[j]!;
      body.push(l);
      if (!headerDone) header.push(l);
      for (const ch of l) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") depth--;
      }
      if (started) headerDone = true;
      end = j;
      if (started && depth <= 0) break;
    }
    // The condition itself may name several routes; all of them are this handler's.
    const routes = [...header.join("\n").matchAll(/pathname === "(\/admin[^"]*)"/g)].map((m) => m[1]!);
    blocks.push({ routes: [...new Set(routes)], line: i + 1, body: body.join("\n") });
    coveredUntil = end;
  }
  return blocks;
}

function rerenders(body: string, writers: Set<string>): boolean {
  if (/\bredirectRerendered\(/.test(body)) return true;
  if (/\brerenderTenantSnapshot\(/.test(body)) return true;
  for (const w of writers) if (new RegExp(`\\b${w}\\(`).test(body)) return true;
  return false;
}

async function run(source: string): Promise<string[]> {
  const writers = await renderingWriters();
  if (writers.size === 0) {
    return ["A renderelő írás-függvények listája ÜRES — az elemzés elromlott (editor.ts)."];
  }
  const blocks = adminPostBlocks(source);
  if (blocks.length < 20) {
    return [`Csak ${blocks.length} admin POST route-ot találtam — az elemzés elromlott.`];
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    const renders = rerenders(b.body, writers);
    for (const route of b.routes) {
      seen.add(route);
      if (renders) {
        if (NO_RENDER_NEEDED[route]) {
          problems.push(
            `${route} (public.ts:${b.line}) — RENDEREL, mégis a „nem kell" listán áll. ` +
              `A lista hazudik: vedd ki.`,
          );
        }
        continue;
      }
      if (!NO_RENDER_NEEDED[route]) {
        problems.push(
          `${route} (public.ts:${b.line}) — a mentés után NINCS újrarenderelés, és nincs indok sem.\n` +
            `      A publikus oldal statikus pillanatkép: enélkül a tulaj ment, a vendég a RÉGI oldalt látja.\n` +
            `      Vagy: return redirectRerendered(res, session.tenantId, "…")\n` +
            `      Vagy: vedd fel a NO_RENDER_NEEDED listára azzal, MIÉRT nem látszik a változás az oldalon.`,
        );
      }
    }
  }
  for (const route of Object.keys(NO_RENDER_NEEDED)) {
    if (!seen.has(route)) {
      problems.push(`${route} — a listán van, de ilyen admin POST route már NINCS. Töröld a listáról.`);
    }
  }
  return problems;
}

const source = await readFile(PUBLIC_TS, "utf8");

if (SELF_TEST) {
  // Negative proof: strip the re-render from the unit save and the guard MUST bite.
  const broken = source.replace(
    /return redirectRerendered\(res, session\.tenantId, "\/admin\?tab=modulok&m=booking&saved=1"\);/,
    'return redirect(res, "/admin?tab=modulok&m=booking&saved=1");',
  );
  if (broken === source) {
    console.error("⛔ ÖNTESZT: nem találtam a rontandó sort — az önteszt elavult.");
    process.exit(1);
  }
  const found = await run(broken);
  const bites = found.some((p) => p.startsWith("/admin/units/save"));
  if (!bites) {
    console.error("⛔ ÖNTESZT BUKOTT: a rontott forrásra is átengedett az őr.");
    console.error(found.join("\n"));
    process.exit(1);
  }
  console.log("✅ ÖNTESZT: a rontott /admin/units/save mentést az őr elkapja.");
}

const problems = await run(source);
if (problems.length) {
  console.error("⛔ SNAPSHOT-PROPAGÁCIÓ: a mentés nem jut el a publikus oldalra\n");
  for (const p of problems) console.error(`   · ${p}`);
  process.exit(1);
}
console.log(
  `✅ snapshot-propagáció: minden tenant-admin mentés vagy rendereli az oldalt, vagy indokoltan nem (${Object.keys(NO_RENDER_NEEDED).length} kivétel).`,
);
