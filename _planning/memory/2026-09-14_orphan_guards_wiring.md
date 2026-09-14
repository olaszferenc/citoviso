# 2026-09-14 — 21 árva őr: a kapu-rendszert semmi nem mérte

**Kiinduló bejelentés (A4 brief):** két friss őr nincs kapuba kötve —
`renewal-date-coherence-check` (ADR-0144) és `room-card-overflow-check`. Mérve:
`grep -n "renewal-date\|room-card" hooks/pre-commit` → 0 találat, miközben 174 más
`scripts/` hivatkozás van benne.

**ADR:** [ADR-0152](../DECISIONS.md) · **Élesítés NINCS** (§0.3) · **Termék-kód nem változott.**

---

## ① A leltár — nem kettő volt, hanem HUSZONEGY

A 95 `scripts/*-check.mts`-ből 21 volt árva. Egyik sem szerepelt sem a
`hooks/pre-commit`-ben, sem a `scripts/land.sh`-ban; a rájuk mutató 7 forrás-komment
(`Guard: scripts/…-check.mts`) mind egy soha le nem futó ellenőrzésre hivatkozott.

Mind a 21-et lefuttattam (rc + idő + mit igényel):

| őr | rc | idő | sors |
|---|---|---|---|
| geo-verify-check | 0 | 5 s | **bekötve** (offline) |
| ical-check | 0 | 7 s | **bekötve** (offline) |
| places-outage-check | 0 | 5 s | **bekötve** (offline, stubolt fetch) |
| scrape-coverage-check | 0 | 7 s | **bekötve** (szintetikus Places-világ) |
| scrape-liveness-check | 0 | 6 s | **bekötve** (saját eldobható fixture, takarít) |
| multilang-tier-check | 0 | 19 s | **bekötve** (saját lead+tenant+site fixture) |
| domain-provision-check | 0 | 26 s | **bekötve** (eldobható DB) |
| order-paylink-check | 1 → **0** | 10 s | **bekötve** — csak `PAYMENT_GATEWAY=mock`-kal indul |
| renewal-date-coherence-check | 0 | 33 s | **bekötve** (eldobható DB) ← *a brief ①* |
| room-card-overflow-check | 0 | 144 s | **bekötve** (saját tmp-fa) ← *a brief ②* |
| ad-banner-render-check | 0 | 7 s | kivétel — **park** |
| booking-price-coherence-check | 0 | 17 s | kivétel — **park** |
| hero-pick-check | 0 | 26 s | kivétel — **park + fizetős** |
| copy-panel-check | **1** | 63 s | kivétel — **park** |
| hero-override-check | **1** | 9 s | kivétel — **park** |
| hero-override-ui-check | **1** | 69 s | kivétel — **park** |
| pattern-badge-check | **1** | 15 s | kivétel — **park** |
| outreach-link-host-check | 0 | 5 s | kivétel — **telepítés-mérő** |
| recurring-mandate-check | — | — | kivétel — **kézi** (valódi kártyaterhelés, 3DS) |
| module-config-check | **1** | 9 s | ⚠️ **ADÓSSÁG — elrohadt fixture** |
| lead-page-surface-check | **1** | 334 s | ⚠️ **ADÓSSÁG — VALÓDI TERMÉK-HIBA** |

## ② A park-függőség KIMONDVA (a brief 4. pontja)

Hét őr a KÖZÖS teszt-parkra méri magát. Négy **ma is piros**, és egyik sem a kód miatt:
`hero-override-check` ENOENT-et kap a közös `sites/`-ben lévő
`mock-aranykagylo-36-fullbleed-ab5b3bb9.html`-re · `pattern-badge-check` maga írja ki, hogy
„a mock fájl nincs meg ebben a fában" · `copy-panel-check` beégetett lead-UUID-ra
(`e16165d9-…`) vár `.cp-scale`-t 30 s-ig · `hero-override-ui-check` a `.hp-undo`-ra.

Kettő **zöld, de üres parkon szándékosan pirosra megy** — és pont ez a veszélyes:
`ad-banner-render-check` anti-vakuum őr (ha nem lát galéria- ÉS JSON-LD-képet a korpuszban,
kimondja, hogy „a »nincs hirdetés« állítás megalapozatlan"), `booking-price-coherence-check`
pedig `⛔ nincs vizsgálható oldal (provisioned/live, slug-gal)`-lal bukik. **Bekötve ezek pont
a purge után állítanák meg mindenki landolását** — ahogy 2026-09-13-án már megtörtént.

⚠️ Egy soft függőség a bekötöttek között, a hookban névvel kiírva: az `order-paylink-check`
saját lead+mock fixture-t épít, de kell hozzá EGY tetszőleges `scrape_run` sor
(`executeTakeFirstOrThrow`) — purge-elt parkon ott száll el, és akkor NEM a commit a hibás.

## ③ Amit a mérés a bejelentésen TÚL talált

**(a) Az ADR-0147 ③ szabálya pontosan EGY helyen érvényesült.** Az 50 diff-scope-olt blokkból
**48 nem tartalmazta a saját fájlját** a triggerében — vagyis 48 őr átírása ellenőrizetlenül
ment volna át. Mind a 48 javítva.

**(b) 5 bekötött őr NÉMÁN kimaradt a landolásból.** A `changed_files()` függvény azért létezik,
mert a `land.sh` a kaput `LAND_RANGE`-dzsel, ÜRES indexszel futtatja — de öt blokk nyersen a
`git diff --cached --name-only`-t olvasta, ami ott mindig üres: `configurator-float-check`,
`modsec-align-check`, `market-gate-check`, `tenant-legal-check`, `snapshot-propagation-check`.
**Mind az 5-öt külön lefuttattam, mind zöld** (96/17/10/9/5 s), ezért az átkapcsolás nem visz be
új pirosat senki landolásába.

**(c) A legfontosabb: egy árva őr egy ÉLŐ hibát takart.** A `lead-page-surface-check` ma piros
az `origin/main`-en, és nem fixture-rohadás miatt: `aurora`/mobil nézetben a lebegő pirula
(y=769, 195×83) a **„Szabad időpontok megtekintése" CTA 23 %-át takarja** (rect 35,822 320×80,
vh=844). A 6 önteszt és a többi 60+ állítás zöld. **Ez pontosan az a hiba, amiért az őr készült
(Elek FK-004b ②)** — van róla mérésünk, és mert soha nem volt bekötve, nincs róla tudomásunk.
Az árva őr tehát nem elmaradt munka: kiszállított hiba.

## ④ A szállítás

`scripts/guard-wiring-check.mts` — öt szabály, piros önteszttel:
① minden őr bekötve vagy INDOKKAL kivétel · ② a diff-scope-olt trigger illeszkedik az őr saját
fájljára · ③ a trigger a `changed_files`-t olvassa, nem nyersen a `--cached`-et · ④ a
kivétel-lista élő (létező fájl, nem bekötött) · ⑤ a kivétel **MÉRT**: `kind` (kézi · telepítés ·
park · elrohadt) + `measuredOn` dátum + `measured` szöveg arról, mit adott a futás.

⛔ **A kivétel nem mentesítés, hanem kimondás.** „Lassú" nem lehet indok — arra a diff-scope-olt
trigger a válasz. A két ELROHADT sort a meta-őr **minden futásban külön kiírja**, hogy a „minden
zöld" sor ne olvasódjon rendben lévő állapotnak.

**A meta-őr MINDIG fut, diff-scope nélkül.** Szándékos: egy új árva úgy keletkezik, hogy valaki
létrehoz egy `*-check.mts`-t és a hookot meg sem nyitja — vagyis pont akkor, amikor semmilyen
hook-fájlra szűkített trigger nem tüzelne. Ára ~3 s, böngésző és DB nélkül.

## ⑤ Bizonyítás — „bekerült a fájlba" nem bizonyíték

- **A (végponttól végpontig):** szándékosan bekötetlen `scripts/zzz-proof-check.mts` staged →
  valódi `git commit` → **exit 1**, HEAD nem mozdult, a meta-őr állította meg.
- **B:** a `render.ts` kitöltője visszarontva a 2026-09-13-i alakra (abszolút panel a SZÜLŐBE) →
  a trigger tüzel, az őr **9/114 mérésen bukik**, exit 1.
- **C:** a `nextChargeDate` visszarontva „ma + 12 hónap"-ra → a trigger tüzel, és az őr
  reprodukálja az EREDETI leletet: `képernyő 2027-09-14 · subscription.current_period_end
  2027-09-11`, exit 1 — **miközben az „első vásárlás" ág zöld marad**, tehát megkülönböztet,
  nem vakon tör.
- **A meta-őr önteszt:** mind a négy szabály sértését előállítja szintetikus hook-szövegen, plusz
  egy ÁLPOZITÍV-kontroll (tiszta alakra némának kell lennie).

## ⑥ Nyitott tételek (mind külön szálra)

1. ⚠️ **`lead-page-surface-check` piros — TERMÉK-HIBA.** Az aurora/mobil pirula-ütközés a
   vevő vásárlási CTA-ján. Javítás után **be kell kötni** (a kivétel-sor akkor törlendő).
2. ⚠️ **`module-config-check` piros — elrohadt fixture.** A `source: "booking:xyz"` és a
   foglalás-slot mai `cit-enquiry` markupja. Javítás után bekötni.
3. A 7 park-függő őr csak akkor köthető be, ha kap önhordó fixture-t (vagy ha a park
   garantáltan létezik) — ma ez nem áll fenn.
4. A `*-lint.mts` és `*-selftest.mts` családot NEM leltároztam; a meta-őr ma csak a
   `*-check.mts` mintára szól. Érdemes kiterjeszteni.

## Módosított / létrehozott fájlok

- `scripts/guard-wiring-check.mts` — ÚJ (meta-őr, 5 szabály, piros önteszt)
- `hooks/pre-commit` — 11 új őr-blokk · 48 trigger ön-triggerrel bővítve · 5 trigger
  `changed_files`-re váltva
- `_planning/DECISIONS.md` — ADR-0152
- `_planning/memory/INDEX.md`, `MEMORY.md` — ez a bejegyzés
