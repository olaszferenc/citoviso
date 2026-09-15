# 2026-09-15 — A fantom pirula-ütközés, és két szál ugyanazon a munkán (ADR-0180)

**Szál:** `wt/leadlistalap` · **Tulajdonosi utasítás:** „javítsd a lead-page-surface-check
pirula-ütközését is". **Élesítés NINCS** (§0.3 — mérőeszköz, nulla termék-kód).

---

## ⛔⛔ A premissza hamis volt — és az ÉN idézésem terjesztette

Az előző körben a záró összefoglalómba egy őr-leltár **2026-09-14-i dátumú** sorát másoltam át
„ma PIROS, és ez **TERMÉK-HIBA**: a pirula a CTA **23 %-át** takarja" alakban. A tulaj erre adta
az utasítást.

**Mérve, javítás ELŐTT:** 19 sablon × 2 méret = 38 pirula-mérés, `EXIT=0`; a `y` **475–828
között szór** sablononként — ez maga a bizonyíték, hogy a termék kikerülője dolgozik
(kikapcsolva konzisztensen `y=745`). Az **ADR-0168** már **fantomnak** minősítette a
bejelentést. A dátum ott volt a soron; nem az információ hiányzott, hanem a következtetés.
**A pirulához egyetlen sort sem nyúltam.**

## ⛔⛔ És amiről ez a nap igazán szól: KÉT SZÁL UGYANEZT A MUNKÁT VÉGEZTE EL

A mérés közben megtaláltam a valódi hibát (öt őr a KÖZÖS `assets/Temp`-be írta és törölte a
scratch-jét; háromnál INDULÁSKOR, vagyis futó szálak alól). Megírtam mind az ötöt + egy
osztály-őrt + a hook-bekötést, és végigvittem a kapukon.

**Mire a land a push-ig ért, egy párhuzamos szál UGYANEZT landolta** (`0ca7a93`): ugyanaz az öt
őr, ugyanaz a diagnózis („a piros VERSENY volt, nem termék"), plusz osztály-őr
(`guard-scratch-scope-check.mts`). A commit-üzenetük **nevesíti a szálamat**: *„a
`wt/leadlistalap` session épp UGYANEZT az őrt futtatta, és amelyik előbb végzett, kitörölte a
másik alól a fixture-t"* — az én diagnosztikai futásaim voltak a verseny másik oldala.

**Amit tettem:** ⛔ **az ő verziójuk a bázis, a duplikátumomat ELDOBTAM** (`git reset --hard
origin/main`), és CSAK azt vittem tovább, ami náluk nincs. Két őr egy szabályra két igazság, és
egy most landolt idegen döntést nem írok át.

⚠️ **NYITOTT, az övék a döntés:** az ő elszigetelésük **munkafa**-egyedi
(`_leadsurface-${SCOPE}`), az enyém futásonként egyedi gép-szintű temp volt. A munkafa-egyedi
kulcs UGYANABBAN a fában futó két mérést nem védi — és ez nem elméleti: ma **két teljes kört
futtattam EGYSZERRE ugyanebben a munkafában**, pont a verseny előállításához.

## Amit megtartottam (náluk nincs)

**① `--only=<sablon>` hibakereső szűkítés** (≈20 s a 6 perc helyett). ⛔ Az első változatom
**KÉT önteszt-ágat buktatott egy HIBÁTLAN őrön**: a ④ ágak KONKRÉT sablonokra kalibráltak
(`files["fullbleed"] ?? …`), és szűkítve a fallback a szűkített sablont kapta, ahol a
visszarontott hiba nem áll elő. Javítva: hangos fejléc + a ④ **kimondottan kimarad** + a záró
sor **nem mond tisztát**. ⭐ Ugyanaznap az **ADR-0177** ugyanerre jutott az Elek-futásnál —
konvergens felismerés, tehát a hibaosztály valós.

**② A mozgó kivágás nyugvópontban mérése** (harmadszor ugyanez a szabály: ADR-0147 ②,
ADR-0168 ①). A commit kapu-futása `aurora/asztali`-n „üres keretezett dobozt" jelentett
(`colours: 1`) — ugyanazon a fán, ahol az előtte futott kör zöld volt. **1 bukás 12 futásból**,
és 10 SZÁNDÉKOS kísérletből (8 szűkített + 2 EGYSZERRE futó teljes kör, 33-as terhelésnél)
**egyszer sem**. Mechanizmus: a `loc.screenshot()` maga görgeti be az elemet, az pedig INDÍTJA a
felfedő animációt. ⭐ **És nem elmélet:** a várás élesben tüzelt — két egymás utáni kivágás
**65 → 17 színt** adott ugyanarra a dobozra.
⛔ Nem gyengítés, **hamis ZÖLDET nem tud adni** (a valóban üres doboz stabilan egy színű, és a
④ mindhárom piros ága tüzel). ⚠️ **De NEM állítom, hogy a bukás javítva van:** nem tudtam
előállítani, tehát a hatását nem mértem meg — ezért hagy a napló nyomot (`⏱ a kivágás még
mozgott`).

## ⚠️ Nyitott, idegen: egy diff-scope NÉLKÜL futó kapu véletlenszerűen blokkol MINDENKIT

A commitom közben elbukott a `consent-style-check`-en, **amit nem módosítottam**. Mérve: a bukó
felület a `/pay/done`, amit a guard a KÖZÖS park egy `paid`+`gateway_ref` sorából épít — és mire
a böngésző lekéri, egy párhuzamos szál átírhatja az állapotot, így a lap a 404-es ágra fut, amin
nincs `.panel`. **Bizonyíték:** közvetlenül utána 355 zöld / 0 bukás, és a felület **be sem
került** (mérve: 1 kifizetett sor van, `gateway_ref` NULL). ⛔ A kapu diff-scope nélkül fut,
tehát MINDEN szál MINDEN commitját blokkolja. Nem gyengítettem el más őrét; javaslat: a lekért
lapról előbb állapítsa meg, hogy a VÁRT lap-e, és ha nem, **hangosan** maradjon ki.

## Módosított / létrehozott fájlok

- `scripts/lead-page-surface-check.mts` — `--only` szűkítés, a ④ kihagyása szűkített futásban,
  a kivágás nyugvópont-várása (az ő scratch-javításuk ÉRINTETLEN)
- `_planning/DECISIONS.md` (ADR-0180), `MEMORY.md`, `_planning/memory/INDEX.md`, ez a jegyzet

## Nyitott kérdések

- Munkafa-egyedi vs. futásonként egyedi scratch (lásd fent) — az övék a döntés.
- A `consent-style-check` park-függő, mindenkit blokkoló bukása.
- ⭐ **Eljárás:** ~25 szálnál a „ketten ugyanazon" nem kivétel. Bejelentett hiba előtt nem csak
  a `DECISIONS.md` címeit kell grepelni, hanem **futó munkát is keresni** (`git log --oneline
  origin/main -5`, az `INDEX.md` aznapi sorai).
