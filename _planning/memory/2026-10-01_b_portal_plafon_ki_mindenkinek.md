# Portál előbb, mindenkinek — a 60-as plafon ki, a tárolt park backfill-szkriptet kapott (B rész)

**Dátum:** 2026-10-01 · **Szál:** SUB „B rész” a Places-költség briefből (koordinátor: CIT „Places API 600 $”) ·
**Döntés:** ADR-0294 (portál előbb, mindenkinek)

## Elvégezve
- `enrichPortal`: minden kontaktálható lead ISMERT adatlapja olvasva (plafon nélkül); a fizetős webes felfedezés
  futásonként ≤60 lead (`maxSearchLeads`, 0 = soha); párhuzamosság 2 → 4 host; `portalLookupAt` jel.
- `run.ts`: a portál-olvasás csak az ÚJ leadekre fut (a store-dedup halmazával előre szűrve — a tárolt lead
  eddig is eldobódott a futás végén, az olvasott adattal együtt). `persist.ts`: `storedLeadIdentities()` közös.
- `scripts/portal-backfill.mts`: a tárolt park olvasása (szárazfutás alapból, `--go` ír, kötegenként ment,
  folytatható; Google-t/keresőt nem hív). Dev-en 5 leaddel kipróbálva: 3-nak lett portál-fotója (52 fotó).
- Őr: `scripts/portal-uncapped-check.mts` (pre-commit, fetch-csonk, ~8 s). A régi kóddal 4 állítása bukik.

## Mérve
- 40 véletlen éles lead / 97 adatlap valódi olvasása: 158,7 s (C=2), 24/35 leadnél adatlap, 463 fotó.
- Teljes élesi park (1 057 lead jelölttel, 2 702 URL, 759 host) visszajátszva: C=2 ~100 perc, C=4 ~78 perc,
  C≥6 ~72 perc. Padló: hovamenjek.hu 189 adatlap × ~18 s (képenkénti méret-mérés ugyanazon a hoston).
- booking.com: 426 jelölt-URL, 6/6 bot-oldal → haszontalan olvasás (~10 perc / teljes kör).

## Nyitott
- A backfill élesi futtatása (`--go`, ~78 perc) — a nagy deploy UTÁN, a tulaj/koordinátor döntése.
- booking.com `challenge_protected`-re tétele a registryben? (koordinátori döntés)
- hovamenjek képmérés gyorsítása (cache) → a teljes kör ~40 percre.

## Fájlok
`src/scraper/enrichPortal.ts` · `src/scraper/run.ts` · `src/scraper/persist.ts` · `src/scraper/types.ts` ·
`src/scraper/sources/portalListing.ts` · `scripts/portal-backfill.mts` · `scripts/portal-uncapped-check.mts` ·
`hooks/pre-commit` · `_planning/decisions/XXXX-portal-elobb-mindenkinek-plafon-ki.md`
