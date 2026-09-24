# 2026-09-24 — „Worktree commit összeakadások” — három gyökérok, mindhárom zárva (ADR-0223)

**Kiváltó (tulaj):** „sokadik napja fordul elő, hogy worktree commit összeakadások vannak a
sessionok között… ez a probléma mindenhol fennáll: CIT MR OF… javítsunk mindent”.

## Amit mértem

1. **A mai „idegen commit” (`3333302e`, `wt/cit8582db2c`) tettese a watchdog CÍMADÓJA.** A
   `gen_title()` headless haikuja (`claude --print --allowed-tools ""`, cwd=HOME) a session
   üzeneteit végrehajtotta: `Read MEMORY.md` → `find / -name .git` → `git worktree list` → `cd`
   → `git add && git commit` (angol üzenet, trailer nélkül). Az `--allowed-tools ""` bypass alatt
   semmit nem tilt. CIT: 59 futásból 8 eszközös, 1 commit; MR: 71-ből 6. A 08:16-os futást a
   watchdog 75 mp-es timeoutja ölte meg — a commit után. OF-en nincs haiku-címadó.
2. **A resume-nak nem volt fa-őre** (a `rc-new.sh`-nak 09-23 óta van): OF két `--resume`-olt
   session egy fő fában (egyik 17 napja használatlan blank), MR 3–4 örökölt session a
   `minereal` fő fában. CIT-en MOST 0 fa két élő sessionnel (`/proc/*/cwd`); 24 órában egy
   projekt-mappa sem kapott két átiratot. A `main` 144 commitjából (09-16 óta) 134 trailer-es,
   a 10 trailer nélküli mind a land ADR-számozója.
3. **Kapu-versenyek** (182 őr átnézve, Explore-alagent): szerver-import `CIT_SHOT` nélkül →
   közös `language_pack` írás minden commiton; 5+1 fix nevű scratch-DB; fix fixture-kulcsok;
   fix `/tmp` és `assets/Temp` nevek.

## Amit csináltam

- **Infra (a repón kívül, `~/bin`, CIT+MR+OF; backupok `_backup-20260924-094x/`):** címadó
  `--tools "" --permission-mode default` + üres cwd + adat-keretezés + fail-closed
  (`--selftest-title`); `resume()` fa-őr: foglalt fa → saját worktree + `RC_NOTICE` első prompt
  (`--selftest-resume-guard`). Service-ek újraindítva, dry-tick zöld. Doktrína: globális
  `CLAUDE.md` §8/§9. OF élő próba: a leállított blank archived volt → új blank már saját fában.
- **Repó (ez a commit):** `server-import-env-check` őr + 4 őr javítva; `lib/scratch-db.mts`,
  `lib/session-tmp.mts`; 22 őr per-run egyedi állapotra. Minden módosított kapu zöld
  (részletek az ADR-ben). `copy-panel-check` a HEAD-en is bukik (`.cp-scale`) — nyitva.
- Csapda menet közben: a patch-szkriptem `re.sub(…, lambda)` mellett `\g<1>` literált írt és
  elvitte a `WTROOT` sort — 3 fájl ~1 percig szintaktikailag törött (a futó service-ek nem).

## Nyitva
- MR/OF örökölt fő-fás sessionök: a következő újraindításukkor költöznek maguktól.
- `copy-panel-check` bukása; fixture-települések fix koordinátái.
- A MEMORY.md-teteje land-ütközés (ADR-0210 az indexeket kezeli, ezt nem).
