## ADR-XXXX — Szövegkurátor (Poe): a mock szövegét perszóna írja, az őrök egyszer, csak ítélnek

**Dátum:** 2026-10-05 · **Státusz:** elfogadva (lokál; élesre csak a nagy deployjal) ·
**Kiegészíti:** ADR-0325 (Neo az Inas), ADR-0323 (kézi szöveg), ADR-0292 (vendég-kritikus) ·
**Kapcsolódó:** §B.17, ADR-0324 (lírai nyitórész), ADR-0317 (összevont hely-állítás), ADR-0028 (kurátori prompt) ·
**Terv:** `szovegkurator/TERV.md` (a koordinátor fájában, `_from-sub/e7c0f9eb/…/_drafts/`) ·
**Kontraktus:** `assets/design-refs/console/poe-curator/` · **Charter:** `poe/charter/`

**A tulaj szava (2026-10-05).** „Nem is programozó kell, hanem szövegkurátori munkatárs … majdnem nullázzuk az
API-hívások számát és költségét.”

**Kiváltó.** A mock szövegét eddig egy API-hívás (briefAndCopy) írta, a piaci kapu újragenerált, a vendég-kritikus
újraíratott — mockonként mérten ~0,39–0,66 USD, és egy író, ami minden hívásnál mindent elfelejt. Az ADR-0324 mérése
szerint az utolsó 50 hős-címből 49-et leltár vezetett. A szöveg más szakma, mint Neo kurátori előkészítése: más az
emlékezete (stílus, régió, korábbi nyitások), és más a ritmusa.

**Döntés.**
1. **Külön perszóna: Poe, a szövegkurátor (férfi)** — D3. Saját, tartós RC-session, saját Chrome-profil, saját
   konzol-fiók (`poe`), memória a fán kívül (`~/poe/`: beerkezo, naplo, jelentesek, nyitasok, regiok, stilus,
   tanulsagok, ugyek). Charter: `poe/charter/CHARTER.md` + `RUNBOOK.md` + `ONTOLOGIA.md` (a §B.17, ADR-0292,
   ADR-0317, ADR-0323, ADR-0324 tételes kivonata a teljes DOMAIN-fájlok helyett).
2. **Új generálási mód: „generálás kurátori szöveggel”** — D2. A szöveg-csomagot (`CuratorCopy`: a `CopyKey`
   mezők, `sellingPoints` szó szerinti idézettel, opcionális `accent`) Poe írja; a briefAndCopy, a piaci
   újragenerálás és a kritikus–író kör KIMARAD. A csomagot UGYANAZ a szabály ellenőrzi, mint a kézi szöveget és az
   AI-t (`copyFields` + `copyValueError`, `validateSellingPoints`, `guestValueHighlights`) — egy szabály, nem kettő
   (`src/generator/copyCurator.ts`). A kurátori mezők `copyManual`-ként, Poe nevével rögzülnek (ADR-0323 D3: az
   AI-újraírás nem írja felül).
3. **A minőségkapu: „A” változat** — D1. A tényhűség-, a piaci és a vendég-kritikus őr EGYSZER, csak ítél a
   kiszállított szövegen; az ítélet tárolt, a `mockVerdictGate` változatlanul olvassa. Kurátor-módban nincs
   AI-újragenerálás — az őr-ítélet a kurátoré. Az ADR-0292 ① „javító kör”-ét Poe végzi az ADR-0323
   szöveg-szerkesztőjében, **leadenként legfeljebb egy** fizetős újraítéléssel. A nyugtázás nem az övé.
4. **Tényt Poe sem adhat hozzá** (§B.17, ADR-0028). A nem szó szerinti idézetű tény kiesik és jelentődik, ahogy
   az AI-nál; a „Honnan tudjuk?” panel csak gépileg ellenőrzött idézetet mutat.
5. **Lektor (őr-perszóna) NINCS** — a terv 4. pontjának árnyék-ítélete kimarad. Az őr-perszónára váltás („B”)
   továbbra is KÜLÖN tulaj-döntés lenne, az ADR-0292 ① és a §B.17 enforce módosításával.
6. **Konzol-út, nincs CLI** (koordinátori döntés, a §2b-kapun át, tulaj-jóváhagyás 2026-10-05 ~11:45): a lead-lap
   **Forrás-csomag** füle (mindaz, amiből írni szabad), és a **„Generálás kurátori szöveggel”** űrlap MINDKÉT
   helyen — a „Mock és generálás” panelben és saját lapként (`/lead/:id/curate?t=a,b`) —, egy komponens, két
   belépő. Ugyanekkor: a vendég-hang ≥4★ szűrése, és a földrajzi „medence” nem „Medence” szolgáltatás.
7. **Munkarend (tulaj, 2026-10-05):** a jegy Neótól VAGY a tulajtól jön a `~/poe/beerkezo/`-ba, a tulajé előbb.
   Neo jegye: a lead-URL, a kurátori lap URL-je a két sablonnal és indokkal, megfigyelések „nyom, nem forrás”
   címkével — forrás-anyag nélkül. Sablon nélküli jegyre Poe nem választ maga. Szűkös heti keretnél Neónak van
   elsőbbsége. EGY Poe van: 150k-nál „TÖMÖRÍTHETŐ — itt folytatom: …”, a `/compact` a koordinátoré, handoff nincs.
   A visszajelzés Neo jegyére `~/neo/beerkezo/`-ba megy (Neo a RUNBOOK §7-e szerint ellenőriz), a tulajéra a
   koordinátoron át.
8. **Pilot élesen, mindkét ágon** — D5: 5 lead × 2 sablon × 2 ág (AI-szöveg ↔ Poe-szöveg), vak összevetéssel.
   Mérés: `scripts/pilot-poe-report.mts` (csak olvas; `inputs.copyOrigin = "curator"` különíti el az ágakat).

**Nyitott kérdések — a terv javaslatával eldöntve.** Egy közös szövegkészlet a két sablonra (a szakaszcímek
térhetnek el) · az akcentszínt Poe a fotókhoz választja, vision-hívás nélkül · a pilot csak magyar · a generálást
Poe indítja · mockonként ítél az őr (közös ítélet a két sablonra külön ADR, a pilot után).
**Nyitva marad (D4):** az előfizetéses keret mint termelési erőforrás — a tulaj dönt a pilot előtt.

**Őr.** `scripts/copy-curator-check.mts` (pre-commit, piros kontrollal): a kurátori mód mindhárom ítéletet
perszisztálja, a kapu blokkol, a csomag-validátor ugyanazt a szabályt használja, mint a kézi és az AI-szöveg.

**Élesítés.** Migráció NINCS, env NINCS. Élesen kell: a `poe` operátor-fiók. Ismert: a `fetchPlaceReviews` 30
napnál régebbi vélemény esetén kapu nélkül hív Places Details-t — a pilot-leadeknél előre megnézendő. A konzol ma nem
ellenőrzi az `operator_user.role`-t (ADR-0325 ismert gyengesége): a határt a charter tartja.

**Visszafordíthatóság:** 🔄 könnyű — a mód kapcsoló; az API-út változatlanul megmarad.
