## ADR-0054 — Az operátor-konzol lead-oldala DOSSZIÉ, nem görgetés

- **Dátum:** 2026-08-22
- **Kiváltó (tulaj):** *„tervezd újra a LEAD oldal. Itt egy elrendezés minta egy tabulátoros nézetből
  a MineReal rendszeremből. Szempontból is praktikusabb."*
- **Döntés:** A lead-oldal **fülekre bomlik** (Adatok · Mock és generálás · Megkeresés ·
  Csomag és fizetés · Fotók · Elérhetőségek · Audit), fölötte egy **identitás-sávval**, amely a
  match-konfidenciát NAGY mérőszámként viszi. A fül-sáv sötét navy, cián záróvonallal; a vonal az
  **aktív fül alatt megszakad**, mert a fül fehérje ráfut a lapra — a fül és a tartalma egy test.
- **Miért:** a lead-oldal **hét, egymással nem összefüggő munkát** hordoz (adat-javítás, generálás,
  megkeresés, pénz, fotók, forrás-ellenőrzés, audit). Egyetlen görgetésben ezek egymást temették:
  minden szekció rövidre volt szorítva, hogy a többi is elférjen, és a kurátor nem látta, melyikben
  van egyáltalán tennivaló. Fülekkel minden munka **teljes szélességet** kap, a fül-számok pedig
  egy pillantásból megmondják, hol van tartalom. A minta a tulaj saját, napi használatban lévő
  MineREAL-rendszeréből jön — ismerős elrendezés, nulla tanulási költség.
- **Az elrendezést nem a technika választotta:** öt változatot kapott a tulaj letölthető mockként,
  és ő döntött (a dosszié-fül a MineREAL-hoz leghűbb). A dizájn-döntéseknél ez a bevált út.
- **Kikötés — a fül nem rejthet el tartalmat:** a fülek **valódi horgony-linkek**, ezért JavaScript
  nélkül minden panel látszik (semmi nem vész el), és a szerver meglévő
  `#prospects` / `#mock-artifacts` / `#ls-data` átirányításai a megfelelő fület nyitják.
- **Visszafordíthatóság:** 🔄 tisztán megjelenítési réteg (`leadPage()` + `citui-console.css`);
  se séma, se route, se adat nem változott.
- **Elvetett alternatíva:** oldalsó, függőleges fül-sáv (B változat) — asztali gépen jó, de a
  konzolt telefonról használjuk, ahol úgyis vízszintes sorrá kellene alakulnia; fölösleges kettősség.
- **Mellék-tanulság (a kapu jól mért):** a `template-picker-check` PIROSRA ment, mert a sablon-választó
  rejtett fülre került — a kapu a **viselkedést** méri, nem a jelölőt, ezért elkapta, hogy a választó
  a renderelt alapállapotban kattinthatatlan. A kapu most az operátor valódi útján (fül-kattintás) éri
  el a választót, plusz külön állítja, hogy a fül tényleg megnyitja. Az önteszt továbbra is piros a
  törött jelölőn. Vö. [feedback: az őr azt mérje, ami SZÁMÍT].
- **Státusz:** ELFOGADVA és ÉLES (commit `2fb7015`).
