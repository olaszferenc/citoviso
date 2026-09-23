# Kontraktus — TÖBB TERV egy követett linken: tervváltó (jóváhagyva 2026-09-23)

Tulaj-döntés négy körben (`plan.html` = a 4. kör, **működő** terv, méret-váltóval és a „Mai” sáv
összevetésével). A változatok közül az **A — a tervváltó a keretező sávban** győzött; a B (külön csík)
és a C (választó-kártyák a sáv alatt) elvetve, mert több helyet visznek el a nyitóképből.

Tulajdonosi megfogalmazás, szó szerint:

> „arra figyeljünk hogy a felső sáv ne legyen túl vastag, mert akkor elveszi a WOW hatást és arra
> koncentrál a lead.”
>
> „csak nem elég látványos, hogy több opció van...”

**Miért kell:** a kurátor egy futásban sok tervet generál egy leadnek (Villa Suzy: 19 terv, 2026-09-21),
és ma **egyet** küldünk ki, a többit eldobjuk — pedig a generálás költsége már kifizetve. A lead a saját
linkjén válthasson a kurátor által kiengedett tervek között; a „több opciója van” élmény a megkeresés
horga.

⛔ **KIADÁS:** ez a fejlesztés a `feat/multimocktabs` ágon él, és **a pilot elindulása UTÁN** megy élesre
(tulajdonosi döntés, 2026-09-23). A `land.sh` erre az ágra NEM fut; a main és a prod érintetlen.

Képek: `plan-mobil.jpg` (390 px) · `plan-asztali.jpg` (1440 px) · `plan-mobil-lap-alja.jpg` ·
`plan-asztali-lap-alja.jpg` · `plan-mobil-felvillanas.jpg` (a figyelemfelhívás csúcsa) ·
`plan-mobil-2-terv.jpg` (váltás után).

---

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

### A. Mikor jelenik meg

1. **Csak ha a kurátor legalább 2 tervet engedett ki ugyanahhoz a követett linkhez; legfeljebb 3-at.**
   Egy tervnél a lapon semmi nem változik (lásd „Eldöntve”).
2. **Az 1. terv a jóváhagyott (elsődleges) mock.** A levél és az MMS képe továbbra is EZÉ; a többi terv
   csak a linken látszik. A mai „egy leaden egy jóváhagyott mock” invariáns (`curateArtifact`,
   migráció 0064) **megmarad** — a többi terv a prospecthez rendelt *alternatíva*, nem második `approved`.

### B. A felső sáv (a keretezési kontraktus `../framing/` kiegészítése)

3. **VÉKONY.** Mérve: mobil (390 px) **116 px** (a mai sáv 107 px, tervváltó nélkül); asztali 1280 px-en
   **44 px, egy sorban** (a mai 87 px). Keskenyebb asztalon két sorba törhet — ez elfogadott, de a
   magassági keret nem nőhet a mérés fölé.
4. **A három állítás és a „Miért kaptam?” EGY folyó szövegben**; a „Miért kaptam?” a szöveg végén áll.
   Továbbra is natív `<details>` — **JS nélkül is nyílik**, és a kinyitott rész viszi az Adatkezelési
   tájékoztató és a Leiratkozás linkjét (framing §4–§5).
   ⛔ A `<details>` NEM kerülhet `<p>`-be: a HTML-elemző a `<p>`-t lezárja előtte, és a „Miért kaptam?”
   kiesik a sorból (mérve, 2026-09-23).
5. **A jogi mondatok EGY forrásból** — ugyanazok a `prospectNotice.ts` konstansok (`LEGAL_BASIS`,
   `TRACKING_NOTICE`) töltik a kinyitható részt és a lap alji láblécet (framing §6).
6. **A sáv NEM ragad (nem sticky), a lap tetején, a folyamban** marad (framing §2). Tulajdonosi kérdésre
   2026-09-23-án kimondva, miért nem: mobilon a sáv + a sablon foglalás-sávja + a rendelés-gomb a
   képernyő ~negyedét folyamatosan elfoglalná, és több sablon saját ragadós fejléce ütközne vele.

### C. A tervváltó

7. **Felirat:** „**Három tervet** készítettünk:” — a szám a kiengedett tervek számából jön
   („Két tervet …” két tervnél). ⛔ Nem égethető be.
8. **Képes gombok:** minden terv gombja a **saját nyitóképének kicsinyített mása** (élesben a tervenként
   már elkészülő nyitókép-fotó, ugyanaz, ami a levélbe megy — nem új gyártás), rajta a **sorszám**.
   A terveknek NINCS nevük, csak sorszámuk (tulajdonosi döntés). Mobilon 60×40, asztalon 52×32 px.
9. **Az aktuális terv jelölt** (cián keret, `aria-current="page"`); minden gomb `aria-label="N. terv"`.
10. **A gombok SIMA LINKEK** (`/p/<token>/v/<n>`) — JS nélkül is váltanak.
11. **A váltás teljes oldalbetöltés, saját címre.** A sablonok CSS-e egymásra rakva szétesne, ezért nincs
    kliens-oldali csere. Az új terv a lap tetején kezdődik.

### D. A figyelemfelhívás (felvillanás)

12. A nem-aktuális gombok **kétszer** megemelkednek és felragyognak — **legfeljebb 3-szor egy látogatás
    (munkamenet) alatt**, és csak két pillanatban: **az első megnyitáskor** (~2,5 mp után) és **amikor a
    lead lentről visszagörget a lap tetejére**.
13. **Tervváltás után NEM indul magától**, és a váltást követő ugrás a lap tetejére nem számít
    „visszagörgetésnek”.
14. ⛔ **Soha nem végtelen.** A rendelés-gomb (`cit-cfg-launch`) már végtelenül pulzál; egy második
    állandó mozgás a vásárlásról vinné el a figyelmet, reklám-érzetet keltene, és a WCAG 2.2.2-t
    (5 mp-nél hosszabb, magától induló mozgás) sértené. `prefers-reduced-motion` mellett csak egy
    statikus cián keret.

### E. A lap alji tervváltó

15. **A terv végén, a jogi lábléc FÖLÖTT** egy blokk: „**Tetszett?** Nézze meg a másik kettőt is.”
    (két tervnél: „… a másikat is.”). A lábléc marad a lap legalja (framing §6, ADR-0112).
16. **Csak a TÖBBI tervet kínálja**, az épp nézettet soha. Kártyánként: a terv nyitókép-előnézete,
    „N. terv”, „Megnézem →”. Mobilon két oszlop, asztalon két nagy kártya.
17. Az alcím helyes névelővel: „Ez volt **az** 1. terv / **a** 2. terv / **a** 3. terv a háromból …”.
    ⛔ Nem „a(z)”.
18. **Skin-független** (a keretező sáv semleges színei), a folyamban, semmit nem takar.

### F. Rendelés

19. **A rendelés-gomb és a konfigurátor az ÉPP NÉZETT tervre vonatkozik** — a panel kimondja („Ezt a
    tervet rendeli meg: N. terv”), és a rendelés ehhez az artefaktumhoz kötődik. A fizetési kapu
    (`payment/service.ts`, `provision.ts`, `sendBatch.ts`) ma `status === 'approved'`-ot követel: egy
    alternatíva megrendelésekor az alternatívát kell elsődlegessé tenni **egy tranzakcióban**, különben a
    fizetni akaró vevőt a kapu elutasítja (`feedback_gate_must_not_refuse_the_paying_customer`).
20. ⚠️ **A rendelés-gomb ütközés-kerülése** (`cit-configurator.js` `blockingRects`) a kitöltött/keretes
    ≥100×32 elemek elől fölfelé tér ki — a lap alji kártyák ilyenek. A gomb nem menekülhet a blokk
    fölé, és nem takarhatja a lábléc linkjeit.

### G. Mérés

21. A megtekintés és az események **tervhez kötve** rögzülnek (melyik tervet nézte, melyikről váltott,
    melyikből rendelt) — enélkül nem tudjuk meg, hogy a több terv emeli-e a konverziót.

### H. Általános

22. Minden vevő-oldali felirat `T()` / `tr()` mögött (i18n-doktrína); nincs emoji, az ikonok inline SVG-k.

---

## Eldöntve (2026-09-23)

- **Az egy-tervű lap NEM változik:** a mai (2026-09-14-es) keretező sávot kapja. A vékony sáv CSAK a
  több-tervű lapé. ⛔ Egy tervnél semmi nem jelenhet meg ebből a kontraktusból.

## A megkeresés szövege több tervnél (jóváhagyva 2026-09-23)

A szöveg a kiküldött tervek számából **dinamikusan** születik (N = 2 vagy 3); **egy tervnél a mai szöveg
marad, betűre**. Minden mondat `T()` mögött.

- **Tárgy:** „{név} – N honlap-terv” (számjeggyel). Mérve 598 lead nevén, ~38 karakteres mobilos
  Gmail-előnézettel: „3 honlap-terv” 82%-nál fér ki (a mai „honlap-terv” 87%, a „három honlap-terv” 68%).
- **p1:** „Ezért készítettünk három honlap-tervet, háromféle kinézettel. Előzetes látványtervek az Önről
  nyilvánosan elérhető adatokból: nem kész oldalak, és semmire nem kötelezik.” (két tervnél: két / kétféle)
- **p2:** „A linken mindhármat megnézheti, és egy kattintással válthat köztük. Ki is próbálhatja:
  beállíthatja, mi kerüljön az oldalra, és rögtön látja az árát.” (két tervnél: mindkettőt)
- **Képaláírás (új):** „A képen az első terv látható — a másik kettőt a linken találja.” (két tervnél: a
  másikat) — a levélben EGY kép megy, ezért a levél nem ígérhet mást, mint amit a link ad (§I).
- **p4:** „Ha valamelyik tetszik, élesítjük. …”
- **Önálló SMS:** „{név} – három honlap-látványtervet is készítettünk Önnek, amelyeket most élőben megnézhet
  és kipróbálhat kötelezettségmentesen! A Citoviso Csapata” + link. (két tervnél: két)
- **Az MMS utáni SMS:** „{név} – az imént küldött terv mellé még kettőt készítettünk: mindhármat élőben
  megnézheti és kipróbálhatja kötelezettségmentesen! A Citoviso Csapata” + link. (két tervnél: még egyet /
  mindkettőt). Mérve: 598 névből 16 lesz 5 részes (ma 1); a hosszabb, „MMS-ben küldött” forma 50-et adott.
- Az MMS képe és tárgya NEM változik (az 1. terv, a jóváhagyott).

## Következő lépés

- Az őr: a `scripts/prospect-framing-check.mts` bővítése (sávmagasság-keret, `<details>` a sorban és JS
  nélkül, a gombok linkek, a lap alji blokk a lábléc fölött és nem a nézett tervet kínálja, a felvillanás
  véges) — piros önteszttel.
