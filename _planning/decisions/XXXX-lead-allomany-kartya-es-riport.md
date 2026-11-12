## ADR-XXXX — Lead-állomány: a CRM-kártya helyett képtípus × állapot mátrix, riport-fül, időszak-gomb

**Dátum:** 2026-11-12 · **Döntött:** tulaj (terv „B”), a fogalmakat a session rögzítette

**Kontextus.** A CRM-kártya (felmért szereplő, kvalifikált lead, mock-sorok) nem mutatta, hány kvalifikált
lead milyen képpel indul, hány ment ki, hány küldhető most és miért vár a többi. A tulaj saját táblázatot
rajzolt (képtípus × állapot, csatorna szerint, generálásra vár ok szerint), és időszak-gombot kért az
Irányítópultra.

**Döntés.**
1. Az Irányítópulton a CRM-kártya helyén teljes szélességű „Lead-állomány” sor (terv:
   `assets/design-refs/console/lead-allomany/`, „B”); a Riportban új „Lead-állomány” fül (`/report/leads`).
2. Időszak-gomb „Ma · 7 nap · 1 hónap · Összes” (alap: Összes) a Lead-állomány és a Megkeresések kártyára;
   a Messenger-út változatlan. Az időszak kohorsz: az időszakban felmért leadek, a mai állapotukban.
3. Fogalmak (egy besoroló, `src/console/leadStock.ts`, a kártya, a fül és a `/leads?stock=` szűrő közös):
   kvalifikált = nincs/elavult honlap, nem diszkvalifikált, nincs letiltva (a CRM-lista ≥1 képes alapszűrőjénél
   tágabb); saját kép = ≥1 portál/Google/honlap-fotó (Street View nem); település/stock = nincs saját fotó és
   a mock településfotót kapott, vagy még nincs mock; semmilyen kép = a mock településfotót sem kapott;
   kiküldhető = az átnéző tárolt verdiktje „pass”, a jóváhagyó lapon nem lett „Nem mehet ki”, van ellenőrzött
   elérhetőség (e-mail vagy lefutott Viber/WhatsApp-ellenőrzés a HU mobilon), és még nem ment ki.
4. Az átnézés a TÁROLT verdiktet olvassa (`reviewVerdict` + `review.verdict` = pass), nem számol szöveg-hasht
   (a teljes mock-bemenet 19k leadnél túl nehéz a nyitólaphoz) — ugyanaz az olvasat, mint az automata soré.

**Következmény.** A CRM-kártya „Eladó modul” sora megszűnt (a „Figyelmet kér” sor mondja ki); a lead-lista
egy kártya-számról nyitva nem kap alapszűrőt, a sáv mondja ki, melyik szám listája.
