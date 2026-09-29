## ADR-XXXX — A kapu-időkorlát CSEND-alapú, nem teljes-idő alapú (az ADR-0268 1. pontjának helyesbítése) (2026-09-29)

- **Kiváltó:** a kapu-koordinátor (`cit3bd83952`) helyesbítése, még aznap, az ADR-0268 landolása után. A
  2026-09-29-i `cfg-sheet-scroll-check --selftest` eset nem beragadás volt, hanem egy lassú kapu:
  - egy session leölte idő előtt, 803 s-nál, illetve 438 s-nál;
  - egyedül futtatva 400 s alatt a 2. sablonig jutott, élő kimenettel.

  Az „`epoll_wait` + tétlen renderer” egy `waitForTimeout`-os mérés NORMÁL állapota, nem beragadás-jel.
- **Előzmény:** ADR-0268.

**A hiba az ADR-0268-ban:** a 600 s-os TELJES-idő korlát pontosan ugyanazt a tévedést gépesítette volna,
mint a kézi ölés: egy lassú, de haladó kapu (terhelés alatt >13 perc) hamis pirosat kapott volna.

**Döntés:**
1. **A fő korlát a CSEND:** ha a kapu stdout-ja és stderr-je `CIT_GATE_JOB_SILENCE` másodpercig (alapból 900)
   egyetlen bájttal sem nő, a kaput leállítjuk. A futtató másodpercenként a két kimeneti fájl méretét nézi.
   - Miért csend: a haladó kapu ír. A `cfg-sheet-scroll-check` sablon × viewport párosonként ír ki eredményt.
     A valódi beragadás néma: a 2026-09-27-i `guest-mobile-check` 18 percig egy bájtot sem írt, egyedül
     ~2 perc alatt zöld.
   - Miért 900 s: egyedül ~200 s egy sablon, így a 3–4×-es terhelés mellett a leghosszabb egészséges csend
     ~800 s. Egy 600 s-os csend-korlát ezt már súrolná.
2. **Végső védőháló: teljes-idő plafon,** `CIT_GATE_JOB_MAX` másodperc (alapból 3600). Ez arra a kapura
   vonatkozik, amelyik örökké csepegtet. Egy óra messze a leglassabb mért kapu fölött van. Előzmény × szorzó
   alapú korlátot nem vezettünk be: az előzmény is a beragadásokkal és a kézi ölésekkel szennyeződik.
3. **Minden más változatlan az ADR-0268 szerint:**
   - a teljes folyamatfa leállítása PID szerint;
   - a HANGOS piros ítélet (rc 124): az üzenet megnevezi, melyik korlát sült el, és hány másodperc után;
   - nincs zöld-gyorsítótár-bejegyzés és nincs előzmény-bejegyzés;
   - a kimenetből ítéletet nem következtetünk.
4. **A böngésző-zárás „gyökérok” (ADR-0268, 5. pont) visszavonva,** mint nem bizonyított. Csak akkor kerül
   elő újra, ha valódi beragadást reprodukálunk.

**Őr:** `scripts/gate-runner-check.mts`, J-forgatókönyv:
- egy 7 s-ig másodpercenként író kapu 3 s-os csend-korlát mellett ZÖLD;
- 4 s-os plafon mellett ugyanez a kapu 124-gyel piros;
- a néma kapu piros, és egyetlen folyamata sem marad életben.

Új önteszt-visszarontások: csend-korlát ki · teljes idő a csend helyett · plafon ki.
