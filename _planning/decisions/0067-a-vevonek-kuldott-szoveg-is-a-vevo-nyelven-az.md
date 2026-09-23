## ADR-0067 — A vevőnek KÜLDÖTT szöveg is a vevő nyelvén: az i18n-doktrína kiterjed a levelekre és a vendég-űrlapokra

**Dátum:** 2026-08-25 · **Státusz:** elfogadva (tulajdonosi elkapás) · **Kapcsolódó:**
ADR-0036 (nyelv = paraméter, language_pack), ADR-0063 (multilang modul),
03-INVARIANTS §B.18 (i18n-doktrína — KITERJESZTVE).

### Probléma (tulaj, 2026-08-25)

A multilang stale-értesítő tesztlevele magyarul érkezett, és a tulaj feltette a
kérdést: „ha lengyelországi a tenant, lengyelül küldjük?" A válasz NEM volt. Az
átvizsgálás kiderítette, hogy nem egyetlen levélről van szó: **a teljes kimenő
levél-felület** beégetett magyar volt (`<html lang="hu">`-val együtt) —
belépési adatok, számla-kísérőlevél, „elkészült az előnézeted", és ami a
legsúlyosabb: a tenant SAJÁT VENDÉGEINEK menő foglalás-visszaigazolás,
elutasítás és vélemény-köszönő. Ráadásul a foglalási/vélemény-űrlap
**hibaüzenetei** is (14 db), amelyeket a vendég a tenant oldalán lát.

Egy lengyel panzió német vendége tehát lengyel oldalon foglalt volna, és magyar
hibaüzenetet + magyar visszaigazolást kapott volna.

### A gyökér-ok: az őr FÁJLLISTÁJA, nem a szabály

A §B.18 szabály jó volt; a betartatás mérte a rosszat. Két külön őr (katalógus-
kinyerő + i18n-lint) **két külön, kézzel karbantartott fájllistával** dolgozott, és
egyik listában sem szerepelt az `src/email/*`. A doktrínához kötés maga a listára
kerülés volt — így a levél-lánc soha nem került a doktrína alá, miközben minden
kapu zölden jelentett. (Ugyanez a hibaosztály egyszer már megtörtént: a két lista
driftje elnyelte az ADR-0044 modul-szekció feliratait.)

Két további vakfolt derült ki ugyanitt:
1. a lint csak **dupla idézőjeles** literált nézett — a `` `Legalább ${n} éjszakára…` ``
   alakú (tehát épp a számot tartalmazó, jellemzően vevő-mondat) sértések átmentek;
2. a lint **soronként** dolgozott, így a többsoros, helyesen burkolt `T(\n lang,\n "…")`
   hívást hamis pozitívként jelentette (a kinyerő viszont látta) — ez olvashatatlan
   egysoros kódba kényszerítette volna a szerzőt.

### Döntés

1. **A doktrína a KÜLDÖTT és a VENDÉGNEK MEGJELENÍTETT szövegre is vonatkozik**, nem
   csak a renderelt oldalra. Vevő-szöveg SOHA nem beégetett — `T(lang, "…")`.
2. **A nyelv forrása egyetlen igazság: a SITE nyelve** (`langForTenant`/`langForSite`,
   ADR-0036 szerint a régió országából származtatva és a site-adatba fagyasztva).
   Leadnél a mockja nyelve (`langForLead`) — a levél és a megnyitott oldal nem
   mondhat mást. A vendég a site nyelvén kap mindent: azon a nyelven foglalt.
3. **EGY fájllista, HÁROM őr** (`scripts/i18n-sources.mjs`). A hármas kapu mindegyike
   erről olvas: PostToolUse-hook (`i18n-scan.mjs`), `i18n-lint`, katalógus-kinyerő.
   ⚠️ A hook külön, NEGYEDIK kockázat volt: saját „keep in sync" listát vitt, ami MÁR
   driftelt (5 fájl a lint 6-ja mellett) — és ez a legdrágább rés, mert a hook a
   legkorábbi visszajelzés: szerkesztéskor szól, vagy soha. Egy vevő-felületet érintő
   fájl mostantól MINDHÁROM őrhöz csatlakozik, vagy egyikhez sem.
4. **Az őr kiterjesztve**: template-literál (backtick) szkennelés + többsoros `T()`
   felismerés. Mindkettő pirosra tesztelve, szándékos rontással.
5. **Nyelvnevek is fordulnak** (`langNameLocalized`, literál `T()`-hívásokkal, mert a
   kinyerő csak literált lát): a lengyel tulaj „niemiecki (Deutsch)"-ot olvas.
6. **JOGI kivétel megerősítve:** a SZÁMLA (bizonylat) tétel-szövege marad a
   kiállító nyelvén — az országonkénti JOGI csomag kérdése, nem UI-fordítás. A
   számla **kísérőlevele** viszont a vevő nyelvén megy.

### Következmény

A katalógus 393 → 486 stringre nőtt: 93 addig fordíthatatlan vevő-felirat vált
fordíthatóvá. Lengyelre élesben verifikálva.

A kiterjesztett őr **a bekötés pillanatában talált egy további élő sértést** egy másik
szál frissen landolt kódjában (a szoba-kártya „{n} fő" férőhely-címkéje a vendég
oldalán) — vagyis nem elméleti védelem: azonnal fogott.


### ② A TENANT-ADMIN is a vevő nyelvén — és a PSZEUDO-NYELV kapu (2026-08-25, ugyanaznap)

Az ① után a tulaj rendelkezett: essünk neki a maradék ismert adósságnak is. A
tenant-admin (a tulaj SAJÁT munkafelülete) és a modul-beállító képernyők ~320
feliratát átvezettük a nyelvi csomagon; a katalógus 493 → 861 stringre nőtt.
A `<html lang>` és a `<title>` is a vevő nyelvét deklarálja; a belépő-oldal a
tulaj saját oldaláról érkező linkből (`?lang=`) tudja meg a nyelvet.

⛔ **KIVÉTEL, kimondva:** `src/server/legalViews.ts` + `src/legal.ts` (ÁSZF,
Impresszum, elállás, DPA) NEM megy gépi fordításon — a jogi szöveg országonkénti
JOGI csomag kérdése (§B.18). Egy félrefordított ÁSZF felelősség, nem UI-hiba.

**A LÉNYEG viszont egy új hibaosztály:** az `i18n-lint` MAGYAR ÉKEZETET keres, ezért
**vak az ékezet nélküli magyarra**. Élesen megtörtént: a lengyel tulaj admin-felülete
„1 db"-ot írt ki, minden kapu zöld volt, és csak EMBERI szem vette észre egy
képernyőképen. Ugyanígy csúszott át a „Vissza a modulokhoz".

**Válasz: `scripts/i18n-pseudo-check.mts` — strukturális, nem heurisztikus kapu.**
A valódi felületeket egy szintetikus nyelven rendereli, amelynek csomagja MINDEN
fordított stringet «jelöléssel» lát el; ami a kimeneten jelöletlen marad, az
definíció szerint nem ment át `T()`-n — ékezettel vagy anélkül. 9 felületet fed,
pirosra tesztelve: ékezet nélküli szivárgásra a lint ZÖLD, a pszeudo-kapu PIROS.

A kapu azonnal talált olyan réseket is, amiket az ember nem látott volna végig: az
**ADAT-REGISZTEREK** (modul-katalógus, modul-config mezők) feliratai — a view-k
`T(lang, m.label)`-lel fordítják őket, ami DINAMIKUS argumentum, tehát a kinyerő
sosem látta. Megoldás: a kinyerő MEZŐNÉV szerint takarítja be ezeket a
`src/modules.ts` / `src/moduleConfig.ts`-ből (a literál marad literál, mert az ott
ADAT). Plusz egy elmaradt `lang`-átadás (`renderField`) is így bukott ki: a
fordítás „be volt kötve", csak épp nem hívódott.

**Meta:** heurisztikus őr mellé mindig kell egy STRUKTURÁLIS is, ha a heurisztika
hibája néma. A pszeudo-nyelv nem nyelvet találgat — a hiányzó CSATORNÁT méri.



### ③ A BELSŐ KONZOL is felkészítve — operátoronkénti nyelv (2026-08-26)

Tulaj: „készítsük fel a belsőt is arra, ha lesz nem magyar". A konzol ~570 feliratát
átvezettük a nyelvi csomagon (katalógus 861 → 1420 string), a `<html lang>` és a
lapcím is a nyelvet deklarálja.

**A nyelv itt NEM a piacé, hanem az EMBERÉ.** A tenant-admin a SITE nyelvén szól (a
vevő nyelve az adatból következik, ADR-0036); a konzolnál viszont egy magyar és egy
lengyel operátor UGYANAZT a felületet nézi ugyanazon az adaton. Ezért a beállítás a
FIÓKHOZ tartozik (`operator_user.lang`, migráció 0037), nyelvváltóval a fejlécben,
és alapértéke `hu` — néma nyelvváltás rosszabb, mint a változatlanság.

**Kérés-hatókörű nyelvi kontextus (`AsyncLocalStorage`, `src/console/i18nCtx.ts`)**,
nem paraméter-átfűzés. Indok mérésből: a konzolnak ~53 egymást hívó nézet-függvénye
van; egy paraméter végigvezetése minden szignatúrát ÉS minden hívóhelyet érint, és
EGY kihagyott átadás némán magyarul hagy egy töredéket — pontosan ez történt a
tenant-oldalon (`renderField` megkapta a paramétert, a hívó nem adta át). Modul-szintű
„aktuális nyelv" viszont versenyhelyzet: két egyidejű kérés felülírná egymást. Az ALS
mindkettőt kizárja; a nézet egy sorral jut a nyelvhez (`consoleLang()`), a nyelvet
pedig az az EGY hely tölti fel, ahol az operátor amúgy is betöltődik
(`currentOperator`) — így egyetlen route sem felejtheti el.

**A pszeudo-nyelv kapu 6 konzol-felülettel bővült** (összesen 15), szándékosan ÜRES
adattal: a „nincs találat" típusú szöveget felejtik el a leggyakrabban lefordítani, és
épp azzal találkozik egy új munkatárs az első napon. A kapu itt is azonnal fogott: a
lint által NEM látott, ékezet nélküli feliratokat (`Match`, `Kontakt`, `Mock`,
`modern`, `nincs honlap`), a szűrő-legördülők opció-címkéit és több modul-szintű
címke-térképet (`QUAL_META`, `EVENT_LABEL`, `MENU`, `MONTHS`).

⚠️ A „Tervek” felület (ADR-0068) időközben VISSZAVONVA a main-en — a hozzá tartozó
két fájl i18n-esítése ezzel tárgytalan lett, és nem került be.

**Kimarad (indokolt):** a jogi szövegek (ADR-0067 ②) és az operátor-LOGOK — a log
diagnosztika, nem felület.

**Kapcsolódás az ADR-0070-hez:** az ott kimondott irány (a doktrína fájllistája legyen
SZÁRMAZTATOTT, ne kézi) ezt a szakaszt is felülírja majd; a konzol-fájlok addig kézzel
kerültek a közös listára.

### Visszafordíthatóság

🔄 Additív: minden `T()` magyar forrás-stringre esik vissza, ha nincs csomag.

### Meta-tanulság (a memóriába is)

Ha egy doktrínához a kötést egy **kézzel karbantartott lista** adja, akkor a lista a
doktrína — és ami lemarad róla, az nem „még nem konvertált", hanem **őrizetlen**.
Új vevő-felület születésekor a kérdés nem „burkoltam-e", hanem „RAJTA VAN-E A
LISTÁN". Az őr hatókörét ugyanúgy kell auditálni, mint a szabályt.
