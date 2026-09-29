## ADR-XXXX — A kapu-futtató a leghosszabb kaput indítja először, tartós kapuidő-előzményből (`scripts/lib/gate-runner.mjs`) (2026-09-29)

- **Kiváltó (tulaj, 2026-09-29):** a koordinátor „A” és „B” javaslatára: *„Ok a és b”*. Brief:
  `~/rc-briefs/kapu-leghosszabb-eloszor.md`. Az „A” opció ez; a „B” (öt böngészős kapu belső
  párhuzamosítása) külön szál.
- **Előzmény:** ADR-0227 (párhuzamos kapu-futtatás), ADR-0230 (gépi slotok), ADR-0261 (indokolt
  önátfedés), a lassú-land vizsgálat (`_planning/memory/2026-09-29_lassu_land_vizsgalat.md`, ③ javaslat).

**A tény:** a futtató az ① fázis kapuit a HOOK SORRENDJÉBEN indította, 4 szálon. Ha egy 180 s-os kapu
(pl. `mobile-chrome-check`) a sor végén indul, a futás farka ennyivel nyúlik. A kapuidőket csak a
`CIT_GATE_TIMES` env esetén írta ki — tartós előzmény nem volt.

**Döntés:**
1. **Tartós előzmény.** Minden futás végén a TÉNYLEG lefutott kapuk ideje (zöld ÉS piros — a piros
   is ennyi ideig tartott) a `<git-common-dir>/cit-gate-history.json`-ba kerül, a kapu STABIL
   kulcsával: az argv (`npx tsx scripts/x.mts --selftest`). NEM a zöld-gyorsítótár aláírása, mert az
   minden diffnél változik. Érték: mozgóátlag, ½ új + ½ régi (egy zajos, terhelt futás nem billenti
   át a sorrendet), 0,1 s-ra kerekítve. A gyorsítótárból kihagyott és az ① fázisban eldobott (írni
   próbáló) futás nem számít — az utóbbinál a ② fázisbeli futás ideje kerül be.
2. **Írás több sessionből:** az írás előtt a fájl ÚJRA beolvasva, a saját kapuk frissítve, majd
   tmp + `rename` (atomikus csere). Két egyidejű író közül az utolsó nyer — ami így elveszhet, az egy
   futás mérése egy sorrendi tippben, nem ítélet. Hiányzó vagy sérült fájl = nincs előzmény, nem hiba;
   ha az írás elbukik, a futtató kiírja (⚠ sor), de nem bukik.
3. **Leghosszabb először — CSAK az ① fázis indítási sorrendje.** A sávba sorolás előtt a várakozó
   kapuk az előzmény szerint csökkenő sorrendbe kerülnek (stabil rendezés). **Az előzmény nélküli kapu
   ELÖL**: egy új kapu gyakran épp egy új böngészős kapu, és ha hátra kerülne, pont az a farok-hiba
   jönne vissza, amit ez javít; ha egy rövid kapu így egyszer elöl fut, az legfeljebb néhány
   másodperc. Előzmény nélkül a sorrend PONTOSAN a hooké (a stabil rendezés miatt) — a bevezetés
   napján semmi nem változik, amíg az első futás le nem írja az előzményt.
4. **Változatlan:** az önkizárás (és a `self-overlap-safe` kivétel), az író-sáv, a soros író-kapuk
   (hook-sorrendben), a gépi slotok, a zöld-gyorsítótár, a bukás utáni ütemezés-leállás. A kimenet
   szerződése sem változik: az ① fázis eredménye ma is a BEFEJEZÉS sorrendjében íródik ki (nem a
   hook-sorrendben), a bukások a `FAILED` fájlon át a hook `gate_failed` blokkjával. Az összegző sor
   új tagja: `leghosszabb-először (K/N kapunak volt előzménye)`.
5. **`CIT_GATE_HISTORY_FILE`** áthelyezi a fájlt (az őr fixture-je privátat használ — soha nem írja
   a valódit). A `CIT_GATE_JOBS`-hoz nem nyúltunk (a „C” opció lesz).

**Őr:** `scripts/gate-runner-check.mts` I forgatókönyv — öt kapu két szálon, előre betöltött
előzménnyel; minden kapu az INDULÁSAKOR írja a nevét, és 1,5 s-ig tartja a szálát, így az első két
sor a két elsőként indított kapu (kiolvasva, nem időből következtetve): az előzmény nélküli és a
leghosszabb kell legyen. Az előzmény a futás után frissül (új kulcs bekerül, a régi érték mozog), a
sérült fájl mellett a futás zöld. Két új visszarontás (a rendezés ki · az előzmény nélküli kapu
hátra), 19/19 piros.

**Mérés (EGY előtte/utána, ugyanazon a fán és diffen):** `CIT_GATE_CACHE=0 CIT_GATE_TIMES=…
CIT_GATE_HISTORY_FILE=<privát> LAND_RANGE=f4dc1972~1...f4dc1972 bash hooks/pre-commit`, fa: af925571 +
ez a futtató. Az „előtte” = üres előzmény, vagyis pontosan a hook-sorrend; az „utána” az előtte-futás
által írt előzménnyel.

| | ① fázis (86 kapu, 4 szál) | író-sáv (5) | soros írók (25) | összesen | load1 (kezdet → vég) |
|---|---|---|---|---|---|
| előtte (hook-sorrend) | **369 s** | 28 s | 730 s | 1126 s | 4,3 → 16,9 |
| utána (leghosszabb először, 86/86 előzmény) | **275 s** (−94 s, −25 %) | 16 s | 927 s | 1218 s | 16,0 → 5,8 |

- A nyereség az ① fázisban van, ahol a rendezés hat. A teljes idő NEM csökkent, mert a soros írók
  sávját egyetlen kapu, az `outreach-link-live-check` viszi (299 s → 675 s ugyanazon a diffen — egy
  élő linket követ, a szórása maga nagyobb, mint az egész nyereség). Ehhez ez az ADR nem nyúl; ez
  a következő szűk keresztmetszet.
- ⚠️ EGY pár, eltérő terhelés mellett (a gépen közben más landok futottak) — irány, nem pontos szám.
- Az első kiszemelt mérési diff (`9ad6652d...HEAD`, 114 kapu) nem volt használható: a
  `lead-mobile-check` párhuzamos futásban 2/2 piros volt (egyedül és a main-próbán zöld) — ezt a
  koordinátor külön szálon vizsgálja; a futtató a sorrendtől függetlenül ugyanígy bukott (üres előzmény).
