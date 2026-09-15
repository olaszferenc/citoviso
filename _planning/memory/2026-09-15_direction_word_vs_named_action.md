# 2026-09-15 — Az útbaigazítás ne IRÁNY legyen, hanem NÉV (ADR-0182)

**Szál:** `wt/sugozaras` · **Élesítés: NINCS** (§0.3) · **ADR:** 0182
**Kiváltó ok:** a `deploy-prod.sh` **GATE 1c** elbukott a `fd4ec5ed..8f44801` tartományon
(18 commit), mert a tudásbázis-őr FLAG verdiktet adott. Három hiány; mind a három javítva.

## Mit mértem (és mit mondott mást a mérés, mint a bejelentés)

- **A ② lelet ÁLLT, és számmal is igazolható:** a kézi terhelés-újrapróba visszajelző sávja a
  renderelt lapon a **6 660.** bájtnál áll, a hivatkozott gombok a **10 200–10 800.** bájtnál —
  a négy „a fenti gombbal" mind **lefelé** mutatott **fölfelé** szóval.
- ⛔ **MELLÉKLELET, amit a BRIEF nem sorolt fel:** a **`nincs_kartya`** ág pontosan akkor áll
  elő, amikor `payment_method !== 'token'` (`retryCharge.ts`) — ami **bitre ugyanaz a
  predikátum**, mint az `autoCharge` (`subscriptionAdmin.ts`). Ilyenkor a „Másik kártyával
  fizetek" gomb **meg sem jelenik**: a sáv NEM LÉTEZŐ kijáratra küldött. A BRIEF javaslata („kövesd
  a `varakozas` mintát") ezen az ágon **rossz gombot nevezett volna meg** — ezért a mondat most
  a lapon MOST LÉTEZŐ kiútból származik, nem beégetett feliratból.
- ⛔ **ÖTÖDIK „fenti"**, a mandátum-blokk saját szövegében („A fenti befizetéssel…") — és nem
  forrás-grepből, hanem a horgony 390 px-es mérésének **KÉPÉRŐL**. Tulajdonosi utasításra javítva.

## A horgony: három mérés, két elvetett változat

A tulaj kérte, hogy a redirect vigyen horgonyt. Megmértem, és **kimondtam, hogy felemás**:

1. **mandátum-blokkra** → a gombok odakerültek, ⛔ de az ÜZENET **1 201 px-szel** a képernyő fölé
   csúszott: két gomb, indoklás nélkül.
2. **fagyás-blokkra, `scroll-margin-top:130px`** → közel járt, ⛔ de **levágta a sáv tetejét**
   (top=−50), mert a sáv a benne ülő gombbal 90-ről **168 px-re** nőtt. A 130 **tartalomtól függő
   szám** volt: egy hosszabb vagy lefordított üzenetnél némán újra vágna.
3. **a horgony MAGA A SÁV** (`#terheles-uzenet`) + a sáv **kattintható kijáratot visel**. Így az
   üzenet és a tett **szerkezetileg** egy képernyőn van, nem egy eltalált px-érték miatt.
   Ellenőrizve 390 px-en: a sáv teteje **y=16**, a kijárat és a tartozás-kártya is látszik;
   a gomb kontrasztja **7,03** (AA fölött) — mérve, mert a házban a link-szabály már evett meg
   gomb-feliratot egyszer.

## ⛔ Amit egy IDEGEN őr mért ki rajtam

A kijáratot először a **befizetés-gomb nevével** vittem a sávba. Az viszont viseli a
**tartozás összegét**, és a `frozen-settle-check` azonnal pirosra ment: a jóváhagyott
„B — Rendezés-képernyő" kontraktus szerint az összeg **csak a fagyás-blokkban** állhat, mert egy
harmadik előfordulás azt kelti, hogy KÉTSZER kell fizetni. **Mérve: 2 → 3.**
→ A sáv mostantól **csak a TÁVOLI** kijáratot duplikálja (összeg nélküli felirat); a
befizetés-gomb 390 px-en amúgy is egy képernyőn van a sávval.
⚠️ **Az idegen őr fixtúrájában nincs `?ujra=` kód, tehát erre az ágra sosem látott volna rá** —
ezért a szabály átkerült a saját őrbe is (`feedback_restructure_blinds_a_foreign_guard` fordítottja:
most én voltam az, akinek a változtatása egy idegen szabály hatókörén KÍVÜLRE esett).

## Az őr

`scripts/charge-retry-note-check.mts` — hermetikus, a RENDERELT lapot méri **10 eseten**
(8 kimenet + 2 másik fül). Öt szabály: irány-tilalom (sáv ÉS mandátum-blokk) · a megnevezett
kijárat VALÓDI vezérlő · a távoli úthoz kattintható elem valódi `href`-fel · a horgony célja
létezik · a sáv nem ismétli a tartozás összegét. Bekötve a `hooks/pre-commit`-be.

- **Piros önteszt: 23 sértés**, és az önteszt **külön megköveteli, hogy MIND AZ ÖT szabály
  megszólaljon** (ADR-0157 tanulsága: a halott szabályt az összevont darabszám elfedné).
- **Negatív kontroll a TÖRTÉNETI hibára** („Másik kártyával fizetek" a `nincs_kartya` ágon).
  ⭐ **Ez élesben is dolgozott:** amikor a ③ szabályt átírtam, az utó-feltétel kibuktatta, hogy a
  kontroll cserés alakja már **üresen futna** — némán semmit sem bizonyított volna. Injektálásra
  írtam át.

## Tudásbázis

- `kb/entries/admin-subscription/entry.hu.md` — **„Az automatikus kártyaterhelés elakadt — mit
  tegyek?"**: a két gomb szerepe (mikor melyiket), és mind a **hét** kimenet emberi nyelven, a
  **15 perc** türelmi idő és a **4** kísérlet indoklásával. + a zöld visszakapcsoló sáv
  kifizetett-időszak mondata és a számla-linkje.
- `kb/entries/admin-modules/entry.hu.md` — a fizetés-utáni **elutasítás**-ág (a „Nem történt
  terhelés." és a másolható hivatkozási azonosító) és az **„Ezt a fizetést nem találjuk"** lap,
  kimondva, hogy arról a hivatkozásról **nem tudjuk**, történt-e terhelés.
- ⚠️ **A KB-őr azonnal elkapott egy hibámat:** a számla-link feliratát **félkövéren** idéztem
  behelyettesített számlaszámmal (`CIT-2031-0042 megnyitása…`), ami a forrásban sablon — a
  §J.24 felirat-őr a nyers view-forráshoz méri a félkövér idézeteket. Átírva: félkövéren csak a
  valóban létező literál áll.
- 🔴 **NYITOTT:** a `payResultPage` / `payUnknownRefPage` a `console/views.ts`-ben él
  (**operátor**-korpusz), a cikk viszont **tenant** — ezért ezek a feliratok sima idézőjelben
  állnak, vagyis **drift-védelem nélkül**. A lapokat a FIZETŐ VEVŐ látja; hovatartozásuk
  eldöntendő (korpusz-bővítés vagy külön entry).

## Képek és fordítás

- `npx tsx scripts/kb-shot.mts` — **18** elavult kép frissült. A `console-duplicates` képe volt a
  bejelentett: az ADR-0178 `ghost`-javítása után is **három egyforma cián gombot** mutatott;
  most helyreállt a hierarchia (elsődleges kitöltött + két halvány). Megnéztem a képet.
- **KB-fordítás-kör lefuttatva** mind a **6** élő nyelvre (de, en, hr, it, pl, sk) — a két
  módosított cikk mind a hat nyelven elavult, és újragenerálódott. Végállapot: **19/19 friss
  minden nyelven.**
  ⚠️ **De az első kör NEM volt zöld, és ezt nem nyelem el:** 12 fordításból **kettő** (hr és pl
  `admin-subscription`) **integritás-sértés** miatt eldobódott (felirat/kép-útvonal/alcím-szám
  eltérés — NEM token-elvágás). Egyetlen újrafuttatás mindkettőt megoldotta, tehát a modell
  nemdeterminizmusa volt, nem a cikk szerkezete. **Amit ez jelent:** az `ensureKbTranslations`
  ilyenkor „missing"-nek számolja és a KÖVETKEZŐ trigger javítja — vagyis ha senki nem futtatja
  újra, az adott nyelv tulaja **a RÉGI súgót kapja**, az új szakasz nélkül, és erről semmi nem
  szól hangosan. A `kb-freshness` napi söprés a képekre néz, a fordítás-lefedettségre nem.

## Módosított fájlok

- `src/server/adminViews.ts` · `src/server/public.ts` · `public/assets/ui/citui-admin.css`
- `scripts/charge-retry-note-check.mts` (új) · `hooks/pre-commit`
- `kb/entries/admin-subscription/entry.hu.md` · `kb/entries/admin-modules/entry.hu.md`
- 18 `kb/entries/*/assets/hu/*.png` · `src/i18n/catalog.json`
- `_planning/DECISIONS.md` (ADR-0182) · `MEMORY.md` · `_planning/memory/INDEX.md`

## Nyitott kérdések

1. 🔴 A pay-lapok felirat-drift védelme (lásd fent) — korpusz-kérdés, nem szövegezés.
2. A `§2b` kivételt a tulaj adta, mért számokkal és a javítás pontos alakjával kérdezve — a
   token naplózva. A kör **nem élesít**; a kapu-verdiktet **nem adtam meg magamnak**
   (`node scripts/kb-gate.mjs pass …` NEM futott), azt egy friss, független őr ítéli meg.

---

## ⛔ UTÓIRAT — a független tudásbázis-őr FLAG-et adott, és igaza volt (ADR-0183)

A három eredeti hiányt pótoltnak mérte, **de a `kb-shot`-köröm ÚJ RÉST nyitott**, és az
blokkolta az élesítést. Ez a kör legfontosabb tanulsága, mert **a saját javításom rontott el
valamit, és minden kapum zöld maradt**.

### ① A fő baj: kiürítettem egy súgó-képet

`kb/entries/console-leads/assets/hu/legend.png`: **640×2020 / 305 kB → 640×126 / 12 kB** (mérve,
a köröm előtti állapothoz hasonlítva). A kép a **csukott** `details` fejléc-sávját mutatta,
miközben a képaláírás „a jelmagyarázat **kinyitva**"-t ígér, a bekezdés pedig azt, hogy
számítógépen nyitva fogad. **A teljes oszlop-magyarázat némán kiesett a súgóból.**

Az ok **két rétegű**, és külön-külön ártalmatlannak látszott:
- **(a)** a felvétel a SZERVER HTML-jében cserélt sztringet
  (`<details class="con-legend">` → `… open`), a nézet viszont ma
  `<details class="con-legend" id="leadLegend" open>`-t ad → a csere **NO-OP** volt, némán;
- **(b)** és ha illeszkedett volna, sem ér semmit: a lap `syncOpen()`-je **700 px alatt leszedi**
  az `open`-t, a felvétel meg **390 px**-en készül. Vagyis a szerver-oldali HTML-babrálás
  **elvileg sem** tudta megoldani.

**Javítás:** a nyitás a **DOM-on, a lap-szkript lefutása UTÁN** történik (`forceOpen`), és ha a
szelektor nem talál, a szkript **hangosan dob** — a néma kihagyás volt maga a hiba.
Újrafuttatva a kép **640×2448** (magasabb az eredetinél, mert a nézet azóta új sorokat kapott),
és **megnéztem a szememmel**: a jelmagyarázat nyitva, a teljes oszlop-listával.

### ② A súgó szerkezeti állítása fordítva volt

A cikk a pirula és a cím **sorrendjét** fordítva írta le, és a blokkot az Előfizetés-kártya
„**alatt**"-ra tette. Mérve: a DOM-ban a **pirula van előbb**, és a blokk a kártyán **BELÜL**,
a **42–90 %-a** között ül. ⚠️ A „kártya alsó részén"-t sem vettem át vakon: külön megmértem
390 és 1280 px-en, és a mondat a mért arányt tükrözi.
**Mostantól őrzött:** `charge-retry-note-check` ⑥a (sorrend) és ⑥b (tartalmazás) — mindkettőnek
saját piros próbája van.

### ③ Az ép-őr (ADR-0183)

A `kb-shot` minden felvételt összevet az ELŐZŐ képpel, és a **nagyságrendi esés PIROS**.
⛔ Azért a generátorban: **sem a `kb-check`, sem a `kb-freshness` nem nézi, VAN-E TARTALOM a
képen**. A megkerülhetetlenség **szerkezeti**: minden felvétel egyetlen úton (`snap()`) megy ki,
és az önteszt a szkript **saját forrását** méri (pontosan 1 `screenshot()` hívóhely, a `snap()`-en
belül) — ezt élesben is pirosra vittem egy szándékosan beszúrt megkerülő úttal.
Önteszt: 7 eset, 2 piros (köztük a valódi 2020 → 126), és **pozitív kontroll** is, hogy a jogos
rövidülés átmenjen — különben egy mindig-igaz predikátum is zöldnek látszana.

### Amit ez tanít

**Egy generátor, ami nem méri, amit előállított, csendben tud kárt okozni** — és a köré épített
kapuk (`kb-check`, `kb-freshness`) mind zöldek maradhatnak, mert MÁS kérdésre válaszolnak.
Ugyanaz az osztály, mint a `feedback_label_answers_a_different_question`, csak képen.
⚠️ És: **a saját javító-körömet is meg kell mérni**, nem csak azt, amit javítani küldtek. A 18
újragenerált képből egyet sem néztem meg a szememmel — csak azt az egyet, amiért a kör indult.

🔵 **Elhalasztva (az őr szerint nem blokkoló):** a `payResultPage`/`payUnknownRefPage`
felirat-drift kérdése — a feliratok ma pontosak, a korpusz-döntés külön kör.
