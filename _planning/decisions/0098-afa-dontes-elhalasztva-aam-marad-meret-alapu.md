## ADR-0098 — ÁFA-döntés elhalasztva: AAM marad méret-alapú újranyitásig + 80%-os limit-őr a konzolon (2026-09-06)

**Kontextus:** a középtávú terv (tulaj, 2026-09-06): sikeres pilot + visszaigazolt fizetőképes
kereslet esetén az egyéni vállalkozásból Kft. lesz. Az ÁFA-kérdés ekkor kerül elő éllel — de a
tulaj döntése: **egyelőre NEM foglalkozunk az ÁFÁ-val, a méret dönt.** Az AAM (alanyi
adómentesség) éves plafonja 18 M Ft (2025-01-01 óta); az átlépő számla már TELJES egészében
áfás, és 15 napon belül NAV-bejelentés jár — ezt nem érheti váratlanul az operátort.

1. **AAM-limit-őr a konzol-dashboardon:** az idei HUF nettó árbevétel a plafonhoz mérve;
   80%-tól sárga figyelem-chip, 100%-tól piros (alatta csendes — a dashboard nem zajong).
   Konstans: `AAM_ANNUAL_LIMIT_HUF` (`src/console/partnerData.ts`).
2. **Két élő forrás összegződik:** a fizetés-út legacy `invoice` táblája (status='issued')
   + a kézzel rögzített kimenő `accounting_document`-ok (storno/credit_note levon, proforma
   nem bevétel; source='system' kizárva, hogy egy jövőbeli tükör ne duplázzon).
3. **Reverse-charge kizárva:** a külföldi teljesítési helyű szolgáltatás nem számít a
   belföldi értékhatárba (Áfa tv. 188. §).
4. **Nem-HUF bizonylat NEM némán marad ki** (a vak adathiány-ág tilos): árfolyamot nem
   tárolunk, ezért a nem-HUF kimenő bizonylatok darabszáma a chip title-jében jelenik meg.
5. **Kód-készenlét rögzítve:** a számlázó-réteg soronkénti `vatKey`/`vatRate` mezői miatt
   az AAM→ÁFA váltás konfig-fordítás, nem átírás (0007/0031 óta így épült) — a Kft.-váltás
   informatikai oldala nem blokkoló.

### ADR-0098/b — SMS-őr a chip mellé (tulaj: „azért mehet az sms őr", 2026-09-06)

A chip csak akkor szól, ha a tulaj ránéz a konzolra — a küszöb-átlépés SMS-ben is utoléri:
6. **`checkAamAlert(now)` a napi billing-cycle ticken** (`src/console/aamAlert.ts`): 80% és
   100% küszöb, évente és küszöbönként EGYETLEN SMS (`aam_alert` bélyegtábla, 0051 — a
   dunning_event idempotencia-mintája; új év = természetes reset). A 80-as bélyeg nem
   némítja a 100-ast. Küldés ELŐBB, bélyeg utána: bukott küldés = következő tick újrapróbál.
7. **Címzett: `OWNER_ALERT_PHONE` env** (a modem SIM-je önmagának mérten nem kézbesít,
   ADR-0095). Hiányzó szám = HANGOS hiba bélyeg nélkül (a vak adathiány-ág tilos) — az
   értesítés esedékes marad, amíg a szám be nincs állítva.
8. Mérve (mock SMS + ideiglenes 15/19 M-s teszt-bizonylat, teljes takarítással): baseline
   néma → 80% tüzel → ismételt tick néma → 100% külön tüzel → hiányzó szám nem bélyegez.

### ADR-0098/c — Riasztási címzettek a konzol Beállításokban (tulaj, 2026-09-06)

Tulaj-kérés: „ezt is lehessen beállítani citoviso beállításokban — keret kihasználtság
email és sms cím". Döntések:
9. **`app_setting` platform-szintű kulcs-érték tár** (0052): a konzol /settings írja, az
   env-kulcs a gép-szintű tartalék — a DB-érték deploy nélkül felülír. Első lakók:
   `alert_phone`, `alert_email`.
10. **E-mail csatorna az SMS mellé**, csatornánkénti bélyeggel (`aam_alert.channel`,
    dunning_event-minta): a bukott e-mail a következő ticken újrapróbázik ANÉLKÜL, hogy az
    SMS duplán menne. Aszimmetria kimondva a felületen is: üres SMS-szám → env-alap érvényes
    (placeholder mutatja); üres e-mail → csatorna ki (nincs env-iker).
11. **Beviteli tolerancia:** 06-os alak +36-ra normalizálódik (normalizePhone); hibás
    szám/e-mail hangos hiba-pill, írás nélkül.
12. KB frissítve (console-settings: új panel-szekció + friss screenshot SEMLEGES számmal —
    a tulaj privát száma nem commitolódik; console-dashboard: AAM-chip a chip-listában,
    tudasbazis-or FLAG nyomán). Mérve: settings-kör 8/8 zöld (mentés/normalizálás/
    visszaolvasás/hiba-ágak/ürítés), őr-kör 6/6 zöld (env-fallback, DB-felülírás,két csatorna,
    idempotencia, csatornánkénti újrapróba).
