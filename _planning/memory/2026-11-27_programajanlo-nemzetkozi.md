# Programajánló (poi) nemzetközi — az ország nyelvén keres, az új vevő azonnal kap (2026-11-27)

Session `cit9b957558`, koordinátor `cit9b4690e3`, brief `~/rc-briefs/heti-programok-nemzetkozi-20261127.md`.

## Kiinduló jelzés
A tulaj a horvát [TESZT] próbában (Ruža apartmanok, Makarska) azt kérdezte: „itt miért nincsenek javasolt programok?” A vevő-admin 0 programot mutatott.

## Ok (élesen mérve, csak olvasás)
- Az 5 perces pending gyűjtés 09:56-kor lefutott a Makarska-körre, 23 településre. Magyar kifejezéssel keresett („… programok rendezvények 2026 november december”, search_lang=hu, hu Accept-Language, `name:hu`), így 25 programot talált, szinte mind Pécsre és Dunaföldvárra. A körben 0 program volt.
- A horvát települések `settlement.country`-ja élesen 'HU' maradt (alapérték; a gyűjtés soha nem írta).

## Javítás
- `src/events/eventLexicon.ts` (új): a kör nyelve. A szavak (`eventSearchQuery`, `eventMonthNames`, `eventMonthWords`, `eventDateOrder`) a lexikonból jönnek, a search_lang és a locale az ország-sorból. Lexikon nélküli országban nincs gyűjtés.
- `src/countryLexicon/{hu,hr}.json`: a négy új kulcs. A HU a régi égetett lista, bájtra ugyanaz. A HR Bábel szava.
- `src/events/gates.ts` `dateMentioned(text, iso, spec)`: "md" (HU, a régi szabály bájtra) és "dm" (HR: „28. studenoga”, „5.12.2026.”, „12. – 14. prosinca”, „19. i 20. prosinca”, „28 de noviembre”).
- `src/events/settlements.ts`: a kör a tenant országában töltődik (`osmNameTag`, a `country` oszlop is íródik). Más országú cache → újratöltés. Ha egy település országa változik, a régi `done` futásai `stale_lang` státuszt kapnak.
- `scripts/gather-events.mts`: a kör országa `countryOfLead`. A pending a kör minden soha nem gyűjtött településére indul, 6 órás hűtéssel.
- Őrök: `scripts/events-gates-check.mts` (HR esetek mindkét irányban, a HU-kifejezés bájtra), `scripts/country-layer-check.mts` (az events-fájlok a hatókörben).

## Vak mérés (dry-run, 14 eddig nem látott település)
| | település | program | rossz dátum | körön kívüli hely | $/település | $/program |
|---|---|---|---|---|---|---|
| HR (6 tengerparti, 4 belső) | 10 | 76 | 0 | 0 | 0,0249 | 0,0033 |
| HU | 4 | 62 | 0 | 0 | 0,0241 | 0,0016 |
Hvar 0 programot adott (108 nyers, 92 túl hosszú). A gépi dátum-ellenőrzés (dátum a név ±400 karakterén belül) 8 esetet jelzett, kézzel mind helyes.

## Nyitott
- A HR „27 STU” / „stu 27” rövidítés nincs a lexikonban (Bábel kétértelműnek tartja). Varaždinon 22 date_not_in_text dobás ebből jött.
- ES/IT/BG/FR/PT: Bábel szavai készen vannak (`~/babel/munka/poi-events/<cc>.json`), de ezeknek az országoknak még nincs lexikon-fájlja.
- Élesítés után a Makarska-kör magától újragyűjtődik (stale_lang → pending, ≤5 perc).
