# 2026-10-11 — Portál-naptárszinkron: Elek 4. körének javításai (B1 + K1–K8 + A1–A13)

**Szál:** SUB az „Elek-teszt koordinátor” alatt (brief `~/rc-briefs/foglalas-portal-javitasok-elek-20261011.md`).
Elek jelentése: `~/wt/cit333dea6d/_from-sub/f75e9b8a/_elek/JELENTES.md`. Döntés: ADR-XXXX (a land osztja ki).

## Elkészült
- **B1** — `/naptar/<token>.ics` (és `/naptar/<token>/<portál>.ics`) a tenant-hoszton, saját domainen, dev `/t/<slug>/`
  úton is; a tenant-hoszt csak a saját szállása egységét adja; a fagyasztás (503) előtt fut. Más tenant-oldali link
  ugyanezzel a hibával: nincs (a jogi lapokat a tenant-router szolgálja, a levél-linkek a `mailLinkRoutes` listán).
- **K1** — ütközés egy nálunk elfogadott éjszakával: nem töröl; `calendar_conflict` napló, kártya (nap + vendég),
  egyszeri tulaj-levél (`src/booking/syncMail.ts`); a darabszám = ténylegesen átvett éjszakák.
- **K2** — a 4 MB-os korlát streamelve (400 MB-os végtelen feed: +2 MB RSS, korábban +1,17 GB).
- **K3** — csak publikus cím (DNS után a socket `lookup`-jában + minden átirányításnál), egységes hibamondat;
  dev-kivétel `CALENDAR_SYNC_ALLOW_PRIVATE=1`, csak loopbackre és csak nem-platform `publicSiteUrl` mellett.
- **K4** — `injectRuntime` a már injektált oldalon cserél; a `/p/<token>` (injectConfigurator) kiszolgáláskor frissít →
  deploy után a kiküldött mockokon is látszik a minta-sáv. Élesen NINCS újrarenderelés/backfill.
- **K5** — vendég-naptár: a foglalt éjszaka első napja távozásnak választható (asztal + mobil, képpel).
- **K6** — azonos kérés 10 percen belül (advisory lock) = ugyanaz a kérés, egy levél.
- **K7** — 24 h folyamatos hiba → egy tulaj-levél a gyógyulásig; `last_ok_at`, `calendar_sync_run` (utolsó 10 futás).
- **K8** — 6-os párhuzamosság, 120 mp-es keret, legrégebbi elöl; a karbantartó szkriptben a szinkron külön try-ban.
- **A1 A2 A4 A5 A6 A7 A9 A11 A12 A13** javítva; **A3, A8 marad; A10 nem nyúltunk hozzá** (tulaj-döntés).
- Migráció `0106_calendar_sync_health.sql`; KB `kb/entries/admin-modules-booking` hibaállapotokkal bővítve.
- Őr `scripts/portal-sync-guard-check.mts` (+ `--self-test`, K1/K4/K5/K7 szabotázs piros), bekötve; a régi kódon
  (origin/main `8f856dbd`) mérve: B1 4 hoszt-alakon 404, A6, A7 piros.

## Elek szkriptjei újrafuttatva (scratch-DB `citoviso_foglfix_10111906`, portok 4722/4922/4962)
B1 négy hoszt-alak 200 · A6 · K1 · K2 · K3 (19 eset) · K4 (kiküldött mock) · K5 · K6 · A1 · A9 · K8 · a kártya
hibaállapotai (A2/A4/A5/A11/K7) · A13 — mind PASS. Utána-képek: `_fix/shots/` (fában, gitből kizárva).

## Nyitott
- A13: a sáv már nem takar, de a döntő oldalon továbbra is van egy „Elfogadom” (süti) a lap alján — ha a tulaj a
  levélből nyíló döntő lapokról a sávot is le akarja venni, az consent-szabály döntés (ADR-0145 ③ hatókör).
- Élesítés a nagy deployjal (semmi nem ment élesre). Deploy után: a kiküldött mockokon a sáv újrarenderelés nélkül él.
