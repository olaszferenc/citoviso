// Path-B proof: generate a BESPOKE single-property website as free AI-HTML (like the reference
// samples), for the SAME data the engine (Path A) renders — so the two approaches can be
// compared on identical content. This is NOT the engine; it is one AI call producing a whole
// bespoke page. Not mock=live / not editable — it exists only to judge the quality ceiling.
//   npx tsx scripts/bespoke-mock.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "../src/config.js";

const P = (seed: string, w = 1200, h = 900) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const brief = `Szállás: Silvana Erdei Rezort
Alcím: Csend, amit hallani lehet — prémium erdei menedék a fák koronája fölött.
Karakter: sötét, prémium, cinematic erdei wellness-rezort.
Bemutatkozó: Tizennyolc, egymástól takarásban lévő lakosztály, padlótól plafonig üvegezve, természetes tölgy és kő felületekkel. Saját szauna, saját panoráma — közös csak az erdő csendje és a lombkorona-medence.
Cím: 3235 Mátraszentimre, Fenyves út 1. · Tel: +36 37 000 000 · E-mail: stay@silvana.hu
Statok: 18 lakosztály · 4,9★ (487 értékelés) · 720 m tengerszint felett · 2021 óta

Felszereltség: Panorámaszauna; Kültéri jacuzzi; Reggeli-kosár termelőktől; Kandalló + tűzifa; Erdőfürdő túraútvonalak; Privát parkoló + EV-töltő; Klíma minden lakosztályban; Kutyabarát lakosztályok.

Szobák:
- Canopy Suite — 38 m² · 2 fő · lombkorona szint — Függőágy az üvegfal előtt, privát erkély a fák magasságában, esőztető zuhany. Kép: ${P("silvana-r1", 1000, 750)}
- Forest Deluxe — 30 m² · 2 fő · földszint — Közvetlen kilépés a mohakertbe, kültéri fürdődézsa, kandalló a hűvös estékre. Kép: ${P("silvana-r2", 1000, 750)}
- Sky Penthouse — 64 m² · 2–4 fő · tetőszint — Panorámás tetőterasz privát jacuzzival, külön nappali, csillagnéző tetőablak. Kép: ${P("silvana-r3", 1000, 750)}

Galéria-fotók: ${P("silvana-a")}; ${P("silvana-b")}; ${P("silvana-c")}; ${P("silvana-d")}; ${P("silvana-e")}; ${P("silvana-f")}
Hero-fotó: ${P("silvana-hero", 1920, 1200)}

Vélemények:
- "Három napig nem néztem a telefonomra. Nem tiltotta senki — egyszerűen nem hiányzott." — Horváth Dóra, Budapest, 2026. január
- "A lombkorona-medencéből néztük a naplementét. Ez volt életünk legjobb évfordulója." — Kiss Márton és Anna, Szeged, 2026. február
- "A slow dinner önmagában megér egy utat. A csend meg mindent visz." — Fekete Gábor, Debrecen, 2026. május`;

const SYSTEM = `Magyar szálláshely-weboldal ART-DIRECTOR + FEJLESZTŐ vagy, prémium szinten.
Készíts EGYETLEN, teljes, önálló HTML-oldalt (inline <style>, Google Fonts <link>) a megadott
szállás adataiból: modern, konverzió-fókuszú, LÁTVÁNYOS, prémium oldal.

Kötelező szekciók (gazdag, sűrű): sticky nav (brand + linkek + CTA) · FULL-BLEED hero
(100svh, háttérkép + gradiens-fátyol + eyebrow/kicker + ÓRIÁS display-cím + alcím + 2 CTA) ·
kiemelt foglaló-sáv (dátum-mezők + gomb) · stat-sáv (a megadott számokkal) · felszereltség-rács ·
szobák (KÉP + specifikáció + leírás + CTA) · galéria (aszimmetrikus/eltolt) · vélemények
(csillagokkal) · GYIK (<details>) · térkép + kapcsolat-űrlap · gazdag több-oszlopos lábléc.

Dizájn: szerif DISPLAY (pl. Fraunces/Cormorant/Marcellus/Playfair) + sans body (pl. Jost/Manrope/
Figtree). Erős tipó-hierarchia, letter-spaced eyebrow-k, nagyvonalú térköz, hover-mikrointerakciók,
layered sötét felületek. Accent-szín a karakterhez.

SZABÁLYOK: NINCS emoji — minden ikon INLINE SVG. Csak a megadott adatot használd (ne találj ki új
tényt). A képekhez a megadott URL-eket használd. A kimenet KIZÁRÓLAG a teljes HTML dokumentum
(<!doctype html>…</html>), MÁS SEMMI (nincs magyarázat, nincs markdown-kerítés).`;

async function main() {
  if (!config.anthropicApiKey) throw new Error("nincs ANTHROPIC_API_KEY");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  console.log("\n  bespoke AI-HTML generálása (claude-opus-4-8)… ~30-90s");
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 32000,
    system: SYSTEM,
    messages: [{ role: "user", content: brief }],
  });
  const res = await stream.finalMessage();
  const block = res.content.find((b) => b.type === "text");
  let html = block && block.type === "text" ? block.text : "";
  const m = html.match(/<!doctype[\s\S]*<\/html>/i);
  if (m) html = m[0];
  if (!/<html/i.test(html)) throw new Error("a modell nem adott vissza HTML-t");

  const outDir = path.resolve(process.cwd(), "sites/_engine-proof");
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, "bespoke-mock.html");
  await writeFile(file, html, "utf8");
  console.log(`  → ${file} (${html.length} b)\n`);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
