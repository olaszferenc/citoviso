## ADR-0002 — Munkamód: döntési napló + visszafordíthatóság-címke + fókusz

- **Dátum:** 2026-07-08
- **Döntés:** (1) Minden stratégiai döntés ide, ebbe a naplóba kerül. (2) Minden jelentős választásnál
  jelzem a **visszafordíthatóságot** (🔄 / 🚪); egyirányú ajtón lassan + explicit rákérdezéssel megyünk.
  (3) **Egy szál egyszerre**, a pilot-célhoz kötve — nincs architektúra-asztronautika. (4) Horgony a
  **MineREAL-workflow**-hoz mint mérce.
- **Miért:** A tulaj nem tudja tételesen vetni a technikát és nincs idő rá; e mechanizmus nélkül egy
  **jelentős stratégiai rossz irány észrevétlenül átcsúszhat** (mint majdnem a hand-roll→Next.js→NestJS
  lengés). Ez a napló + a címkék adják a kontrollt szakértelem nélkül.
- **Visszafordíthatóság:** 🔄
- **Státusz:** ELFOGADVA.
