# 2026-10-28 — Bábel eseményre ébred, a Koordinátor alatt; deploy b6384a2f

**Tulaj:** „csak akkor fusson bábel, ha igény van rá: pl deploy … A mostani nyelvi fordító események triggereljék bábelt”; Bábel a Koordinátor alá (Magellan már ott volt, 🟩2.6).

## Elvégzett munka
- Bábel SUB-ja (b26a867b, `~/wt/citb26a867b`) a `🟩2 Koordinátor` (29fb4f7c) alá: `~/.claude/rc-sub/<sid>` parent + `rc-subnums.json` (🟩2.10). A Koordinátor tmux-üzenetben tájékoztatva.
- `~/rc-briefs/watch/babel-watch.py` (cron */10, csak git, $0): igény = a `catalog.json` új kulcsai az utolsó `prod/*` tag óta, amit a `babel/packs/<lang>.json` nem fed + az azóta változott `kb/entries/<id>`, aminek a KB-magja régebbi; élő nyelv = van seed-pack. Jegy `~/babel/beerkezo/*-igeny-*.md`, magától zárul, ha a mag lefedi. Átadás tmux-ba csak, ha Bábel tétlen és a beviteli sora üres — a halvány (SGR 2) Claude-javaslat nem számít begépelt szövegnek (mérve: „kezdd el a német csomagot” szürkén). Újra-átadás 3 óra után.
- `scripts/deploy-prod.sh` GATE 5 bukás → `~/babel/beerkezo/<ts>-deploy-gate5.md` a mért kimenettel.
- `babel/charter/RUNBOOK.md` §4c (jegyek).
- Első éles kör: jegy 3332ebbb (1 új felirat en/sl) → Bábel fordította, landolta (`b6384a2f`) → a jegy magától zárult (18 perc).
- Deploy (tulaj-engedély): éles = `b6384a2f` (prod/20261028-0859); GATE 5 en/sl 5656/5656, KB 24/24; tudasbazis-or PASS a `views.ts` hiány-sávjára.

## Módosított fájlok
`scripts/deploy-prod.sh`, `babel/charter/RUNBOOK.md`, `MEMORY.md`; repón kívül `~/rc-briefs/watch/babel-watch.py`, crontab, `~/.claude/rc-sub/b26a867b-…`, `~/.claude/rc-subnums.json`.

## Nyitott
- A fizetett többnyelvű honlap „Bábelre vár” hibája még nem ír jegyet (0 ilyen vevő).
- `src/i18n/spend.ts` maradék a `public.ts` következő módosításával törölhető.
