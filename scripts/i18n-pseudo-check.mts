// PSEUDO-LOCALE guard (ADR-0067 ②) — the structural answer to the i18n-lint's
// blind spot.
//
// ⛔ WHY: i18n-lint finds unwrapped strings by looking for HUNGARIAN ACCENTS. That
// heuristic is blind to unaccented Hungarian — and it shipped exactly that: the
// tenant admin greeted a Polish owner with "1 db" (darab), green gates all round,
// caught only by a human looking at a screenshot.
//
// This check does not guess at language at all. It renders the real views in a
// synthetic locale whose pack wraps every translated string in «guillemets», then
// asserts that NO visible text survives outside them. A string that never went
// through T() is unmarked by construction — accents or not.
//
//   npx tsx scripts/i18n-pseudo-check.mts

import { readFile } from "node:fs/promises";
import path from "node:path";

import { installPack } from "../src/i18n/packs.js";
import { runWithConsoleLang, setConsoleLang } from "../src/console/i18nCtx.js";
import {
  layout,
  leadsPage,
  operatorLoginHelpPage,
  operatorLoginPage,
  reportPage,
  settingsPage,
} from "../src/console/views.js";
import { buildLeadListResult } from "../src/console/data.js";
import { adminDashboard } from "../src/server/adminViews.js";
import { moduleSettingsSection } from "../src/server/moduleConfigViews.js";
import { effectiveModuleConfig } from "../src/moduleConfig.js";
import { MULTILANG_TIERS } from "../src/modules.js";
import { LANG_REGIONS, langName, siteLangs } from "../src/i18n/lang.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const PSEUDO = "zz";

const catalog = JSON.parse(
  await readFile(path.join(ROOT, "src/i18n/catalog.json"), "utf8"),
) as string[];
installPack(
  PSEUDO,
  Object.fromEntries(catalog.map((s) => [s, `«${s}»`])),
);

const session = {
  tenantId: "demo",
  tenantUserId: "u",
  username: "demo-user",
  displayName: "Demo Panzio",
  contactEmail: "demo@example.com",
} as unknown as Parameters<typeof adminDashboard>[0];

const content = {
  name: "Demo Panzio",
  tagline: "Tagline",
  intro: "Intro text that is long enough to count as done for the checklist.",
  highlights: ["A", "B"],
  photos: [{ url: "/x.jpg", alt: "alt" }],
  usingOwnPhotos: true,
  status: "live",
  previewPath: null,
  lang: PSEUDO,
} as unknown as Parameters<typeof adminDashboard>[1];

const modules = {
  modules: [
    { id: "gallery", label: "Galeria", group: "offer", spine: false, active: true, priceMonthly: 490, supersededBy: null },
    { id: "enquiry", label: "Enquiry", group: "reach", spine: true, active: true, priceMonthly: 0, supersededBy: null },
  ],
  baseMonthly: 3900,
  totalMonthly: 4390,
} as unknown as NonNullable<Parameters<typeof adminDashboard>[2]>["modules"];

// ⚠️ Ez a fixture NINCS típus-ellenőrizve (az opts `as unknown` úton megy be), ezért a
// `tsc` NEM fogja meg, ha a nézet új mezőt vár — az ADR-0128-nál pont ez történt:
// a hiányzó `regions` miatt a kártya renderelése futásidőben szállt el, és EZ A KAPU
// fogta meg, nem a fordító. Ezért a sávok a VALÓDI forrásból (MULTILANG_TIERS) jönnek,
// és a nyelvek is a valódi listából: így a fixture nem tud csendben elavulni.
const mlTargets = siteLangs().filter((l) => l !== "hu");
const multilang = {
  price: 14900,
  count: 3,
  tiers: MULTILANG_TIERS.map((t) => ({
    id: t.id,
    name: t.name,
    cap: t.cap ?? mlTargets.length,
    isAll: t.cap === null,
    price: t.priceDefault,
    effPrice: t.priceDefault,
    unitPrice: Math.round(t.priceDefault / (t.cap ?? mlTargets.length)),
  })),
  selectedTier: MULTILANG_TIERS[0]!.id,
  totalTargets: mlTargets.length,
  regions: LANG_REGIONS.map((r) => ({
    key: r.key,
    langs: r.codes.map((c) => ({ code: c, name: langName(c) })),
  })),
  primaryLangName: "x",
  options: mlTargets.map((l) => ({ code: l, name: langName(l) })),
  state: { languages: ["de"], langNames: ["de"], status: "stale" as const, generatedAt: "2026-08-25" },
  generating: false,
  failedError: null,
  langUrls: [{ lang: "de", url: "https://x/de/" }],
};

/**
 * ADR-0067 ③ — the INTERNAL CONSOLE surfaces, rendered inside a request language
 * context exactly as the server does it. EMPTY-STATE data on purpose: "no results
 * yet" copy is the most commonly forgotten to translate, and it is precisely what
 * a new colleague meets on their first day.
 */
const CONSOLE_SURFACES: readonly { name: string; html: string }[] = runWithConsoleLang(() => {
  setConsoleLang(PSEUDO);
  // Every FunnelCounts field, so the report renders real "0" cells instead of
  // "undefined" (an undefined would look like a leak and hide a real one).
  const zero = {
    prospects: 0,
    sent: 0,
    opened: 0,
    returned: 0,
    moduleTouched: 0,
    orderIntent: 0,
    converted: 0,
    unsubscribed: 0,
    openedOfSent: 0,
    orderIntentOfSent: 0,
  };
  const emptyReport = {
    total: zero,
    segments: [],
    leadTotals: { players: 0, leads: 0, mocks: 0, approved: 0 },
  } as unknown as Parameters<typeof reportPage>[0];
  return [
    { name: "console:chrome", html: layout("Citoviso", "<p>Citoviso</p>", { active: "/" }) },
    { name: "console:login", html: operatorLoginPage(null, "") },
    { name: "console:login-help", html: operatorLoginHelpPage("") },
    { name: "console:leads-empty", html: leadsPage(buildLeadListResult([], {}), {}) },
    {
      name: "console:settings",
      html: settingsPage({ username: "op", displayName: "Op", role: "superadmin" }),
    },
    { name: "console:report", html: reportPage(emptyReport) },
  ];
});

/** Guest-written review rows — the GUEST's words, never translated (see PROPER). */
const REVIEW_FIXTURE = [
  { id: "rv1", authorName: "Anna", rating: 5, body: "Nice", stayMonth: "2026-08", unitName: "Room", status: "pending", verified: false, token: "t1" },
  { id: "rv2", authorName: "Peter", rating: 4, body: "Nice", stayMonth: null, unitName: null, status: "published", verified: false, token: "t2" },
  { id: "rv3", authorName: "Elek", rating: 1, body: "Nice", stayMonth: null, unitName: null, status: "rejected", verified: false, token: "t3" },
];

/** Every surface this guard covers. Add a view here when you add a view. */
const SURFACES: readonly { name: string; html: string; attrs?: boolean }[] = [
  ...CONSOLE_SURFACES,
  ...["attekintes", "szovegek", "fotok", "modulok", "fiok"].map((tab) => ({
    name: `admin:${tab}`,
    html: adminDashboard(session, content, {
      tab,
      modules,
      multilang,
      siteUrl: "https://demo.citoviso.com",
      previewToken: "t",
      saved: true,
    }),
  })),
  // The review inbox (approved contract B): every state, the "what you just did" line,
  // and the Google card with the owner's toggle BOTH ways — its wording differs per state.
  // Unaccented labels ("Kiteszem", "Az oldalon", "csillag") sailed past i18n-lint here
  // because this screen was never on this list (measured 2026-09-23).
  ...[true, false].map((showGoogleRating) => ({
    name: `module:reviews(google ${showGoogleRating ? "on" : "off"})`,
    attrs: true,
    html: adminDashboard(session, content, {
      tab: "modulok",
      modules,
      moduleSettingsHtml: moduleSettingsSection("reviews", {
        lang: PSEUDO,
        values: { ...effectiveModuleConfig("reviews", null, null), showGoogleRating },
        canRestore: true,
        priceMonthly: 490,
        reviews: {
          items: REVIEW_FIXTURE,
          google: { value: 4.8, count: 37, url: "https://www.google.com/maps" },
          done: { id: "rv1", verdict: "published" },
        },
      }),
    }),
  })),
  ...["hours", "amenities", "usp", "poi"].map((m) => ({
    name: `module:${m}`,
    html: adminDashboard(session, content, {
      tab: "modulok",
      modules,
      moduleSettingsHtml: moduleSettingsSection(m, {
        lang: PSEUDO,
        values: effectiveModuleConfig(m, null, null),
        canRestore: true,
        priceMonthly: 490,
      }),
    }),
  })),
];

/**
 * Visible text fragments of an HTML document.
 *
 * Tags become a separator rather than a boundary, because a marked sentence may
 * legitimately SPAN markup (`«Az <strong>«nyitókép»</strong> — …»`). Marks are
 * therefore removed from the whole text FIRST (inner-most out, so nesting works),
 * and only what remains is split into fragments to judge.
 */
function visibleText(html: string, withAttrs = false): string[] {
  const SEP = " ";
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, SEP);
  // Drop translated spans, inner-most first; a mark may contain separators.
  for (let i = 0; i < 12; i++) {
    const next = text.replace(/«[^«»]*»/g, SEP);
    if (next === text) break;
    text = next;
  }
  // (Opt-in per surface: turned on globally it reports 4 pre-existing console leaks —
  // "minimum", a placeholder — that are their own thread; measured 2026-09-23.)
  // Accessible names and hints are COPY as well — a screen reader reads them aloud,
  // and "5 csillag" in an aria-label is exactly how an untranslated label hid here.
  const attrs = [...html.replace(/<script[\s\S]*?<\/script>/gi, " ").matchAll(
    /\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g,
  )].map((m) => m[1]!.replace(/«[^«»]*»/g, " ").replace(/&[a-z]+;/g, " "));
  return withAttrs ? [...text.split(SEP), ...attrs] : text.split(SEP);
}

// Text that is legitimately NOT translated. Kept deliberately tight — every
// entry here is a hole in the guard, so each one states WHY it is not a label:
//   · punctuation / digits / icon glyphs — no language at all;
//   · an amount with its currency — a number, formatted, not a sentence;
//   · a hostname, an e-mail address, a language CODE — identifiers;
//   · the FIXTURE's own tenant data below — that is the owner's text, and
//     translating a tenant's own words would be the actual bug.
const ALLOW = new RegExp(
  "^(?:" +
    // ↕ ↑ ↓ = the sort-direction glyphs in the lead-list header (2026-09-12). Direction
    // arrows, not copy: there is nothing in them to translate, and putting them in the
    // catalog would invite a translator to "translate" an arrow.
    // ⇄ = the "scrolls sideways" marker, ? = the column-help button (2026-09-14, the
    // approved lead-list plan). Same class: icon glyphs with no language in them. Both
    // carry a TRANSLATED accessible name (`aria-label`/`title` through `T()`) and the ⇄
    // sits in an `aria-hidden` span — the MEANING is translated, the glyph is decoration.
    // ⚠️ This does not open a hole for real copy: the pattern is anchored `^…$`, so a
    // string is exempt only if it is ENTIRELY glyphs. "Mit jelent?" still fails.
    "[\\s\\d.,:;·—–\\-/()%+«»@★☆›‹×↕↑↓⇄?]*" + // punctuation, digits, glyphs
    "|[\\d\\s.,]+\\s*(?:Ft|€|EUR|HUF)" + // formatted money
    "|[a-z0-9.-]+\\.[a-z]{2,}" + // hostname
    "|[^\\s@]+@[^\\s@]+\\.[a-z]{2,}" + // e-mail
    "|[A-Za-z]{2,3}" + // language / currency code (DE, de, HUF)
    ")$",
);
const PROPER = new Set([
  "Citoviso",
  // The brand word after the mark that IS the "C" (the "B" lockup, ADR-0236) — the name,
  // split by design; the lockup's accessible name is the whole "Citoviso".
  "itoviso",
  // Role identifiers are data, not labels (RBAC keys).
  "superadmin",
  // The FIXTURE tenant's own content (see `content`/`modules` above).
  "Demo Panzio",
  "demo-user",
  "Galeria",
  "Enquiry",
  "Intro text that is long enough to count as done for the checklist.",
  "Tagline",
  "alt",
  "A B",
  // The review fixture's guest data (REVIEW_FIXTURE): names, the quoted body, the unit.
  "Anna",
  "Peter",
  "Elek",
  "„Nice\"",
  "Room",
  "2026-08 · Room",
]);

let bad = 0;
for (const s of SURFACES) {
  const leaks: string[] = [];
  for (const raw of visibleText(s.html, s.attrs)) {
    // Trim decorative punctuation around a fragment: "Citoviso —" is the proper
    // noun plus a separator, not an untranslated label.
    const t = raw.replace(/\s+/g, " ").trim().replace(/^[—–·:|/,-]+|[—–·:|/,-]+$/g, "").trim();
    if (!t || ALLOW.test(t) || PROPER.has(t)) continue;
    // Marked text is fine — including a sentence built from several marks, and
    // NESTED marks (a T() whose placeholder holds another T(), e.g. a label
    // rendered inside a sentence). Strip inner-most first, repeatedly.
    let stripped = t;
    for (let i = 0; i < 8; i++) {
      const next = stripped.replace(/«[^«»]*»/g, "");
      if (next === stripped) break;
      stripped = next;
    }
    stripped = stripped.replace(/\s+/g, " ").trim();
    if (!stripped || ALLOW.test(stripped) || PROPER.has(stripped)) continue;
    leaks.push(stripped.slice(0, 70));
  }
  if (leaks.length) {
    bad += leaks.length;
    console.error(`⛔ ${s.name} — ${leaks.length} burkolatlan felirat:`);
    for (const l of [...new Set(leaks)].slice(0, 8)) console.error(`   "${l}"`);
  }
}

if (bad) {
  console.error(
    `\n⛔ i18n-pseudo-check: ${bad} felirat NEM megy át a nyelvi csomagon — ` +
      `idegen nyelvű tenant ezt a saját nyelve helyett magyarul látná (§B.18).`,
  );
  process.exit(1);
}
console.log(`✅ i18n-pseudo-check: ${SURFACES.length} felület — minden látható felirat a csomagból jön.`);
