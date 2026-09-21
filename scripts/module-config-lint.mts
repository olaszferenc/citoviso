// ADR-0044 guard: a module we CHARGE for must be configurable by the owner who bought it.
//
// This exists because the opposite happened: 12 modules shipped as priced add-ons with a
// bare ON/OFF flag and no settings whatsoever. Selling "Online foglalás" for 990 Ft/month
// and then offering nothing to set is a product failure and a misrepresentation risk, so
// the rule is now mechanical rather than a promise:
//
//   priceMonthly > 0  ⇒  MODULE_CONFIG_REGISTRY has an entry with fields or a bespoke editor.
//
// Also checks the registry is internally sound: no orphan entries, every field has a
// default, every select field's default is one of its own options.
//
//   npx tsx scripts/module-config-lint.mts

import { readFile } from "node:fs/promises";

import {
  MODULE_CATALOG,
  type ModuleRequirement,
  type ModuleDef,
  PRESETS,
  modulesForConversion,
  sellableModuleIds,
} from "../src/modules.js";
import { MODULE_CONFIG_REGISTRY } from "../src/moduleConfig.js";
// Judged on what actually RENDERS, not on what the registry declares: a module
// may name a bespoke editor that has not been built, and counting that as
// "configurable" would make this guard lie.
import { hasSettingsScreen } from "../src/server/moduleConfigViews.js";

const problems: string[] = [];

for (const m of MODULE_CATALOG) {
  const def = MODULE_CONFIG_REGISTRY[m.id];
  // ADR-0063: a 'once'-billed module is configured AT PURCHASE (its dedicated
  // admin card is where the owner sets it — e.g. multilang picks the 3 languages),
  // not through the generic per-module settings registry. The guard still measures
  // what matters (a REAL owner-facing surface exists, red-testable by deleting the
  // card), just against the right artifact: the admin views must render a form
  // posting to /admin/<id>.
  if (m.billing === "once") {
    const adminViewsSrc = await readFile(
      new URL("../src/server/adminViews.ts", import.meta.url),
      "utf8",
    );
    if (!adminViewsSrc.includes(`action="/admin/${m.id}"`)) {
      problems.push(
        `⛔ "${m.id}" (${m.priceMonthly} Ft/alkalom) — egyszeri díjas modul SAJÁT vásárló/beállító ` +
          `kártya nélkül: az adminViews.ts-ben nincs form action="/admin/${m.id}".`,
      );
    }
    continue;
  }
  if (m.priceMonthly > 0 && !def) {
    problems.push(
      `⛔ "${m.id}" (${m.priceMonthly} Ft/hó) — FELÁRAS modul konfig-séma NÉLKÜL. ` +
        `Vegye fel a MODULE_CONFIG_REGISTRY-be (src/moduleConfig.ts).`,
    );
    continue;
  }
  if (m.priceMonthly > 0 && !hasSettingsScreen(m.id)) {
    problems.push(
      `⛔ "${m.id}" (${m.priceMonthly} Ft/hó) — van registry-bejegyzése, de MA nem állítható semmi: ` +
        `nincs mezője, a deklarált szerkesztője (${MODULE_CONFIG_REGISTRY[m.id]?.editor ?? "—"}) pedig nincs megépítve.`,
    );
  }
  if (!def) continue;

  for (const f of def.fields) {
    if (!(f.key in def.defaults)) {
      problems.push(
        `⛔ "${m.id}.${f.key}" — nincs alapértéke. Minden mezőnek működő alapértékkel kell indulnia ` +
          `(érintetlen modul is helyesen üzemel).`,
      );
    }
    if (f.type === "select") {
      const opts = (f.options ?? []).map((o) => o.value);
      if (opts.length === 0) {
        problems.push(`⛔ "${m.id}.${f.key}" — select mező opciók nélkül.`);
      } else if (!opts.includes(String(def.defaults[f.key]))) {
        problems.push(
          `⛔ "${m.id}.${f.key}" — az alapérték ("${String(def.defaults[f.key])}") nincs az opciók között.`,
        );
      }
    }
  }
}

// Shared-slot relationships must be coherent, or the price and the page disagree:
// a module could be billed while its section never renders.
for (const m of MODULE_CATALOG) {
  for (const target of m.supersedes ?? []) {
    if (target === m.id) {
      problems.push(`⛔ "${m.id}" — önmagát váltja ki.`);
      continue;
    }
    const other = MODULE_CATALOG.find((x) => x.id === target);
    if (!other) {
      problems.push(`⛔ "${m.id}" — nem létező modult vált ki: "${target}".`);
      continue;
    }
    if (other.supersedes?.includes(m.id)) {
      problems.push(`⛔ "${m.id}" ↔ "${target}" — kölcsönösen kiváltják egymást (körkörös).`);
    }
    const rivals = MODULE_CATALOG.filter((x) => x.supersedes?.includes(target));
    if (rivals.length > 1) {
      problems.push(
        `⛔ "${target}" — többen is kiváltják (${rivals.map((r) => r.id).join(", ")}): ` +
          `nem egyértelmű, melyik jelenik meg a közös helyen.`,
      );
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ADR-0192 ⑥ ① — the DECLARED module dependencies must be sound, and every set we
// actually OFFER must satisfy them. The damage this guards against is not an empty
// band (every block early-returns) but CONTENT WITHOUT CONTEXT: a booking calendar
// that cannot name a price, a price table that cannot say what it prices.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ INDEPENDENT reference implementation: unmet HARD requirements of a set, walked
 * straight off the raw catalog. Deliberately NOT the product's
 * missingRequiredModules() — a guard that calls the very function it judges cannot
 * fail (feedback_guard_must_not_borrow_its_subject; measured there: a sort check
 * using its own comparator stayed green on a broken sort).
 *
 * Reference semantics, and where they are STRICTER than the product on purpose:
 *   · multi-unit is unknown → conditional requirements STAND (ADR-0192 ④.4);
 *   · EVERY module in the set imposes its own requirements, superseded or not — if
 *     a superseded module ever declares one, this goes red and forces a decision
 *     instead of quietly dropping it.
 */
function unmetHard(ids: readonly string[]): string[] {
  const have = new Set(ids);
  const out: string[] = [];
  for (const id of ids) {
    const def = MODULE_CATALOG.find((m) => m.id === id);
    for (const r of def?.requires ?? []) {
      if (r.strength === "hard" && !have.has(r.id)) out.push(`${id} → ${r.id}`);
    }
  }
  return out;
}

/**
 * Structural soundness of the declared `requires` edges. Takes the catalog as a
 * PARAMETER so the same code can be pointed at deliberately broken fixtures
 * (`--selftest`): a guard nobody has ever seen go red is a guard nobody knows works
 * (feedback_narrow_recognizer_is_a_false_green).
 */
function structuralRequirementProblems(catalog: readonly ModuleDef[]): string[] {
  const out: string[] = [];
  for (const m of catalog) {
    const seenIds = new Set<string>();
    for (const r of m.requires ?? []) {
      if (r.id === m.id) {
        out.push(`⛔ "${m.id}" — önmagát követeli meg (requires).`);
        continue;
      }
      if (seenIds.has(r.id)) {
        out.push(
          `⛔ "${m.id}" — kétszer követeli meg ugyanazt: "${r.id}". Két sor = két „why" mondat ` +
            `ugyanarra a kötésre, és a képernyő az elsőt mutatja.`,
        );
      }
      seenIds.add(r.id);
      const other = catalog.find((x) => x.id === r.id);
      if (!other) {
        out.push(`⛔ "${m.id}" — nem létező modult követel meg: "${r.id}".`);
        continue;
      }
      // A dependency that cannot be bought on the same path is not a dependency, it
      // is a dead end: the cart would tick a module the offer never lists.
      if (other.retired) {
        out.push(
          `⛔ "${m.id}" — LEVETT (retired) modult követel meg: "${r.id}". A kosár olyat ` +
            `pipálna be, ami nincs a kínálatban.`,
        );
      }
      if (other.tenantOnly) {
        out.push(
          `⛔ "${m.id}" — csak tenant-adminból eladható modult követel meg: "${r.id}". ` +
            `A konfigurátorban meg sem vásárolható, tehát a feltétel teljesíthetetlen.`,
        );
      }
      // The "why" is shown to the OWNER on six screens — an empty or stub sentence
      // would ship as the explanation of a blocked cancellation.
      if (r.why.trim().length < 20) {
        out.push(
          `⛔ "${m.id}" → "${r.id}" — a „why" mondat üres vagy csonk ("${r.why}"). ` +
            `Ez a mondat megy ki a tulajnak, nem gépi kód.`,
        );
      }
    }
  }

  // A cycle is not a modelling curiosity: the cart's closure and the cancel gate both
  // walk this graph, and a loop would either hang them or make every set invalid.
  // Walked over ALL edges (hard and advice alike) — an advice edge that closes a loop
  // is still a product statement nobody can satisfy.
  const edges = new Map<string, string[]>(
    catalog.map((m) => [m.id, (m.requires ?? []).map((r) => r.id)]),
  );
  const state = new Map<string, 1 | 2>();
  const walk = (id: string, path: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      const from = path.indexOf(id);
      out.push(`⛔ Körkörös függőség: ${[...path.slice(from < 0 ? 0 : from), id].join(" → ")}.`);
      return;
    }
    state.set(id, 1);
    for (const next of edges.get(id) ?? []) walk(next, [...path, id]);
    state.set(id, 2);
  };
  for (const m of catalog) walk(m.id, []);
  return out;
}

problems.push(...structuralRequirementProblems(MODULE_CATALOG));

// Every set we OFFER must be satisfiable — checked on the REAL derivation path
// (PRESETS / modulesForConversion / sellableModuleIds), judged by the independent
// reference above.
{
  const offered: { label: string; ids: readonly string[] }[] = [
    ...PRESETS.map((p) => ({ label: `"${p.id}" csomag`, ids: p.modules })),
    { label: "ALL-IN (konverziós alapértelmezés)", ids: modulesForConversion([], new Set()) },
  ];
  for (const s of offered) {
    for (const bad of unmetHard([...s.ids])) {
      problems.push(`⛔ ${s.label} — teljesítetlen függőség: ${bad}.`);
    }
  }

  // ⛔ THE MEASURED LEAK (ADR-0192 ②): the module-sales switch silently produced an
  // invalid package — with `rooms` off the shelf, `teljes` and `ajanlott` still
  // offered `pricing` and `booking` — and presetNestingViolations() stayed green
  // because it never sees the switch. So simulate it: taking ANY sellable module
  // off sale must leave every package satisfiable.
  for (const victim of MODULE_CATALOG) {
    if (victim.retired || victim.tenantOnly || victim.spine) continue;
    const disabled = new Set([victim.id]);
    const sets: { label: string; ids: readonly string[] }[] = [
      ...PRESETS.map((p) => ({
        label: `"${p.id}" csomag`,
        ids: sellableModuleIds(p.modules, disabled),
      })),
      { label: "ALL-IN", ids: modulesForConversion([], disabled) },
    ];
    for (const s of sets) {
      for (const bad of unmetHard([...s.ids])) {
        problems.push(
          `⛔ "${victim.id}" eladásból kivéve ⇒ ${s.label} teljesítetlen függőséget tartalmaz: ${bad}.`,
        );
      }
    }
  }
}

// Orphan registry entries: a config for a module that no longer exists in the catalog.
for (const id of Object.keys(MODULE_CONFIG_REGISTRY)) {
  if (!MODULE_CATALOG.some((m) => m.id === id)) {
    problems.push(`⛔ "${id}" — registry-bejegyzés, ami nincs benne a MODULE_CATALOG-ban (árva).`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// --selftest — the RED control. Every assertion below is a deliberately broken
// fixture the checker must reject, plus a valid one it must stay silent about.
// Standalone exit: a self-test that rides on the real run would report the
// product's state, not the checker's.
//   npx tsx scripts/module-config-lint.mts --selftest
// ──────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--selftest")) {
  const def = (id: string, requires?: ModuleDef["requires"], extra: Partial<ModuleDef> = {}): ModuleDef => ({
    id,
    label: id,
    publicLabel: id,
    publicDesc: id,
    group: "offer",
    priceMonthly: 0,
    ...(requires ? { requires } : {}),
    ...extra,
  });
  const WHY = "Ez egy elég hosszú, tulajnak szóló indoklás a teszthez.";
  const need = (id: string, over: Partial<ModuleRequirement> = {}): ModuleRequirement => ({
    id,
    strength: "hard",
    why: WHY,
    ...over,
  });

  const cases: { name: string; problems: string[]; want: string | null }[] = [
    {
      name: "ÉRVÉNYES pár → néma (nincs álpozitív)",
      problems: structuralRequirementProblems([def("a", [need("b")]), def("b")]),
      want: null,
    },
    {
      name: "nem létező modult követel meg",
      problems: structuralRequirementProblems([def("a", [need("nincs-ilyen")])]),
      want: "nem létező modult követel meg",
    },
    {
      name: "önhivatkozás",
      problems: structuralRequirementProblems([def("a", [need("a")])]),
      want: "önmagát követeli meg",
    },
    {
      name: "kör (a → b → a)",
      problems: structuralRequirementProblems([def("a", [need("b")]), def("b", [need("a")])]),
      want: "Körkörös függőség",
    },
    {
      name: "levett (retired) modul a függőség",
      problems: structuralRequirementProblems([def("a", [need("b")]), def("b", undefined, { retired: true })]),
      want: "LEVETT (retired) modult követel meg",
    },
    {
      name: "tenantOnly modul a függőség",
      problems: structuralRequirementProblems([def("a", [need("b")]), def("b", undefined, { tenantOnly: true })]),
      want: "csak tenant-adminból eladható",
    },
    {
      name: "csonk why mondat",
      problems: structuralRequirementProblems([def("a", [need("b", { why: "kell" })]), def("b")]),
      want: "mondat üres vagy csonk",
    },
    {
      name: "ugyanaz a függőség kétszer",
      problems: structuralRequirementProblems([def("a", [need("b"), need("b")]), def("b")]),
      want: "kétszer követeli meg ugyanazt",
    },
    {
      name: "ÉRVÉNYES halmaz → az unmetHard néma",
      problems: unmetHard(["booking", "pricing", "rooms"]),
      want: null,
    },
    {
      // ⭐ THE MEASURED LEAK, REPRODUCED. This is what shipped: the plain
      // "drop the disabled id" filter left `pricing` (and `booking`) in the
      // package after `rooms` went off sale, and presetNestingViolations()
      // stayed green. If this case ever goes silent, the cascade check is
      // vacuous and the lint above proves nothing.
      name: "RÉGI (kaszkád nélküli) szűrés rooms-letiltásnál → sértés",
      problems: unmetHard(
        PRESETS.find((p) => p.id === "teljes")!.modules.filter((id) => id !== "rooms"),
      ),
      want: "pricing → rooms",
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const hit = c.want === null ? c.problems.length === 0 : c.problems.some((p) => p.includes(c.want!));
    if (hit) {
      console.log(`✅ ${c.name}`);
    } else {
      failed++;
      console.error(`❌ ${c.name} — várt: ${c.want ?? "NÉMA"}; kapott: ${JSON.stringify(c.problems)}`);
    }
  }
  console.log(
    failed
      ? `\n⛔ module-config-lint --selftest: ${failed}/${cases.length} eset bukott.`
      : `\n✅ module-config-lint --selftest: mind a ${cases.length} eset rendben (a kapu tud pirosat adni).`,
  );
  process.exit(failed ? 1 : 0);
}

if (problems.length) {
  console.error(`\n${problems.join("\n")}`);
  console.error(
    `\n⛔ module-config-lint: ${problems.length} sértés — ADR-0044: felárért eladott modul KONFIGURÁLHATÓ kell legyen.`,
  );
  process.exit(1);
}

const priced = MODULE_CATALOG.filter((m) => m.priceMonthly > 0).length;
console.log(`✅ module-config-lint: mind a ${priced} felárazott modul konfigurálható.`);
