// ⭐ LAND GATE — ADR-0429: every sellable module reaches the setup wizard, the module tiles
// and the reminders through ONE registry (src/tenant/moduleSetup.ts), and cannot land without it.
//
// The approved plan (assets/design-refs/tenant-admin/modul-statusz/README §5) binds these checks:
//   ① COVERAGE   — every non-retired catalog module is brought up by a topic, or is EXEMPT with a reason.
//   ② LIVE REF   — a topic's modules[] point at existing, non-retired catalog modules.
//   ③ RULE       — every topic has a status rule; it is pure (sync, reads only the ctx — run on a deep-frozen
//                  fixture); on the EMPTY site it is NOT Kész (unless `doneByDefault` says why), on the
//                  FILLED site it is Kész / Ön döntött így.
//   ④ PATH       — "steps" topics have a step set with ≥1 step, and every step names a registered writer;
//                  "page" topics point at an existing admin tab.
//   ⑤ HELP       — the kb id is an existing kb/entries/<id>.
//   ⑥ EXEMPTIONS — an exemption names a live module that has no topic.
//   ⑧ REQUIRES   — a requirement names an existing topic (with its locking sentence) or a registered data
//                  precondition.
//   ⑨ ACYCLIC    — the requires graph has no cycle (the walk could never start).
//   ⑩ ADR-0192   — an "always" catalog dependency A → B means every A-topic waits (transitively) for a
//                  B-topic, and no B-topic ever waits for an A-topic (the inverted, deadlocking edge).
//                  "multiUnit" dependencies are the runtime module lock (topicLock reads the catalog).
//   ⑪ IN THE WALK — every topic is part of the wizard: steps, or a page that returns to the walk.
//   ⑦ SELF-TEST  — `--self-test` produces each violation on a synthetic copy and expects red.
//
// Run: npx tsx scripts/module-setup-registry-check.mts [--self-test]

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MODULE_CATALOG, type ModuleDef } from "../src/modules.js";
import {
  DATA_PREREQS,
  SETUP_EXEMPT,
  SETUP_TOPICS,
  type SetupCtx,
  type SetupTopic,
} from "../src/tenant/moduleSetup.js";
import { STEP_SETS, WRITERS, type StepEnv } from "../src/server/setupSteps.js";
import type { Unit } from "../src/tenant/units.js";
import type { UnitPrice } from "../src/tenant/prices.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF_TEST = process.argv.includes("--self-test");

// ── fixtures ────────────────────────────────────────────────────────────────────────
const unit = (over: Partial<Unit> = {}): Unit => ({
  id: "u-house",
  name: "A szállás egésze",
  capacity: null,
  description: null,
  sortOrder: 0,
  slug: "a-szallas-egesze",
  amenities: [],
  seasonalOnly: false,
  isWholeProperty: true,
  priceOnRequest: false,
  representsWhole: true,
  wholeOnly: false,
  ...over,
});
const basePrice: UnitPrice = { id: "p1", label: "", from: null, to: null, amount: 30000, isBase: true, minNights: null, validFrom: null, validTo: null, parentId: null };
const allModules = new Set(MODULE_CATALOG.filter((m) => !m.retired).map((m) => m.id));

function emptyCtx(): SetupCtx {
  return {
    tenantId: "t", siteId: "s", today: "2026-11-06", held: allModules, prices: new Map(),
    units: [unit()], unitPrices: new Map(), filled: new Set(), stored: new Map(),
    intro: "", photoCount: 6, ownPhotos: false, address: "", hasGeo: false, customDomainLive: false,
    multilang: null, calendar: [], progress: new Map(), suggestedRooms: [],
  };
}
function filledCtx(): SetupCtx {
  return {
    ...emptyCtx(),
    units: [unit({ capacity: 6 })],
    unitPrices: new Map([["u-house", [basePrice]]]),
    filled: new Set(["hours", "amenities", "poi", "pricing", "rooms"]),
    stored: new Map<string, Record<string, unknown>>([
      ["booking", { minNights: 2, notifyEmail: "" }],
      ["hours", { checkInFrom: "14:00", checkInTo: "20:00", checkOutUntil: "10:00" }],
      ["amenities", { items: ["Ingyenes Wi‑Fi"] }],
      ["email", { localPart: "info", forwardTo: "a@b.hu" }],
      ["usp", { items: ["Vízpart"] }],
    ]),
    intro: "Csendes vendégház a Duna-parton, saját stéggel és kerttel, nyolc fő részére.",
    ownPhotos: true, address: "Napos part 108", hasGeo: true, customDomainLive: true, multilang: "active",
    progress: new Map([["calendar", { step: 0, draft: { none: true }, skipped: false, hidden: false, completed: true }]]),
  };
}
function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    if (o instanceof Map) for (const v of o.values()) deepFreeze(v);
    else for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

// The admin tabs (adminViews TABS) — a "page" topic must open one of them.
function adminTabs(): Set<string> {
  const src = readFileSync(join(ROOT, "src/server/adminViews.ts"), "utf8");
  const i = src.indexOf("const TABS = ");
  const block = src.slice(i, src.indexOf("\n];", i));
  return new Set([...block.matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]!));
}

interface Inputs {
  catalog: readonly Pick<ModuleDef, "id" | "label" | "retired" | "requires">[];
  topics: readonly SetupTopic[];
  exempt: Readonly<Record<string, string>>;
  prereqs: Readonly<Record<string, unknown>>;
  steps: Readonly<Record<string, (env: StepEnv) => { writes: string }[]>>;
  kbExists: (id: string) => boolean;
  tabs: ReadonlySet<string>;
}

function reaches(topics: readonly SetupTopic[], from: string, to: string, seen = new Set<string>()): boolean {
  const t = topics.find((x) => x.id === from);
  return !!t && t.requires.some((r) => !!r.topic && (r.topic === to || (!seen.has(r.topic) && (seen.add(r.topic), reaches(topics, r.topic, to, seen)))));
}
function findCycle(topics: readonly SetupTopic[]): string[] | null {
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  let found: string[] | null = null;
  const dfs = (id: string): void => {
    if (found) return;
    state.set(id, 1);
    stack.push(id);
    for (const r of topics.find((x) => x.id === id)?.requires ?? []) {
      if (!r.topic || found) continue;
      if (state.get(r.topic) === 1) { found = [...stack.slice(stack.indexOf(r.topic)), r.topic]; return; }
      if (!state.has(r.topic)) dfs(r.topic);
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const t of topics) if (!state.has(t.id)) dfs(t.id);
  return found;
}

export function checkRegistry(inp: Inputs): string[] {
  const errs: string[] = [];
  const live = inp.catalog.filter((c) => !c.retired);
  const env = (ctx: SetupCtx): StepEnv => ({ ctx, lang: "hu", draft: {}, tenantId: "t", siteId: "s", actor: "gate" });
  // ①
  for (const c of live) {
    if (!inp.topics.some((t) => t.modules.includes(c.id)) && !inp.exempt[c.id]) {
      errs.push(`① ${c.id} („${c.label}”): a katalógusban eladható, de a nyilvántartásban (src/tenant/moduleSetup.ts) nincs témája. Javítás: vegyél fel egy bejegyzést (status + setup + kb), vagy tedd a SETUP_EXEMPT-be indokkal.`);
    }
  }
  const ids = new Set<string>();
  for (const t of inp.topics) {
    if (ids.has(t.id)) errs.push(`② ${t.id}: kétszer szerepel a nyilvántartásban.`);
    ids.add(t.id);
    // ②
    for (const m of t.modules) if (!live.some((c) => c.id === m)) errs.push(`② ${t.id}: a(z) „${m}” modul nincs a katalógusban, vagy kivezetett.`);
    // ③
    if (typeof t.status !== "function") {
      errs.push(`③ ${t.id}: nincs státusz-szabálya.`);
    } else {
      try {
        const e = t.status(deepFreeze(emptyCtx()), "hu");
        const f = t.status(deepFreeze(filledCtx()), "hu");
        if (e instanceof Promise || f instanceof Promise) errs.push(`③ ${t.id}: a státusz-szabály aszinkron — csak a betöltött ctx-ből olvashat, DB-t nem érhet el.`);
        else {
          if (e.st === "done" && !t.doneByDefault) errs.push(`③ ${t.id}: az ÜRES oldalon „Kész” — a szabály nem a valós adatot nézi (vagy adj doneByDefault indoklást).`);
          if (f.st !== "done" && f.st !== "decl") errs.push(`③ ${t.id}: a KITÖLTÖTT oldalon „${f.st}” — a szabály sosem lesz kész.`);
        }
      } catch (err) {
        errs.push(`③ ${t.id}: a státusz-szabály hibát dob vagy írni próbál a ctx-be (${(err as Error).message}).`);
      }
    }
    // ④ + ⑪
    if (t.setup.kind === "steps") {
      const set = inp.steps[t.id];
      if (!set) errs.push(`④ ${t.id}: „steps” téma, de nincs lépés-készlete (src/server/setupSteps.ts STEP_SETS).`);
      else {
        const list = set(env(filledCtx())).concat(set(env(emptyCtx())));
        if (!list.length) errs.push(`④ ${t.id}: a lépés-készlet üres — a varázsló nem kérdezne semmit.`);
        for (const s of list) if (!(WRITERS as readonly string[]).includes(s.writes)) errs.push(`④ ${t.id}: a lépés ismeretlen írás-útra hivatkozik („${s.writes}”) — vedd fel a WRITERS-be, ha valódi.`);
      }
    } else {
      const u = new URL(t.setup.href, "http://x");
      const tab = u.searchParams.get("tab") ?? "";
      if (!inp.tabs.has(tab)) errs.push(`④ ${t.id}: a lap (${t.setup.href}) nem létező admin-fülre mutat.`);
      const m = u.searchParams.get("m");
      if (m && !live.some((c) => c.id === m)) errs.push(`④ ${t.id}: a lap (${t.setup.href}) nem létező modulra mutat.`);
      if (!t.setup.returns) errs.push(`⑪ ${t.id}: csak csempe-téma — a lap nem tér vissza a varázslóba (returns hiányzik), így a varázsló nem vinné végig. Javítás: beágyazott lépések, vagy page + returns: true.`);
    }
    // ⑤
    if (!inp.kbExists(t.kb)) errs.push(`⑤ ${t.id}: a súgó-link („${t.kb}”) nem létező KB-entry (kb/entries/${t.kb}).`);
    // ⑧
    for (const r of t.requires) {
      if (r.topic && !inp.topics.some((x) => x.id === r.topic)) errs.push(`⑧ ${t.id}: a requires nem létező témára mutat („${r.topic}”).`);
      if (r.topic && !r.why) errs.push(`⑧ ${t.id} → ${r.topic}: nincs zároló mondat (why) — a tulaj nem tudná, mire vár.`);
      if (r.data && !inp.prereqs[r.data]) errs.push(`⑧ ${t.id}: ismeretlen adat-előfeltétel („${r.data}”) — regisztráld a DATA_PREREQS-ben.`);
      if (!r.topic && !r.data) errs.push(`⑧ ${t.id}: üres requires-elem.`);
    }
  }
  // ⑥
  for (const id of Object.keys(inp.exempt)) {
    if (!live.some((c) => c.id === id)) errs.push(`⑥ KIVÉTEL „${id}”: nincs ilyen eladható modul — töröld a kivételt.`);
    if (inp.topics.some((t) => t.modules.includes(id))) errs.push(`⑥ KIVÉTEL „${id}”: közben van témája — töröld a kivételt.`);
  }
  // ⑨
  const cyc = findCycle(inp.topics);
  if (cyc) errs.push(`⑨ körkörös függés: ${cyc.join(" → ")} — a varázsló sosem tudna elindulni.`);
  // ⑩
  for (const c of inp.catalog) {
    for (const r of c.requires ?? []) {
      const aT = inp.topics.filter((t) => t.modules[0] === c.id);
      const bT = inp.topics.filter((t) => t.modules[0] === r.id);
      if ((r.when ?? "always") === "always" && bT.length) {
        for (const a of aT) if (!bT.some((b) => reaches(inp.topics, a.id, b.id))) {
          errs.push(`⑩ ${a.id} (${c.id}): a katalógusban ${c.id} → ${r.id} (ADR-0192), de a téma nem vár egyetlen ${r.id}-témára sem (${bT.map((b) => b.id).join(", ")}). Javítás: requires: { topic: "${bT[0]!.id}", why }.`);
        }
      }
      for (const b of bT) for (const a of aT) if (reaches(inp.topics, b.id, a.id)) {
        errs.push(`⑩ ${b.id} (${r.id}) egy ${c.id}-témára (${a.id}) vár, pedig a katalógusban ${c.id} függ ${r.id}-tól — fordított él.`);
      }
    }
  }
  return errs;
}

const real: Inputs = {
  catalog: MODULE_CATALOG,
  topics: SETUP_TOPICS,
  exempt: SETUP_EXEMPT,
  prereqs: DATA_PREREQS,
  steps: STEP_SETS,
  kbExists: (id) => existsSync(join(ROOT, "kb/entries", id, "entry.hu.md")),
  tabs: adminTabs(),
};

if (SELF_TEST) {
  const base = SETUP_TOPICS;
  const swap = (id: string, over: Partial<SetupTopic>): SetupTopic[] => base.map((t) => (t.id === id ? ({ ...t, ...over } as SetupTopic) : t));
  const cases: [string, string, Partial<Inputs>][] = [
    ["①", "egy modul témája hiányzik", { topics: base.filter((t) => t.id !== "hours") }],
    ["②", "nem létező modul", { topics: swap("hours", { modules: ["nincs-ilyen"] }) }],
    ["③", "üresen is kész", { topics: swap("hours", { status: () => ({ st: "done", line: "" }) }) }],
    ["④", "nincs lépés-készlet", { steps: Object.fromEntries(Object.entries(STEP_SETS).filter(([k]) => k !== "hours")) }],
    ["⑤", "nem létező súgó", { topics: swap("hours", { kb: "nincs-ilyen-entry" }) }],
    ["⑥", "halott kivétel", { exempt: { ...SETUP_EXEMPT, nincsilyen: "x" } }],
    ["⑧", "nem létező előfeltétel", { topics: swap("hours", { requires: [{ topic: "nincs", why: () => "x" }] }) }],
    ["⑨", "kör", { topics: swap("letting", { requires: [{ topic: "pricing", why: () => "x" }] }) }],
    ["⑩", "ADR-0192 ellentmondás", { topics: swap("calendar", { requires: [{ data: "bookableUnit" }] }) }],
    ["⑪", "csak csempe", { topics: swap("poi", { setup: { kind: "page", href: "/admin?tab=modulok&m=poi", label: () => "x", returns: false } }) }],
  ];
  let bad = 0;
  for (const [mark, what, over] of cases) {
    const errs = checkRegistry({ ...real, ...over });
    const hit = errs.some((e) => e.startsWith(mark));
    console.log(`${hit ? "✓" : "✗"} önteszt ${mark} (${what}) → ${hit ? "piros, ahogy kell" : "NEM bukott"}`);
    if (!hit) bad++;
  }
  const clean = checkRegistry(real);
  console.log(clean.length ? `✗ a valódi nyilvántartás piros (${clean.length})` : "✓ a valódi nyilvántartás zöld");
  if (bad || clean.length) process.exit(1);
  console.log(`✅ module-setup-registry-check önteszt: ${cases.length}/${cases.length} sértés pirosat adott`);
  process.exit(0);
}

const errs = checkRegistry(real);
const live = MODULE_CATALOG.filter((m) => !m.retired).length;
if (errs.length) {
  console.error(`✗ module-setup-registry-check: ${errs.length} hiba (ADR-0429)\n` + errs.map((e) => "  " + e).join("\n"));
  process.exit(1);
}
console.log(`✅ module-setup-registry-check: ${live} eladható modul · ${SETUP_TOPICS.length} téma · ${Object.keys(SETUP_EXEMPT).length} kivétel (indokkal) · 0 hiba`);
