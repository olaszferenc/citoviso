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

import { MODULE_CATALOG } from "../src/modules.js";
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

// Orphan registry entries: a config for a module that no longer exists in the catalog.
for (const id of Object.keys(MODULE_CONFIG_REGISTRY)) {
  if (!MODULE_CATALOG.some((m) => m.id === id)) {
    problems.push(`⛔ "${id}" — registry-bejegyzés, ami nincs benne a MODULE_CATALOG-ban (árva).`);
  }
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
