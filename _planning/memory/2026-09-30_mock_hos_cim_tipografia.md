# 2026-09-30 — Mock hős-cím tipográfia: a hosszú mondat nem veri szét az oldalt (ADR-0284)

**Kérés (tulaj, az éles mockokat nézve):** „sok mocknál a szöveg kinyírja az oldalt. Extrém nagy a szöveg.”
Koordináló session (nem SUB — a tulaj kérésére a SUB-jel levéve, a jelölőfájl `~/.claude/rc-sub-removed/`).

**Mérés.** A tulaj képe (dark-luxury, transit) egy 150%-ra skálázott laptop: ~1320×570 CSS px. Ezen reprodukálva
pontosan. Az éles 19 mock HTML-je lehozva (`scp`, csak olvasás), az újrarendereléshez az éles
`mock_artifact.inputs` (recipe + siteData) — offline render a munkafa motorjával, DB-írás nélkül.
Előtte 23/76 hibás skin×méret (fejléc-fedés, lap fölé lógás, teljes képernyős cím), utána 1 (watercolor,
elrendezés, nem betűméret). Skin-ítélet (1320×570): hibás volt — dark-luxury, horizontal, cinematic,
parallax (fed/kilóg), transit, brutalism, artdeco, dopamine, organic, scrapbook, watercolor (képernyő-evő);
jó volt — aurora, claymorphism, fullbleed, card-sidebar, editorial, tilted-gallery, wordmark-grow, arch-frames.

**A többi éles mock (a tulaj kérése: „minden élesen generált mockot nézz meg”).** Élesen 36 sor / 28 fájl
/ 10 lead maradt (a teszt-lead 19 mockja közben törlődött az élesről; a lemért másolata a `_drafts/`-ban).
Mai állapot: 0 hiba (rövid, 20–41 karakteres címek). A mai motorral újrarenderelve: a „Panzió” dark-luxury
közepes címmel a nav-ra futott → ráúszó-fejléces skinek (dark-luxury, horizontal, cinematic) alacsony asztalon
fejléc-a-folyásban geometriát kaptak; az őr azóta közepes címet is mér. Végeredmény: 47 mock × 4 méret, 1 maradék
(watercolor, elrendezés). A rövid/közepes sáv plafonja lazítva (16vh/12vh), mert a szűkebb csak nem-törött címeket kicsinyített.

**Javítás.** `src/engine/templateKit.ts` `heroFit()` + `HERO_FIT_CSS` (hossz-sáv → magasság-plafon); a 14
mondat-címes sablon h1-e attribútumot kap, a saját clamp `min()`-be burkolva; dark-luxury/parallax/cinematic
hosszú mondatnál szélesebb sor; dark-luxury/horizontal/cinematic alacsony asztalon fejléc a folyásban; parallax alacsony asztalon nagyobb padding-top. Őr: `scripts/hero-fit-check.mts`
(+ `hooks/pre-commit`), negatív kontrollal. dizajn-doktrina-or: PASS. hero-contrast, mobile-chrome,
design-token-lint, guard-wiring zöld.

**Módosított fájlok.** `src/engine/templateKit.ts`, `src/engine/templates/{artdeco,aurora,brutalism,cinematic,
claymorphism,darkLuxury,dopamine,fullbleed,horizontal,organic,parallax,scrapbook,transit,watercolor}.ts`,
`scripts/hero-fit-check.mts`, `hooks/pre-commit`, `_planning/decisions/XXXX-…`, ez a jegyzet, `MEMORY.md`.

**Nyitott.** ① Élesre a tulaj deployol (Deploy-koordinátor). ② A már legenerált mockok pillanatképek —
deploy után `rerender-mock.mts` kell rájuk (a teszt-leadre mind a 19). ③ watercolor 1320×570: a cím utolsó
sora a hajtás alatt (fejléc + chip 380 px) — ha zavar, külön elrendezés-kör. ④ A tulaj a képeket megkapta
(előtte/utána, laptop · asztali · mobil); ha a méreteken változtatni akar, a sáv-számok egy helyen vannak.
