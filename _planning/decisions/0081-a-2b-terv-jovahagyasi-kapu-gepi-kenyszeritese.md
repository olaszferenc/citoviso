## ADR-0081 — A §2b terv-jóváhagyási kapu GÉPI kényszerítése (felület-kapu hook)

**Dátum:** 2026-08-29 · **Státusz:** ELFOGADVA (tulajdonosi rendelet: „csináld meg hookként") ·
**Kapcsolódó:** ADR-0065/0066/0076/0077 (a kapu és a csatornája), CLAUDE.md §2b. Nem módosítja a
doktrínát — KIKÉNYSZERÍTI.

**A kiváltó (őszinte gyökér-ok).** Egy operátor-konzol felület-munkát (checkbox mock-típus-picker +
„Mock törlése" gomb) KÓD-ELŐBB írtam meg, önkényesen „apró javítás"-nak minősítve a §2b kivételét,
és a desktop+mobil nézetet meg sem adtam. A tulaj fogta meg. Diagnózis: a §2b volt az EGYETLEN
kritikus doktrína gépi kapu nélkül — csak próza (az i18n/design-token/KB/élesítés mind hookkal
blokkol). A kivétel önbíráskodó volt: én döntöttem el, hogy „nincs kétség", holott a doktrína azt
mondja: „Kétség esetén: terv-először". Memória-minta: „prózában írt szabály statisztikusan tart,
gépi kapu 100%-osan".

**A döntés.** A munkarendet hookká tesszük (a többi kritikus szabály mintájára):
- **`scripts/surface-plan-scan.mjs` — PreToolUse hook** (Write|Edit|MultiEdit): renderelt felület-fájl
  szerkesztése jóváhagyás-token nélkül → `exit 2`, a szerkesztés MEG SEM történik. PreToolUse (nem
  Post), mert a §2b lényege az ORDER: kód ELŐTT megállni.
- **`scripts/surface-gate.mjs` — token-tár + CLI.** Kulcs = a git-ág (egy worktree = egy szál).
  `approve` CSAK friss DESKTOP+MOBIL ui-shot mellett nyit (pont az a szabály, ami elbukott);
  `exception "<indok>"` = a tulaj kimondott, NAPLÓZOTT kivétele (⚠️ nem magadnak adod — ADR-0068).
- **`scripts/surface-gate-check.mjs` — pre-commit strukturális iker** (commit-mód): felület-fájl nem
  landolhat token nélkül (feedback_heuristic_guard_needs_structural_twin: runtime-őr önmagában tiltott).
- **`scripts/ui-surface-scope.mjs` — EGY közös felület-lista** (a nudge + a kapu innen olvas, hogy ne
  driftel — feedback_guard_scope_is_the_doctrine). Hatókör = renderelt pixel/interakció, NEM a teljes
  import-closure (az az i18n-őré).

**Korlát (kimondva).** Egy-agentes felállásban a hook NEM bizonyítja, hogy a tulaj rábólintott — de a
NÉMA utat lehetetlenné teszi: felület-kód nincs kimondott, indokolt, terv-fedett (friss desktop+mobil)
feloldás nélkül. A csendes mulasztásból hangos, naplózott, szándékos aktus lesz.

**Bizonyíték (ugyanaznap 3× végigfutott).** A mock-törlés+multiselect (approve-úton), a provisioned-mock
törölhetőség-fix és a leadek alap-szűrő (exception-úton, tulaj-rendeletre) mind a kapun át landolt.

**Visszafordíthatóság:** 🔄 munkarendi kapu; a scriptek/regisztráció eltávolíthatók, kód nem függ tőle.
