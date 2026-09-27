# 2026-09-28 — Telefonos menü, és a foglalás-sáv csak félúton (B) — ADR-XXXX

**Szál:** „Mock-sablonok körképe → B megvalósítás” (`~/wt/citde23c1a2`, koordinátor: `citfd41ef18`).
**Státusz:** megvalósítva, NEM élesítve (a nagy deployjal megy).

## Honnan
A tulaj a Lidó Wellness és Bor Villa élő oldalán (390 px): dupla „Foglalás” (fent + lent), nincs mobil menü, és a
**folyam-csapda** — napválasztás után a végig ott maradó alsó „FOGLALÁS” gombbal akart beküldeni (az csak visszaugrik).
1. kör: körkép 19 sablonon (`~/rc-briefs/mock-chrome-audit-REPORT.md`): 16/19 menü nélkül, 14/19-en a sáv az űrlapnál.
   Gyökérok: ADR-0237 ①–② (tegnapi) + 16 sablon-másolat.
2. kör: §2b A/B/C működő mock (`~/rc-briefs/mock-chrome-variants-REPORT.md`) → a tulaj a **B**-t választotta,
   kikötés: „amint elérjük a foglalási részt, tűnjön el ez a sáv”.

## Mit csináltam
- **Közös réteg, egy hely:** `assets/runtime/cit-runtime.js` `initPhoneChrome()` + `assets/runtime/cit-modules.css`
  „Phone chrome” blokk. A runtime MÉRI, melyik foglalás-gomb ül ragadó elemen (resize-ra újra), és a blokknál
  `.cit-away`-t tesz rá (ragadó dokknál az egész dokkra); a `[data-cit-mobbar]` sáv csak a hero után
  (`cit-mobbar--on`), ha a hero-nak nincs saját gombja, az első képernyőtől; asztalon `display:none`. Menü-gomb +
  lenyíló lista a lap saját linkjeiből (`.cit-mast-links` / `[data-cit-navsrc]`), utolsó sor a sablon CTA-ja; Esc,
  kívül, menüpont zár; `tr("Menü")`, `tr("Menü bezárása")`; ikon a `src/ui/icons.ts` „menu” rajza.
- **Sablonok:** 16 sáv `data-cit-mobbar`; `data-cit-navsrc` (card-sidebar, tilted-gallery); `data-cit-ownnav`
  (arch-frames, wordmark-grow, editorial — a működő link-soruk marad, menü-gomb nincs).
- **Mellékes javítások:** dark-luxury lábléc-név (397–400 px → 390), arch-frames fejléc-rács (423–454 → 390, hosszú
  név), card-sidebar `.layout` + oldalkártya-űrlap (444/420 → 390), cinematic görgetett fejléc név-ellipszis, a
  foglalási kártya dupla „Foglalás” címe, tilted-gallery body-padding csak ≤700 px.
- **Előzetes hiba a mainen:** a `cit-modules.css`-ben egy árva `}` + félrecsúszott két szabály miatt a lap utolsó
  `@media` blokkja nyitva maradt → minden mögé fűzött szabály némán „csak telefon ≤559 px” lett (így buktam rá:
  asztalon látszott a menü-gomb). Árva `}` ki, blokk lezárva; a két szabály helyben, a mai hatásával.
- **Őr:** `scripts/mobile-chrome-check.mts` (pre-commit, `--selftest` + gate). 19 × (mock foglalással + live
  érdeklődő űrlappal) × (390 mobil + 1440); ≤40 px lépés a blokkon üres ÉS kitöltött űrlappal; menü; `innerWidth`;
  JS-hiba. Önteszt: 7 beültetett hiba mind piros, 2 tiszta lap zöld. **Negatív kontroll:** a mai main (88fd0011)
  kódjával renderelt 38 lap → 76 lap-nézetből 59 bukik (mobilon 36/38-on ragadó CTA a blokknál, asztalon 21/38).
- **Idegen őr átállítva:** `guest-mobile-check` ⑤sáv-felirat a sáv KIRAJZOLÁSÁT nézi (display), nem a
  pillanatnyi láthatóságát — különben némán kiürült volna (önteszt zöld, gate 0 HIBA).
- Kontraktus: `assets/design-refs/tenant-site/mobile-chrome-B/` (plan.html + README + képek); `contract-drift-check`
  zöld (8 horgony + 2 kötő felirat). DOMAIN: `06-UI-CONTRACT.md`; `docs/design-brief-external(.en).md` kiegészítve.

- **Két idegen kapu a commitnál:** ① `prospect-framing-check` — a kiküldött mock tetején álló keretező sáv fölé
  festett a fix menü-gomb → a gomb a `[data-cit-framing]` sáv alatt vár, amíg az látszik (`--cit-pmenu-top`), a
  nyitott menü kitöltése ehhez igazodik; ② `lead-mobile-check` önteszt — az „overflow” visszarontás az R4-et
  (pirula) is elbuktatta: a 469×1013-as layout-nézetben a fix alsó pirula y=851-en a látható részen kívül esik
  (a mainen a hero-n is kint álló sáv emelte fölé, vagyis VÉLETLENÜL takarta a hibát). Mérve a main fán is
  (a pirula ott is 851-en, koppintás a hero-ra esik). Az önteszt izolációs feltevése indoklással igazítva; a
  szabály a tiszta lapon változatlan és zöld.

## Tanulság
- **Egy sheet végére fűzni veszélyes**, ha a sheet utolsó blokkja nyitva maradt: a böngésző némán lezárja, a hiba
  láthatatlan, amíg valaki mögé nem ír. A zárójel-egyensúlyt kommentek/sztringek NÉLKÜL, mélység-követéssel mérd
  (a nyers `{`/`}` szám egyezett, mert egy árva `}` korábban kiegyenlítette).
- **Az őröm önteszte megfogott egy modell-hibát:** a „sáv marad” beültetett hibát a runtime második védelme
  (`cit-away` a sáv gombján) még elrejtette — a beültetett hibának MINDEN védelmet ki kell ütnie, hogy a régi
  viselkedést modellezze.
- A mérő-lapot célonként újra kell nyitni: a menüpont `#fragment`-je a következő `setContent`-nél odaugratta a lapot.
- A tenant-hoszton a sima görgetés (`scroll-behavior:smooth`) 900 ms-nál még úton van — az első mérés „hibát”
  mutatott; 3 s-mal igazolt.

## Nyitott
- A két félrecsúszott vélemény-űrlap szabály (`.cit-rev-f__consent`) helye — ma minden szélességen hat.
- A tilted-gallery fekvő hero-alja (`max-height:500px`) még a megszűnt sáv 70 px-ét tartja szabadon.
- A Lidó `/t/…` pillanatképe a régi kóddal renderelt (a friss render tenant-hoszton igazolva); újrarender:
  `scripts/rerender-tenant.mts lido-wellness-es-bor-villa` (a közös `sites/`-t és a multilang-állapotot írja — nem futtattam).
- arch-frames / wordmark-grow intro-animációja programozott görgetésnél áttetszően rajta marad a képen (mérési
  jelenség, a körképben is így volt; valódi kattintással rendben).
