# 2026-09-23 — Súgó-képek: determinisztikus gyártó + deploy-KAPU (ADR-0220)

**Brief:** `~/rc-briefs/kb-shot-determinism-gate-brief.md` (a MODULOK 2. kör sessionből).

## Elvégezve
1. **Determinizmus.** `scripts/kb-shot.mts`: minden felvétel a `snap()`-en át `settle()`-t kap
   (animáció/átmenet/kurzor ki, `document.fonts.ready`, képek bevárva — lazy→eager, explicit
   görgetés, ragadó elemek static-ra: elem-képen mind, viewport-képen a nem-tapadók; két képkocka;
   15 s-os hangos időkorlát). Új módok: `--out <dir>`, `--determinism`, `--check-committed`.
   Mérve: 8 teljes gyártás (1 pár nyugalomban + 3 pár 8 szálas CPU-terhelés alatt) — 38/38 kép
   pixelre azonos. Piros próba (véletlen késleltetés + 50%-os 40 px görgetés, `grep -c`=2): 17 kép
   pirosan, névvel + bbox-szal; visszaállítva, `grep -c`=0.
2. **Pixel-összevető:** `scripts/lib/png-pixel-diff.mts` (sharp, >24/csatorna, bbox). A `--self-test`
   kalibrálja: azonos → 0; 5×5 folt → pontos bbox; +10 zaj → 0; méret → piros. Negatív kontrollok:
   küszöb 255 (vak) → piros; küszöb 5 (zaj-érzékeny) → piros. Pre-commit hook: a lib változására is fut.
3. **Kapu:** `scripts/deploy-prod.sh` GATE 1c/kép — `kb_shot_gate()` a cél-commit worktree-jében
   (node_modules symlink, .env a hívó cwd-jéből) `--check-committed`; MINDEN deployon fut. Külön:
   `bash scripts/deploy-prod.sh --kb-shot-gate <commit>` (csak lokál). Próbák: HEAD → zöld (38 friss);
   elavult `console-pricing` (a 4cffc731 előtti) → PIROS `8860 px, bbox (88,4632)-(547,5855)`;
   kapu előtti commit (4cffc731) → PIROS „nem igazolható" (nem néma zöld). A régi WARN kivezetve.
4. **4 kép újragyártva** a beállt állapotban: console-leads (Név-oszlop elválasztó, `is-scrollx`),
   console-outreach-draft + console-report (felső sáv betű után), console-dashboard (2 px).

## Nyitott kérdések (tulaj)
- ⚠️ A kapu egy ADR-0220 ELŐTTI commitra való VISSZAGÖRGETÉST is megállítja (nincs `--check-committed`).
  Szándékosan nincs kikerülő kapcsoló; ha vészhelyzeti rollback kell, erről a tulaj dönt.
- A képek a DEV DB modul-katalógusából renderelnek → a dev DB modul-ár/név változása „elavult képet" jelent.
- A `partner-kb-shot.mts` képei nincsenek a kapu alatt.

## Fájlok
`scripts/kb-shot.mts` · `scripts/lib/png-pixel-diff.mts` · `scripts/deploy-prod.sh` · `hooks/pre-commit` ·
`_planning/decisions/XXXX-a-sugo-kep-frissessege-deploy-kapu.md` · `_planning/decisions/0045-…md` ·
`kb/entries/{console-dashboard,console-leads,console-outreach-draft,console-report}/assets/hu/screen.png`
