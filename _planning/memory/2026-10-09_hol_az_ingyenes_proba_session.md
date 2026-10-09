# 2026-10-09 — „Hol a próba-session?” — a koordinátor megtalálva, SUB-jel levéve (citcc631f6f)

Brief: `~/rc-briefs/kik-ld-s-optimaliz-l-s-20261009-125730.md` (tulaj: mi történt a hosszú sessionnel az ingyenes
próbáról és a „több mock egy linken, tabbal” kérdésről — „hol van?”).

## Lelet
- A session ÉL: `31815b5a` (tmux `rc-31815b5a`, fa `~/wt/citf3e80964`), az `f3e80964` utódja (átadás 11:04,
  az előd archiválódott). A listában „CIT ➕ 🔴 SUB ⚪ Ingyenes próba — koordinátor” néven futott: egy archivált
  session indította, az `rc-new.sh` SUB-nak jelölte, a watchdog ⚪ árva-jelet tett rá, és az `rc-handoff.sh`
  jelölőfájlja az utódra örökítette — ezért a SUB-ok közé keveredett, a tulaj nem találta.
- 12:19 óta 5 tulaj-döntésre vár benne (admin próba-sáv A/B · SMS ékezettel/nélkül · T−3/T−1 levelek szövege ·
  lejárt próba adatmegőrzése, javaslat 90 nap · ÁSZF 1.4 próba-pont). A beviteli mezőben álló
  „A, ékezet nélkül linkkel, 90 nap, ÁSZF mehet” SZÜRKE gépi javaslat, nem tulaj-input.
- Mind a 4 SUB (A/B/C/D) landolt (ADR-0342/0343/0344); 13:06-kor a nagy deploy ki is vitte (`prod/20261009-1306`).
- „Több mock egy linken, tabbal” = `feat/multimocktabs` ág (2026-09-23, 649 committal a main mögött); a tulaj
  válaszára vár, a koordinátor briefje (§6) tiltja, hogy hozzányúljon.

## Elvégezve
- SUB/⚪ jel levéve a `31815b5a`-ról (memória `feedback_owner_main_session_not_sub` négy lépése): jelölőfájl
  `~/.claude/rc-sub/31815b5a-…` törölve; `rc-subnums.json`-ban nem volt; watchdog-state `title`/`good_title`/
  `wd_title` → „CIT ➕ Ingyenes próba — koordinátor”; felhő `PUT /v1/code/sessions/cse_01U4bQi2SJLb6qkZVFiAeboU` → 200.
  Egy teljes watchdog-kör után igazolva: a cím megmaradt, új `THREAD-TAG` nincs.
- Kód nem változott.

## Nyitott kérdések (tulaj: „zárjunk így”)
- Archivált, nem landolt fák: `~/wt/cit71e7b0df` (Próba D) és `~/wt/cit30cb7173` (Próba B) — mindkettőben csak
  követetlen `_report/` képmappa (próba-B/D képernyőképek), kód nincs. Javaslat: nem landolunk belőlük, mehetnek
  a GC-nek. Tulaj-döntés nincs.
- A próba-koordinátor 5 döntése és a `feat/multimocktabs` kérdés a tulajnál.
