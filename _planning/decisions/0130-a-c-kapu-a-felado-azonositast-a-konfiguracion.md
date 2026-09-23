## ADR-0130 — A §C-kapu a FELADÓ-AZONOSÍTÁST a KONFIGURÁCIÓN méri, nem a levél szavain (2026-09-13)

**Dátum:** 2026-09-13 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0121 (a levél viseli a
hirdető cégazonosítását; a heurisztika-hatókör tanulsága), ADR-0112 (a linkelt oldal a
kötelezők hordozója), ADR-0110 (`config.legalEntity` = EGY forrás az impresszummal),
03-INVARIANTS §C.2 + §B.17.

**Kiváltó (Elek FK-004 H2, mérve 2026-09-13).** A ténylegesen KIKÜLDÖTT hideg megkeresés
lábazata ez volt:

> „A megkeresés küldője: **TESZT Szolgáltató e.v. (nem valódi)** · 8360 Keszthely, Teszt utca 1.
> · nyilvántartási szám: TESZT-00000000 · adószám: 12345678-1-42"

ugyanannak a levélnek az aláírása valódi személyt nevezett meg, a lap teteje pedig zöld
**„Jogszerűségi kapu: PASS — küldhető"** jelvényt adott rá. A kötelező feladó-azonosítás
**önmagát érvénytelenítette a címzett szavaival**, és a kapu ezt nem vette észre.

**Miért nem vehette észre.** A §C.2 minden addigi szabálya a SZÖVEGET mérte (kitöltetlen
`[…]` jelölő, „A megkeresés küldője:" sor megléte, placeholder-gyanús elérhetőség a
kapcsolat-blokkban) — a szöveg pedig pontosan azt írta, amit a config diktált: a jelölő
hiányzott, a sor megvolt, a kapcsolat-blokk hibátlan volt. **Egy éles félrekonfiguráció (üres
vagy bemásolt minta-env) ugyanígy nézett volna ki, ugyanígy PASS-szal.** A kapu arra volt vak,
amit a legkönnyebb elrontani. ⚠️ A dev-érték átírása NEM javítás: az a tünetet tünteti el, a
lyukat nem.

**Döntés.**

1. **A mérés a KONFIGURÁCIÓRA költözik, mezőnként három rétegben:** ① ki van-e töltve;
   ② **valódi alakú-e** — az adószám ELLENŐRZŐ SZÁMJEGYE, nyilvántartási szám-alak, szabvány
   szerint FENNTARTOTT (RFC 2606/6761) levél-domain, megjegyzést viselő bejegyzett név;
   ③ nem a `.env.example` dokumentált minta-értéke (pontos egyezés, EGY forrásból).
2. **⛔ NEM szó-feketelista.** Ez a fájl kétszer égett meg fuzzy szöveg-heurisztikán, amely
   HELYES értékre sült el (`xXx` token 2026-09-09; a valós `12345678-1-42` adószám a
   `1234567` mintán 2026-09-11 — ADR-0121). Egyik új szabály sem azt kérdezi, hogy egy érték
   „teszt-szagú-e", hanem hogy **lehet-e valódi**. A `12345678-1-42` azért bukik, mert az
   ellenőrző számjegye hibás (a 8. jegy 6 lenne) — tehát nem adószám; a ház valódi
   `69646014-1-33` száma átmegy, és átmegy két független valós szám is (10773381-2-44,
   10537914-4-44). Az önteszt mindhármat kitűzi.
3. **A lelet STRUKTURÁLT, mezőnként** (`OutreachCheckResult.identity`): melyik env, milyen
   néven nyomtatja a levél, mi az érték, és mit mért a kapu. A piszkozat-lapon saját, piros
   keretes doboz sorolja fel — ott, ahol a visszafordíthatatlan gomb van; a „FLAG" önmagában
   nyolc env-érték közötti találgatás.
4. **A hatókör az, amit a felület TÉNYLEG kinyomtat:** a levél az aláírást (`OUTREACH_SENDER_*`)
   és a nyilvántartási azonosító-sort (`LEGAL_ENTITY_NAME/ADDRESS/REG_NUMBER/TAX_NUMBER`), a
   linkelt előnézet-oldal a hirdetőt (`company||name`). A `LEGAL_ENTITY_EMAIL/PHONE` ide NEM
   tartozik — az az impresszumé (`legal-check.mts`). Egy olyan érték, amit senki nem küld ki,
   csak zaj a kapun.
5. **A próza-szabályok érintetlenek** (ADR-0112/0121): a saját URL-ünk NEM aláírás és NEM
   személyre szabás, a tartalmi szabályok továbbra is CSAK a prózán mérnek.

**Negatív önteszt (kötelező, `scripts/outreach-gate-selftest.mts`).** 14 rontott konfiguráció
mindegyike FLAG-re megy és megnevezi a mezőt; az ÉLES konfig-értékek (olvasva a prod .env-ből)
mindkét felületen tisztán átmennek — **a hamis FLAG ugyanolyan bukás, mint a hamis PASS: az
üzletet állítja meg, csendben, azon a gépen, ahol senki nem futtat tesztet.** A bekötést
ALFOLYAMAT igazolja (a config a modul betöltésekor olvasódik, ezért `process.env` írása a
scriptben késő): placeholder env → a VALÓDI `checkOutreachDraft` FLAG, 3 mezővel; éles-alakú
env → nincs azonosítás-FLAG.

**Vállalt következmény.** A dev .env szándékosan önleleplező teszt-entitást tart, ezért **ezen
a gépen a hideg megkeresés mostantól NEM küldhető** (mérve a valódi küldő-úton: a
`sendOutreachMail` `flagged`-et ad). Ez a kapu helyes működése — egy „(nem valódi)" lábazatú
levél a leadnek csalás-gyanús —, nem mellékhatás. A dev-küldés visszanyerése tulajdonosi
döntés (valós e.v.-adatok a dev .env-be), nem a kapu tompítása.

**Visszafordíthatóság:** 🔄 kód-szintű, egyetlen fájlban (`src/outreach/outreachCheck.ts`).
