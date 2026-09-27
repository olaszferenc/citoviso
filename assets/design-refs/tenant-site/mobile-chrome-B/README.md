# Telefonos fejléc · menü · foglalás-sáv — „B · menü fent, sáv csak félúton” (JÓVÁHAGYOTT kontraktus)

**Hatókör:** `assets/runtime/cit-runtime.js` · `assets/runtime/cit-modules.css`

**Tulaj döntése:** 2026-09-27. A három vázlatból (A: menü fent, alsó sáv sehol · B: menü fent, sáv csak félúton ·
C: a lenti sáv maga a menü) a **B**-t választotta („B tényleg jó … igen, indulhat”). Terv: `plan.html` (a Lidó
Wellness és Bor Villa valódi oldala; méret-váltó „Mobil 390px / Asztali”, az oldal egy valódi viewportban
— iframe — fut, mert fix sávokat és görgetés-figyelőt mutat). Képek: `shots/terv-mobil.png`, `shots/terv-asztal.png`.
Döntés: ADR-XXXX (felülírja az ADR-0237 ①–② pontját).

**Miért:** a tulaj a Lidó oldalán „Foglalás”-ra kattintott, napot választott, és a végig ott maradó alsó
„FOGLALÁS” gombbal akarta véglegesíteni — az csak visszaugrik a blokk tetejére, a valódi beküldő gomb lejjebb volt.
Mérve 19 sablonon (2026-09-27): 14-en ott állt a ragadó sáv az űrlapnál, 16-on nem volt telefonos menü.

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. A tulaj szabálya, szó szerint: „amint elérjük a foglalási részt, tűnjön el ez a sáv”. **Amíg a foglalási blokkból
   (`#cit-booking`) — foglalás-modul nélkül az érdeklődő űrlapból (`#cit-enquiry`) — BÁRMENNYI a képernyőn van,
   semmilyen ragadó foglalás-gomb nem látszik: se a telefonos alsó sáv, se egy ragadó fejléc CTA-ja, se egy ragadó
   dokk — **telefonon ÉS asztalon**. Ott az egyetlen foglalás-gomb a blokk saját beküldő gombja.
2. **Az alsó sáv csak félúton él:** a hero UTÁN csúszik be, a foglalási blokknál eltűnik (a blokk után, a láblécnél
   visszajöhet). Ahol a hero-nak NINCS saját foglalás-gombja (card-sidebar, tilted-gallery), a sáv az első
   képernyőtől ott van — egyszerre egy foglalás-gomb, de az első képernyő sem maradhat nélküle (megvalósítási
   pontosítás, 2026-09-27). Nyitott menü mellett rejtve. **JS nélkül nincs sáv** (a hero gombja és a blokk ott vannak).
3. **Asztalon nincs alsó sáv** (egy sablonon sem — a tilted-gallery sávja is csak telefonon él).
4. **Telefonos menü:** ahol a sablonnak nincs telefonon működő navigációja, jobb felül kerek menü-gomb
   (**„Menü”** felirat a képernyőolvasónak; nyitva **„Menü bezárása”**). Lenyíló lista a lap SAJÁT szekció-linkjeiből
   (ugyanaz a készlet és felirat, mint az asztali fejlécben), utolsó sorként a sablon saját foglalás-gombja kiemelve.
   Bezárja: a gomb újra, az **Esc**, a menün kívüli koppintás, és a menüpont. **A menüpont a ragadó sáv ALÁ ugrik**,
   nem mögé (`scroll-margin-top: --cit-stick`).
5. **Telefonon a görgetett (ragadó) fejlécben nincs foglalás-gomb** — a foglalás a hero gombja, a félúton érkező sáv
   és a menü utolsó sora. A név nem fut a menü-gomb alá.
6. **A saját telefonos navigációt viselő sablonok** (arch-frames, wordmark-grow: ragadó link-sor; editorial: görgethető
   link-csík) NEM kapnak menü-gombot; a fejlécük foglalás-gombja a foglalási blokknál ott is eltűnik (1. pont).
7. Egy hely: a viselkedés a közös runtime-ban él (`initPhoneChrome`), a sablonok csak jelölnek. Feliratok `tr()`-rel,
   színek csak `--cit-*` tokenből, ikon a közös készlet „menu” / „close” rajza.

## Kötő horgony
- `initPhoneChrome`
- `data-cit-mobbar`
- `cit-mobbar--on`
- `cit-away`
- `data-cit-topcta`
- `cit-pmenu-btn`
- `data-cit-navsrc`
- `data-cit-ownnav`

## Amit a terv NEM enged
- ⛔ ragadó foglalás-gomb a képernyőn, miközben a foglalási/érdeklődő blokk látszik (bármelyik nézetben);
- ⛔ alsó foglalás-sáv az első képernyőn (hero) vagy asztalon;
- ⛔ telefonos lap navigáció nélkül.

## Az őr
`scripts/mobile-chrome-check.mts` — mind a 19 sablon × (foglalási mock + foglalás-modul nélküli érdeklődő lap) ×
(390 mobil + 1440 asztal); a blokkon ≤ 40 px lépésben végiggörget ÜRES és KITÖLTÖTT űrlappal; méri a menüt
(nyit · Esc · kívül · menüpont + ugrás), a JS-hibát és az `innerWidth`-et. `--selftest`: beültetett hibák → piros.
Negatív kontroll: a javítás előtti render (a 2026-09-27-i main) elbukik rajta.
