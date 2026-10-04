## ADR-0323 — A mock szövege kézzel átírható: mezős űrlap a kártyán (A) ÉS helyben szerkesztés az előnézeten (B), egy mentési úttal

**Dátum:** 2026-10-04
**Státusz:** elfogadva (lokál; élesre csak a nagy deployjal)
**Kontraktus:** `assets/design-refs/console/mock-copy-edit/`
**Kiegészíti:** ADR-0061 (hős-pin: kurátori döntés a gépi kimenet fölött), ADR-0292 (vendég-kritikus), §B.17 (tényhűség), §I (amit kiajánlottunk, azt kapja)
**Őr:** `scripts/copy-hook-check.mts`, `scripts/copy-manual-check.mts` (mindkettő piros kontrollal)

### Kiváltó

A tulaj kérése: „a mockoknál lehessen manuálisan újraírni a szöveget”.

Ma a lead-lapon a mock szövege csak olvasható. Az egyetlen beavatkozás az AI-újraírás („Szöveg újragenerálása”), ami
az EGÉSZ szöveget újraírja. Egy elírásért vagy egy rossz szóért a kurátor minden mást is kockáztat.

### Döntés

A tulaj 2026-10-04-én, diktálva döntött: „Szöveg: Isis. Előnézet és mező. A többi javaslat szerint oké.”

1. **D1 — MINDKÉT felület, egy mentési úttal:**
   - **A:** mezős űrlap a mock-kártyán. Minden mezőt mutat, a sablonon nem látszókat is, ezeket jelölve.
   - **B:** helyben szerkesztés a kurátori előnézeten (`/artifact/:id/edit`). Csak az írható, ami az adott sablonon
     látszik.
   - Mindkettő a `POST /artifact/:id/copy` → `saveManualCopy()` utat használja.
   - A `/mock/<id>` linket a lead is megkaphatja, ezért szerkesztő sáv SOHA nem kerül rá. A B egy friss renderre
     injektál; a tárolt fájl tiszta marad.
2. **D2 — A tényhűség a kurátoré, de az őrök újra ítélnek:**
   - **Jelölés:** a kézi mező `inputs.copyManual[<kulcs>] = { value, orig, source: "curator", by, at }`.
   - **Őrök:** mentéskor a tényhűség-kapu és a marketing-őr újra fut. A vendég-kritikus CSAK ítél
     (`judgeGuestCopy`), a kézi szöveget nem írja át.
   - **Sorrend:** előbb az őrök, aztán a fájl, aztán a DB, így nincs olyan pillanat, amikor új szó áll régi
     „átment” alatt.
   - **Nyugtázás:** a korábbi `verdictAck` a szöveg-cserével elvész. A „fennakadt” mock csak új nyugtázással
     küldhető.
   - **Indok:** a `mockVerdictGate` sosem nézi, hogy a tárolt verdikt a mostani szövegé-e.
3. **D3 — Az AI-újraírás a kézi mezőt NEM írja felül:**
   - A `recopy.ts` a kézi mezőket rávetíti az AI-szövegre minden generálás és a vendég-kritikus után is. Az őrök a
     ténylegesen kiszálló szöveget ítélik.
   - A forrás-összeállítás közös: `copySources.ts`, a recopy-ból változatlanul kiemelve.
4. **D4 — Teljes újragenerálásnál (új mock) a kézi szöveg nem vándorol át.**
5. **D5 — A korlátok egy forrásból:** `src/engine/copyFields.ts` → `COPY_LIMITS`.
   - Értékek: főcím 140, dőlt kiemelés 60, felső sor 60, alcím 160, bemutatkozás 600, szakasz-cím 90, kiemelés 80,
     legfeljebb 6 kiemelés.
   - Csak a VÁLTOZOTT mezőt méri, így egy hosszabb AI-eredeti nem blokkol.
6. **Befagyás:** kiajánlott mockon (van rá `prospect`) a kézi szerkesztés is tilos. Ugyanaz a vonal, mint az
   AI-újraírásnál.
7. **Sablon-horgok:** mind a 21 sablon minden kirajzolt szöveg-mezőn `data-cit-copy="<kulcs>"` horgot visel.
   - A kiemelés a mező VALÓDI sorszámát viseli. A usp-összefésülés miatt ezt a render egy tömbhöz kötött
     oldaltáblán viszi át.
   - Származtatott nézet: `data-cit-copy-part="first-sentence"`.
   - A közös fejléc felső sora a `mastheadHtml`-ben kap horgot.
   - **Mérve:** 126 render (21 sablon × 6 valódi mock) a horgok levétele után bájtra azonos a korábbival.

### Nyitott pont (a tulajé)

A D5 „egy közös konstans” a tenant-szerkesztőre (`saveTenantContent`: alcím 240, bemutatkozás 2000, 12 kiemelés)
SZÁNDÉKOSAN nem terjed ki.
- **Miért:** ott ma nincs `maxlength`, a szerver NÉMÁN vág. A szorosabb érték az élő tulajok hosszabb szövegét mentéskor
  csendben megcsonkítaná.
- **Ha egységesíteni kell:** az egy tenant-admin felület-változás (számláló + jelzés), külön §2b körrel.

### Mérés (2026-10-04, dev, klónozott artefaktumon)

Élő e2e mindkét felületen, 390 és 1280 px-en: 67/67 lépés zöld, 0 JS-hiba.
- **Ellenőrzött viselkedés:** validáció, mentés, kézi jel, az őrök újrafutása, a nyugtázás elvesztése, a
  visszaállítás, a befagyás.
- **Mobil:** a B alsó sávja 50 px. A tulaj kifogása az első körben a ~45%-os takarás volt.
