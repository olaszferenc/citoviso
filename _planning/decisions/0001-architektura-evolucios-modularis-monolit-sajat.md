## ADR-0001 — Architektúra: evolúciós moduláris monolit, saját/vékony a TS-stacken (keret NÉLKÜL, egyelőre)

- **Dátum:** 2026-07-08
- **Döntés:** A rendszert **moduláris monolitként** építjük, **saját/vékony kóddal** a már választott
  stacken (Node 20 + TypeScript strict/ESM + Postgres + Kysely + célzott kis libek). **Nehéz keretet
  (NestJS/Next.js) most NEM adoptálunk.** A hangsúly a **tiszta modul-határokon** van, hogy a keretet /
  külön szolgáltatásokat **később, fájdalom esetén** olcsón be lehessen húzni — átírás nélkül.
- **Miért:** (1) A best practice célméretben is a *struktúra*, nem a keret — és stádium-függő: most az
  evolúciós, halasztó út a helyes. (2) Solo/kis csapat: a #1 megkötés a **karbantartó megértése** —
  átvizsgálhatatlan keret időnyomás alatt rosszabb, mint a **MineREAL-lal bevált**, testre szabott,
  átlátható mód. (3) A keret **egyirányú ajtó** → nem rohanunk bele, amíg nem tudjuk vetni.
- **Visszafordíthatóság:** 🔄 (tiszta határokkal a keret/szolgáltatás-kibontás bármikor, olcsón)
- **Elvetett alternatívák:** Next.js (frontend-forward) · NestJS (backend-forward) — mindkettő
  *egyirányú ajtó*, a jelen stádiumban túl-elköteleződés. Nyelvváltás (PHP, MineREAL-minta) — tovább
  fragmentálna, a TS-mag már áll.
- **Státusz:** ELFOGADVA. A stack-vita ezzel **lezárva** (ez a stabil horgony, nem újabb lengés).
