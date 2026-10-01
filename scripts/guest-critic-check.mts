// Guard for the GUEST-CRITIC (src/generator/guestCritic.ts, ADR-0292).
//
// Why this exists (Elek, live funnel 2026-10-01): the Muschel mock promised "bérelhető
// kerékpárok", a "főtt reggeli" and a "bőséges saját parkoló" — each one a review
// sentence grown into a service ("borrowing us bicycles", "Cooked breakfast", "Sufficient
// parking") — and spoke to the guest in two registers ("AMIT ITT KAPSZ" next to "Írja
// meg"). Every existing gate was green. The owner's ruling: a guest-eyed critic, magázás
// on the guest page, and a review may ground a standing facility but never an offer (B).
//
// What this guard holds, deterministically (NO AI call, NO database):
//   ① the fixed guest-facing template strings never use the familiar register;
//   ② the lint twin catches the measured defects and leaves their honest twins alone;
//   ③ ruling B's offer rule: a review-only "bérelhető / ingyenes" is blocking, a
//     listing-backed one is not;
//   ④ the critic's photo-only objections are dropped, service objections are kept;
//   ⑤ the loop ships the best critiqued round, not blindly the last one;
//   ⑥ the wiring: both generation paths run the critic and persist its verdict, and the
//     send gate blocks on it.
//
// Run: npx tsx scripts/guest-critic-check.mts
import { readdirSync, readFileSync } from "node:fs";
import {
  bestRound,
  criticSourceOf,
  dropPhotoOnlyObjections,
  HOUSE_REGISTER,
  lintCopy,
  lintOffers,
  type CopySurface,
  type CriticRound,
  type Objection,
} from "../src/generator/guestCritic.js";
import { blockingVerdicts, GUARD_VERDICT_KEYS } from "../src/outreach/mockVerdictGate.js";

let pass = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  if (ok) pass++;
  else failures.push(`${name} — ${detail}`);
};
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// ── ① the template's fixed guest-facing strings are magázó ──────────────────────
{
  check("A ház szabálya: magázás (tulajdonosi döntés 2026-10-01)", HOUSE_REGISTER === "magaz", HOUSE_REGISTER);
  const dir = new URL("../src/engine/templates/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  check("A sablon-könyvtár nem üres (a pásztázás valamit mér)", files.length >= 10, `${files.length} fájl`);
  const offenders: string[] = [];
  let strings = 0;
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), "utf8");
    for (const m of src.matchAll(/\bT\(\s*\w+\s*,\s*"((?:[^"\\]|\\.)*)"/g)) {
      strings++;
      const probe: CopySurface = { tagline: "", intro: m[1]!, highlights: [], editorial: {} };
      const hit = lintCopy(probe, "magaz").filter((o) => o.kind === "megszolitas");
      if (hit.length) offenders.push(`${f}: „${m[1]}” (${hit.map((h) => h.quote).join(", ")})`);
    }
  }
  check("A pásztázás tényleg talált sablon-szöveget", strings >= 50, `${strings} T()-szöveg`);
  check("⛔ Nincs tegező fix sablon-szöveg a vendég-oldalon", offenders.length === 0, offenders.join(" | "));
}

// ── ② the lint twin: the measured defects, and their honest twins ───────────────
const surf = (over: Partial<CopySurface> & { lead?: string; featuresEyebrow?: string }): CopySurface => ({
  tagline: over.tagline ?? "Keszthelyi panzió kerti medencével.",
  intro: over.intro ?? "A kertben medence és árnyékos terasz van.",
  highlights: over.highlights ?? ["Kültéri medence"],
  editorial: {
    hero: { lead: over.lead ?? "Kerti medence és grillezős terasz" } as never,
    ...(over.featuresEyebrow ? { features: { eyebrow: over.featuresEyebrow } } : {}),
  },
});
const kinds = (c: CopySurface) => lintCopy(c, "magaz").map((o) => o.kind);
{
  check("„Amit itt kapsz” (tegező) blokkol", kinds(surf({ featuresEyebrow: "Amit itt kapsz" })).includes("megszolitas"), "nem jelzett");
  check("„Amit itt kap” (magázó) nem blokkol", kinds(surf({ featuresEyebrow: "Amit itt kap" })).length === 0, JSON.stringify(kinds(surf({ featuresEyebrow: "Amit itt kap" }))));
  check("„várjuk a leveled” blokkol", kinds(surf({ intro: "Várjuk a leveled." })).includes("megszolitas"), "nem jelzett");
  check(
    "A „vagy” kötőszó NEM tegezés („…szelvényen vagy az alábbi…”)",
    kinds(surf({ intro: "A foglalási szelvényen vagy az alábbi elérhetőségeken várjuk levelét." })).length === 0,
    JSON.stringify(kinds(surf({ intro: "A foglalási szelvényen vagy az alábbi elérhetőségeken várjuk levelét." }))),
  );
  check("„Friss, főtt reggeli” blokkol (nem létező fogalom)", kinds(surf({ highlights: ["Friss, főtt reggeli"] })).includes("nem_letezo_fogalom"), "nem jelzett");
  check("„Meleg reggeli” nem blokkol", kinds(surf({ highlights: ["Meleg reggeli"] })).length === 0, "jelzett");
  for (const opener of ["medence várja a vendégeket", "játszótérrel várja a családokat", "biliárd várja a megpihenőket"])
    check(`„${opener}” (AI-nyitás) blokkol`, kinds(surf({ intro: `A ház ${opener}.` })).includes("ai_sablon"), "nem jelzett");
  check("„biciklik a Balatonhoz” (vonzat) blokkol", kinds(surf({ lead: "Medence és biciklik a Balatonhoz" })).includes("nyelvtan"), "nem jelzett");
  check("Ál-idézet a főcímben blokkol", kinds(surf({ lead: "„Kerti medence és grillezős terasz”" })).includes("al_idezet"), "nem jelzett");
  check("„Kapszula-kávé” nem tegezés (szóhatár)", kinds(surf({ intro: "Kapszula-kávé a szobában." })).length === 0, "jelzett");
}

// ── ③ ruling B: a review may ground a facility, never an offer ──────────────────
{
  const muschel = criticSourceOf({
    name: "Muschel Panzió",
    facts: [{ label: "kölcsönkerékpárok", source: "google_places", quote: "also borrowing us bicycles to cycle around Balaton" }],
    descriptions: [],
    reviews: ["The owner was very kind, also borrowing us bicycles to cycle around Balaton."],
  });
  check("A Google-véleményből jött tény VÉLEMÉNY-tény", muschel.facts[0]?.kind === "review", String(muschel.facts[0]?.kind));
  const bike = lintOffers(surf({ highlights: ["Bérelhető kerékpárok a Balaton körüli túrákhoz"] }), muschel);
  check("⛔ Véleményből „Bérelhető kerékpárok” BLOKKOL (Muschel)", bike.some((o) => o.severity === "blokkolo"), JSON.stringify(bike));
  const laguna = criticSourceOf({
    name: "Laguna Panzió",
    facts: [{ label: "biliárd", source: "google_places", quote: "playin pool and table footbal in the loby (it was free of charge)" }],
    descriptions: [],
    reviews: [],
  });
  check(
    "⛔ Véleményből „ingyenesen használható biliárd” BLOKKOL (Laguna)",
    lintOffers(surf({ intro: "Esténként ingyenesen használható biliárd van." }), laguna).length === 1,
    "nem jelzett",
  );
  const listed = criticSourceOf({
    name: "Bringás Vendégház",
    facts: [{ label: "Kerékpárkölcsönzés", source: "szallas.hu" }],
    descriptions: ["Vendégeink számára bérelhető kerékpárokat biztosítunk a ház udvarán, kérésre."],
    reviews: [],
  });
  check(
    "A SAJÁT hirdetésben álló bérelhető kerékpár NEM blokkol",
    lintOffers(surf({ highlights: ["Bérelhető kerékpárok"] }), listed).length === 0,
    "hamisan jelzett",
  );
  check(
    "Állandó adottság ajánlat-szó nélkül (Elegendő parkolóhely) NEM blokkol",
    lintOffers(surf({ highlights: ["Elegendő parkolóhely"] }), muschel).length === 0,
    "hamisan jelzett",
  );
}

// ── ④ photo-only objections dropped, service objections kept ────────────────────
{
  const o = (quote: string, kind: Objection["kind"] = "forrastalan_igeret"): Objection => ({
    field: "highlights[0]", quote, kind, severity: "blokkolo", guestReaction: "", fix: "", by: "ai",
  });
  const kept = dropPhotoOnlyObjections([
    o("Kültéri medence napozóágyakkal"),
    o("Bérelhető kerékpárok a Balaton körüli túrákhoz"),
    o("kerékpárok a tó körül"),
    o("Bőséges saját parkoló", "tulzas_a_forrashoz"),
    o("kék vizű medence", "ai_sablon"),
    o("Grillezős terasz a kertben"),
  ]).map((x) => x.quote);
  check("A napozóágy (fotón látható) kifogása kiesik", !kept.includes("Kültéri medence napozóágyakkal"), JSON.stringify(kept));
  check("A kerékpár (szolgáltatás) kifogása marad", kept.includes("Bérelhető kerékpárok a Balaton körüli túrákhoz") && kept.includes("kerékpárok a tó körül"), JSON.stringify(kept));
  check(
    "A fizikai szóval (terasz) ÉS szolgáltatással (grillezés) álló kifogás marad",
    kept.includes("Grillezős terasz a kertben"),
    JSON.stringify(kept),
  );
  check("A parkoló (szolgáltatás) kifogása marad", kept.includes("Bőséges saját parkoló"), JSON.stringify(kept));
  check("A nem-forrás típusú kifogás (AI-sablon) marad", kept.includes("kék vizű medence"), JSON.stringify(kept));
}

// ── ⑤ the best critiqued round ships ────────────────────────────────────────────
{
  const ob = (sev: Objection["severity"]): Objection => ({ field: "x", quote: "x", kind: "ai_sablon", severity: sev, guestReaction: "", fix: "", by: "ai" });
  const round = (tag: string, objs: Objection[]): CriticRound => ({
    copy: surf({ intro: tag }), objections: objs, verdict: objs.some((x) => x.severity === "blokkolo") ? "flag" : "pass", summary: tag,
  });
  const r = [round("r0", [ob("blokkolo"), ob("blokkolo")]), round("r1", [ob("javitando")]), round("r2", [ob("blokkolo")])];
  check("⛔ A rontó utolsó kör NEM megy ki (a legjobb kritizált kör igen)", bestRound(r).summary === "r1", bestRound(r).summary);
  const tie = [round("r0", [ob("javitando")]), round("r1", [ob("javitando")])];
  check("Döntetlennél a későbbi kör nyer", bestRound(tie).summary === "r1", bestRound(tie).summary);
}

// ── ⑥ the wiring ────────────────────────────────────────────────────────────────
{
  check("A kiküldés-kapu ismeri a vendég-kritikust", (GUARD_VERDICT_KEYS as readonly string[]).includes("guestCriticVerdict"), JSON.stringify(GUARD_VERDICT_KEYS));
  const b = blockingVerdicts({ guestCriticVerdict: "flag", guestCriticReason: "„Bérelhető kerékpárok” (velemeny_mint_szolgaltatas)" });
  check("⛔ A vendég-kritikus FLAG-je blokkolja a kiküldést, indokkal", b.length === 1 && b[0]!.reason.includes("Bérelhető"), JSON.stringify(b));
  check("Az error (nem ítélt) is blokkol", blockingVerdicts({ guestCriticVerdict: "error" }).length === 1, "nem blokkolt");
  check("A pass nem blokkol", blockingVerdicts({ guestCriticVerdict: "pass" }).length === 0, "blokkolt");
  for (const path of ["src/generator/generateEngine.ts", "src/generator/recopy.ts"]) {
    const src = read(path);
    check(`${path}: a kritikus lefut`, /await applyGuestCritic\(/.test(src), "nincs applyGuestCritic-hívás");
    check(`${path}: a verdikt az inputs-ba kerül`, /\.\.\.criticInputs,/.test(src), "a criticInputs nincs perzisztálva");
    check(`${path}: a kritikus kimenete a kiszállított szöveg`, /editorial = critic\.copy\.editorial;/.test(src), "a javított szöveg nem kerül vissza");
  }
  const views = read("src/console/views.ts");
  check("A konzol néven nevezi a vendég-kritikust", /case "guestCriticVerdict": return T\(lang, "Vendég-kritikus"\)/.test(views), "nincs névcímke");
}

for (const f of failures) console.error(`❌ ${f}`);
console.log(`\nguest-critic-check: ${pass} zöld, ${failures.length} bukás`);
process.exit(failures.length ? 1 : 0);
