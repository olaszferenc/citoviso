// COPY-HOOK GUARD — every template marks every copy field it shows (ADR-XXXX, approved
// plan: assets/design-refs/console/mock-copy-edit/, ② B — in-place editing).
//
// WHY. The preview editor finds a field ONLY by its `data-cit-copy` hook. A template that
// renders the tagline without the hook does not fail loudly — the field simply is not
// clickable on that template, and the curator concludes the feature is broken (or worse,
// the hook sits on a WRAPPER that also holds other text, and the edit writes that text
// into the field). Both failures are silent in a screenshot, so they are MEASURED here:
//
//   ① VISIBLE ⇒ HOOKED — every field whose value appears in the rendered body has at least
//      one element hooked with ITS key (highlights: its index too).
//   ② HOOK TEXT = FIELD VALUE — a hooked element's text is exactly the value (whitespace
//      and the "\n"→<br> break ignored), or exactly firstSentence(intro) when it is marked
//      `data-cit-copy-part="first-sentence"`. Otherwise the editor would save the wrong text.
//
// Each field carries a unique sentinel, so a finding names the template AND the field.
//
//   npx tsx scripts/copy-hook-check.mts              # green run
//   npx tsx scripts/copy-hook-check.mts --self-test  # RED control: a hook removed / misplaced

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { COPY_SECTION_KINDS, type CopyKey } from "../src/engine/copyFields.js";
import type { Recipe, SectionKind, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { firstSentence } from "../src/engine/templateKit.js";
import { TEMPLATES } from "../src/engine/templates.js";

const SELF_TEST = process.argv.includes("--self-test");
// --only=a,b : debug narrowing for template work. Ignored by --self-test (its red controls
// are tied to the first two templates — feedback_debug_flag_manufactured_a_false_failure).
const ONLY = SELF_TEST ? [] : (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);

const PHOTO = (alt: string) => ({
  url:
    "data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%228%22%20height=%228%22%3E%3Crect%20width=%228%22%20height=%228%22%20fill=%22%23b9b2a4%22/%3E%3C/svg%3E",
  alt,
  provenance: "portal" as const,
});

// Sentinels: unique per field, sentence-shaped where the template slices sentences.
const V: Record<string, string> = {
  "hero.lead": "Qzleadq csendes kert és Qzaccq reggeli",
  "hero.accent": "Qzaccq reggeli",
  "hero.eyebrow": "Qzeyebq felső sor",
  tagline: "Qztagq alcím a vendégháznak",
  intro: "Qzintroaq az első mondat a házról. Qzintrobq a második mondat a kertről.",
};
const HL = ["Qzhlaq saját parkoló", "Qzhlbq kutyabarát", "Qzhlcq árnyas kert", "Qzhldq reggeli kérhető"];
for (const k of COPY_SECTION_KINDS) {
  V[`${k}.eyebrow`] = `Qz${k}eyq kicker`;
  // One two-line title: the "\n" → <br> path must keep the hook's text equal to the value.
  V[`${k}.title`] = k === "features" ? `Qz${k}tiq első sor\nmásodik sor` : `Qz${k}tiq cím`;
}

function data(): SiteData {
  return {
    name: "Nyugalom Vendégház",
    tagline: V.tagline!,
    intro: V.intro!,
    highlights: HL,
    photos: [PHOTO("kert"), PHOTO("szoba"), PHOTO("terasz"), PHOTO("udvar"), PHOTO("konyha"), PHOTO("nappali")],
    rooms: [
      { name: "Kertre néző szoba", capacity: "2 fő", price: "19 000 Ft / éj" },
      { name: "Tetőtéri szoba", capacity: "3 fő" },
    ],
    usp: ["Öt perc sétára a strandtól"],
    rating: { value: 4.8, count: 61, url: "https://example.com/reviews" },
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
    place: { city: "Köveskál", country: "HU" },
  } as unknown as SiteData;
}

function recipe(t: string): Recipe {
  const sec = (kind: string) => ({
    kind: kind as SectionKind,
    copy: { eyebrow: V[`${kind}.eyebrow`]!, title: V[`${kind}.title`]! },
  });
  return {
    template: t,
    skin: "",
    archetype: "",
    sections: [
      { kind: "hero" as SectionKind, copy: { lead: V["hero.lead"]!, accent: V["hero.accent"]!, eyebrow: V["hero.eyebrow"]! } },
      { kind: "stats" as SectionKind },
      ...COPY_SECTION_KINDS.map(sec),
      { kind: "enquiry" as SectionKind },
    ],
  };
}

const squash = (s: string) => s.replace(/\s+/g, "");

interface Probe {
  key: string;
  token: string;
  /** Where the hooked text must equal this (squashed). */
  value: string;
  i?: number;
}
const probes: Probe[] = [
  ...(["hero.lead", "hero.eyebrow", "tagline", "intro"] as const).map((k) => ({
    key: k,
    token: V[k]!.split(" ")[0]!,
    value: V[k]!,
  })),
  ...HL.map((h, i) => ({ key: "highlights", token: h.split(" ")[0]!, value: h, i })),
  ...COPY_SECTION_KINDS.flatMap((k) =>
    (["eyebrow", "title"] as const).map((f) => ({
      key: `${k}.${f}`,
      token: V[`${k}.${f}`]!.split(" ")[0]!,
      value: V[`${k}.${f}`]!,
    })),
  ),
];
// The second intro sentence has its own token: a first-sentence view must NOT show it.
const INTRO_FIRST = firstSentence(V.intro!, 220);

const fails: string[] = [];
let checked = 0;
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const page = await browser.newPage();
  for (const t of Object.keys(TEMPLATES).filter((x) => !ONLY.length || ONLY.includes(x))) {
    let html = renderSite(recipe(t), data(), { phase: "mock" });
    if (SELF_TEST && t === Object.keys(TEMPLATES)[0]) {
      // RED control ①: strip one hook — the field stays visible, the hook is gone.
      html = html.replace(/ data-cit-copy="tagline"/g, "");
    }
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // tsx (esbuild keepNames) wraps named closures in __name() — define it in the page.
    await page.evaluate("window.__name = function (f) { return f; }");
    if (SELF_TEST && t === Object.keys(TEMPLATES)[1]) {
      // RED control ②: a hook on a WRAPPER that also holds other text (set in the DOM —
      // a string replace can hit a "<body" inside an earlier inline script).
      await page.evaluate('document.body.setAttribute("data-cit-copy", "hero.eyebrow")');
    }
    const res = await page.evaluate(
      ({ probes, introFirst }) => {
        const sq = (s: string) => s.replace(/\s+/g, "");
        const out: { key: string; i?: number; visible: boolean; hooked: boolean; bad: string[] }[] = [];
        const body = document.body;
        // document-wide: body.querySelectorAll would skip a hook sitting on <body> itself.
        const hooked = Array.from(document.querySelectorAll<HTMLElement>("[data-cit-copy]"));
        // ② every hook carries exactly its field's text
        const bad: string[] = [];
        for (const el of hooked) {
          const key = el.getAttribute("data-cit-copy")!;
          const i = el.getAttribute("data-cit-copy-i");
          const part = el.getAttribute("data-cit-copy-part");
          const p = probes.find((x) => x.key === key && (x.i === undefined ? i === null : String(x.i) === i));
          if (!p) {
            bad.push(`ismeretlen horog: ${key}${i !== null ? `[${i}]` : ""}`);
            continue;
          }
          const want = part === "first-sentence" ? introFirst : p.value;
          if (sq(el.textContent ?? "") !== sq(want)) {
            bad.push(`${key}${i !== null ? `[${i}]` : ""}: a horgolt elem szövege ≠ a mező („${(el.textContent ?? "").trim().slice(0, 70)}”)`);
          }
        }
        // ① visible ⇒ hooked
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        const texts: Text[] = [];
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const par = (n as Text).parentElement;
          if (par && !par.closest("script,style,template,noscript")) texts.push(n as Text);
        }
        for (const p of probes) {
          const hits = texts.filter((n) => (n.textContent ?? "").includes(p.token));
          const visible = hits.length > 0;
          const isHooked = hits.some((n) => {
            const h = n.parentElement!.closest<HTMLElement>("[data-cit-copy]");
            if (!h || h.getAttribute("data-cit-copy") !== p.key) return false;
            return p.i === undefined || h.getAttribute("data-cit-copy-i") === String(p.i);
          });
          out.push({ key: p.key, ...(p.i !== undefined ? { i: p.i } : {}), visible, hooked: isHooked, bad: [] });
        }
        return { out, bad };
      },
      { probes, introFirst: INTRO_FIRST },
    );
    for (const r of res.out) {
      if (!r.visible) continue;
      checked++;
      if (!r.hooked) fails.push(`${t}: „${r.key}${r.i !== undefined ? `[${r.i}]` : ""}” látszik, de nincs data-cit-copy horga`);
    }
    for (const b of res.bad) fails.push(`${t}: ${b}`);
  }
} finally {
  await browser.close();
}

if (SELF_TEST) {
  const caught1 = fails.some((f) => f.includes("tagline") && f.includes("nincs data-cit-copy"));
  const caught2 = fails.some((f) => f.includes("hero.eyebrow") && f.includes("≠ a mező"));
  console.log(`${caught1 ? "✓" : "✗ FAIL"}  önteszt ①: a levett horgot észreveszi`);
  console.log(`${caught2 ? "✓" : "✗ FAIL"}  önteszt ②: a csomagoló-elemre tett horgot észreveszi`);
  process.exit(caught1 && caught2 ? 0 : 1);
}

console.log(`copy-hook-check: ${Object.keys(TEMPLATES).length} sablon, ${checked} látható mező mérve`);
if (fails.length) {
  for (const f of fails) console.log(`✗ FAIL  ${f}`);
  console.log(`\n${fails.length} hiba — a B (helyben szerkesztés) ezeken a mezőkön nem működne.`);
  process.exit(1);
}
console.log("✓ minden látható szöveg-mező horgolt, és a horog szövege pontosan a mező");
