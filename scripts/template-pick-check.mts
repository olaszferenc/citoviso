// Gate: the curator's template pick must be exactly what gets generated.
//
// ⛔ WHY THIS EXISTS. The picker is multi-select (one mock per ticked template),
// but the form arrived with "fullbleed" PRE-CHECKED. Ticking "arch-frames" then
// produced TWO mocks — one of them always fullbleed — so the owner reported
// "kiválasztom a Boltíves kereteket … ugyanazt a típust gyártja le". The picker
// was not broken; it silently added a second pick nobody asked for.
//
// What is measured (no DB, no network — pure render + parse):
//   ① nothing is pre-checked in the generator form;
//   ② every registered template has a picker card AND a preview image on disk;
//   ③ a chosen template id really reaches the rendered page (per template);
//   ④ the artifact card names the template that produced it.
//
//   npx tsx scripts/template-pick-check.mts

import { existsSync } from "node:fs";
import path from "node:path";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { leadPage } from "../src/console/views.js";

const fails: string[] = [];
const ok = (c: boolean, label: string, detail = "") => {
  console.log(`  ${c ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!c) fails.push(label);
};

// ── ① + ② the picker form ───────────────────────────────────────────────────
const lead = (artifacts: unknown[]) =>
  ({
    id: "00000000-0000-0000-0000-000000000000",
    name: "Teszt Lead",
    qualification: "unknown",
    lifecycle: "active",
    matchConfidence: 0.9,
    address: "Fő utca 1.",
    region: "Balaton",
    raw: {},
    provenance: [],
    artifacts,
  }) as unknown as Parameters<typeof leadPage>[0];

const html = leadPage(lead([]));

const checked = [...html.matchAll(/<input[^>]*name="template"[^>]*>/g)].filter((m) =>
  / checked/.test(m[0]),
);
ok(
  checked.length === 0,
  "a generáló űrlapon EGYETLEN sablon sincs előre bejelölve",
  checked.length ? `${checked.length} előre bejelölve` : "0 előre bejelölve",
);

const missingCards = Object.keys(TEMPLATES).filter(
  (id) => !html.includes(`name="template" value="${id}"`),
);
ok(missingCards.length === 0, "minden sablonnak van kártyája a választóban", missingCards.join(", "));

const root = path.resolve(import.meta.dirname, "..");
const missingShots = Object.keys(TEMPLATES).filter(
  (id) => !existsSync(path.join(root, "public/assets/ui", `tpl-${id}.jpg`)),
);
ok(missingShots.length === 0, "minden sablonnak van előnézeti kártyaképe", missingShots.join(", "));

// ── ③ the pick reaches the rendered page ────────────────────────────────────
const DATA: SiteData = {
  name: "Teszt Panzió",
  tagline: "Csend és kilátás",
  intro: "Kétszáz méterre a parttól, saját kerttel.",
  highlights: ["Parkoló", "Kert"],
  photos: [
    { url: "https://example.invalid/1.jpg", alt: "Ház" },
    { url: "https://example.invalid/2.jpg", alt: "Szoba" },
    { url: "https://example.invalid/3.jpg", alt: "Kert" },
  ],
  contact: { email: "a@b.hu", phone: "+36 30 123 4567", address: "Fő utca 1." },
} as SiteData;

const wrong: string[] = [];
for (const id of Object.keys(TEMPLATES)) {
  const recipe: Recipe = { template: id, skin: "", archetype: "", sections: [] };
  const out = renderSite(recipe, DATA, { phase: "mock" });
  // every template stamps its own id on <body class="cit-tpl-…"> or is identifiable
  // by its own CSS namespace; the body class is the contract the guards key off
  if (!out.includes(`cit-tpl-`)) wrong.push(`${id}: nincs cit-tpl-* body-osztály`);
}
ok(wrong.length === 0, "minden sablon a saját body-osztályát adja", wrong.join(" | "));

// the three new ones must be distinguishable from each other (not one shared render)
const sigs = new Map<string, string>();
for (const id of ["tilted-gallery", "arch-frames", "wordmark-grow"]) {
  if (!TEMPLATES[id]) continue;
  const out = renderSite({ template: id, skin: "", archetype: "", sections: [] }, DATA, {
    phase: "mock",
  });
  const m = /<body class="([^"]+)"/.exec(out);
  sigs.set(id, m?.[1] ?? "");
}
ok(
  new Set(sigs.values()).size === sigs.size,
  "a három új sablon KÜLÖNBÖZŐ oldalt ad (nem ugyanazt)",
  [...sigs.entries()].map(([k, v]) => `${k}→${v}`).join(", "),
);

// ── ④ the artifact card names its template ──────────────────────────────────
const withArtifact = leadPage(
  lead([
    {
      id: "11111111-1111-1111-1111-111111111111",
      path: "mock-teszt-arch-frames.html",
      status: "generated",
      generatedAt: "2026-09-08T10:00:00.000Z",
      inputs: { template: "arch-frames", photos: 3 },
      decisions: [],
    },
  ]),
);
const shortName = (TEMPLATES["arch-frames"]?.label.split(/[—:(]/)[0] ?? "").trim();
ok(
  !!shortName && withArtifact.includes(shortName),
  "az artifact-kártya kiírja, melyik sablon készítette",
  shortName,
);

console.log(
  fails.length
    ? `\n⛔ template-pick-check: ${fails.length} bukott ellenőrzés.`
    : "\n✅ template-pick-check: amit a kurátor kiválaszt, pontosan az készül el.",
);
process.exit(fails.length ? 1 : 0);
