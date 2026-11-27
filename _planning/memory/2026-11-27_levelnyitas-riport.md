# Levél-megnyitás a Riport-tölcsérben (2026-11-27)

SUB `citab2df38a`, koordinátor `cit96bd8170`, brief `~/rc-briefs/levelnyitas-riport-20261127.md`.

## Kérdés
A tulaj: „a levél betöltésekor a kép letöltésével mérjük, hogy megnyitják-e az emailt. Erre nem látok reportot.” Az `email_open` (ADR-0462) 11-23 óta gyűlik, a konzol sehol nem mutatta.

## Elvégzett
- Tölcsér: új első kártya **„Megnyitotta-e a levelet?”** (levél-megnyitás / kiküldött levél, cél 40%, `mail_open_rate`). Alatta Gmail / egyéb, halványan Apple-előtöltés + robot, „… óta mérjük; képblokkoló levelezőnél alulszámol”. A „Megfogja-e a levél?” kártyán: „kattintott / megnyitotta a levelet” (+N kattintó levél-megnyitás nélkül).
- Bontás: „Levelet megnyitotta” oszlop + új bontás „Címzett postafiókja” (Gmail · Egyéb levelező · Nem ment e-mail).
- Definíció (`reportData.ts` fejléc): mért levél = e-mail az első olyan küldéstől, amelyhez valaha `email_open` sor jött; megnyitás = `kind='open'`, `own=false`, **≥60 mp a küldés után**. A 60 mp-en belüli „open” robotnak számít, a régi sorokra is. Ez a 11-23 14:32-es író-oldali szabály visszamenőleg. Csak első kör (az utánkövető levélben nincs távoli kép).
- Őr: `scripts/mail-open-report-check.mts` (tiszta fold + oldal + DB-láb: fold = a brief SQL-je; `--self-test`), bekötve a `hooks/pre-commit`-be.

## Mérés (éles, csak olvasva, 11-27)
- 47 „open” sor a 11-23 14:32-es javítás előtt a küldés utáni 60 mp-en belül jött (szkenner). A szabállyal: Gmail 119 → 52 megnyitó (régi számolással 67), egyéb 54 → 7 (10).

## Módosított fájlok
- `src/console/reportData.ts`, `src/console/reportViews.ts`, `public/assets/ui/citui-console.css`
- `scripts/mail-open-report-check.mts` (új), `hooks/pre-commit`, `scripts/kb-shot.mts`
- `kb/entries/console-report/entry.hu.md` + `assets/hu/{screen,behaviour,order-panel}.png`
- `src/i18n/catalog.json`, `src/i18n/catalog-context.json`
- `MEMORY.md`, ez a jegyzet

## Nyitott
- Élesítés: a koordinátoré (deploy nem az enyém).
