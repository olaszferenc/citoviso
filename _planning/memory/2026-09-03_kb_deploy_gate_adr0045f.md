# 2026-09-03 — ADR-0045/f: a tudás-őr a deploy-csőben + napi frissesség-kör (⑥)

## Mi készült

A tulaj két felvetésének leszállítása („deploy előtt az őr nézzen át mindent"; „időzített kör
frissítse a tudásbázist") — a megegyezett határral: az őr DETEKTÁL és BLOKKOL, tartalmat
felügyelet nélkül NEM ír (§J.24: a hamis súgó rosszabb a hiányzónál).

1. **GATE 1c a `deploy-prod.sh`-ban** (a GATE 1b után): ha a `PROD_SHA..SHA` tartományban
   KB-releváns diff van → ① `kb-check --coverage` a CÉL-commit eldobható worktree-jén (a kézben
   lévő fa mást mérne) → ② screenshot-frissesség WARN (view változott, asset nem) → ③ friss,
   range-kötött `tudasbazis-or` PASS-verdikt KELL (`kb-gate.mjs` token), különben a deploy elbukik.
   KB-diff nélkül néma; első syncnél kihagyva.
2. **`scripts/kb-gate.mjs`** — verdikt-token CLI a surface-gate mintájára: `pass "<from>..<to>"
   "<kivonat>"` / `check` / `--self-test` (6/6 piros-teszt: verdikt nélkül, rövid indoklás,
   MÁS tartomány, 24h TTL-lejárat mind PIROS). Kulcs = felodott SHA-tartomány (nem branch) —
   más célra új verdikt kell.
3. **`scripts/kb-freshness.mts` + `citoviso-kb-freshness.timer`** (napi 07:20, dev-gép, fő fa):
   ① prod↔repo drift (read-only ssh; kor-küszöb 14 nap) · ② screenshot-elavulás
   (view-csoport utolsó commitja vs entry-assetek utolsó commitja) · ③ `kb-check --coverage`.
   FLAG → nem-nulla exit (systemd státusz) + log (`~/.claude/citoviso-kb-freshness.log`).

## Élesben vizsgázott (valódi piros/zöld, nem szintetikus)

- **GATE 1c piros:** dry-run a valódi prod ellen (a8304ee → d1ceb06, a tegnapi KB-szelet még
  nincs élesítve) → diff-lista + determinisztikus zöld + „verdikt hiányzik" → DEPLOY ELBUKOTT ✓.
- **GATE 1c zöld:** jelölt CSŐVEZETÉK-TESZT tokennel a kapu átenged a migráció-listáig; a token
  a teszt után TÖRÖLVE, a check újra piros ✓.
- ⭐ **KÉTSZER ugyanaz a fogott hiba:** a git-pathspec sima `*`-a NEM lép át `/`-t —
  `kb/entries/*/assets` némán SEMMIT nem matchelt (üres ts=0 → 56 éves ál-elavulás a sweepben;
  hamis WARN a deploy-kapuban, miközben a diff-lista tele volt screenshottal). Helyes alak:
  `:(glob)kb/entries/*/assets/**`. A szintetikus self-test ezt NEM fogja (az összehasonlítást
  méri, nem a pathspecet) — az ÉLES adaton futtatott első kör fogta. Tanulság a
  guard-must-measure sorába: az őr első futása mindig valós adaton történjen.

## Módosított / új fájlok

- `scripts/deploy-prod.sh` (GATE 1c) · `scripts/kb-gate.mjs` (ÚJ) · `scripts/kb-freshness.mts` (ÚJ)
- `/etc/systemd/system/citoviso-kb-freshness.{service,timer}` (dev-gép infra, enabled)
- `_planning/DECISIONS.md` (ADR-0045/f)

## Nyitott

- A timer első sikeres futása LAND UTÁN áll be (a szkript a fő fába a main-syncgel érkezik) —
  land után kézi `systemctl start` verifikáció járt.
- Agent-hívás cronból (headless ítélet) tudatosan NEM v1 — ha egyszer kell, külön ADR.
- A verdikt-token gépileg nem tudja bizonyítani, hogy az őr TÉNYLEG lefutott (single-agent
  korlát, mint a surface-gate-nél) — a néma utat zárja le, a doktrína a sessiont köti.
