# 2026-09-29/30 — Deploy-készenlét felderítés: 5 deploy előtti ❌ → 6 SUB egy éjjel, mind landolt

Önálló koordináló session (`cit92d2a67e`, brief: `~/rc-briefs/deploy-keszenlet-felderites.md`). A tulaj kérdése: „minden deploy
kritériumot teljesítünk-e, van-e olyan rész, amiről megfeledkeztünk?” Kódot a koordinátor nem írt; mért (száraz `deploy-prod.sh`
kétszer, élesi OLVASÁS, 4 párhuzamos átvilágító ügynök, tudasbazis-or kétszer), döntési táblát adott, SUB-okat indított és zárt.
Élesre SEMMI nem ment ki.

## Kiinduló mérés (22:20)
- Éles `263ef8dd` (prod/20260924-1004) → `origin/main c96d0954`: **329 commit, 1212 fájl, +133 624/−16 932, 10 migráció (0071–0080)**;
  npm-függőség nem változott. Élesen **0 valódi fizető bérlő** (ferenc-haz + nyugalom-demo teszt), 0 sikeres Barion-fizetés.
- Száraz deploy: GATE 1/4/2/1b/1c-kép zöld, **GATE 1c-n megállt** (nincs tudasbazis-or PASS a tartományra); az őr FLAG-et adott
  (2 valódi súgó-hiba az `admin-modules-rooms`-ban).
- Amiről megfeledkeztünk (új leletek): (1) **`X-Forwarded-Host`** — a `publicBaseUrl` elsőként azt olvasta, az éles nginx nem írja felül
  → hamis fejlécű kéréssel a tulaj levelébe idegen domainre mutató action_token-es link kerülhetett (a mai élesben is); (2) a **visszagörgetés
  a régi SHA-ra ma nem futna le** (GATE 1c/kép `--check-committed`, GATE 6 events-időzítők, GATE 1c token) és nincs down-migráció;
  (3) **nincs ütemezett DB-mentés**, az utolsó dump 7 napos, csak a VPS-en; (4) **nincs riasztás** időzítő/levél/webhook-hibára;
  (5) **9 .env-kulcs csak devben** (Websupport/Cloudflare/REGISTRAR/DNS/Maps-böngésző) → élesen mock regisztrátor — a tulaj
  ellenkezőleg emlékezett, a kulcsNEVEK mérése döntött; (6) vélemény-kérő job NEM létezik; (7) Secure süti/`/login` fék/CSRF hiánya;
  (8) vendég-ÁSZF, GDPR-export, idegen nyelvű jogi oldalak nincsenek.

## Tulaj-döntések (2026-09-29 este, szó szerint a lényeg)
- Súgó + X-Forwarded-Host javítás a deploy elé: „oké”. Vészterv: „elfogadom”. Riasztás + Secure/login: „nem tudom, mit javasolsz” →
  javaslat: igen, két kis SUB. Dump-lehúzás: „igen”. Pilot utánra (vélemény-job, vendég-ÁSZF, GDPR, CSRF, idegen nyelvű jogi): „igen”.
  Maps-kulcs: „reggel adom”. „Futass le minél többet és reggel aggregáltan tudom megnézni.”

## SUB-ok (mind saját fában, mind landolt, mind leállítva)
| SUB | eredmény | commit / ADR |
|---|---|---|
| Súgó-javítás GATE 1c | 2 rooms-lelet + booking „szobái” javítva; KB_PATHS + bookingViews/offerViews/contactViews | `08d364d3` |
| X-Forwarded-Host | host CSAK a `Host`-ból; őr negatív kontrollal (régi kódon piros) | `d21bc04d` · ADR-0278 |
| Secure süti + /login fék + ÁSZF §9 | `Secure` csak https mögött; 10 hibás/10 perc/IP → 429; §9 zárolás; ÁSZF 1.3 | `a13065f0` · ADR-0277 |
| Riasztás | `OnFailure=` 6 prod service-en → `citoviso-alert@` → alert_email; mailSafe + webhook riaszt; GATE 6 telepíti | `837671d6` · ADR-0276 |
| Időutazó őr | `booking-maintenance-timetravel-check` 41 állítás; **halott ígéret** az Árazás lapon (3212. sor) | `d93819a3` |
| DEPLOY-READY.md | újraírva: 20 lépés, 9 .env-kulcs, vészterv parancsokkal, füst-próba, pilot utáni lista | `cf617010` |

## Amit a koordinátor maga mért/csinált
- Éles dump lehúzása (`~/citoviso-prod-backups/`, 09-22 + 09-15, gzip OK) és **próba-visszatöltés dev scratch-DB-be**: 65 tábla,
  csak a `citoviso` szerep hiánya hibázott (élesen létezik); a próba-DB törölve. Tanulság: a lehúzott dump 7 napos (420 lead vs 3010),
  a vészterv a GATE 3 friss dumpjára épüljön.
- GATE 6 terv kézzel az új commiton (olvasva): 4 timer egyezik, 4 service módosul, 5 új egység. Éles `alert_email` kitöltve (2 cím).
- Második száraz deploy `d21bc04d`-re: a GATE 1c-ig minden zöld; tudasbazis-or a végső tartományra **PASS** → token rögzítve
  (`kb-gate.mjs pass`, 24 h, tartományhoz kötve; kivonat: `~/rc-briefs/reports/deploy-keszenlet/kb-gate-kivonat.txt`).
- Gépi memória-index 90 KB → 16 KB (247 régi sor `MEMORY-archive.md`-be, teljes horoggal).

## Nyitva reggelre (a tulaj dönt) — a reggeli HTML 3. szakasza
① Árazás-lap halott emlékeztető-ígérete (§B.17) → kis SUB; ② fojtás IP-je: XFF első eleme helyett X-Real-IP; ③ ÁSZF 1.3 jogi átnézés;
④ OnFailure a public/console unitokra (nincsenek a repóban); ⑤ dev-riasztás némítása; ⑥ KB_PATHS grepből; ⑦ a 9 .env-kulcs beírásának
ideje (deploy-session, engedéllyel). Csak élesben mérhető: tenant-hostú linkek, postafiók/.ics, GATE 5 költség, alert@ valódi futás,
Cloudflare SSL-mód (Secure a CF-Visitor-ból).

## Tanulságok
- A „már kint van élesen” emlékezetet a kulcsNEVEK mérése cáfolta — értéket nem kell olvasni hozzá.
- A `programs-editor-check` a tiszta mainen is pirosra megy párhuzamos park-írók alatt (flake, 2 SUB-nál +1 land-kör).
- A port-őr és az élesi-írás-őr hook a parancs SZÖVEGÉRE néz: briefírás heredoc-kal („:4600”, „Websupport”) blokkolódik → Write eszköz.
- Egy diagnosztikai segédügynök egy ideiglenes SQL-fájlt a prod /tmp-be másolt, majd törölte (adatot nem érintett) — a briefbe
  „stdin-ről” kell írni, hogy ez se történjen.

## Fájlok
Koordinátor: ez a jegyzet; briefek a fán kívül (`~/rc-briefs/dk-*.md`, `deploy-common-rules.md`); jelentések
`~/rc-briefs/reports/deploy-keszenlet/`; döntési HTML-ek `assets/design-refs/_drafts/deploy-keszenlet/` (gitből kizárva).
