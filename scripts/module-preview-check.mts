/**
 * ADR-0089 gate — the tenant-admin module preview.
 *
 * What this measures, and why each one is here rather than "obviously fine":
 *
 *  ①  THE PREVIEW WRITES NOTHING. A pre-payment ALL-IN preview that quietly wrote
 *     entitlements is exactly how three live tenants ended up running modules they
 *     never paid for. The guard reads the preview's own source and refuses ANY
 *     write call in its closure — and proves the detector works by pointing it at
 *     renderAndPersist(), which must come back dirty.
 *  ②  A NOT-YET-OWNED SECTION IS MARKED. Without the "MINTA…" badge the preview
 *     claims the content is already the tenant's (§B.17) and the paid reality would
 *     differ from what was shown (§I bait-and-switch).
 *  ③  THE FOCUSED MODULE IS IN THE PREVIEWED SET. "Show me how this would look" is
 *     asked about modules the tenant does NOT own; rendering without it answers with
 *     the page they already have. This shipped broken once — measured, not assumed.
 *  ④  SAMPLES STILL CANNOT REACH A LIVE PAGE. The new sampleAllow hook opens the
 *     sample path outside the mock phase; the default must stay closed.
 *
 * Every assertion has a RED twin: a deliberately broken input the checker must
 * reject. A guard that has never failed is a guard nobody has tested.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { decoratePreview, domAnchorsOf, parsePreviewSet } from "../src/server/modulePreview.js";
import { modulesSection } from "../src/server/adminViews.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { ARCHETYPES } from "../src/engine/archetypes.js";
import { SKINS } from "../src/engine/skins.js";
import { MODULE_CATALOG } from "../src/modules.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import type { TenantModuleView } from "../src/tenant/modules.js";

const ROOT = path.resolve(import.meta.dirname, "..");
let bad = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  bad++;
  console.log(`  ✗ ${m}`);
};
const check = (cond: boolean, m: string) => (cond ? ok(m) : fail(m));

// ── ① the preview must not write ────────────────────────────────────────────
const WRITE_CALLS = [".updateTable(", ".insertInto(", ".deleteFrom(", "writeFile(", "mkdir("];

/** Body of a top-level `export async function NAME(` / `async function NAME(`. */
function functionBody(src: string, name: string): string {
  const start = src.search(new RegExp(`(export\\s+)?async function ${name}\\s*\\(`));
  if (start < 0) throw new Error(`nincs ilyen függvény: ${name}`);
  const open = src.indexOf("{", src.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`nem záródik: ${name}`);
}
const writesIn = (body: string) => WRITE_CALLS.filter((c) => body.includes(c));

console.log("① Az előnézet nem ír (forrás-szintű zár):\n");
const editorSrc = await readFile(path.join(ROOT, "src/tenant/editor.ts"), "utf8");
const previewBody = functionBody(editorSrc, "renderTenantModulePreview");
const previewWrites = writesIn(previewBody);
check(
  previewWrites.length === 0,
  previewWrites.length === 0
    ? "⭐⭐ renderTenantModulePreview NEM ír (se entitlement, se fájl, se DB-sor)"
    : `renderTenantModulePreview ÍR: ${previewWrites.join(", ")}`,
);
// RED twin: the same detector on the persisting path must come back dirty.
check(
  writesIn(functionBody(editorSrc, "renderAndPersist")).length > 0,
  "önteszt: az író-detektor a renderAndPersist-et ELKAPJA (tehát tud pirosra menni)",
);
const routeSrc = await readFile(path.join(ROOT, "src/server/public.ts"), "utf8");
const routeIdx = routeSrc.indexOf('pathname === "/admin/modules/preview"');
check(routeIdx > 0, "az előnézet-route létezik a publikus szerveren");
const routeChunk = routeSrc.slice(routeIdx, routeIdx + 1400);
check(
  !routeChunk.includes("applyModuleChange") && !routeChunk.includes("rerenderTenantSnapshot"),
  "az előnézet-route nem hív modul-váltást és nem renderel snapshotot",
);
check(routeChunk.includes("currentTenant"), "az előnézet-route session mögött van");

// ── ② the sample badge ──────────────────────────────────────────────────────
console.log("\n② A meg nem vásárolt szakasz JELÖLT:\n");
const BADGE = "MINTA — az Ön adataival töltjük fel";
const fakePage =
  `<html><body><section data-cit-module="rooms"><h2>Szobák</h2></section>` +
  `<section data-cit-module="gallery"><h2>Képek</h2></section></body></html>`;
const shown = new Set(["rooms", "gallery", "enquiry"]);
const marked = decoratePreview(fakePage, { owned: new Set(["gallery"]), shown, lang: "hu" });
check(marked.includes(BADGE), "a minta-címke szövege bekerül az előnézetbe");
check(
  /"notOwned":\s*\[[^\]]*"rooms"/.test(marked),
  "a NEM birtokolt modul (rooms) a jelölendők közt van",
);
check(
  !/"notOwned":\s*\[[^\]]*"gallery"/.test(marked),
  "a birtokolt modul (gallery) NINCS a jelölendők közt (nem hazudik mintát)",
);
check(marked.includes("</body>"), "a dekoráció a body-n belül marad (nem tör el HTML-t)");
// RED twin: with everything owned there is nothing to mark.
const allOwned = decoratePreview(fakePage, { owned: shown, shown, lang: "hu" });
check(
  /"notOwned":\s*\[\]/.test(allOwned),
  "önteszt: ha mindent birtokol, a jelölendő-lista ÜRES (a detektor nem mindig zöld)",
);

// ── ③ the focused module is inside the previewed set ────────────────────────
console.log("\n③ A megnézett modul BENNE van az előnézett halmazban:\n");
const mkModule = (id: string, active: boolean): TenantModuleView["modules"][number] => {
  const def = MODULE_CATALOG.find((m) => m.id === id)!;
  return {
    id,
    label: def.publicLabel,
    publicDesc: def.publicDesc,
    group: def.group,
    spine: Boolean(def.spine),
    active,
    priceMonthly: def.priceMonthly,
    supersededBy: null,
    cancelAtPeriodEnd: false,
    awaitingFirstCharge: false,
  };
};
const mv: TenantModuleView = {
  modules: [
    mkModule("gallery", true),
    mkModule("enquiry", true),
    mkModule("rooms", false),
    mkModule("pricing", false),
    mkModule("email", false),
  ],
  baseMonthly: 3900,
  totalMonthly: 4390,
};
const tabHtml = modulesSection(mv, null, null, "info@example.com", "hu");
const links = [...tabHtml.matchAll(/href="\/admin\/modules\/preview\?on=([^"#]+)#focus=([^"]+)"/g)].map(
  (m) => ({ on: decodeURIComponent(m[1]!).split(","), focus: decodeURIComponent(m[2]!) }),
);
check(links.length > 0, `a fülön van előnézet-link (${links.length} db)`);
const missing = links.filter((l) => !l.on.includes(l.focus)).map((l) => l.focus);
check(
  missing.length === 0,
  missing.length === 0
    ? "⭐⭐ minden előnézet-link tartalmazza a saját modulját (nem a mai oldalt mutatná)"
    : `hiányzó modul az előnézet-halmazból: ${missing.join(", ")}`,
);
check(
  links.some((l) => l.focus === "rooms"),
  "a meg NEM vásárolt modulnak is van előnézet-linkje (ez adja el)",
);
// A module with no page surface must not promise a preview.
check(domAnchorsOf("email").length === 0, "az egyedi e-mail cím modulnak nincs oldal-horgonya");
check(
  !links.some((l) => l.focus === "email"),
  "⭐ felület nélküli modul NEM kap „Megnézem” gombot (nem ígér üres képernyőt)",
);
check(tabHtml.includes("Az én moduljaim"), "a fülön ott a megvásárolt modulok blokkja");
check(tabHtml.includes("Bővítés"), "a fülön ott a kirakat-blokk");
check(
  (tabHtml.match(/data-modrow="rooms"/g) ?? []).length === 1,
  "egy modul PONTOSAN egy blokkban szerepel (nincs duplikálás)",
);
check(parsePreviewSet("*").size > 5, "az `on=*` rövidítés a teljes katalógust adja");
check(parsePreviewSet("nemletezo,rooms").has("rooms"), "ismert modul átmegy az `on=` szűrőn");
check(!parsePreviewSet("nemletezo").has("nemletezo"), "ismeretlen modul-id NEM jut a renderelőig");
check(parsePreviewSet("").has("enquiry"), "a gerinc mindig benne van (van mivel megkeresni)");

// ── ④ samples still cannot reach a live page ────────────────────────────────
console.log("\n④ Élesre továbbra sem szivárog minta:\n");
const RECIPE = { template: "editorial", skin: "calm", sections: [] } as unknown as Recipe;
const DATA = {
  name: "Teszt Vendégház",
  tagline: "Teszt",
  intro: "Teszt bevezető.",
  highlights: ["Kert"],
  photos: [{ url: "/uploads/a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "", address: "Fő utca 1." },
} as unknown as SiteData;
const live = renderSite(RECIPE, DATA, { phase: "live" });
const previewLike = renderSite(RECIPE, DATA, {
  phase: "live",
  sampleAllow: new Set(["pricing"]),
  demoForms: true,
});
check(!/data-cit-module="pricing"/.test(live), "élesen, minta-engedély NÉLKÜL nincs ár-szekció");
check(
  /data-cit-module="pricing"/.test(previewLike),
  "önteszt: engedéllyel viszont MEGJELENIK (tehát tényleg ez a kapcsoló dönt)",
);
check(
  !/data-cit-module="hours"/.test(previewLike),
  "⭐⭐ az engedély SZŰK: amit nem engedtünk, az mintaként sem jelenik meg",
);

// ── ⑤ the gallery switch actually moves the page (ADR-0089 ⑦) ───────────────
// The tenant used to be able to switch "Képek a szállásról" off and see NOTHING
// change: only the photo cap was lifted. A paid switch that moves nothing is
// indistinguishable from a con (§I) — so this measures every template both ways.
console.log("\n⑤ A galéria-kapcsoló LÁTHATÓAN változtat (és nem hagy sebet):\n");
const GAL_DATA = {
  name: "Villa Rubin",
  tagline: "Csend, kert",
  intro: "Kétszáz méterre a víztől.",
  highlights: ["Saját parkoló", "Kutyabarát"],
  photos: [1, 2, 3, 4, 5, 6].map((i) => ({
    url: `/uploads/${i}.jpg`,
    alt: `kép ${i}`,
    provenance: "owner",
  })),
  contact: { email: "info@example.com", phone: "+36 30 111 2222", address: "Fő utca 1." },
  rooms: [{ name: "Kétágyas", capacity: "2 fő" }],
} as unknown as SiteData;
const nImg = (h: string) => (h.match(/<img\b/gi) ?? []).length;
const nAnchor = (h: string) => (h.match(/data-cit-module="gallery"/g) ?? []).length;
/** A section left as a heading over nothing — the empty band the doctrine forbids. */
function hollowBands(h: string): number {
  let n = 0;
  for (const m of h.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)) {
    if (!/<(img|figure|svg|iframe|form|input|video|table|p|li|ul|ol|dl|blockquote)\b/i.test(m[1]!)) n++;
  }
  return n;
}
/** href="#foo" with no id="foo" anywhere — a button that goes nowhere. */
function deadAnchors(h: string): string[] {
  const ids = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  return [...h.matchAll(/href="#([A-Za-z][^"]*)"/g)]
    .map((m) => m[1]!)
    .filter((t) => t !== "top" && !ids.has(t));
}
const galFails: string[] = [];
let galChecked = 0;
for (const id of Object.keys(TEMPLATES)) {
  const r = { template: id, skin: Object.keys(SKINS)[0], sections: [] } as unknown as Recipe;
  const on = renderSite(r, GAL_DATA, { phase: "live" });
  const off = renderSite(r, GAL_DATA, { phase: "live", hideGallery: true });
  galChecked++;
  if (nAnchor(on) === 0) galFails.push(`${id}: bekapcsolva sincs galéria-horgony (a mérés vak lenne)`);
  if (nAnchor(off) !== 0) galFails.push(`${id}: kikapcsolva IS maradt galéria-szekció`);
  if (nImg(off) >= nImg(on)) galFails.push(`${id}: a kikapcsolás nem vett le képet (${nImg(on)}→${nImg(off)})`);
  if (nImg(off) < 1) galFails.push(`${id}: kép nélkül maradt az oldal (§A: soha)`);
  if (!off.includes("Villa Rubin")) galFails.push(`${id}: elveszett a szállás neve`);
  if (hollowBands(off) > hollowBands(on)) galFails.push(`${id}: üres sáv maradt a galéria helyén`);
  const dead = deadAnchors(off).filter((t) => !deadAnchors(on).includes(t));
  if (dead.length) galFails.push(`${id}: halott menü-link maradt (#${dead.join(", #")})`);
}
check(galChecked >= 16, `mind a ${galChecked} sablon mérve galéria BE és KI állásban`);
check(
  galFails.length === 0,
  galFails.length === 0
    ? "⭐⭐ minden sablonon: a galéria-szekció eltűnik, a fejléc-kép marad, nincs üres sáv és nincs halott menü-link"
    : galFails.join(" · "),
);
// Composition path: the gallery may BE the page's only imagery — there a single
// photo stays rather than a picture-less page, but the switch must still move.
const compFails: string[] = [];
for (const a of Object.keys(ARCHETYPES)) {
  const r = {
    archetype: a,
    skin: Object.keys(SKINS)[0],
    sections: [{ kind: "hero" }, { kind: "gallery" }, { kind: "features" }, { kind: "rooms" }],
  } as unknown as Recipe;
  const on = renderSite(r, GAL_DATA, { phase: "live" });
  const off = renderSite(r, GAL_DATA, { phase: "live", hideGallery: true });
  if (nImg(off) >= nImg(on)) compFails.push(`${a}: nem változott a képek száma`);
  if (nImg(off) < 1) compFails.push(`${a}: kép nélkül maradt`);
}
check(
  compFails.length === 0,
  compFails.length === 0
    ? "a kompozíciós úton is kevesebb kép marad — de sosem nulla (a galéria ott maga a fejléc)"
    : compFails.join(" · "),
);

console.log(
  bad === 0
    ? "\n✅ module-preview-check: az előnézet nem ír, jelöl, a saját modulját mutatja; a galéria-kapcsoló látható változást hoz — és élesre semmi minta nem szivárog."
    : `\n❌ module-preview-check: ${bad} hiba`,
);
process.exit(bad === 0 ? 0 : 1);
