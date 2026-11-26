## ADR-XXXX — A mainre csak a land-soron át: push-őr + soros hotfix-merge (land-merge.sh)

- **Dátum:** 2026-11-26
- **Státusz:** elfogadva (tulaj: „Ok”, 2026-11-26, a „land 3 óra” panaszra)
- **Érinti:** `hooks/pre-push` (új), `scripts/land-merge.sh` (új), `scripts/land-lock-check.mts` (⑦–⑨), `hooks/pre-commit` (a land-lock-check indító-mintája); előzmény: ADR-0275 (gépszintű land-sor)

### Mi volt a baj (mérve 2026-11-26 12:40)
- A landok a gépszintű zár alatt sorban futnak (ADR-0275): fetch → rebase → tsc → kapuk → push → visszaellenőrzés. Ez csak akkor működik, ha a mainre más út nem vezet.
- 8 óra alatt a main 18 first-parent commitjából **8 a soron kívül került fel kézi pushsal**: a koordinátor `Merge remote-tracking branch 'origin/main' into wt/cit5980e14c` merge-ei és a hotfix `-s ours` merge-ek (a land.sh rebase-e a merge-et eldobná, ezért kézzel mentek).
- Minden ilyen push alatt a zárat tartó land pusha visszapattan, és a land újra rebase-el, majd **a teljes kapusort újrafuttatja**. Élő példa: `citb28926a1` 12:11-kor rebase, 20 perc kapu, 12:24-kor egy kézi merge, 12:31-kor újra rebase és újra kapuk. A sorban mögötte álló land közben 17 perce várt. Így lett egy land órákig tartó.

### Döntés
1. **`hooks/pre-push`:** a `refs/heads/main`-re menő pusht elutasítja, hacsak a hook folyamata nem a land-zárat épp tartó folyamat (a `cit-land.lock.holder`-ben megnevezett PID: land.sh vagy land-merge.sh) **leszármazottja**, és a zár valóban foglalt. Ősláncot néz, nem exportált változót, így a régebbi fából indított land.sh is átmegy (az ő land-lock.sh-ja nem exportál semmit), és egy kézi push akkor sem, ha épp más land tartja a zárat. Más ref (hotfix-ág, tag, a deploy szerver-pusha) érintetlen. Kikerülő kapcsoló nincs.
2. **`scripts/land-merge.sh <ref>`:** a hotfix `-s ours` merge soros, gyors útja. A zár alatt: fetch, egy merge-commit, amelynek a FÁJA az origin/main saját fája (bájtra azonos tartalom, ezért egyetlen kapu ítélete sem változhat, és kapu nem fut), szülei az origin/main és a ref; push, visszaellenőrzés („LAND-MERGE: IGAZOLTAN FENT”). Ha a main már tartalmazza: „nincs teendő”. A kézi `git merge -s ours` + `git push HEAD:main` megszűnt.
3. Saját munka a mainre továbbra is: `bash scripts/land.sh`.

### Igazolás
- `land-lock-check` ⑦–⑨, eldobható repóban, a VALÓDI hookkal és szkripttel:
  - ⑦ zár nélkül a main-push elutasítva, a main nem mozdul, és az üzenet megnevezi a két utat; ha MÁS land tartja a zárat, a kézi push akkor is elutasítva; a zártartó pusha átmegy; másik ágra zár nélkül is lehet pusholni.
  - ⑧ a land-merge után a main fája változatlan, a hotfix-commit a main őse, a merge két szülős; a második futás „nincs teendő”.
  - ⑨ visszarontás: ha a hook nem utasít el, a ⑦ piros.
  - 26 állítás zöld, 24 s.
