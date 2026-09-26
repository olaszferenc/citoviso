## ADR-XXXX — Programajánló: saját program a tenanttól + alapból dátum szerinti sorrend

**Dátum:** 2026-09-26 · **Státusz:** elfogadva (megvalósítva, őrrel) · **Kapcsolódó:** ADR-0214
(automata heti programajánló), a `design-refs/console/programajanlo/` B kontraktus ③ pontját MÓDOSÍTJA.

**Kontextus.** A tulaj a Camping Carina választóján: „itt adhasson a tenant is hozzá üres elemet,
amit teljesen maga szerkeszt”. Eddig csak a gyűjtött programokból lehetett választani, a
tenant saját rendezvénye (vagy amiről ő tud) nem kerülhetett ki.

**Döntések (tulajdonosi, 2026-09-26, §2b kör: A/B vázlat → „A”).**
1. **Saját program = üres kártya a listában** (A változat; a B „űrlap-ablak előnézettel” elvetve).
   Belépő az „Az Ön oldalán” lista tetején ÉS a javasoltak alján (mobilon a Javasolt fül nyílik
   először). Mezők: cím · kezdete · vége (ha több napos) · Helyben / Máshol + település · webcím
   (nem kötelező). Leírás mező NINCS. Kontraktus: `assets/design-refs/console/programajanlo-sajat/`.
2. **A saját program forrása a szállás, és a sor ezt ki is mondja** („a többi ok” = a javaslat
   elfogadva): az adminban „Saját ajánlás” jelvény, a honlapon „Forrás: …” helyett „A szállás
   ajánlja” (+ a webcím linkje, ha van). ⚠️ A §B.17 forrás-kapu (nincs forrás → nincs sor) a
   GYŰJTÖTT programokra változatlanul él; ez az egyetlen, kimondott kivétel.
3. **Sorrend: alapból DÁTUM, a fel/le nyíl felülír** („alapértelmezés: dátum. fel le override”).
   `site_module_config.poi.config.order` = `"date"` (alap, a kulcs hiánya is ez) | `"manual"`.
   Dátum-módban a honlap a kiválasztottakat ÉS az automatikusan kitöltött helyeket EGYÜTT rendezi
   dátum szerint; kézi módban a tenant sorrendje, utána az automatika (a korábbi viselkedés).
   A „dátum szerint rendezem” link visszaállít.
4. **Egy szabálykészlet:** `src/events/ownPrograms.ts` (cím ≤120, kezdés nem múlt nap és ≤90 nap
   előre, legfeljebb 31 napos, webcím csak http(s) és `https://` pótlással). A kliens-szkript ezt
   tükrözi azonnali visszajelzésnek, de a mentés-út (`sanitizePicks`) a valódit futtatja és eldobja,
   amit elutasít. Egy már futó (korábban mentett, múltbeli kezdetű) saját programot NEM utasít el.
5. **Tárolás a meglévő `picks` listában** (v2 marad, additív): `{ id: "own-xxxxxxxx", own: {title,
   start, end, place, url} }` — így egy sorrend fedi a két fajtát. Nincs új tábla, nincs migráció.
6. **Láthatóság:** a honlap-blokk a következő két hetet mutatja, ezért a két héten túl kezdődő
   saját program a 10 helyből egyet elfoglal az adminban, de a honlapon csak a kezdete előtt 14
   nappal jelenik meg — a kártya és a sor ezt kimondja („Megjelenik a honlapon: …”). Lejárat: a
   vége (ennek hiányában a kezdete) után magától lekerül.
7. **„Máshol” távolsága:** ha a beírt település a kör cache-elt települései között van, km-t
   mutatunk (légvonal, ADR-0214 ③); különben távolság nélkül áll a sor.

**Őr:** `scripts/programs-editor-check.mts` — űrlap-szabályok mindkét irányban, dátum-sorrend,
kézi felülírás + visszaállítás, mentés-visszaolvasás (DB), honlapi sor („A szállás ajánlja”, két
héten túli még nincs kint), szerkesztés/törlés, hamisított mentés (múlt nap, `javascript:`, rossz
id, 121 karakter, 31 napon túli vég → eldobva), mobil belépő. Negatív kontroll: a honlap-szűrő és a
szerver-szabály visszarontva → 2 FAIL.
