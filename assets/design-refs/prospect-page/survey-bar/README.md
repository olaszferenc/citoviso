# „Mi tartotta vissza?” — alsó kérdés-sáv (JÓVÁHAGYOTT TERV, 2026-10-12)

Tulajdonosi döntés: 2026-10-12, „ok rendben” (a koordinátoron át, Elek lead-köre, K-új-1).
Elek mérése: a felső ajánlat-sáv × gombja után feljövő kérdés-kártya mobilon 366×353 px-en ült, a
képernyő ~42%-át és **mindkét** rendelés-pirulát takarta (`05c-x-utan-5mp-wait8000-mobil.png` a
koordinátor fájában). Az ADR-0369 célja (ne takarjon) így a második lépésben elveszett.
Kattintható terv: `plan.html` (méret-váltó, kinyitás, válasz, ×, „Újra”). A képek a valódi
lapról készültek (`scripts/mock-trial-overlay-check.mts --shots=…`): `sav-zarva-*`, `sav-nyitva-*`.
**Ez a terv KÖT: elvárt viselkedés, nem stílus-javaslat.** Felülírja a felső sáv
(`assets/design-refs/console/escalation-topbar/`) 4. pontjának „változatlan” kérdés-kártyáját.

**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css`

## Amit a terv KÖT
1. **Egy kis sor alul**: a kérdés, egy nyíl és egy rajzolt × (≥ 40 px). Zárva legfeljebb 64 px magas.
   Mobilon csak **„Mi tartotta vissza?”**, asztalon mellette **„Egy koppintás, segít jobbat kínálnunk.”**
   Mobilon teljes szélesség (12 px szegély), asztalon a bal alsó sarok, legfeljebb 540 px.
   **Fátyol nincs**, a terv alatta görgethető és kattintható marad.
2. **Nem takarja a rendelés-pirulákat** („14 nap ingyen”, „Itt rendelheti meg”), sem a sablon alsó
   foglalás-sávját, sem a süti-sávot: mindegyik FÖLÖTT ül (a pirula-elhelyezés által közzétett
   `--citui-cfg-clear` magasság fölött; ha az nincs, a süti-sáv fölött). Kinyitva is fölfelé nyílik.
3. **A válaszok koppintásra nyílnak** (a sorra vagy a nyílra), zárva nem látszanak. Kinyitva a
   mobil is mutatja a második mondatot. A válaszok, az „Elküldöm” (opció nélkül tiltott), az
   „Inkább nem”, a „Más…” szövegmezője és a köszönő mondat **változatlanok** (riport README 19).
4. **A × csak elrejti** a sávot, nem küld semmit; nem kérdezünk újra ugyanazon a látogatáson.
5. Ugyanaz a nyelv, mint a felső ajánlat-sávé (ADR-0369): fehér alap, sötétkék szöveg, cián gomb,
   rajzolt × kör.
6. **A kérdés nem marad el csendben** (Elek A-új-1): ha a felső sávot a látogató azelőtt zárja
   be, hogy a `/view` válaszolt volna (élő ajánlat, a sáv a betöltéskor jön), a kérdés a válasz
   megérkezésekor jelenik meg.
7. Változatlan: a próba-űrlap és a sikerablak alatt a sáv nem látszik (Elek2 Ú3); a válasz a
   `/p/<token>/feedback` végpontra megy a viewId-vel, forrás `escalation_dismiss`.

## Őr
`scripts/mock-trial-overlay-check.mts` ⑦ (zárva ≤ 64 px, egyik pirulát sem takarja, a válaszok
csak koppintásra; kinyitva sem takar) és ⑧ (gyors × a `/view` válasza előtt → a kérdés megjön),
mobilon és asztalon; `--self-test`: a `cit-cfg-trialfx-*` blokkok nélkül mind piros.
