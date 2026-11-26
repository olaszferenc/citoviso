## ADR-0494 — Land: optimista előkör — a kapuk a land-zár ELŐTT futnak, a zár alatt csak a push (2026-11-26)

- **Státusz:** elfogadva (tulaj, 2026-11-26: „mehet minden a gyorsításra”)
- **Érinti:** `scripts/land.sh`, `scripts/land-lock.sh` (`land_pregate_valid`), `scripts/land-lock-check.mts` (③ új alak, ⑥ +2 visszarontás, ⑩), `hooks/pre-commit` (komment); módosítja: ADR-0275 (gépszintű land-sor) „a zár az ELSŐ fetch előtt” szabályát

### Mérés (2026-11-26)
- Egy land a zár alatt 400–900 s-ot töltött: rebase 20–29 s, tsc 116–137 s, kapuk 260–730 s. A zárat közben minden más land várta, és kb. 10 párhuzamos szálnál ez sor lett: a tulaj szerint „EGY LAND 3 óra”.
- A deploy-szkript maga ma 3–10 perc volt (`deploy-prod.sh`), és a mainről 15–30 perc alatt kiment. A várakozás tehát nem a deploynál, hanem a land-sorban gyűlt.

### Döntés
1. A land először zár NÉLKÜL fetchel, rebase-el, és lefuttatja a tsc-t és a teljes kapusort, ugyanazzal a függvénnyel (`land_gates`), amely a zár alatt is fut.
2. Ezután veszi fel a zárat, és a zár alatt ÚJRA fetchel. A `land_pregate_valid <base> <head>` csak akkor igaz, ha az origin/main pontosan az a commit, amelyre az előkör rebase-elt, és a HEAD pontosan az, amelyen a kapuk futottak. Ekkor a kapuk már pontosan arra a fára futottak, amelyet a land pushol, és a zár alatt csak a push, a visszaellenőrzés és a fő-fa frissítése fut.
3. Ha bármi mozdult, a rebase, a tsc és a kapuk a zár alatt újrafutnak, pontosan úgy, mint eddig. Kapcsoló, amely az előkört ellenőrzés nélkül elfogadná, nincs, és az őr tiltja.
4. Minden land egy sort ír a közös git-könyvtár `cit-land-times.log`-jába (összesen, a zár alatt, az előkör érvényes-e, szakaszonként), hogy a sor költsége később is mérhető legyen.

### Miért nem lazít
Egyetlen kapu sem marad ki olyan fára, amelyet nem látott: a pusholt fa vagy bájtra az, amelyen a kapuk futottak, vagy a kapuk a zár alatt újrafutnak. A push-őr (ADR-0485) változatlan: a mainre csak a zártartó pusholhat. Az ADR-szám kiosztása is az utolsó fetch utáni marad, mert ha a main mozdult, a `land-rebase.sh` visszavonja és újraosztja.

### Ára
Ha a main az előkör alatt mozdul, a kapuk kétszer futnak: egyszer zár nélkül, egyszer a zár alatt. Ez CPU, nem várakozás, és a gépi slotok (6) ezt is korlátozzák. A tényleges találati arányt a `cit-land-times.log` mutatja meg.
