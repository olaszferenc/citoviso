// Mock-generator agent (agent-2, ADR-0008 pillér 2, restructured by ADR-0009).
// Per-lead, live. Consumes the ARCHETYPE-primary, tier-partitioned corpus:
//   a. CLASSIFY: lead → TIER (structural) + ENVIRONMENT-HINT (palette/mood/copy) via vision.
//   b. SELECT:   an archetype at that TIER, honouring region anti-collision (neighbour
//                archetypes) + usage rotation (least-used). Environment is NOT a filter.
//   c. GROUNDED ADAPTATION: the chosen design is a BLUEPRINT → generate with the REAL
//                facts + REAL photos + the env-hint for copy/palette; unknown sections DROPPED.
// See DESIGN-CATALOG.md §6 and DECISIONS.md ADR-0009.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { ENVIRONMENTS, ENV_HINT, MODULE_BLOCKS_HU, TIERS, type Environment, type Tier } from "./corpus.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REFS = path.resolve(HERE, "../../assets/design-refs");
const MANIFEST = path.join(REFS, "corpus", "manifest.json");

export interface CorpusEntry {
  id: string;
  tier: Tier;
  variant: number;
  archetype: string;
  style: string;
  title: string;
  file: string; // relative to assets/design-refs
  bytes: number;
}

export async function loadCorpus(): Promise<CorpusEntry[]> {
  if (!existsSync(MANIFEST)) return [];
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8")) as CorpusEntry[];
  } catch {
    return [];
  }
}

// ── a. classification (vision) ────────────────────────────────────────────────
export interface LeadForMock {
  readonly name: string;
  readonly region: string;
  readonly photos: string[];
  readonly contact: {
    phone?: string;
    email?: string;
    address?: string;
    mapUrl?: string;
  };
}

export interface Classification {
  /** Drives corpus selection (structural). */
  readonly tier: Tier;
  /** Grounding hint only — palette/mood/feature vocabulary, NOT a corpus filter. */
  readonly environment: Environment;
}

const CLASSIFY_SYSTEM = `Szálláshely-osztályozó vagy. A képek + név + régió alapján döntsd el a MINŐSÉG-szintet (tier) és a KÖRNYEZET-típust. Csak azt vedd figyelembe, ami a képeken/adatban tényleg látszik.
Válaszod PONTOSAN egy JSON sor legyen, semmi más:
{"tier":"<egyszeru|kozep|premium|luxus>","environment":"<topart|borvidek|videki|termeszet|hegyi|tengerparti|varosi|nagyvarosi|horgasz>"}`;

export async function classifyLead(lead: LeadForMock): Promise<Classification | null> {
  if (!config.anthropicApiKey) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const content: AnthropicNS.ContentBlockParam[] = [];
  for (const url of lead.photos.slice(0, 5)) content.push({ type: "image", source: { type: "url", url } });
  content.push({
    type: "text",
    text: `Név: ${lead.name}\nRégió: ${lead.region}\nOsztályozd a fenti képek alapján.`,
  });

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 200,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: "user", content }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  const m = /\{[\s\S]*?\}/.exec(block.text);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as { tier?: string; environment?: string };
    const tier = (TIERS as readonly string[]).includes(j.tier ?? "") ? (j.tier as Tier) : null;
    const env = (ENVIRONMENTS as readonly string[]).includes(j.environment ?? "")
      ? (j.environment as Environment)
      : null;
    if (!tier || !env) return null;
    return { tier, environment: env };
  } catch {
    return null;
  }
}

// ── b. selection (tier filter → archetype anti-collision + rotation) ──────────
export interface SelectOpts {
  /** Archetypes already given to neighbours in the region — avoid if possible. */
  readonly avoidArchetypes?: string[];
  /** designId → times used (rotation: prefer least-used). */
  readonly usage?: Map<string, number>;
}

export interface Selection {
  readonly entry: CorpusEntry;
  readonly blueprintHtml: string;
}

/**
 * Pick a corpus design at the classified TIER. Environment is NOT a filter (ADR-0009):
 * every archetype is available regardless of the lead's region. Drop avoided archetypes
 * when that still leaves a choice, then take the least-used (rotation), tie-broken by variant.
 * Falls back to adjacent tiers if the exact tier pool is empty (partial corpus).
 */
export async function selectCorpusDesign(
  corpus: CorpusEntry[],
  cls: Classification,
  opts: SelectOpts = {},
): Promise<Selection | null> {
  const avoid = new Set(opts.avoidArchetypes ?? []);
  const usage = opts.usage ?? new Map<string, number>();

  const order: Tier[] = tierFallback(cls.tier);
  let pool: CorpusEntry[] = [];
  for (const t of order) {
    pool = corpus.filter((e) => e.tier === t);
    if (pool.length) break;
  }
  if (!pool.length) return null;

  const notAvoided = pool.filter((e) => !avoid.has(e.archetype));
  if (notAvoided.length) pool = notAvoided;

  pool = [...pool].sort((a, b) => {
    const ua = usage.get(a.id) ?? 0;
    const ub = usage.get(b.id) ?? 0;
    return ua - ub || a.variant - b.variant;
  });

  const entry = pool[0]!;
  const blueprintHtml = await readFile(path.join(REFS, entry.file), "utf8");
  return { entry, blueprintHtml };
}

/** Prefer exact tier, then nearest neighbours (tone-adjacent). */
function tierFallback(tier: Tier): Tier[] {
  const chains: Record<Tier, Tier[]> = {
    egyszeru: ["egyszeru", "kozep", "premium", "luxus"],
    kozep: ["kozep", "premium", "egyszeru", "luxus"],
    premium: ["premium", "luxus", "kozep", "egyszeru"],
    luxus: ["luxus", "premium", "kozep", "egyszeru"],
  };
  return chains[tier];
}

// ── c. grounded adaptation from the blueprint ─────────────────────────────────
const ADAPT_SYSTEM = `Szakértő webdizájner + fejlesztő vagy. Egy VALÓS magyar szálláshelynek készítesz teljes, önálló, reszponzív HTML-mockot — hideg megkeresés előzetes tervét. Kapsz egy BLUEPRINT dizájnt (a korpuszból, a szállás tier-szintjéhez illő, magas színvonalú szerkezeti referencia) és egy KÖRNYEZET-SÚGÁST (paletta/hangulat/feature-szótár).

BLUEPRINT-HASZNÁLAT:
- A blueprint SZERKEZETÉT, elrendezés-logikáját, nav-paradigmáját, tipográfiai és mikro-interakciós karakterét vedd át — ez adja a vizuális színvonalat és egyediséget.
- A blueprint PALETTÁJA csak kiindulás — hangold a VALÓS fotók színvilágához és a környezet-súgáshoz.
- A blueprint szövege/képe placeholder — NE másold. Ahol a blueprintben olyan szekció van, amihez NINCS valós adatod (ár, szoba-típus, vélemény, stat), azt HAGYD KI vagy alakítsd valós tartalmúvá — SOHA ne tölts fabrikált adattal.

MODUL-LOGIKA (a blueprint modul-blokkjait valós adattal töltöd):
${MODULE_BLOCKS_HU}
- Csak azt a modult rendeld, amihez VALÓS adatod van (a blueprint modul-slotja a forma, a lead adata a tartalom). A GERINC (hero + érdeklődés-CTA + lábléc) mindig legyen. Hiányzó modul → a slot kimarad, a szerkezet záródjon össze rendben (ne maradjon üres sáv).

UI-KONTRAKTUS (KÖTELEZŐ):
1. TÉMA-TOKENEK: a :root-ban add ki a szabvány CSS-változókat a VALÓS fotókhoz hangolt palettával, és a saját stílusod ezekből építkezzen: --cit-accent, --cit-on-accent, --cit-ink, --cit-muted, --cit-bg, --cit-surface, --cit-line, --cit-radius, --cit-font-display, --cit-font-body, --cit-shadow.
2. FOGLALÁS/ÉRDEKLŐDÉS MODUL: a foglaló/érdeklődés blokk helyére NE írj saját űrlapot — üres slot, amit a runtime tölt: <section data-cit-module="booking" data-cit-variant="bar VAGY card" data-cit-name="<a szállás VALÓS neve>"></section>. Ha VAN valós email a lead adatai közt, tedd hozzá: data-cit-email="<valós email>". A variánst az archetípushoz. Ez a GERINC érdeklődés-CTA — mindig legyen.
3. GALÉRIA MODUL: a fotó-galéria KÜLSŐ elemére (a valós <img>-eket TARTALMAZÓ szekció/rács) tedd rá a data-cit-module="gallery" horgot — a valós képek maradnak benne, in-skin, ahogy megírtad (bento/mozaik/carousel). A runtime erre lightboxot csatol; NE írj saját lightbox/nagyítás JS-t. Ha nincs valós kép, a slot marad el.
4. TÉRKÉP/MEGKÖZELÍTÉS MODUL: ha VAN valós cím vagy koordináta, a hely-blokk KÜLSŐ elemére tedd rá: <section data-cit-module="map" data-cit-query="<a VALÓS cím VAGY 'lat,lng'>">. BELÉ írd meg in-skin a statikus tartalmat (cím + „Útvonaltervezés" link a valós Térkép-URL-re) — ez JS nélkül is működik. A runtime egy „kattintásra betöltő" térképet csatol (adatvédelem). NINCS cím/koordináta → nincs térkép-modul.
5. VÉLEMÉNYEK MODUL: CSAK ha VAN valós vélemény-adat (kamu értékelés/idézet TILOS). Ekkor: <section data-cit-module="reviews"><div data-cit-track>…valós vélemény-kártyák…</div></section>. A runtime ≥2 kártyánál carousellé alakítja. Nincs valós vélemény → a modul marad el.
6. NE tedd bele a runtime <script>/<style>-t — a rendszer injektálja.
7. JS NÉLKÜL IS MŰKÖDJÖN (üres-sáv-tilalom): a tartalom ALAPBÓL látszik. Ha scroll-reveal/entrance-animációt használsz, az PROGRESSZÍV FEJLESZTÉS legyen: a rejtett kezdőállapot KIZÁRÓLAG a .cit-anim kapcsoló mögött — a rejtendő elem kapja a .reveal osztályt, pl. ".cit-anim .reveal{opacity:0;transform:translateY(24px)}" és ".cit-anim .reveal.in{opacity:1;transform:none}". A .cit-anim kapcsolót ÉS a .in felszabadítást (scrollnál) A RUNTIME végzi — NE írj saját IntersectionObserver-t/reveal-JS-t. SOHA ne legyen a tartalom alapból (.cit-anim nélkül) opacity:0/rejtett. A .cit-anim kapcsolót ÉS a .in felszabadítást (scrollnál) A RUNTIME végzi — NE írj saját IntersectionObserver-t/reveal-JS-t.
8. FÜGGŐLEGES RITMUS (LEVEGŐSSÉG-KERET — renderben MÉRJÜK, tartsd be):
- A szekció-magasság a TARTALMAT kövesse. Cél: minden szekció ~85%+-ban ki legyen töltve tartalommal — a levegő RITMUS, nem üres, lefoglalt hely. Kihagyott modulnál a szerkezet záródjon össze, ne maradjon üres sáv.
- Szekció függőleges paddingje LEGYEN RESZPONZÍV, ne fix: pl. padding-block: clamp(2.25rem, 6vw, 5rem) — így mobilon automatikusan szűkül. SOHA ne vigyél 6rem+ FIX függőleges paddinget, ami mobilra is átömlik és üres sávot hagy.
- NON-hero szekcióra TILOS olyan min-height/vh, amit a tartalom nem tölt ki (üres alsó sáv). CSAK a hero lehet teljes magasságú (100svh); minden más magassága a tartalomból jöjjön.
- Al-blokkok közti függőleges rés (gap/margó) ≤ ~2.5rem; ne hagyj 120px+ üres rést a tartalom-egységek között.
- TIER-ÉRZÉK: luxus/premium a keret FELSŐ végén lélegezzen (levegős, DE kitöltött); egyszeru/kozep a szűkebb végén.

TÉNYEK (KÖTELEZŐ, JOGI):
- KIZÁRÓLAG a megadott valós adatot + a képeken EGYÉRTELMŰEN láthatót használd.
- SOHA ne találj ki: árat, szoba-nevet/típust, m²-t, csillagot/értékelést/vélemény-idézetet, díjat, NTAK-ot, konkrét felszereltséget, ami nem látszik, vagy kamu telefon/email-t.
- Ha NINCS ár/szoba adat → NE tegyél áras foglaló/„Szobák & árak" szekciót. Ár nélküli „Érdeklődés/Elérhetőség" blokk rendben.

TARTALOM — TURISZTIKAI RELEVANCIA (a környezet-súgás alapján):
- A VENDÉG szempontjából RELEVÁNS dolgokra fókuszálj: elhelyezkedés, közelség, hangulat, panoráma, kényelem, megközelíthetőség — a környezet-súgás adja a szótárat.
- NE emelj ki turisztikailag lényegtelen fizikai/építészeti apróságot (tetőszín, kapu anyaga). A hero-főcím HÍVOGATÓ, élmény/előny-vezérelt.

KÉPEK:
- KIZÁRÓLAG a szövegben SZÁMOZVA megadott pontos kép-URL-eket használd (a szállás VALÓS fotói) — pontosan úgy. SOHA ne találj ki kép-URL-t, TILOS stock/picsum/Unsplash.
- A blueprint elrendezés-logikáját alkalmazd ezekre a valós képekre (bento/mozaik/carousel — ahogy a blueprint sugallja). A hero-hoz a legvonzóbb valós képet.

BRAND:
- NINCS emoji. Ikon = inline SVG vonalrajz (stroke=currentColor).
- Magyar szöveg: meleg, konkrét, a látható RELEVÁNS részletekre építve; tényt sosem kitalálva.
- A láblécben: "Előzetes terv — készült a Citoviso motorral".

KIMENET:
- Az ELSŐ sor PONTOSAN egy HTML-komment: <!--CIT {"archetype":"<a blueprint archetípusa>","environment":"<env>","tier":"<tier>","corpusId":"<a kapott korpusz-id>","style":"<pár szó>"}-->
- Utána a teljes <!doctype html> ... </html>. SEMMI mást.`;

export interface GroundedResult {
  readonly html: string;
  readonly corpusId: string;
  readonly archetype: string;
  readonly environment: Environment;
  readonly tier: Tier;
}

export async function generateFromCorpus(
  lead: LeadForMock,
  cls: Classification,
  sel: Selection,
): Promise<GroundedResult | null> {
  if (!config.anthropicApiKey) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const images = lead.photos.slice(0, 5);
  const content: AnthropicNS.ContentBlockParam[] = [];
  for (const url of images) content.push({ type: "image", source: { type: "url", url } });

  const contactLines = [
    lead.contact.phone && `Telefon: ${lead.contact.phone}`,
    lead.contact.email && `Email: ${lead.contact.email}`,
    lead.contact.address && `Cím: ${lead.contact.address}`,
    lead.contact.mapUrl && `Térkép: ${lead.contact.mapUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  content.push({
    type: "text",
    text:
      `Szállás neve: ${lead.name}\nRégió: ${lead.region}\nTier: ${cls.tier}\n` +
      `KÖRNYEZET-SÚGÁS (${cls.environment}): ${ENV_HINT[cls.environment]}\n\n` +
      (contactLines
        ? `VALÓS elérhetőség (csak ezt használd):\n${contactLines}\n`
        : "Nincs megadott elérhetőség — konkrét szám/email NÉLKÜL, általános érdeklődés-CTA.\n") +
      `\nA fenti ${images.length} kép EZEN a szálláson készült. Az img src-ekbe PONTOSAN ezeket az URL-eket tedd (sorrendben, sose találj ki kép-URL-t):\n` +
      images.map((u, i) => `[${i + 1}] ${u}`).join("\n") +
      `\n\nBLUEPRINT (korpusz-id: ${sel.entry.id}, archetípus: ${sel.entry.archetype}, stílus: ${sel.entry.style}) — a SZERKEZETÉT/karakterét vedd át, a placeholder-tartalmát NE:\n\n` +
      sel.blueprintHtml,
  });

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 20000,
    system: ADAPT_SYSTEM,
    messages: [{ role: "user", content }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  const text = block.text;

  const metaMatch = /<!--\s*CIT\s*(\{[\s\S]*?\})\s*-->/.exec(text);
  let meta: Record<string, string> = {};
  if (metaMatch) {
    try {
      meta = JSON.parse(metaMatch[1]) as Record<string, string>;
    } catch {
      /* keep defaults */
    }
  }
  const docStart = text.search(/<!doctype html>/i);
  const html =
    docStart >= 0 ? text.slice(docStart) : text.replace(/<!--\s*CIT[\s\S]*?-->/, "").trim();

  return {
    html,
    corpusId: meta.corpusId ?? sel.entry.id,
    archetype: meta.archetype ?? sel.entry.archetype,
    environment: cls.environment,
    tier: cls.tier,
  };
}
