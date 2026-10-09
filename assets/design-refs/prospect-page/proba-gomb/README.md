# „14 nap ingyen” — az ingyenes próba belépője a lead-lapon (JÓVÁHAGYOTT TERV, 2026-10-09)

A tulaj döntése a §2b terv-körben (2026-10-09, a koordinátoron át, szó szerint): B a legjobb, ahol a két
pirula egyben van. Az A (keretező sáv a lap tetején) és a C (kártya az Árak előtt) elvetve.
Háttér: ADR-0342 (kártya nélküli próba, `src/trial/start.ts` `startTrial`, `src/trial/config.ts`
`getFreeTrialConfig`), mért alap: `_planning/RESEARCH-2026-10-valos-oldal-eroforrasigeny.md` §4 — 55-ből
55 megnyitó hozzá sem ért a rendelés-panelhez; a próba belépője a panel ELŐTT kínál utat.

Kattintható terv: `plan.html` (önhordó; méret-váltó, próba-hossz 7/14/30, szerver-válasz siker/hiba,
i18n-jelölő; a mérés-napló élőben mutatja a kiváltott eseményeket). A lap a valódi Laguna Panzió dev-mock
kivonata (hős, szöveg, fotók).

**Hatókör (a kód landolásakor töltendő ki):** `assets/runtime/cit-configurator.js` ·
`assets/runtime/cit-configurator.css` — és ahol a próba-űrlap él.

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Pirula-pár.** A jóváhagyott „Itt rendelheti meg” pirula (ADR-0242, `../order-pill/`) MELLÉ, ugyanabba a
   rögzített rétegbe kerül a „{n} nap ingyen” pirula — EGY egységként, egymás mellett, egy sorban
   (`white-space: nowrap`; 390 px-en is egy sor, mérve). Sorrend: bal = próba, jobb = rendelés.
   Telefonon (≤ 560 px) a pár a teljes szélességet kitölti (széleken 12 px), asztalon középen áll.
2. **Szín.** A rendelés-pirula változatlan (platform-cián, ADR-0242 ③ szabálya a lila-cserével együtt).
   A próba-pirula navy (`--citui-navy-900`), fehér felirat, cián ajándék-ikon (`src/ui/icons.ts`-be
   kerülő saját SVG; emoji tilos), fehér perem. A két pirula soha nem azonos színű.
3. **Mindig kint van**, pontosan a rendelés-pirula szabályaival (ADR-0242 ②): betöltéskor beúszik,
   a rendelő-panel nyitva tartása alatt rejtve, lecsukás/bezárás után visszajön.
4. **Kikerülés (ADR-0242 ④ kiterjesztve a PÁRRA):** a pár alsó éle a legfelső rögzített alsó réteg
   (Foglalás-sáv, süti-sáv) fölött 10 px-szel ül. Ha a lappal együtt mozgó fő gomb kerülne a PÁR
   bármelyik tagja alá, a pár EGYÜTT vált (telefon: a pár egy egység, ezért ha az oldalváltás nem
   szabadítja fel, a pár feljebb lép; asztal: közép → jobb → bal → feljebb). A pár sosem szakad szét,
   és a fő gombot sosem temeti be. Őr: a `lead-mobile-check` R8 és a `lead-page-surface-check` ②
   a PÁR mindkét tagját méri.
5. **Kikapcsolt próba** (`getFreeTrialConfig().enabled === false`): a próba-pirula NEM jelenik meg,
   a rendelés-pirula a régi, egyedüli helyén áll — a lap pontosan olyan, mint a próba előtt.
   Már vásárolt lead (owned) és már futó/elhasznált próba (`trial_used`) esetén szintén nincs próba-pirula.
6. **A napszám a beállításból jön** (`getFreeTrialConfig().days`), MINDEN feliratban ({n}) — a pirulán,
   az űrlap címében, a tényekben, a gombon. Beégetett „14” sehol.
7. **Az űrlap** (telefonon alsó lap, asztalon középre nyíló ablak): cím „Próbálja ki {n} napig ingyen”,
   a próba címe (`<címke>.citoviso.com`), majd a tények — CSAK ami igaz (§B.17):
   nem kell bankkártya, nincs előre fizetés · {n} napig minden funkció · saját kezelőfelület ·
   a keresőknek szóló alapok (szálláshely-adatok, oldaltérkép, HTTPS — és SEMMI más Google-ígéret,
   lásd koordinátor-brief §5) · a {n}. nap után az oldal szünetel, nem terhelünk, az adat megmarad ·
   saját domain a próbában nincs, megrendeléskor választható.
8. **Mezők és szabályok** = a `POST /p/:token/trial` szerződése: név (≥ 2 karakter, szóközök
   összevonva), e-mail (kisbetűsítve, `EMAIL_RE` mint `src/tenant/contact.ts`), telefon
   (`PHONE_NORM_JS` kliens-tükör, mező-elhagyáskor `+36 30 123 4567` alakra írja), ÁSZF-pipa,
   **fotó-nyilatkozat pipa** (a `PHOTO_RIGHTS_DECLARATION_V1` szó szerinti
   szövegével, külön pipa). ⚠️ A fotó-nyilatkozat a tulajnak mutatott B-ben NEM volt benne; a
   befagyasztáskor került be, mert az ADR-0342 végpontja kötelezőnek veszi (§A, mint a fizetős
   checkoutnál). A hibaüzenet a mező alatt jelenik meg, az első hibás mező kap fókuszt.
9. **⛔ Mező-elhagyáskor nincs hibaüzenet, ha a fókusz a Küldés gombra megy** (`relatedTarget`).
   Mérve 390 px-en: a megjelenő üzenet a lenyomás és a felengedés között lejjebb tolta a gombot,
   és a koppintás elveszett. A küldés úgyis minden mezőt ellenőriz.
10. **Állapotok:** küldés alatt a gomb tiltva, pörgő jel + „Indítjuk a próbát…”, a mezők tiltva;
    szerverhiba → üzenet a gomb alatt, a beírt adat MEGMARAD; a szerver hibakódjait
    (`TrialError`: `invalid_*`, `terms_required`, `photo_rights_required` → a mező alá;
    `trial_used`, `already_owned`, `in_progress`, `disabled`, `market_not_approved`,
    `provision_failed` → saját mondat a gomb alatt) a lap fordítja szöveggé.
    Siker: „A hozzáférést elküldtük” + a cím, amire ment (`loginSentTo`), a próba vége
    (`trialUntil`), és a 3/1 napos figyelmeztetés ténye.
11. **Választás a kedvezmény helyett:** az űrlap alján egy sor kimondja, hogy a −25% bemutatkozó
    kedvezmény a megrendelésnél él, a próbával nem adódik össze, és egy link megnyitja a rendelő-panelt.
12. **i18n (§B.18):** minden vevő-oldali felirat — a JS-ben összerakott hiba- és állapot-mondatok is —
    `tr("…")`-rel, a napszám helyőrzővel (`tr("{n} nap ingyen").replace("{n}", …)`).

## Mérés (ADR-0333 mellé, saját esemény-család)

A próba-űrlap NEM a rendelő-panel — ezért nem `panel_open.via`, hanem:

| esemény | payload | mikor |
|---|---|---|
| `trial_open` | `{via:"sticky"}` | a „{n} nap ingyen” pirula megnyomása |
| `trial_invalid` | `{fields:[…]}` | küldés kliens-hibával |
| `trial_submit` | `{via}` | a kérés elmegy |
| `trial_send_failed` | `{status, error}` | szerverhiba / `TrialError` |
| `trial_close` | `{seconds}` | bezárás siker nélkül |
| `panel_open` | `{via:"trial"}` | ÚJ via-érték: az űrlap alján lévő linkről nyitott rendelő-panel |

A siker rekordja a szerver `trial_start` eseménye (`src/trial/start.ts`, a látogatásra kötve) — a kliens
nem ír külön sikert, hogy ne legyen kétszer számolva. A `/report` Rendelés-panel füle a `trial` via-t
saját chipként kapja (`PANEL_VIAS`).

## Képek

`plan-mobil-belepo.jpg` · `plan-mobil-urlap.jpg` · `plan-mobil-hibak.jpg` · `plan-mobil-siker.jpg` ·
`plan-asztali-belepo.jpg` · `plan-asztali-urlap.jpg` · `plan-asztali-hibak.jpg` · `plan-asztali-siker.jpg`.
A mock végigkattintva 390 px-en és asztalon (hibás e-mail/telefon/név, pipák nélkül, küldés, szerverhiba,
siker, napszám-váltás): mind zöld, JS-hiba 0.

## Kötő feliratok (a kód landolásakor félkövér-idézetté válnak a contract-drift-checkhez)

„{n} nap ingyen” · „Itt rendelheti meg” · „Próbálja ki {n} napig ingyen” · „Elindítom a {n} napos próbát” ·
„A hozzáférést elküldtük” · „Nem kell bankkártya, nincs előre fizetés”
