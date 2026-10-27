# 2026-10-27 — Válasz-javaslat: Poe soha nem kapta meg a jegyeket → válasz-figyelő (ADR-0340 A út)

**Kérés (tulaj):** „A leadektől nem generálódik automatikus válasz … ez hogyhogy nem működik?”

**Diagnózis (éles DB, csak olvasás):** a gyűjtő írta a Poe-jegyeket (`~/poe/beerkezo/*-valasz-*.md`), de Poe
egyet sem dolgozott fel: 12 válaszból 0-n volt `suggestion_*`. Poe a koordinátor mock-kötegein dolgozott,
a RUNBOOK §1 sorrendjében a válasz-jegy nem szerepelt, és semmi nem ébresztette rá.

**Döntés (tulaj): „A) verzió”** — Poe marad a szerző (nem szerver-oldali AI-hívás).

**Elvégezve:**
- `~/rc-briefs/watch/valasz-watch.py` (repón kívül, crontab `* * * * *`): a nyitott (`KÉSZ` nélküli, ≤14 napos)
  válasz-jegyet beírja Poe élő sessionjébe (a `~/.claude/sessions` regiszterből a `~/wt/poe` cwd alapján, csak üres
  beviteli sornál); 60 perc múlva újra szól. Állapot `valasz-tried.json`, napló `valasz-watch.log`. Élesben igazolva:
  a Szépapám háza jegye 10:00-kor jött, ugyanabban a percben átadva.
- `poe/charter/RUNBOOK.md` §1: a válasz-jegy mindent megelőz; §6b: MINDEN jegyre javaslat (elutasítóra is rövid
  nyugtázás), a „Megválaszoltam”-ot Poe soha nem nyomja meg — a küldés/lezárás mindig a tulajé.
- Poe javaslatai: Napfény (árlista), Andi + Villa Eszter (bocsánatkérés), König + Szépapám (nyugtázás) — mind a tulaj küldi.
- ⛔ Hiba és javítás: 10:24-kor a koordinátor utasítására Poe a König/Szépapám tételt javaslat nélkül lezárta; a tulaj
  („én hagyjam jóvá a szövegterveket”) → visszavonva, javaslat letéve, szabály rögzítve.
- Élesen (tulaj „igen”): König Hotel + Szépapám háza leiratkoztatva (`prospect.unsubscribed_at` + optout-log, status lost);
  mentés `/opt/citoviso/backups/optout-konig-szepapam-20261027-095331/`.
- A régi, már megválaszolt 5 jegy `KÉSZ`-re zárva (a figyelő ne adja át újra).

**Módosított fájlok:** `poe/charter/RUNBOOK.md`, `MEMORY.md`, ez a jegyzet; repón kívül `~/rc-briefs/watch/valasz-watch.py` + crontab.
Élesre kód nem ment (nincs deploy-teendő).

**Nyitott ötletek (nem sürgős, döntést nem várnak):**
- Konzol: a leiratkozás idejét UTC-ben, a kiküldést helyi időben írja ki (Poe ezért hitte, hogy a kampány átlépte Villa Eszter leiratkozását — nem lépte át: 15:22 levél → 15:54 válasz).
- Konzol: saját „Nem válaszolunk (elutasító)” címke a „Megválaszolva” helyett (§2b terv kellene).
