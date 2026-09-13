# 2026-09-13 — A §C-kapu a feladó-azonosítást a KONFIGURÁCIÓN méri (ADR-0130)

**Kiváltó:** Elek FK-004 H2 (tulaj-bejelentés). A ténylegesen kiküldött hideg megkeresés
lábazata: „A megkeresés küldője: **TESZT Szolgáltató e.v. (nem valódi)** · 8360 Keszthely,
Teszt utca 1. · nyilvántartási szám: TESZT-00000000 · adószám: 12345678-1-42" — miközben az
aláírás valódi személyt nevezett meg, és a lap teteje zöld **„Jogszerűségi kapu: PASS —
küldhető"** jelvényt adott rá.

## Amit a mérés mutatott

- **A kapu nem lehetett volna képes észrevenni.** Mind a négy §C.2 szabály a SZÖVEGET mérte
  (kitöltetlen `[…]` jelölő · a „A megkeresés küldője:" sor megléte · placeholder-gyanús
  elérhetőség a kapcsolat-blokkban), a szöveg pedig pontosan azt írta, amit a config
  diktált: a jelölő hiányzott, a sor megvolt, a kapcsolat-blokk hibátlan volt.
- **Egy éles félrekonfiguráció ugyanígy nézne ki, ugyanígy PASS-szal.** A dev-érték átírása
  ezért nem javítás — a tünetet tünteti el, a lyukat nem (tulajdonosi elhatárolás).

## A javítás (ADR-0130)

A mérés a **konfigurációra** költözött, mezőnként három rétegben: ① kitöltött-e; ② **valódi
alakú-e**; ③ nem a `.env.example` dokumentált minta-értéke (pontos egyezés, EGY forrásból).

⛔ **Nem szó-feketelista.** Ez a fájl kétszer égett meg fuzzy szöveg-heurisztikán, amely
HELYES értékre sült el (`xXx` token 2026-09-09; a valós `12345678-1-42` a `1234567` mintán
2026-09-11, ADR-0121). Egyik új szabály sem azt kérdezi, hogy egy érték „teszt-szagú-e",
hanem hogy **lehet-e valódi**:

| mező | a mérés | a dev-érték sorsa |
|---|---|---|
| `LEGAL_ENTITY_TAX_NUMBER` | magyar adószám **ellenőrző számjegye** (súlyok 9,7,3,1,9,7,3) + áfa-kód + területi kód | `12345678-1-42` → a 8. jegy 6 lenne, nem 8 → **nem létező adószám** |
| `LEGAL_ENTITY_REG_NUMBER` | 8 jegyű e.v.-szám VAGY `##-##-######` cégjegyzékszám; csupa ismételt jegy tilos | `TESZT-00000000` → egyik alak sem |
| `LEGAL_ENTITY_NAME` / `OUTREACH_SENDER_*` név | a bejegyzett név nem visel zárójeles/szögletes **megjegyzést** (karakter-osztály szabály, nem szólista) | `TESZT Szolgáltató e.v. **(nem valódi)**` → megjegyzést visel |
| `OUTREACH_SENDER_EMAIL` | szabvány szerint **FENNTARTOTT** domain (RFC 2606/6761: `.invalid`, `.test`, `example.com`…) | a dev érték valós → átmegy |
| `OUTREACH_SENDER_PHONE` | mező-szintű minta-szám (5+ azonos jegy, növekvő sorozat) — **ITT** a helye, nem a prózán | nincs beállítva → kimarad |
| `LEGAL_ENTITY_ADDRESS` | irányítószám + legalább 4 elem, megjegyzés nélkül | `8360 Keszthely, Teszt utca 1.` → **átmegy** (helyes alak) |

⭐ **A táblázat utolsó sora a lényeg:** a kapu nem „a dev-konfigot" utasítja el, hanem azt,
ami nem lehet valódi. Egy helyes alakú teszt-cím átmegy.

**Strukturált lelet** (`OutreachCheckResult.identity`): melyik env · milyen néven nyomtatja a
levél · mi az érték · mit mért a kapu. A piszkozat-lapon saját, piros keretes doboz sorolja
fel — ott, ahol a visszafordíthatatlan gomb van. ⚠️ A doboz a lap SAJÁT box-mintáját kapta
(inline border), mert a konzol-CSS-ben **nincs `.card` szabály** — az első vágásom emiatt a
lap legsúlyosabb blokkját laza szövegként rajzolta ki; a KÉP fogta meg, nem a kód.

**Egy predikátum:** a doboz és az ok-lista ugyanabból a listából származik
(`identityReason`), nem egy második regex a mondatokon.

## Mivel bizonyítva

- **Negatív önteszt:** 14 rontott konfiguráció mindegyike FLAG + megnevezi a mezőt.
- **Hamis FLAG elleni pozitív kitűzés:** az **ÉLES** konfig-értékek (prod `.env`-ből olvasva)
  mindkét felületen tisztán átmennek + három **valós** adószám (69646014-1-33 · 10773381-2-44
  · 10537914-4-44) elfogadva. A hamis FLAG ugyanolyan bukás, mint a hamis PASS: az üzletet
  állítja meg, csendben, azon a gépen, ahol senki nem futtat tesztet.
- **A bekötés alfolyamatban:** a config a modul betöltésekor olvasódik, ezért `process.env`
  írása a script tetején KÉSŐ (ESM). Külön process, saját env-vel → placeholder env: a
  VALÓDI `checkOutreachDraft` FLAG 3 mezővel; éles-alakú env: nincs azonosítás-FLAG.
- **Viselkedés a valódi küldő-úton:** `sendOutreachMail(<FK-004 prospect>, {dryRun:true})` →
  `flagged` (a dry-run a §C-kapu UTÁN tér vissza, tehát a kapu tényleg blokkol, és közben
  levél nem mehet ki).
- **Kép:** `assets/Temp/ui-identity-gate-{mobile,desktop}.png` (390px + desktop).

## Vállalt következmény (tulaj-döntést igényel)

A dev `.env` szándékosan önleleplező teszt-entitást tart → **ezen a gépen a hideg megkeresés
mostantól nem küldhető** (az Elek FK-004 7. lépése blokkolva lesz). Ez a kapu helyes
működése, nem mellékhatás. A dev-küldés visszanyerése tulaj-döntés: valós e.v.-adatok a dev
`.env`-be (a gép amúgy is csak `elek@citoviso.com`-ra küld) — **nem** a kapu tompítása.

## Párhuzamos szál — worktree-ütközés

A munka a `~/wt/cit2167c7de` fában indult, ahol **egy másik session is dolgozott** (FK-004
**H1**, a törött MMS-előnézet: `mockPhotoHealth.ts`, `photoGate` a `leadPage`-ben) — stage-elt
fájlokkal az indexben. A commit ezért **friss, üres worktree-ből** (`~/wt/citsenderid`,
origin/main-ről) készült: a két saját fájl patch-csel, a `views.ts` hunkjai kézzel újra. Így
a katalógus-regenerálás is TISZTA maradt (pontosan 5 új string, idegen nélkül).

## Módosított fájlok

- `src/outreach/outreachCheck.ts` — a §C.2 azonosítás-mérés (~300 sor) + a kapu bekötése
- `src/console/views.ts` — strukturált, mezőnkénti doboz a piszkozat-lapon
- `scripts/outreach-gate-selftest.mts` — 14 negatív + éles-pozitív + alfolyamatos bekötés-próba
- `src/i18n/catalog.json` — 5 új konzol-string
- `_planning/DECISIONS.md` — ADR-0130
- `_planning/DOMAIN/03-INVARIANTS.md` — §C.2 kiegészítés

## Nyitott

- Tulaj-döntés: menjenek-e valós e.v.-adatok a dev `.env`-be (különben dev-ből nincs hideg
  levél).
- Az FK-004 további leletei (H1 törött MMS-kép, Z1–Z4) **másik szálban** futnak.
