# 2026-09-29 — Miért lassú a land az ADR-0227/0230 után? (brief: lassu-land-vizsgalat)

**Két ok, számokkal (20 mért futás a sessionök scratchpad-naplóiból + egy reprodukció):**

1. **A „már megmért” felismerés SOHA nem működött a landnál.** A 20 futásban mindenhol
   `0 már zöld volt`. A git a hook `PATH`-jának elejére teszi a `/usr/lib/git-core`-t, a
   `land.sh` sima `bash`-sel hív → más környezet → más aláírás. A galéria land2-je (egy commit,
   a main nem mozdult, nem volt ADR) így 892 s-ot futott feleslegesen. Javítva: ADR-0260
   (`scripts/lib/gate-runner.mjs` + `scripts/gate-runner-check.mts` E forgatókönyv valódi
   `git commit`-tel, 2 új visszarontás, 15/15 piros).
   ⚠️ Korlát: ha a main mozdult, a land ADR-t oszt ki, vagy több commit landol, a kulcs
   szándékosan eltér → minden kapu fut (ADR-0227 ④). Mozgalmas napon ez a gyakori eset.
2. **A kritikus út a `mobile-chrome-check` (2026-09-28 01:05 óta, ADR-0253).** Reprodukció
   (`CIT_GATE_CACHE=0 CIT_GATE_TIMES=… LAND_RANGE=9ad6652d...HEAD bash hooks/pre-commit`):
   84 kapu 960 s; a kapuidők összege 2609 s, de a `mobile-chrome-check` 577 s + a `--selftest`-je
   164 s, és ugyanaz a szkript önmagával nem fut együtt → 741 s egy láncban. A 13 futásban, ahol
   lefutott: ① 530–922 s; a 7-ben, ahol nem: 53–438 s. Slot-várás 0–49 s — nem ok.
   Következő leglassabbak: lead-page-surface 344 s, guest-mobile 212+88 s, room-details 182 s,
   lead-mobile 182 s (a gép load1 mediánja 8 volt a mérés alatt, egy másik land is futott).

**Útközben:** a `gate-lane-check --self-test` a tiszta mainen is piros volt (a negatív kontroll,
a `wallet-check.mts` 09-25 óta javítva → 0 lelet). A kontroll mostantól a commithoz kötött
`0b3bfeae~1:scripts/wallet-check.mts` (ADR-0260 ④). Tanulság: élő fájl negatív kontrollnak
törékeny — a kapu megjavítása megvakítja az őrt.

**Javaslat a koordinátornak (döntésre vár, nem implementálva):** ① a `mobile-chrome-check`
oldalait N párhuzamos lapon/kontextusban futtatni (ugyanazok az állítások, várhatóan 577 → ~150–200 s);
② a `--selftest` és a fő futás összevonása egy böngésző-indításba, vagy az önkizárás feloldása
erre a szkriptre, ha nincs közös scratch-útvonala (−164 s a kritikus útról); ③ leghosszabb-először
ütemezés a futtatóban a `CIT_GATE_TIMES`-előzményből (kisebb nyereség, a lánc alsó korlát marad).

**Élő bizonyíték a javításra:** a commit (git-hookon át) 55 kapu, 117 s, `0 már zöld volt`; utána a
land-hívás mása (`LAND_RANGE=origin/main...HEAD bash hooks/pre-commit`, ugyanazon a fán): **50 már zöld
volt**, csak a 4 diffet/módot olvasó kapu futott, 40 s. (Az egyetlen piros a `planning-index` volt: a
helyőrző-ADR-t a valódi land `assign` lépése osztja ki a kapuk előtt — a mása ezt kihagyta, várt.)

**Módosított fájlok:** `scripts/lib/gate-runner.mjs`, `scripts/gate-runner-check.mts`, `scripts/gate-lane-check.mts`,
`_planning/decisions/XXXX-a-land-ujrahasznalja-a-commitkori-zoldet-git-exec-path.md`, ez a jegyzet.
