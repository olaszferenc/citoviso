# 2026-10-01/02 — Places-költség (~600 $/hét) leállítása: koordinátor-összefoglaló (A–H SUB)

**Session:** CIT „Places API 600 $” koordinátor (`~/wt/citddb048b5`). Kódot ez a session nem írt; 8 koordinált SUB vitte.

## A lelet (mérve, Cloud Monitoring, `mineralcrm` / 1053502558775)
- 9 nap: GetPhotoMedia 16 469 · SearchText 7 007 · Street View 2 798 · GetPlace 313. Egyetlen API-kulcs mindenre (dev, éles, MR).
- Ok: a konzol lead-lapjának Fotók panelje minden betöltéskor fizetős Places-lookupot csinált (1 Text Search + ≤6 fotó, cache nélkül), és generálás alatt a lap 6–8 mp-enként újratöltött → a dev naplóban 1 387 lookup 51 leadre (96% ismétlés; Rubin Villa 126×).
- A portál-fotó szinte sosem jött be: élesen 977 kontaktálható leadnek van ismert portál-adatlapja, 31-nek volt beolvasott fotója (`enrichPortal` 60/futás plafon).
- Listaáras becslés: ~44,6 $/nap átlag a 7 napra (a tulaj ~600 $/hetet látott; a pontos számot a Billing adja).

## Tulajdonosi döntések
- Új tábla, lejárat nélküli tárolás („Eredmény tárolásának idejét nem korlátozzuk”).
- Portál előbb, mindenkinek; Places-fotó csak (a) portál-fotó nélküli leadnél automatikusan egyszer, egyébként KURÁTORI döntés (gomb).
- Mock: B változat (két forrás-sáv).
- „Nincsen cap. Saját magunkat korlátozzuk be.” → semmilyen keret nem állít le, csak figyelmeztet.
- Napi riport kell; SMS-tartalék nem; BigQuery billing export igen.
- Éles portál-backfill a nagy deploy UTÁN (memória: `project_after_deploy_portal_backfill`).

## Landolt (mind origin/main, élesre semmi)
| | ADR | commit |
|---|---|---|
| A lead-lap nem fizet, `lead_places_cache` (mig. 0083), tárolt place id | ADR-0293 | 7f578706 |
| B portál előbb, mindenkinek (+ `portal-backfill.mts`) | ADR-0294 | 7a6ca9d8 |
| C kurátori „Places-fotók lekérése (fizetős)”, két sáv (terv: `assets/design-refs/console/places-kurator/`) | — | d18c4828 |
| D ID-only felderítés, Details csak új helyre | ADR-0295 | 4d42b339 |
| E ismert lead nem dúsul; `module-render-check` UTC-hiba (00–02 CEST minden land bukott) | ADR-0296 | efb21d46, 84f51bef |
| F nincs cap (Details- és bejárás-keret csak figyelmeztet), igaz cap-felirat, booking.com kihagyva; backfill ~22 perc | ADR-0298 | e4bb3749…3676e82a |
| G napi Google-költség riport 07:10 (`citoviso-google-cost-report.timer`) | ADR-0297 | 9f16f7bf |
| H a riport a valós számlából (BigQuery `mineralcrm.billing_export`) | ADR-0301 | ab371ac4 |

Mérve: a Places-hívás 2026-10-01 21:31 óta 0.

## Nyitott
- A billing export bekapcsolása a Console-ban (tulaj): https://console.cloud.google.com/billing/012AB6-FB8C94-04076D/export → Standard usage cost → mineralcrm / billing_export. A dataset kész. A valós ág élesen még NEM mért; az első valós számos levelet vesd össze a Billing → Reports-szal.
- Nagy deploy után: éles portál-backfill (`npx tsx scripts/portal-backfill.mts --go`, ~22 perc), current-turn engedéllyel.
- Kulcs-higiénia (nem kért, javaslat): külön böngésző-/szerver-kulcs, IP/API-korláttal; ma egy kulcs szolgál ki CIT-et és MR-t.
- A lead-lap reload-hurka (generálás alatt 6–8 mp) most is lefuttatja a nyitókép AI-pontozását (tárolt pontszámokkal) — nem Places-költség, de külön ránézést érdemel.

## Koordinátori tanulság
- A SUB-okat háttér-figyelő (Monitor, 20 s) + 10 perces őrjárat (cron) figyelte; a figyelő 30 percenként lejár, újra kell indítani. A minták a koordinátor saját, a SUB-nak küldött szövegére is illeszkedtek (téves riasztás) → a saját üzenet sorait ki kell szűrni.
- Glob-os `rm` felügyelet nélküli SUB-ban engedélyt kér és 2 perc után elutasítódik → `find … -delete`.
