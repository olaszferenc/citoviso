## ADR-XXXX — Térhatású borítókép mindenkinek, és az összes meglévő mock újrarenderelése

**Dátum:** 2026-11-24 · **Státusz:** elfogadva (tulaj) · **Session:** `cite2d1c9b4`
**Felülírja:** ADR-0472 kísérleti felosztását (a leadek fele kapja) · **Érinti:** ADR-0474 (generátor-javítás)

### Előzmény
Az ADR-0472 a térhatású (mozgó) borítóképet kísérletként vezette be: a lead-azonosítóból számolt
érme a leadek felét tette a térhatás-ágba, a kapcsoló (`DEPTH_HERO_EXPERIMENT=1`) élesen nem volt
bekapcsolva. 2026-11-24 reggel éles teszt ment: három, még ki nem küldött mock (parallax,
kapunyitás, névből növő) újrarenderelve térhatással és az ADR-0474 javításaival, a valódi
megkeresés-levél a tulajnak és Eleknek. Elek mindhárom oldalt élesen végigkattintotta (levélkép,
mozgás, kapu, bevezető, JS-hiba 0), a tulaj a levelet a Gmail beérkezett mappájában kapta meg.

### Döntés (tulaj, 2026-11-24)
„Ez az éles teszt, de nyilván mindenki kapja meg. Sőt, továbbmegyek: ha jó a teszt, újra kell
generálni az összes létezőt.” · „minden ok, mehet tovább a folyamat”

1. **Mindenki kapja.** A `config.depthHero` kapcsoló (env `DEPTH_HERO`) alapállása `all`: a három
   kiküldhető sablon (parallax · gate-opening · wordmark-grow) minden új mockja térhatással
   készül, ahol a borító elbírja (méret, nem fizetős Places-kép, van mélységmodell). Az érme csak
   `experiment` módban dönt (ez a régi `DEPTH_HERO_EXPERIMENT=1` is); `off` = senki.
2. **Az összes meglévő mock újrarenderelése** a három sablonból — AI nélkül, a tárolt
   inputs-ból, a mostani motorral (`scripts/rerender-terhatas.mts`): térhatás + a kapunyitásnál
   az ADR-0474 téma-szabálya szerinti szárnykép (ha az új szabály nem talál más témájú képet, a
   régi szárny marad — mock nem veszíti el a kapuját). A kiküldött linkek mockjai is: a terv és
   a szöveg nem változik (§I), a borító mozgása és az ADR-0474 javításai megjelenítési javítások.
3. **Visszafordíthatóság:** minden mock HTML-je és inputs-a mentésbe kerül, MIELŐTT a szkript
   hozzányúl; `--restore <mentés>` mindet visszateszi. A szkript megszakítható és újraindítható
   (`inputs.terhatasAt`).

### Következmény
- A `scripts/depth-hero-report.mts` ág-összevetése `all` módban nem ad kontrollt — a mérés innen
  a levél → kattintás tölcsér változása a bevezetés előtti időszakhoz képest.
- A mélységkép borítónként egyszer készül (cache: `photo_depth_map`), a többi mock ugyanarra a
  képre a cache-ből kapja.
