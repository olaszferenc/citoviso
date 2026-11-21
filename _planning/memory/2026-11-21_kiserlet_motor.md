# 2026-11-21 — Kísérlet-motor a hideg megkereséshez (citbeaa9a26)

**Brief:** `~/rc-briefs/kiserlet-motor-20261121.md` · koordinátor `citb64f0ed0` · ADR-XXXX `kiserlet-motor-hideg-megkereses`

## Elvégezve
- Migráció `0143_outreach_experiment.sql`: `outreach_variant` (katalógus, kontroll + kikapcsolt §3-jelöltek), `outreach_send_variant`, `email_open`. Dev DB-re felvéve.
- `src/outreach/experiment.ts`: Thompson-osztás (determinisztikus mag), 10% padló, választás a lemaradás szerint, őr + `alertHouse`, hozzárendelés/rögzítés.
- `src/outreach/emailOpen.ts`: távoli hős-kép (befagyasztott JPEG), osztályozás (Gmail-proxy / Apple-előtöltés / bot), rögzítés.
- `src/email/outreachEmail.ts`: `heroUrl`, `firstLine`, `fromName`, `bodyStyle:"plain"`, `noImage` opciók; opció nélkül a mai levél.
- `src/outreach/sendBatch.ts`: változat-hozzárendelés, második §C-kapu a kész levélen (FLAG → kontroll), távoli kép, címke a küldés után.
- `src/outreach/autoDispatch.ts`: `ensureDailyPlan` a tickben (keret = rámpa vagy `dailyCap`).
- Konzol: `GET /p/<token>/kep.jpg`; `src/console/prospectPath.ts`: a pilot-másolat a kép URL-jét is `?sajat=1`-gyel jelöli.
- `scripts/experiment-selftest.mts` + `hooks/pre-commit` bekötés; `scripts/outlook-lint.mts` a sima változatot is őrzi.
- Riport „Kísérletek” panel: §2b-terv, 3 változat (A táblák · B kártyák bizonytalansági sávval · C ítélet-sorok), mobil + asztali, Playwright-tal végigkattintva (0 JS-hiba) → a koordinátornak.

## Nyitott
- Riport-panel + hétfői összefoglaló-sor: a koordinátor/tulaj választ a 3 terv közül; addig nincs felület-kód.
- A 0,5%-os őr-küszöb vs. a mért 1,2%-os leiratkozási alapszint.
- Élesítés: nincs (külön „mehet”).
