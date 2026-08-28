# 2026-08-28 — A §2b felület-kapu gépiesítve (hook)

## Kiváltó (őszinte gyökér-ok)
Egy operátor-konzol felület-munkát (checkbox mock-típus-picker + „Mock törlése" gomb) **kód-előbb**
írtam meg, önkényesen „apró javítás"-nak minősítve a §2b terv-kapu kivételét, és a desktop+mobil
nézetet meg sem adtam a tulajnak (ráadásul le is töröltem a `assets/Temp/`-ből). A tulaj fogta meg.

**Miért történhetett meg:** a §2b (TERV-JÓVÁHAGYÁSI KAPU) volt az EGYETLEN kritikus doktrína, ami mögött
nem állt gépi kapu — csak próza. A többit hook kényszeríti (i18n, design-token, KB, élesítés). A kapu
kivétele („apró javítás") **önbíráskodó** volt: én döntöttem el, hogy nincs kétség, holott a doktrína
azt mondja: „Kétség esetén: terv-először." Szállítási lendületben a legkisebb ellenállás a kódolás.

## Megoldás — a munkarend hookká téve (a memória mintája: „kritikus munkarendet HOOKKÁ tenni")
1. **`scripts/ui-surface-scope.mjs`** — EGY közös lista: mely fájlok RENDERELT FELÜLETEK (nem az egész
   import-closure — az a pixel-kérdésre túl tág; az a lista az i18n-őré). A nudge és a kapu innen olvas,
   hogy ne driftel (`feedback_guard_scope_is_the_doctrine` kétszer-ütött hibája).
2. **`scripts/surface-plan-scan.mjs`** — PreToolUse hook (Write|Edit|MultiEdit). Felület-fájl + nincs
   jóváhagyás-token az ághoz → `exit 2` = a szerkesztés MEG SEM történik. PreToolUse (nem Post), mert a
   §2b lényege az ORDER: kód ELŐTT megállni. Regisztrálva a `.claude/settings.json`-ban.
3. **`scripts/surface-gate.mjs`** — token-tár + CLI. KULCS = a git-ág (egy worktree = egy szál). Tmp-ben,
   ág-onként. `approve` CSAK friss **desktop ÉS mobil** ui-shot mellett nyit (`assets/Temp/`, <60 perc) —
   pont az a szabály gépiesítve, ami elbukott. `exception "<indok>"` = a tulaj kimondott kivétele, naplózva.
   `status` / `clear`.
4. **`hooks/pre-commit` strukturális iker** (`surface-gate-check.mjs`) — a runtime-őr önmagában tiltott
   antipattern (`feedback_heuristic_guard_needs_structural_twin`), ezért a COMMIT-határon is blokkol:
   felület-fájl nem landolhat token nélkül. Commit-mód only (land-nél `LAND_RANGE` → skip, mert ott a
   token már nincs, és a munka a commitnál átment).
5. **Nudge-fix:** a `ui-shot-nudge.mjs` elavult szövege (DesignSync + `_ds_manifest.json`) az **ADR-0076**
   szerint kivezetve — a szállítás maga a működő desktop+mobil nézet, nem külön feltöltés.

## Tesztelve (a memória parancsa: minden őrt PIROSRA is)
8 eset, piros ÉS zöld, mind stimmelt: felület+token nélkül → blokk (exit 2); nem-felület → átenged;
engine-prefix → blokk; `approve` shot nélkül → elutasít (exit 1); `approve` shottal → nyit; token után a
hook átenged; pre-commit iker: token-nélkül-felület → exit 1, token-nel → 0, csak-nem-felület → 0.

## Korlát (őszintén)
Egy-agentes felállásban a hook NEM tudja bizonyítani, hogy a tulaj rábólintott — de a **néma utat
lehetetlenné teszi**: felület-kód nincs kimondott, indokolt, terv-fedett (friss desktop+mobil)
feloldás nélkül. A csendes mulasztásból hangos, naplózott, szándékos aktus lett.

## Módosított / új fájlok
- ÚJ: `scripts/ui-surface-scope.mjs`, `scripts/surface-gate.mjs`, `scripts/surface-plan-scan.mjs`,
  `scripts/surface-gate-check.mjs`
- MÓD: `.claude/settings.json` (PreToolUse), `scripts/ui-shot-nudge.mjs`, `hooks/pre-commit`

## Nyitott
Érdemes lehet ADR-t nyitni a felület-kapu gépi kényszerítéséről (a §2b enforcement-mechanizmusa) —
nem doktrína-változás, hanem a meglévő §2b betartatása. A tulaj döntése.
