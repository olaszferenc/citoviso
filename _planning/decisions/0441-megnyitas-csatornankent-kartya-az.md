## ADR-0441 — Megnyitás csatornánként: kártya az Irányítópulton (saját Ma · 7 nap · Összes)

**Dátum:** 2026-11-13 · **Döntött:** tulaj (terv „B” — csatorna-csempék), a fogalmakat a session rögzítette

**Kontextus.** A tulaj kérése (brief `report-20261113-071126.md`): az Irányítópulton lássa, mi a csatornák
(e-mail · Viber · WhatsApp · SMS/MMS) megnyitási hatékonysága, „Ma, 7 nap és összes” bontásban. A csatornánkénti
megnyitás eddig csak a Riport Tölcsér „Honnan nyitották” paneljén látszott (ADR-0435), a kiküldés napja szerinti
kohorszban, időszakonként külön oldalon.

**Döntés.**
1. Teljes szélességű „Megnyitás csatornánként” kártya a Messenger-út alatt, az időszak-gomb fölött (terv:
   `assets/design-refs/console/csatorna-megnyitas/`, „B”): négy csempe, nagy szám = 7 napos arány, alatta
   Ma · 7 nap · Összes egymás mellett. A pult időszak-gombja (ADR-0438) NEM hat rá.
2. Fogalmak (`src/console/openChannels.ts`): **kapta** = a csatorna első küldése (a második érintés előtt,
   `touchesOf`) az időszakba esik; **megnyitotta** = ebből a csatornából kattintott a linkre, bármikor azóta
   (`attributeOpen`, bot nélkül). A levél-megnyitást nem mérjük. Az SMS és az MMS egy csatorna. Az időszakok a
   Riport presetjei (`reportPeriod`: „today”, „7” = 7 × 24 óra, „0”).
3. **„Nem eldönthető”** = az időszakban (7 nap) kiküldött leadek, akiknek csatornához nem rendelhető megnyitása van.
4. Csempe → `/report?days=7#os-<csatorna>`: a „Honnan nyitották” panel sora lenyílik (a panel `id="honnan"`,
   a sorok `id="os-…"`, a hash-t a panel szkriptje olvassa).

**Következmény.** A kártya és a Riport panel ugyanazzal a hozzárendeléssel számol; a „Kapta” eltérhet, mert a
Riport kohorsza a kiküldés napja, a kártyáé a csatorna-küldés napja. Az oldal minden betöltése egy
`loadProspectFacts`-ot futtat (helyben ~0,1 mp). Őr: `scripts/open-channels-check.mts`. Az új feliratokat élesítés
előtt Bábel fordítja (addig magyar).
