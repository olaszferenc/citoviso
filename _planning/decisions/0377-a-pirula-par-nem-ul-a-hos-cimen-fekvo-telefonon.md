## ADR-0377 — A pirula-pár nem ül a hős-címen: fekvő telefonon jobb alsó sarok (egymás alatt), álló telefonon a süti-sáv idején a cím fölé lép

**Dátum:** 2026-10-13 · **Kontextus:** a tulaj „A” döntése (2026-09-29, 3. telefonos kör), a pilot utánra halasztva; „Mehet mind subban” (2026-10-13, a koordinátoron át). **Módosítja:** ADR-0242 ④–⑤ (a hely), ADR-0342 pár-kontraktus 1. pontja (fekvő telefonon egymás alatt). **Megtartja:** ADR-0242 ④ gomb-kitérés (FK-004b H-3), R8 (rögzített alsó réteg fölött), ADR-0373 (kérdés-sáv a `--citui-cfg-clear` fölött).

### Kiváltó (mérve a mai main-en, 465e5394)
- **Fekvő telefon (844×390):** a ≤ 560 px-es telefon-szabályok nem élnek, így az asztali közép-hely és méret jött: a ~455 px széles pár nyugalomban is a hős-cím / bevezető sorra ült (dark-luxury: „Csendes panzió a p…” a pár alatt; a 09-29-i mérésben Laguna arch-frames címe).
- **Álló telefon (390×844), süti-sáv kint:** a pár a sáv fölé ül, a sáv a saját magasságával emeli (09-29: 784 → 661 px) — a hős-címre. Ma ugyanígy a dark-luxury-n (655 px, a bevezetőn).

### Döntés
1. **Fekvő telefon** = `(max-height:500px) and (orientation:landscape) and (min-width:561px)`. A pirulák telefonos méretűek (14 px betű, 44 px magas, alul 14 px), a hely **csak a jobb sarok** (közép és bal nincs: a bal oldalra váltva az editorial menüsorára ült); ha a sarokban fő gomb van, a pár a jobb oldalon lép feljebb.
2. **Fekvő telefonon a pár egymás alatt áll** (fent a próba, lent a rendelés, azonos szélesség, 6 px rés): egymás mellett ~370 px széles volt, és a hős-gombsor és a cím miatt 21 sablonból nyugalomban 8-on, süti-sávval 12-n a fejléc magasságáig mászott (mérve, a cím-akadállyal). Egymás alatt egy ~195 px-es oszlop, ami 14 sablonon nyugalomban a sarokban marad; a 7 középre rendezett hősön a cím mellé, jobbra lép.
3. **A hős-cím akadály** — fekvő telefonon mindig, álló telefonon csak a süti-sáv idején: a `h1` és az utána álló testvér-`p`-k **szöveg-sorai** (szöveg-csomópontok, nem a blokk: a gate-opening címe 785 px széles dobozban 288 px szó). A sor sorközét (~10 % fent-lent) nem számoljuk, a betűktől állóban 6, fekvőben 3 px rés marad (fekvőben fölötte a menü-gomb szab határt; a teljes AVOID_GAP a 50 px-es címeknél 4 px-en múlva a menü-gombig emelte a párt). A pár föléjük lép, alá soha.
4. Sáv nélkül álló telefonon és asztalon semmi nem változik (ADR-0242 ④).

### Őr
`scripts/mock-trial-overlay-check.mts` ⑪ — minden sablon: fekvő nyugalomban (sarokban, nem középen; a cím betűin nem ül; hős-gombot nem temet — PILL_PROBE, a fotó-csempe tartalom, mint a ⑨-ben), fekvő és álló süti-sávval (a cím betűin nem ül). `--self-test`: a `cit-cfg-trialfx-pill*` blokkok kivágásával a ⑪ piros.

### Nyitott (nem ennek a döntésnek a része)
Álló telefonon **sáv nélkül** és asztalon néhány sablonon (fullbleed, dark-luxury, parallax, horizontal, card-sidebar; asztalon fullbleed, horizontal, artdeco) a pár a hős-gombsor fölé lépve a bevezető sorra ül — ez az ADR-0242 ④ felfelé-lépése, a tulaj az „A”-ban erre nem döntött (a „B” lett volna a cím-kitérés kiterjesztése mindenhol).

### Visszafordíthatóság
🔄 könnyű — kliens-oldali elrendezés (`cit-configurator.js/.css`); adat, séma, pénzút nem változott. Élesre a következő deployjal megy.
