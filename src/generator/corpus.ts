// Corpus-builder agent (ADR-0008 pillér 1, restructured by ADR-0009). OFFLINE, batch.
// The corpus is an ARCHETYPE-PRIMARY, tier-partitioned library of wildly diverse,
// high-quality reference designs. Environment is NOT a corpus axis (ADR-0009) — it
// is a grounding-time hint applied per lead by agent-2. Each design demonstrates a
// distinct structural ARCHETYPE at a given quality TIER, using placeholder images
// (picsum) + plausible demo content to show TARGET richness. structures/ is the
// few-shot quality bar. See DESIGN-CATALOG.md §6 and DECISIONS.md ADR-0009.

import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";

// ── Axes ──────────────────────────────────────────────────────────────────────
// TIER partitions the corpus (structurally real: whitespace/density/loudness).
export const TIERS = ["egyszeru", "kozep", "premium", "luxus"] as const;
export type Tier = (typeof TIERS)[number];

// ENVIRONMENT is NOT a corpus axis anymore (ADR-0009). It stays as the vocabulary
// the classifier emits and agent-2 injects as a palette/mood/feature HINT at
// grounding time — never a corpus folder.
export const ENVIRONMENTS = [
  "topart",
  "borvidek",
  "videki",
  "termeszet",
  "hegyi",
  "tengerparti",
  "varosi",
  "nagyvarosi",
  "horgasz",
] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Guest-facing context + mood per environment — a GROUNDING hint (copy/palette). */
export const ENV_HINT: Record<Environment, string> = {
  topart:
    "Balaton-parti / tóparti szállás. Vonzerő: víz közelsége, panoráma a tóra, sétány, strand, naplemente. Paletta-irány: víz-kék, homok, nád, meleg napfény.",
  borvidek:
    "Borvidéki szállás (Badacsony, Villány, Tokaj jelleg). Vonzerő: borpincék, kóstoló, szőlősorok, dombok, gasztronómia. Paletta-irány: bordó, terrakotta, arany, szőlőzöld, kő.",
  videki:
    "Vidéki / falusi vendégház. Vonzerő: csend, otthonos vidéki hangulat, udvar, kert, lassú pihenés. Paletta-irány: meleg föld-tónus, natúr fa, krém, mezőzöld.",
  termeszet:
    "Természet-közeli szállás (erdő, nemzeti park). Vonzerő: túraútvonalak, erdő csendje, zöld panoráma. Paletta-irány: mély erdőzöld, moha, kéreg-barna, köd-szürke.",
  hegyi:
    "Hegyi szállás (Mátra, Bükk, Zemplén jelleg). Vonzerő: hegyi panoráma, kilátópont, friss levegő, túra, kandalló. Paletta-irány: fenyő-zöld, pala-szürke, meleg fa, hó-fehér.",
  tengerparti:
    "Tengerparti szállás (Adria / mediterrán jelleg). Vonzerő: tenger, strand, mediterrán fény, kikötő. Paletta-irány: azúr, mészfehér, terrakotta, olíva.",
  varosi:
    "Kisvárosi / belvárosi szállás. Vonzerő: gyalogos belváros, kávézók, kultúra, kényelmes bázis. Paletta-irány: visszafogott urbánus, meleg semleges + egy erős akcentus.",
  nagyvarosi:
    "Nagyvárosi / metropolisz szállás (Budapest jelleg). Vonzerő: pörgés, tömegközlekedés, design, üzleti + városi turizmus. Paletta-irány: kontrasztos, kortárs, sötét/neon vagy tiszta minimál.",
  horgasz:
    "Horgász-szállás (tó, folyó, csónakház). Vonzerő: pecázás, víz, csónak, hajnali csend, család. Paletta-irány: nád, iszap-zöld, víz-szürke, fa-stég, meleg reggeli fény.",
};

/** Sophistication + expected content richness per quality tier. */
const TIER_HINT: Record<Tier, string> = {
  egyszeru:
    "EGYSZERŰ, budget kategória: tiszta, becsületes, barátságos. Nem próbál luxusnak látszani. Kevesebb szekció, praktikus infó. Tipó: közvetlen, olvasható. Kerüld a fényűző, arany, magazin-hatást.",
  kozep:
    "KÖZÉP kategória: rendezett, megbízható, kellemes. Kiegyensúlyozott szekció-készlet, jó képek, világos CTA. Sem szűkös, sem fényűző. Modern, de nem experimentális.",
  premium:
    "PRÉMIUM kategória: igényes, gondos részletek, erős tipográfia, bőséges levegő, finom mikro-interakció. Magazinos vagy építészeti érzet megengedett. Gazdagabb szekció-készlet.",
  luxus:
    "LUXUS kategória: kifinomult, visszafogottan fényűző, editorial/cinematic. Bátor tipográfia, drámai hero, sok negatív tér, prémium anyaghatás. Sose harsány/olcsó.",
};

// ── Module vocabulary (szállás pilot) ────────────────────────────────────────
// The FUNCTION axis (DOMAIN/05-MODULES.md, ADR-0010). Modules are DATA, not a
// corpus axis: an archetype is a module-HOSTING layout grammar. Both agents share
// this vocabulary — agent-1 arranges the blocks, agent-2 fills only present ones.
export const MODULE_BLOCKS_HU = `MODUL-BLOKKOK (szállás — a FUNKCIÓ-tengely, ezekből épül az oldal):
- KÍNÁLAT: galéria (fotók) · szobák/apartmanok · felszereltség/szolgáltatás · árak/szezonok
- ELÉRHETŐSÉG: érdeklődés/kapcsolat-CTA (GERINC, mindig) · elérhetőség (tel/email/cím) · térkép+megközelítés · beköltözés/nyitvatartás
- KONVERZIÓ: „miért mi" (valós USP) · vélemények (valós) · környék/látnivalók (POI) · ajánlatkérés-CTA
Szabály: a GERINC (hero + érdeklődés-CTA + lábléc) mindig ott van; minden más modul jelenlét/hiány-tűrő.`;

// ── Few-shot: the structures/ corpus is the QUALITY BAR ──────────────────────
export interface FewShot {
  readonly name: string;
  readonly html: string;
}

// ── Generation ───────────────────────────────────────────────────────────────
export interface CorpusDesignInput {
  readonly tier: Tier;
  /** 1-based index of this variant within the tier (for logging/labels). */
  readonly variant: number;
  /** Archetypes already in this tier's pool — diverge RADICALLY from all of them. */
  readonly avoidArchetypes?: string[];
  /** Full high-quality reference designs (structures/) as the quality bar. */
  readonly fewShot: FewShot[];
}

export interface CorpusDesignResult {
  readonly html: string;
  readonly archetype: string;
  readonly style: string;
  readonly title: string;
}

const SYSTEM = `Elit webdizájner + front-end fejlesztő vagy. Egy REFERENCIA-KORPUSZBA készítesz teljes, önálló, reszponzív HTML szálláshely-honlapot. A korpusz célja: egy VADUL SOKSZÍNŰ, MAGAS SZÍNVONALÚ SZERKEZETI ARCHETÍPUS-KÖNYVTÁR. Minden darab EGY új, önálló elrendezés-archetípust demonstrál. Ez NEM valós lead — placeholder tartalommal dolgozol, hogy a SZERKEZET teljes gazdagságát mutasd meg.

⚠️ A KORPUSZ TENGELYE AZ ARCHETÍPUS (a szerkezet), NEM a környezet:
- Ne köss ki egy konkrét tájegységre. A tartalom lehet BÁRMILYEN plauzibilis szálláshely-kontextus — a lényeg a SZERKEZET és a tier-tónus. A palettát a valós fotókhoz a per-lead adaptáció úgyis újrahangolja.
- Minden darab legyen RADIKÁLISAN MÁS, mint a kapott „MÁR LEGYÁRTOTT" archetípusok: más nav-paradigma (sticky / oldalsáv / rejtett / fullscreen-overlay / minimál / vertical-ribbon), más hero-logika (split / full-bleed / carousel / videó-hatás / tipó-vezérelt / bento / diagonal), más elrendezés-rendszer (rács / magazin-spread / vízszintes-görgetés / story-scroll / kártya-torony / timeline), más foglaló/kontakt-UX.

⚠️ NE LÉGY GYÁVA, NE LÉGY SABLONOS:
- A kapott few-shot példák (structures/) a MINŐSÉGI LÉC — ilyen szinten kidolgozott, bátor munkát várunk. NE másold őket; haladd meg.
- Merd használni: erős egyedi tipográfiát (Google Fonts), CSS grid/flex bravúrt, finom vanilla JS mikro-interakciót (carousel, parallax, scroll-reveal) — de működjön JS nélkül is, és legyen mobilon kifogástalan.

⚠️ MODUL-BEFOGADÓ SZERKEZET (fontos — így készül fel az archetípus a valós használatra):
${MODULE_BLOCKS_HU}
- A te dolgod: ezeket a modul-blokkokat rendezd el a magad EGYEDI archetípusában (a placeholder-korpuszban akár mindegyiket megmutathatod = cél-gazdagság). DE a szerkezet legyen MODULÁRIS: bármely modul hiányozhat egy valós leadnél, ezért úgy tervezz, hogy BÁRMELY részhalmaz szépen renderel — semmi üres/tört slot, semmi „ragasztó", ami egy hiányzó modultól szétesik.

⚠️ UI-KONTRAKTUS (KÖTELEZŐ — így csatolható rá a szabvány modul-runtime archetípusonkénti kézi munka nélkül):
1. TÉMA-TOKENEK: a :root-ban add ki EZEKET a szabvány CSS-változókat (a saját archetípus-palettáddal töltve), és a saját stílusod IS ezekből építkezzen: --cit-accent, --cit-on-accent, --cit-ink, --cit-muted, --cit-bg, --cit-surface, --cit-line, --cit-radius, --cit-font-display, --cit-font-body, --cit-shadow.
2. FOGLALÁS/ÉRDEKLŐDÉS MODUL: a foglaló/érdeklődés blokk helyére NE írj saját űrlapot — tegyél egy ÜRES slotot, amit a runtime tölt fel: <section data-cit-module="booking" data-cit-variant="bar VAGY card" data-cit-name="<demo-szállásnév>"></section>. A variánst az archetípusodhoz válaszd (bar = széles vízszintes sáv, card = álló panel/oldalsáv). A slot köré adhatsz saját cím/kontextust.
3. GALÉRIA MODUL: a fotó-galéria KÜLSŐ elemére (a <img>-eket tartalmazó szekció/rács) tedd rá a data-cit-module="gallery" horgot — a képek benne maradnak, in-skin (bento/mozaik/carousel a te archetípusod szerint). A runtime erre lightboxot csatol; NE írj saját lightbox JS-t.
4. TÉRKÉP/MEGKÖZELÍTÉS MODUL: a hely-blokk KÜLSŐ elemére tedd rá: <section data-cit-module="map" data-cit-query="<demo cím>">, BELÉ in-skin statikus tartalommal (cím + „Útvonaltervezés" link). A runtime „kattintásra betöltő" térképet csatol — NE ágyazz be saját iframe-et/térkép-JS-t.
5. VÉLEMÉNYEK MODUL: ha mutatsz vélemény-blokkot, a kártyákat így csomagold: <section data-cit-module="reviews"><div data-cit-track>…kártyák…</div></section>. A runtime ≥2 kártyánál carousellé alakítja — NE írj saját slider-JS-t.
6. NE tedd bele a runtime <script>/<style>-t — azt a rendszer injektálja.

TARTALOM (referencia-korpusz — placeholder megengedett):
- Képek: KIZÁRÓLAG https://picsum.photos/seed/<egyedi-seed>/<w>/<h> placeholder-URL. NE Unsplash, NE kitalált belső útvonal.
- Szöveg: plauzibilis, GAZDAG magyar demo-tartalom. A hero-főcím HÍVOGATÓ, élmény/előny-vezérelt (NE fizikai apróság). Kitalálhatsz szoba-neveket, árakat, felszereltséget, vélemény-idézetet — ez a CÉL-gazdagság demója.

BRAND (kötelező):
- NINCS emoji sehol. Ikon = inline SVG vonalrajz (stroke=currentColor).
- A láblécben jelöld: "Referencia-dizájn — Citoviso korpusz".

KIMENET:
- Az ELSŐ sor PONTOSAN egy HTML-komment: <!--CIT {"archetype":"<rövid, BESZÉDES archetípus-név, pl. split-bento / vertical-ribbon-nav / diagonal-split-grid / story-scroll / gallery-led-masonry / vagy uj:<név>>","style":"<3-6 szavas stílus: paletta+hangulat+tipó>","title":"<a demo-szállás fiktív neve>"}-->
- Utána a teljes <!doctype html> ... </html> dokumentum. SEMMI mást (se magyarázat, se kódkerítés).`;

function truncate(html: string, max: number): string {
  return html.length <= max ? html : html.slice(0, max) + "\n<!-- …(rövidítve) -->";
}

export async function generateCorpusDesign(
  input: CorpusDesignInput,
): Promise<CorpusDesignResult | null> {
  if (!config.anthropicApiKey) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const examples = input.fewShot
    .map(
      (fs, i) =>
        `--- PÉLDA ${i + 1} (${fs.name}) — minőségi lécnek, NE másold ---\n${truncate(fs.html, 14000)}`,
    )
    .join("\n\n");

  const userText =
    `TIER: ${input.tier} (variáns #${input.variant})\n\n` +
    `MINŐSÉG-TÓNUS: ${TIER_HINT[input.tier]}\n\n` +
    (input.avoidArchetypes?.length
      ? `MÁR LEGYÁRTOTT archetípusok ebben a tierben — TÉRJ EL RADIKÁLISAN MINDTŐL:\n- ${input.avoidArchetypes.join(
          "\n- ",
        )}\n\n`
      : "") +
    `Adj egy teljesen egyedi, magas színvonalú szerkezeti archetípust ehhez a tierhez. Bátor, új elrendezés, gazdag placeholder-tartalom.\n\n` +
    `Íme a minőségi léc (few-shot):\n\n${examples}`;

  const content: AnthropicNS.ContentBlockParam[] = [{ type: "text", text: userText }];

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 20000,
    system: SYSTEM,
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
    docStart >= 0
      ? text.slice(docStart)
      : text.replace(/<!--\s*CIT[\s\S]*?-->/, "").trim();

  return {
    html,
    archetype: meta.archetype ?? "unknown",
    style: meta.style ?? "",
    title: meta.title ?? "",
  };
}
