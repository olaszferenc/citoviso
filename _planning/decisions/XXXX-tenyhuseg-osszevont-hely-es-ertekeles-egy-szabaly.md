## ADR-XXXX — Tényhűség: két forrásolt tényből nem lesz harmadik (összevont hely-állítás); a Google-értékelés egy szabállyal, ≥ 0,7 (2026-10-03)

**Dátum:** 2026-10-03 · **Státusz:** elfogadva (hibajavítás mérés alapján; SUB, brief `~/rc-briefs/fix-tenyhuseg-szoveg-ertekeles.md`) ·
**Forrás:** a 2026-10-02-i sablon-munka (Séta és Kapunyitás SUB) tényhűség-őr agentjének két FLAG-je ·
**Kapcsolódó:** §B.17 (03-INVARIANTS: tiltott kimenet (5), 7. pont), ADR-0292 (vendég-kritikus), ADR-0309 (hozzátett hely-/minőség-részlet,
„ismert határ”), ADR-0312 (kültéri tárgy, MINTA nem tény), ADR-0046 (az értékelés-szám), ADR-0293 (Places-költség).

### ① Összevont hely-állítás: a viszony maga a tény
**Lelet.** Három Huszár (Séta-mock): „Kontinentális reggeli a kertben”. A forrás (lake-balaton.com): „A szállás kerttel reggelente
kontinentális reggelit szolgál fel.” — a kert a házé, a reggeli létezik; hogy a reggelit a KERTBEN adják, senki nem mondta. Lidó Wellness
és Bor Villa (Kapunyitás): „Uszoda és wellness a helyszínen”, „Kültéri jacuzzi a kertben”. A forrás (balaton.hu) egy lapos
„Szolgáltatások” lista, ahol az „Uszoda” a „Nightclub”, „Vitorlázás”, „Hajózás” mellett áll — a környék kínálata keveredik a házéval.
A vendég-kritikus átengedte: az ADR-0309 részlet-szabálya EGYÜTTÁLLÁST mér, és a „kert” és a „reggeli” egy forrás-mondatban áll (pont ezt
nevezte meg az ADR-0309 „ismert határa”); a generátor tényhűség-kapuja (modell) PASS-t adott. A „medence” (Lidó) a fotó dolga marad (ADR-0312).

**Döntés.**
1. **Gépi szabály, egy függvény két helyen** (`guestCritic.ts` `placedClaims`): ha egy tagmondat SZOLGÁLTATÁST (reggeli, vacsora, kávé,
   parkoló, grillezés, kerékpár, wifi) vagy hely-kérdéses LÉTESÍTMÉNYT (jakuzzi, szauna, uszoda, wellness) egy helyre tesz („a kertben”,
   „kerti”, „a teraszon”, „az udvarban”, „az erkélyen”, „a helyszínen”, „a villában / a házban”, „in the garden”, „on site”), kell EGY
   forrás-egység, ami a dolgot és a helyet VISZONYKÉPES alakban mondja. A ház jellemzője — „kerttel”, „kertes”, „kertre néző”, „teraszos”,
   „with a garden” — nem viszony. A „kinti / kültéri / outdoor” a kert és az udvar oldalán viszony (Mandula: „Kinti sütögetés … grillező”).
   - **Hatókör:** a tagmondat írásjelig, NEM „és”-ig — „Reggeli és grillezés a kertben” a reggelit is a kertbe teszi (ADR-0292 ai_sablon:
     így olvassa a vendég). A melléknév („kerti / udvari / helyszíni X”) és a melléknévi igenév („a kertben kialakított kemence”) csak a
     saját főnevét köti.
   - **Nem tárgya:** a rögzített kültéri SZERKEZET (terasz, pavilon, játszótér, stég, kemence) helye — azt a fotó mutatja; hogy létezik-e,
     az ADR-0312 kérdése. A szállás NEVE nem állítás („Lidó Wellness …”).
   - **Kritikus:** `lintPlacedClaim` minden körben (blokkoló `tulzas_a_forrashoz`); **generátor-kapu:** `factCheck.ts` `placedClaimsOnPage`
     a renderelt lapon (blokkonként: a cím nem tapad a bekezdéshez; minta-blokk nélkül, ADR-0312 ②), a lelet forrástalan tényként a
     verdikt-listába kerül — API-kulcs nélkül és verifier-hibánál is FLAG. A `recopy` kapuja is megkapja a vélemény-idézeteket (különben a
     véleményből forrásolt hely-állítás ott hamisan bukna).
2. **Promptok.** A szövegíró (brief) „JÓ” példái közül kikerül a „Saját parkoló az udvarban” és a „Kerti grillezés lehetősége” — a modell
   ezt másolta (37 tárolt mockban „Saját parkoló az udvarban”, ebből az Alig-vár Tanyánál és a Lagunánál parkoló-forrás SEM volt). Mindhárom
   AI-szerep (szövegíró + editorial, kritikus, tényhűség-verifier) néven nevezi az összevonást a Három Huszár példájával. Az
   editorial-prompt (`engine/copywriter.ts`) felület-kapus fájl (§2b): a változás a tulaj kivételével ment be (2026-10-03, koordinátoron át).

**Mérés** (dev DB, 172 tárolt mock, a tárolt forrásokból újraépítve). Szövegben 45 mock / 11 lead, 58 előfordulás; a renderelt lapon 46 mock,
62 előfordulás (a sablon fix szövege nem ad hamis találatot). Megoszlás: parkoló@udvar 37 · jakuzzi@kert/terasz 6 · grillezés@kert 4 ·
reggeli@kert/terasz/udvar/helyszín 7 · uszoda/szauna@helyszín 2 · parkoló@kert/helyszín 2. A javítást újrageneráláskor kapják meg — tárolt
mockot nem írunk át, Places-hívás nincs. **Valódi kritikus-kör** (AI, Places nélkül, a két kiment szövegen): Három Huszár „Kontinentális
reggeli a kertben” → „Kontinentális reggeli” (a maradó flag egy meglévő ai_sablon-lelet: „várják a kicsiket”); Lidó „Uszoda és wellness a
helyszínen” kiesik → az író „Uszoda a villában”-ra cserélte, ezt akkor csak a modell fogta → a „villában / házban” bekerült a szabályba;
a végső Lidó-szöveg PASS.

**Ismert határ.** Hogy az „Uszoda” egy lapos portál-listán a házé vagy a környéké, a szabály nem dönti el — csak a HELYÉT nem engedi
hozzáírni. A portál-lista szemantikája (Szolgáltatások vs. a környéken) scraper-kérdés, nem része.

**Őr:** `scripts/placed-claim-check.mts` (új, pre-commit) — a két mért eset a valódi forráson blokkol, 10 becsületes iker zöld, a kapu a
renderelt lapon ugyanazt látja, bekötés + promptok; **önteszt:** a régi szabálykészlet mindkét mért esetet átengedi → piros.

### ② A Google-értékelés egy szabállyal: ≥ 0,7, egy függvény
**Lelet.** A Lidó mockjain „4,8 · 25 vélemény” állt a szállás saját értékeléseként, 0,605-ös párosításon. A §B.17 (7. pont) 0,7-et kér, és
az élő jelvény (`reviews/placeRating.ts`) a saját `MIN_CONFIDENCE = 0.7` példányával ezt is kérte — a generátor (`generate.ts`) viszont a
számot a FOTÓ-kapura ültette, ami csak a „low” sávot (< 0,45) dobja. Egy tény, két szabály.

**Döntés.** `scraper/confidence.ts` `ratingAttributable(score)` (≥ `RATING_MIN_CONFIDENCE` = 0,7; ismeretlen / NaN = nem) az egyetlen szabály:
a generátor `attributedRating`-je és az élő jelvény is ezt hívja; a jelvény saját küszöb-példánya megszűnt. A fotó-kapu NEM változik
(a közepes sáv fotója a kurátor elé megy; a száma tényként menne ki). A pontszám dönt, nem a sáv: a „nem szállás-típusú → legfeljebb közepes”
korlát alatti, 0,7 fölötti párosítás száma kimehet — ez a dokumentált szabály betű szerint. **Nem vész el információ:** a lead-lap
fotó-paneljén a kurátor a PÁROSÍTÁS számát továbbra is látja a sáv mellett (`matchRating` — a Piroska-eset árulkodó jele), csak a lapra és a
levélbe nem kerül.

**Mérés** (dev DB): 165 értékelést hordozó tárolt mockból 60 (6 lead: Alig-vár Tanya 0,51 · Bánó Porta 0,59 · Lidó 0,61 · Eldorádó 0,61 ·
Laguna 0,65 · Myrna Haus 0,697) 0,7 alatti párosításon. Újrageneráláskor kiesik; tárolt mockot nem írunk át.

**Őr:** `scripts/rating-attribution-check.mts` (új, pre-commit) — a szabály (0,605 → nem, 0,7 → igen, ismeretlen → nem), a generátor döntése
a Lidó-párosításon, egy szabály egy hely (import + nincs saját küszöb + nincs közvetlen `rating = m.rating`), a kurátor-panel diagnózisa;
**önteszt:** a régi szabály (band != low) a Lidón számot ad → piros.

**Visszafordíthatóság:** 🔄 — mindkettő egy-egy függvény; a tárolt adat nem változott.
