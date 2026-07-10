// Grounded AI mock generator (ADR-0007). Claude generates a COMPLETE, unique,
// responsive HTML mock — free on STRUCTURE (variety), bound on FACTS (only real
// data, never fabricated). The structural catalog + a region "avoid" list steer
// diversity; the real photos ground palette + copy. Returns the archetype used
// so the caller can log it (anti-collision ledger). See _planning/DESIGN-CATALOG.md.

import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";

// Mirror of DESIGN-CATALOG.md §1 (keep in sync). The prompt offers these as the
// "vocabulary of diversity"; the model may also invent a new structure.
const CATALOG = [
  "editorial — magazin-fejléc, spread lebegő kártyával, drop-cap intro, váltakozó szekciók, serif",
  "immersive-dark — sötét paletta, teljes-képernyős parallax hero, full-bleed kártyák",
  "quiet-minimal — keskeny, központozott, sok levegő, §-számozott csendes sorok",
  "ken-burns-carousel — animált Ken-Burns hero + húzható carousel (JS)",
  "cinematic-horizontal — vízszintes-görgetős fejezet-panelek, full-screen",
  "booking-classic — hero + kontakt → szekciók → info (klasszikus, nyugodt)",
  "split-asymmetric — aszimmetrikus rács, kép/szöveg kettéosztva",
  "story-scroll — függőleges fejezetek, full-bleed képekkel",
  "gallery-led — galéria-fókusz, nagy képekkel elöl",
];

export interface AiMockInput {
  readonly name: string;
  readonly region: string;
  /** Real photo URLs of THIS property (Places/Street View). */
  readonly photos: string[];
  readonly contact: {
    phone?: string;
    email?: string;
    address?: string;
    mapUrl?: string;
  };
  /** Archetypes already used by neighbours in the region — avoid these. */
  readonly avoidArchetypes?: string[];
}

export interface AiMockResult {
  readonly html: string;
  readonly archetype: string;
  readonly environment?: string;
  readonly tier?: string;
  readonly style?: string;
}

const SYSTEM = `Szakértő webdizájner + fejlesztő vagy. Egy VALÓS magyar szálláshelynek készítesz teljes, önálló, reszponzív HTML-mockot — hideg megkeresés előzetes tervét.

SZERKEZET (itt legyél BÁTOR és SOKSZÍNŰ):
- Válassz egy HATÁROZOTTAN egyedi elrendezés-archetípust a kapott katalógusból, VAGY találj ki újat. Cél a valódi vizuális egyediség — SOHA ne kaptafa.
- Ha kapsz "KERÜLD" listát (a szomszédok már ezeket kapták), attól szerkezetileg térj el.
- Modern, igényes, mobilra is jó. Használhatsz kevés vanilla JS-t (carousel, parallax), de működjön JS nélkül is értelmesen.

TÉNYEK (ez KÖTELEZŐ, JOGI — soha ne szegd meg):
- KIZÁRÓLAG a megadott valós adatot + a képeken EGYÉRTELMŰEN láthatót használd.
- SOHA ne találj ki: árat, szoba-nevet/típust, m²-t, csillagot/értékelést/vélemény-idézetet, díjat, NTAK-ot, konkrét felszereltséget, ami nem látszik, vagy kamu telefon/email-t.
- Ha NINCS ár/szoba adat → NE tegyél bele "Szobák & árak" vagy áras foglaló szekciót. Ár nélküli "Érdeklődés/Elérhetőség" kontakt-blokk rendben.
- Csak a megadott elérhetőséget írd ki; ha nincs, általános érdeklődés-CTA, konkrét szám/email nélkül.

TARTALOM — TURISZTIKAI RELEVANCIA (fontos, gyakori hiba):
- A VENDÉG szempontjából RELEVÁNS dolgokra fókuszálj: elhelyezkedés és közelség (Balaton-part, sétány, borvidék, központ, látnivalók, strand), hangulat és környezet (csend, zöld, árnyas, panoráma, kilátás), kényelem, élmény, megközelíthetőség, parkolás.
- NE emelj ki turisztikailag LÉNYEGTELEN fizikai/építészeti apróságot: tetőszín, kapu/kerítés anyaga (pl. "kovácsoltvas kapu"), homlokzat-részlet, apró tárgyak. Ezek IGAZAK lehetnek, de NEM eladási pontok — sőt zavaróak. Építészeti jelleget CSAK akkor említs, ha valódi vonzerő (autentikus, hangulatos, műemlék-jelleg), és akkor is a vendég-élmény felől.
- A hero-főcím legyen HÍVOGATÓ, ÉLMÉNY- vagy ELŐNY-vezérelt (mit kap a vendég), NE egy fizikai részlet. ROSSZ: "Piros tetős polgárvilla". JÓ: "Csendes zöld oázis a Balaton partján" / "Néhány lépésre a sétánytól és a bortól".

KÉPEK:
- KIZÁRÓLAG a szövegben SZÁMOZVA megadott pontos kép-URL-eket használd (ezek a szállás VALÓS fotói) — pontosan úgy, ahogy kaptad.
- SOHA ne találj ki kép-URL-t (pl. "https://images/1"), és TILOS stock/Unsplash. Minden <img src> a megadott URL-ek egyike legyen.
- A HERO-hoz a legvonzóbb, legreprezentatívabb képet válaszd (a házat, kilátást, belső teret vagy hangulatos környezetet mutassa) — mellékes, üres vagy kevésbé hízelgő fotó (pl. csak fák/parkoló) NE legyen a hero.
- A paletta a képek valós színvilágából jöjjön.

BRAND:
- NINCS emoji sehol. Ikon = inline SVG vonalrajz (stroke=currentColor).
- Magyar szöveg: meleg, konkrét, NEM generikus, a látható RELEVÁNS részletekre építve; tényt sosem kitalálva.
- A láblécben jelöld: "Előzetes terv — készült a Citoviso motorral".

KIMENET:
- Az ELSŐ sor PONTOSAN egy HTML-komment: <!--CIT {"archetype":"<katalógus-név vagy 'uj:<rövid>'>","environment":"<tópart|borvidek|videki|termeszet|hegyi|tengerparti|varosi|nagyvarosi|horgasz>","tier":"<luxus|premium|kozep|egyszeru>","style":"<pár szó>"}-->
- Utána a teljes <!doctype html> ... </html> dokumentum. SEMMI mást ne írj (se magyarázat, se kódkerítés).`;

export async function generateAiMock(
  input: AiMockInput,
): Promise<AiMockResult | null> {
  if (!config.anthropicApiKey) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const images = input.photos.slice(0, 5);
  const content: AnthropicNS.ContentBlockParam[] = [];
  for (const url of images) {
    content.push({ type: "image", source: { type: "url", url } });
  }
  const contactLines = [
    input.contact.phone && `Telefon: ${input.contact.phone}`,
    input.contact.email && `Email: ${input.contact.email}`,
    input.contact.address && `Cím: ${input.contact.address}`,
    input.contact.mapUrl && `Térkép: ${input.contact.mapUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  content.push({
    type: "text",
    text:
      `Szállás neve: ${input.name}\nRégió: ${input.region}\n\n` +
      (contactLines
        ? `VALÓS elérhetőség (csak ezt használd):\n${contactLines}\n`
        : "Nincs megadott elérhetőség — konkrét szám/email NÉLKÜL, általános érdeklődés-CTA.\n") +
      `\nA fenti ${images.length} kép EZEN a szálláson készült. Az img src-ekbe PONTOSAN ezeket a URL-eket tedd (sorrendben, semmi mást; sose találj ki kép-URL-t):\n` +
      images.map((u, i) => `[${i + 1}] ${u}`).join("\n") +
      `\n` +
      `\nSzerkezeti katalógus (válassz, vagy találj ki ehhez foghatót):\n- ${CATALOG.join("\n- ")}\n` +
      (input.avoidArchetypes?.length
        ? `\nKERÜLD (a szomszédok már ezeket kapták): ${input.avoidArchetypes.join(", ")}\n`
        : "") +
      `\nA környezet + minőség típust a képekből ítéld meg, és tedd a CIT-metába.`,
  });

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
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
    environment: meta.environment,
    tier: meta.tier,
    style: meta.style,
  };
}
