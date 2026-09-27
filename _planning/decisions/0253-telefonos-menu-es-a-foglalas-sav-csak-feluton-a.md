## ADR-0253 — Telefonos menü, és a foglalás-sáv csak félúton: a foglalási blokknál semmilyen ragadó foglalás-gomb (felülírja az ADR-0237 ①–②-t)

**Dátum:** 2026-09-27 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy) · **Szál:** „Mock-sablonok körképe → B megvalósítás”
**Kontraktus:** `assets/design-refs/tenant-site/mobile-chrome-B/` · **Őr:** `scripts/mobile-chrome-check.mts`

### Kontextus

A tulaj a Lidó Wellness és Bor Villa élő oldalán (390 px) három hibát jelentett: ① dupla foglalás-CTA (fent a
fejlécben és lent a ragadó sávban), ② nincs menü telefonon, ③ **folyam-csapda:** a „Foglalás”-ra kattintva a
foglalási blokkhoz ugrott, kitöltötte, és a végig ott maradó alsó „FOGLALÁS” gombbal akarta véglegesíteni — az
csak visszaugrik a blokk tetejére (mérve: 432–746 px), a valódi „Foglalási kérés elküldése” lejjebb volt.

Körkép 19 sablonon (2026-09-27, `~/rc-briefs/mock-chrome-audit-REPORT.md`): **16/19-en nincs telefonos menü**
(se link, se hamburger), **14/19-en a ragadó sáv az űrlapnál is látszik**, 4 sablonon fent és lent is „FOGLALÁS”.
A gyökérok egy TEGNAPI döntés: az ADR-0237 ① szerint ahol a sablon telefonon ragadó Foglalás-sávot visel, a
fejléc link-sávja elmarad („a CTA a sávban él”), ② szerint minden masthead-es sablon ilyen sávot visel. Ez a
menüt vitte el, és a sávot az űrlap fölé tette. A sáv viselkedése 16 sablonban másolatként élt.

A §2b szerint három működő vázlat ment a tulajnak (A: menü fent, alsó sáv sehol · B: menü fent, sáv csak félúton ·
C: a lenti sáv maga a menü). **A tulaj a B-t választotta** („B tényleg jó … igen, indulhat”), és kikötötte:
„amint elérjük a foglalási részt, tűnjön el ez a sáv”.

### Döntés

1. **A foglalási blokknál nincs ragadó foglalás-gomb.** Amíg a `#cit-booking` (foglalás-modul nélkül: az
   érdeklődő űrlapot hordozó `#cit-enquiry`) bármennyi része a képernyőn van, se a telefonos alsó sáv, se egy
   ragadó fejléc CTA-ja, se egy ragadó dokk nem látszik — telefonon ÉS asztalon. Az egyetlen foglalás-gomb a
   blokk saját beküldő gombja. Mérve, nem deklarálva: a runtime maga keresi meg, melyik foglalás-gomb ül ragadó
   elemen (egy csak asztalon ragadó kártya, egy csak 700 px fölött ragadó dokk is), és újraméri átméretezéskor.
2. **Az alsó sáv csak félúton él** (felülírja az ADR-0237 ②-t, ami a sávot mindig kint tartotta): a hero után
   csúszik be, a foglalási blokknál eltűnik, nyitott menü mellett rejtve; JS nélkül nincs sáv. Asztalon egyik
   sablonon sincs alsó sáv (a tilted-gallery asztali sávja megszűnt).
3. **Telefonos menü** (felülírja az ADR-0237 ①-et, ami a link-sávot a sávért cserébe vitte el): ahol a sablonnak
   nincs telefonon működő navigációja, jobb felül kerek menü-gomb; a lista a lap SAJÁT szekció-linkjei (a masthead
   link-sávja, ill. a sablon `data-cit-navsrc` listája — ugyanaz a felirat, mint asztalon), utolsó sorként a sablon
   foglalás-gombja. Esc, kívül-koppintás és menüpont zárja; a menüpont a ragadó sáv ALÁ ugrik (`--cit-stick`).
   Telefonon a görgetett fejlécben nincs foglalás-gomb. A saját telefonos navot viselő sablonok (arch-frames,
   wordmark-grow, editorial — `data-cit-ownnav`) nem kapnak menü-gombot: ott a link-sor ma is működik, a
   közös megoldással nem ütközik; a fejlécük CTA-ja a blokknál ott is eltűnik.
4. **Egy hely.** A viselkedés a közös runtime-ban (`initPhoneChrome`, cit-runtime.js; CSS: cit-modules.css), a
   sablonok csak jelölnek: `data-cit-mobbar` (a sáv), `data-cit-navsrc` (a menü forrása, ha nem a masthead),
   `data-cit-ownnav`. Új sablon ugyanígy csak jelöl.
5. Az ADR-0237 ③–⑦ (egy szerkezetű sáv-felirat, Google-fotó méretek, transit, brutalism, őrök) változatlan; a
   masthead telefonos tömör alakja (①-ből a pirula és a 150 px-es plafon) marad.

### Mellékes javítások ugyanebben a körben (a tulaj „mehet”)
- **dark-luxury:** a lábléc márkaneve `nowrap` + 4 px betűközzel a rácsoszlopot 384 px-re feszítette → a telefon
  397–400 px-re szélesített, a sáv gombja levágódott. A lábléc-név tördel, a rács elemei `min-width:0`.
- **cinematic:** a görgetett fejlécben a név a gomb alá futott — a név egy soros, ellipszissel enged.
- **dupla „Foglalás” cím:** a foglalási szekció `<h2>`-je alatt a kártya saját címe megismételte; a kérés-kártya
  címe a szekcióban rejtve (a nyugta és az önálló kártyák megtartják).
- **cit-modules.css zárójel-hiba (előzetes, a mainen):** egy félrecsúszott töredék (két vélemény-űrlap szabály +
  árva `}`) miatt a lap UTOLSÓ `@media` blokkja nyitva maradt — a böngésző a fájl végén némán lezárta, így a
  hiba láthatatlan volt, amíg valaki mögé nem fűzött. Az árva `}` kikerült, a blokk lezárva; a két szabály a
  mai hatásával helyben maradt (áthelyezésük viselkedés-változás lenne — nyitott kérdés).

### Következmények
- A mock-fájlok STATIKUSAK: a meglévő mockok és tenant-pillanatképek a következő renderkor kapják meg (tenant:
  `scripts/rerender-tenant.mts`).
- A `guest-mobile-check` ⑤sáv-felirat szabálya a sávot mostantól a hero UTÁN méri (az első képernyőn nincs sáv).
- Élesítés nincs: a nagy deployjal megy.
