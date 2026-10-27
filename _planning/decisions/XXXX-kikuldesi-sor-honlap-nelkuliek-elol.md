## ADR-XXXX — A kiküldési sor sorrendje: a honlap nélküliek mennek elsőként

**Dátum:** 2026-10-27 · **Státusz:** elfogadva (lokál, nem élesítve) · Kiegészíti: ADR-0405 (automata kiküldés)

### Kontextus

Az automata kiküldés (ADR-0405) a sorból (`outreach_dispatch`) a legrégebben sorba tett leadet vette
elő, a lead fajtájától függetlenül. A sorban saját, modern honlappal rendelkező leadek is álltak: a
koordinátor 2026-10-27-én 48 ilyen sort kézzel a sor végére tett (`queued_at` → 10-28 22:00/22:30),
hogy a honlap nélküliek előbb menjenek.

A tulaj döntése (2026-10-27): **„a honlap nélküliek mennek elsőként, és ha elfogytak, jöhetnek a többiek”**.

### Döntés

1. A claim sorrendje rang szerint:
   - **0:** nincs saját honlap — `lead.qualification = no_site`, vagy `raw.websiteStatus` none / portal_only;
   - **1:** elavult saját honlap (`outdated`);
   - **2:** modern saját honlap (`modern`);
   - **3:** minősítetlen.
2. Egy rangon belül a régebben sorba tett sor megy előbb (`queued_at`).
3. A rangot egy allekérdezés adja (`DISPATCH_PRIORITY`, `src/outreach/autoDispatch.ts`), nem join: a
   `FOR UPDATE SKIP LOCKED` claim továbbra is csak a kiküldési sort zárolja.

### Következmények

- Kézi `queued_at`-hátratolás nem kell: egy később sorba tett honlap nélküli lead is a honlapos sorok elé kerül.
- A napi keret, az ablak (hétköznap 9–16) és minden küldési kapu változatlan; csak a sorrend más.
- Őr: `scripts/dispatch-priority-check.mts` (egy újabb honlap nélküli sor a régebbi modern elé kerül;
  a teljes rangsor; a claim valóban ezzel rendez).

### Visszafordíthatóság

🔄 Olcsón visszavonható: a rendezés egy sor a claimben; adat nem változik.

### Elvetett alternatíva

- A honlapos leadek kizárása a sorból: a tulaj szerint ők is mennek, csak utánuk.
- Kézi `queued_at`-tologatás: minden új sorba tételnél megismételni kellene.
