# 2026-08-22 — Mock-generáló panel átrendezés + az „egy tesztfelület" gépi kapuvá tétele

## Mi történt

### A) Mock-generáló panel (lead-oldal, „Mock és generálás" fül) — tulaj-iterációkkal
1. **Elrendezés:** kártyák + kurátor-prompt BALRA, a kiválasztott minta előnézete JOBBRA
   (`.gen-2col` grid). Több lépésben a tulaj visszajelzéseire: fele-fele osztás (4 kártya-oszlop),
   az előnézet cián kerettel + glow-val kiemelve (a kiválasztott kártya jelölésével azonos
   tokenekből), és a keret a bal oszlop aljáig (a prompt vonaláig) nyúlik (`align-items:stretch`).
2. **A kép volt a rossz, nem a CSS:** az egyetlen minta-asset egy 960×620 FEKVŐ card-shot volt —
   a magas keretben a `cover` egy kivágatba nagyított („semmi sem látszik"), a `contain` félig
   üresen hagyta. A fix az ASSET: `scripts/shot-previews.mts` mostantól egy HARMADIK, álló
   880×1050 `tpl-<id>-prev.jpg`-t is lő (16 sablon), a view/JS/őr erre vált, a fit vissza `cover(top)`.
   A maradék alsó vágás SZÁNDÉKOS: a minta egy több-képernyős weboldal, a keret az „első képernyőt"
   mutatja, a teljes oldal a nagyítóban van.
3. **Mobil-lelet:** a tulaj telefonja a konzolt ~900px CSS-szélességen rendereli → a 760px-es
   töréspont SOSEM sült el, a kétoszlopos nézet torz sávot adott. Töréspont 1080px-re emelve.
4. `shot-previews.mts` outDir repo-relatív lett (worktree-biztos), nem a fő fába drótozva.

### B) ⛔⛔ Az „egy tesztfelület" szabály megsértése → gépi kapu (a session valódi tanulsága)
- **A hiba:** a változást egy kézzel indított :4610-es worktree-szerveren mutattam meg, port-URL-t
  adva a tulajnak — pedig ADR-0052 kimondja: a fő fa (:4600) = A tesztfelület. A tulaj jogos
  dühvel állított meg: „Honnan kéne tudnom a portokat? Nem is akarok vele foglalkozni."
- **Miért történhetett meg:** a leírt szabály prózában élt, és a döntési pillanatban a generikus
  reflex („teszteletlen kód nem megy main-re") elnyomta — a doktrína FEL SEM MERÜLT. Ahol hook van
  (block_live_deploy), ott a doktrína SOSEM sérült; ahol csak próza, ott statisztikus.
- **Gépi javítás (mindkettő piros-tesztelve):**
  1. `~/.claude/hooks/block_worktree_ports.sh` (PreToolUse, settings.json-ba kötve): worktree-ből
     dev-szerver indítás / CONSOLE_PORT|PUBLIC_PORT átírás = BLOKK, az üzenet a helyes utat mondja
     (commit → land → :4600). 5/5 teszt (2 blokk, 3 átenged, override-dal is).
  2. `scripts/land.sh` a sikeres visszaellenőrzés UTÁN ff-only frissíti a fő fát (őrök: main ágon +
     tiszta fa) → „land = látszik a :4600-on" azonnal, nem a sync-timer 60 mp-ét várva.
- **Mellék-hiba:** a takarításnál egy beragadt PID-del egy MÁSIK szál (:4691) szerverét öltem meg
  (visszaállítva). Kill előtt cwd-ellenőrzés a /proc/PID/cwd-ből.
- Memória: `feedback_single_test_surface_no_ports.md`.

## Élesítés
A tulaj kimondta: „zárjuk és menjen ki élesre is" → deploy-prod.sh a session-záró commitra
(ADR-0053 szerint, dry-run + --go).

## Módosított fájlok
- `src/console/views.ts` — gen-panel 2 oszlop; preview `-prev.jpg`; inline stílus CSS-be
- `public/assets/ui/citui-console.css` — gen-2col grid (1fr/1fr, stretch), preview kiemelés,
  1080px töréspont
- `scripts/shot-previews.mts` — portré prev-shot + repo-relatív outDir
- `scripts/template-picker-check.mts` — az őr a `-prev.jpg`-t méri
- `public/assets/ui/tpl-*.jpg` — 16 új `-prev` + újragenerált shotok
- `scripts/land.sh` — fő-fa ff-frissítés a land végén
- (repo-n kívül) `~/.claude/hooks/block_worktree_ports.sh` + `~/.claude/settings.json`

## Nyitott
- Ha a tulaj többet akar látni a mintából: `shot-previews.mts` prev-viewport 1050 → ~1400 + újragen.
