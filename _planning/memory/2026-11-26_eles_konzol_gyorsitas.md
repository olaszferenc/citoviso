# 2026-11-26 — Éles konzol gyorsítása (35 mp → 0,3 mp)

Session: `citb28926a1`. Brief: „KURVA LASSÚ AZ ÉLES CITOVISO BELSŐS ADMIN”. Tulaj: „mehet” (A+B+C), „menjen ki”, „GO”, végül „sokkal gyorsabb lett! zárhatunk”.

## Mérés (élesen, bejelentkezve, előtte)
- VPS: 2 vCPU / 3,8G, load 7–31, CPU-nyomás 70–99%.
- `/` 35 mp, `/hub/report` 27, `/duplicates` 25, `/hub/finance`·`/hub/system` 12, `/hub/crm` 8.

## Okok
1. A hub-oldalak kérésenként SORBAN számoltak újra 10 adatforrást (lead-állomány 8,7 mp, „Megnyitás csatornánként” 5,8, tölcsér 2,6).
2. A lead-állomány mind a 21 600 mock `inputs` JSON-ját soronként 6× csomagolta ki; a `loadProspectFacts` a teljes `inputs`-ot a Node-ba húzta.
3. A `/duplicates` minden kattintásra 33 ezer lead teljes `raw`-ját vizsgálta.
4. A főoldal válasz-blokkjában a `whenShort` hívásonként 3 `Intl.DateTimeFormat`-ot épített (a renderidő 87%-a, élesen profilozva).
5. CPU-éhség: a kiküldő 2 percenkénti mock-frissítése (a `qafix4` pecsét utáni ~540 mock) és a sessionök ssh-s munkája (22 párhuzamos `rerender-mock`, 4 szeletes `qa-review`, `_fill-ok`) azonos súllyal versenyzett a konzollal.

## Javítás
- `src/console/swrCache.ts` (új): stale-while-revalidate tároló. A hub nehéz számai ≤60 mp, a duplikátum-jelöltek ≤5 perc régiek; a kattintás sosem vár. Az eldöntött pár és az összevont lead minden betöltéskor frissen kiesik.
- `src/console/server.ts`: a hub forrásai párhuzamosan; a `/duplicates` tárolt jelöltlistáról.
- `src/console/leadStock.ts`: két lépés (státusz → csak a megjelenített mock JSON-ja); az eredmény bájtra azonos (dev DB-n mérve).
- `src/console/reportData.ts`: csak `skin`/`template` a mock `inputs`-ából.
- `src/console/views.ts`: az időbélyeg-formázók egyszer épülnek (9000 mintán 0 eltérés); felület-kapu kivétel naplózva.
- `deploy/systemd/citoviso-outreach-dispatch.service`: `CPUWeight=20`, `Nice=10`, `IOWeight=20`.
- Élesen kézzel (nem GATE 6): `systemctl set-property user.slice CPUWeight=10 IOWeight=10` — leírás: `deploy/systemd/README.md`.

## Élesítés
- `f5085f12` (prod/20261126-1319), majd `c51bfbb4` (prod/20261126-1434). A második deployban mások landolt munkája is kiment (amenities-javítás, Bábel-fordítások, land-eszköz); tudasbazis-or PASS.
- Mérve utána: `/` 0,2–0,3 mp, hubok 0,15–0,3, `/duplicates` 0,05, `/jovahagyas` 0,15. A deploy utáni első hívás egyszer ~10 mp.

## Mellékszál
- A dev DB HU `send_window_to`-ját kétszer visszaírtam 17→20-ra, mert minden land bukott rajta. A koordinátor (`cita291565c`) szerint a 17 szándékos (0155-ös migráció, F4, ADR-0487); azóta nem nyúltam hozzá. Élesen 20 marad a 0155 deployjáig.

## Nyitott
- A CPU-nyomás 87% körül marad. A 2 vCPU kevés ennyi párhuzamos sessionnek; a gép bővítése tulaj-döntés.
- A válasz-adat (`getRepliesBlock`) ~1,4 mp volt terhelés alatt, főleg DB-várakozás; most nem nyúltam hozzá.
