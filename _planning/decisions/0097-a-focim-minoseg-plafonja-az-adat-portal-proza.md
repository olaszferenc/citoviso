## ADR-0097 — A főcím-minőség plafonja az ADAT: portál-próza minden úton + tulaj-bemutatkozás mező + idézet-verifikált kinyerés (2026-09-06)

**Kontextus:** a tulaj sokadszor kapott fotóból írt, generikus hero-főcímet („Fedett terasz,
tágas nappali és kádas fürdő egy csendes falusi házban"), miközben a szállás valódi horgai
(dézsa, szauna, medence) a portál-leírásokban és az FB-névjegyben éltek. Mérés: 267 élő
leadből 162-nek volt ismert listing-URL-je, de csak 45-nek beolvasott portál-profilja —
a generátor a leadek ~85%-ánál fotó-only dolgozott, és az adathiányos ágon a marketing-őr
strukturális rétege is vak (nincs amenity, nincs mihez mérni). A döntések:

1. **A kézi újragyűjtés IS olvas portált:** a `reenrichOne` lánc az `enrichPortal` lépést
   a fő scrape-futással azonos sorrendben futtatja (verbose). Lead-oldali gomb = leadre
   célzott portál-újraolvasás; a „portalProfiles=0 örökre" állapot megszűnt.
2. **Nyitott-tükör híd (openTwin):** challenge-védett portál adapterén tiszta függvény
   vezetheti le a NYITOTT tükör-URL-t (szallas.hu/<slug> → <slug>.booked.hu; élesben mérve:
   Laguna Panzió 63 szolgáltatás + 1594 kar leírás + 56 fotó). NEM megkerülés: a nyitott
   domain önként szolgálja ki az azonosított klienst; a twin ugyanazokon a robots/entitás-
   kapukon megy át. A főoldalra átirányító (nem létező) adatlap becsületes skip-okot kap.
3. **Tulaj-bemutatkozás kurátor-mező:** a lead-oldalon `ownerIntro` (a tulaj nyilvános
   önleírása, pl. FB-Névjegyből KÉZZEL átemelve — a gépi FB-olvasást a robots tiltja, a kéz
   a jogtiszta út). A generálásba forrásolt leírásként folyik be, ELSŐ helyen (a tulaj saját
   szava a legerősebb forrás); padló 40 karakter (a kurátor szándékosan mentette).
4. **Rangsor-kontraktus az írónak:** az igazolt tények súly szerint csökkenőben mennek a
   promptba, és a prompt kimondja: a főcím a lista ELEJÉRŐL nevezzen meg 1–3 tényt.
5. **Alcím ≠ főcím:** a tagline és a hero-lead EGY lapon jelenik meg — az alcím nem
   ismételheti a főcím tényeit; a MÁSODIK réteget viszi (másik adottság / település /
   kinek való). Mért kár: „Medence, dézsafürdő…" főcím alá „Medence, dézsafürdő…" alcím.
6. **Idézet-verifikált nyílt kinyerés:** a szótár (DECISION_WEIGHT/FACT_LABELS) örökre
   lemarad a valóságtól (a „dézsa" 2026-09-06-ig hiányzott). A brief-hívás ezért nyílt
   szókinccsel is kinyer eladási pontokat `{label, quote}` párként, és determinisztikus
   substring-ellenőrzés validálja a SZÓ SZERINTI idézetet a forrás-prózában (§B.17:
   bizonyíték nélkül a tény eldobódik, sosem hamis). Élesben: „szarvasles a dézsából",
   „helyi borok" — az őr 6 helyett 12 igazolt tényt számolt. Ismert aszimmetria: az
   ismeretlen címke súlya 0 → named-kreditet ad, követelményt nem támaszt (fail-safe).
7. **Structured-output tanulság:** az Anthropic json_schema kimenet a `maxItems`-t NEM
   fogadja el (400) — plafon a validátorban, ne a sémában.
