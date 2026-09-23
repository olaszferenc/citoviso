# 2026-09-23 — A közös doksik ütközése: ADR-enként külön fájl, generált indexek, duplikátum-kapu (ADR-0210)

**Mandátum:** `~/rc-briefs/adr-conflict-structural-brief.md` (A + D most, B + C utána). **Élesítés:** NINCS (§0.3).

## Mit csináltunk
- **Felmérés ELŐBB:** a `DECISIONS.md`-nek NINCS gépi olvasója (csak próza). Csapda: a
  `_planning/DOMAIN/_tools/REFINE-DECISIONS.md` MÁS fájl — egy „DECISIONS.md"-mintára írt csere eltalálná.
  A kézi `INDEX.md` 209 jegyzetből 25-öt nem tartalmazott. A duplikátumok: `0033` (valódi hiba) és
  `0186`/`0186 utószál` (szándékos). A napló sorrendje nem volt monoton (3 helyen).
- **Migráció:** 209 blokk → `_planning/decisions/NNNN-slug.md`, preambulum → `README.md`.
  Bájtra igazolva kétféleképpen (TS `verify-split` + független awk/sha256), négy pozitív kontrollal.
- **Tulajdonosi döntések:** RÖVID index (nem teljes szöveg) · a 0033 most csak megjelölve.
- **Land:** `scripts/land-rebase.sh` — ha CSAK a két generált index ütközik, újragenerál; régi alakú
  szerkesztést blokk-szinten átvisz; minden más ütközés hangosan megállít.
- **Kapuk:** `planning-index.mts check [--staged]` (frissesség + duplikátum + fájlnév↔fejléc) és
  `planning-index-land-check.mts` (eldobható repó, 22 állítás, negatív kontroll, 3 célzott rontás mind piros).

## Tanulság
- ⛔⛔ **A HOOK-BAN FUTÓ ŐR ÖRÖKLI A `GIT_DIR`-T:** a fixture „teszt-repójának" parancsai a VALÓDI
  repón futottak (közös config `core.bare=true` + hamis `user.*`, fixture-commit a saját ágamon).
  Kézzel kétszer zöld volt — a hook a valódi környezet. Git-fixture-t építő őr: `GIT_*` ki a
  gyerek-környezetből + tripwire (a git-dir a tmp alatt van-e) MINDEN írás előtt; csali repóval bizonyítani.
- ⭐ **A számütközés munka közben élesben megtörtént:** az ADR-t 0209-ként írtam, egy párhuzamos szál
  közben landolta a 0209-et → 0210 (a saját hivatkozásaimat tételesen, az idegenhez nem nyúltam).
- ⛔ **A darabolás MAGA rontott volna:** külön fájlok között a git nem jelez ütközést, tehát a két
  `0209-*.md` némán beolvadt volna. Ezért a duplikátum-kapu („C" minimuma) NEM várhatott „utánára".
- ⛔ **Az első pozitív kontrollom nem rontott semmit** (`sed s/a/á/` egy „a" nélküli soron) — a mérés
  zöld volt, és ez SEMMIT nem bizonyított. A kontroll kiírta, hogy a fájl nem változott; enélkül
  zöld-zöldként könyveltem volna el. A rontásnak BIZONYÍTOTTAN változtatnia kell (`cmp`).
- ⭐ A tesztben a teljes `land.sh`-t nem szabad futtatni (fő-fa frissítés + szerver-restart) —
  ezért lett a rebase-lépés külön szkript: a teszt a valódi kódutat futtatja, a mellékhatás nélkül.

## Módosított / új fájlok
`_planning/decisions/*.md` (a régi napló ADR-jei + README + ADR-0210) · `_planning/DECISIONS.md` (generált) ·
`_planning/memory/INDEX.md` (generált) · `scripts/planning-index.mts` · `scripts/land-rebase.sh` ·
`scripts/planning-index-land-check.mts` · `scripts/land.sh` · `hooks/pre-commit` · `CLAUDE.md` §1.4/§3.1 ·
`.claude/agents/tudasbazis-or.md` · `MEMORY.md`

## Nyitva
- **B** — a szám a land pillanatában (helyőrző → kiosztás az utolsó fetch után, csak a saját diffben).
- **ADR-0033** átszámozása (tulajdonosi döntés; a `KNOWN_DUPLICATES`-ből utána törlendő).
- A `MEMORY.md` „Aktív feladat" blokkjának ütközése (A+D nem fedi).
- Futó szálak régi alakú, commitolatlan `DECISIONS.md`-szerkesztéssel (mérve 2026-09-23):
  `~/wt/cit2167c7de`, `~/wt/mocklapleadszem` — a rebase-ükön a feloldó viszi át, vagy hangosan megáll.
