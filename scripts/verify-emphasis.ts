// ADR-0025 ①② verify: deterministic (no API — key cleared → planner fallback runs the SAME
// enforce() guarantees). Checks restraint (≤1 sample-only module in a cold mock) + exactly one
// focal + sample-only forced quiet, then renders HTML for a screenshot eyeball.
//   npx tsx scripts/verify-emphasis.ts
process.env.ANTHROPIC_API_KEY = ""; // set-empty (not delete) so dotenv won't repopulate → fallback
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const { planRecipe } = await import("../src/engine/planner.js");
const { renderSite } = await import("../src/engine/render.js");
type SiteData = import("../src/engine/recipe.js").SiteData;

const photos = Array.from({ length: 6 }, (_, i) => ({
  url: `https://picsum.photos/seed/cit${i}/1200/800`,
  alt: `Fotó ${i + 1}`,
  provenance: "portal" as const,
}));

const COLD: SiteData = {
  name: "Zöldtető Vendégház",
  tagline: "Csendes zug a Balaton-felvidék szívében",
  intro: "Egy régi présházból újjászületett vendégház, ahol a kőfalak és a szőlőhegyi kilátás a főszereplő.",
  highlights: ["Panorámás terasz", "Saborkert", "Kandalló", "Ingyenes parkolás"],
  photos,
  contact: { email: "info@zoldteto.hu", phone: "+36 30 123 4567", address: "8256 Ábrahámhegy, Hegyi út 4." },
};

const RICH: SiteData = {
  ...COLD,
  name: "Silva Resort & Spa",
  rooms: [
    { name: "Deluxe szoba", capacity: "2 fő", note: "Erkély, kilátás.", price: "42 500 Ft / éj", photo: photos[0] },
    { name: "Lakosztály", capacity: "2+2 fő", note: "Külön nappali.", price: "68 000 Ft / éj", photo: photos[1] },
  ],
  reviews: [{ quote: "Álomszép hely, tökéletes kiszolgálás.", author: "Nóra", meta: "2025 nyara" }],
  faqs: [{ q: "Van wellness?", a: "Igen, uszoda és szauna." }],
  rating: { value: 4.7, count: 128 },
};

function summarize(label: string, secs: readonly { kind: string; emphasis?: string }[]) {
  const focal = secs.filter((s) => s.emphasis === "focal");
  const quiet = secs.filter((s) => s.emphasis === "quiet").map((s) => s.kind);
  const sample = secs.filter((s) => ["rooms", "reviews", "faq"].includes(s.kind)).map((s) => s.kind);
  console.log(`\n[${label}]`);
  console.log("  szekciók:", secs.map((s) => `${s.kind}${s.emphasis ? `(${s.emphasis})` : ""}`).join(" → "));
  console.log("  focal:", focal.map((s) => s.kind).join(",") || "NINCS", "| quiet:", quiet.join(",") || "-", "| minta-modulok:", sample.join(",") || "-");
  return { focalCount: focal.length, focalKind: focal[0]?.kind, sampleCount: sample.length };
}

const outDir = path.resolve(process.cwd(), "sites/_engine-proof");
await mkdir(outDir, { recursive: true });
let failures = 0;
const expect = (cond: boolean, msg: string) => { if (!cond) { console.log("  ❌ " + msg); failures++; } else console.log("  ✅ " + msg); };

for (const [label, data, expectFocal] of [["COLD", COLD, "gallery"], ["RICH", RICH, "gallery"]] as const) {
  const { recipe, source } = await planRecipe(data);
  const s = summarize(`${label} (${source})`, recipe.sections);
  expect(s.focalCount === 1, "pontosan egy focal");
  expect(s.focalKind === expectFocal, `focal = ${expectFocal} (kapott: ${s.focalKind})`);
  if (label === "COLD") expect(s.sampleCount <= 1, `restraint: ≤1 minta-modul (kapott: ${s.sampleCount})`);
  if (label === "RICH") expect(s.sampleCount === 3, `gazdag: mind 3 valós modul megmarad (kapott: ${s.sampleCount})`);

  const html = renderSite(recipe, data, { phase: "mock" });
  // Count only injected ATTRIBUTES (`<section data-cit-emphasis=…`), not the CSS selectors.
  const focalAttrs = (html.match(/<section data-cit-emphasis="focal"/g) ?? []).length;
  const quietAttrs = (html.match(/<section data-cit-emphasis="quiet"/g) ?? []).length;
  expect(focalAttrs === 1, `renderben 1 focal attribútum (kapott: ${focalAttrs})`);
  expect(html.includes('[data-cit-emphasis="focal"]'), "EMPHASIS_CSS jelen van");
  console.log(`  render: ${focalAttrs} focal + ${quietAttrs} quiet attribútum`);
  await writeFile(path.join(outDir, `emphasis-${label.toLowerCase()}.html`), html);
}

console.log(`\n${failures === 0 ? "✅ MIND PASS" : `❌ ${failures} bukás`}`);
process.exit(failures === 0 ? 0 : 1);
