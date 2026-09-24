## ADR-0223 — Párhuzamos szálak II.: a fa-szabály a RESUME-nál is, a headless Claude eszköz nélkül, a kapuk osztott állapota futásonként egyedi (2026-09-24)

- **Kiváltó (tulaj, 2026-09-24):** *„sokadik napja fordul elő, hogy worktree commit összeakadások
  vannak a sessionok között… ez a probléma mindenhol fennáll: CIT MR OF… javítsunk mindent”.*
  Előzmény: ADR-0052 (félkész izoláció), a 2026-09-23-i session↔munkafa doktrína (`rc-new.sh`
  elutasítja a foglalt fát), ADR-0207 (fordítás-verseny a commit-kapuból a deploy-kapuba).

**Amit a mérés mutatott — három KÜLÖN mechanizmus, nem egy:**

① **A „másik session commitolta a fájlomat” tettese a watchdog CÍMADÓJA volt.** A
   `gen_title()` egy headless `claude --print --allowed-tools ""` hívásnak adta promptként a
   graduáló session első üzeneteit. Az `--allowed-tools ""` csak az auto-engedély listáját
   üríti; a globális `defaultMode: bypassPermissions` alatt a haiku MINDEN eszközt megkapott,
   és — a globális doktrínát is betöltve — sessionként viselkedett: `Read MEMORY.md` →
   `find / -name .git` → `git worktree list` → `cd ~/wt/cit8582db2c` → `git add … && git
   commit` (angol üzenet, trailer nélkül; `3333302e`). CIT: 59 futásból 8 eszközös, 1 commit;
   MR: 71-ből 6 (egyikük `Skill`+`Workflow`-t hívott). A tünet az ÚJ session első ~10 percében
   jelentkezik (címadás = 3 üzenet vagy 10 perc után) — ezért érződött „a session által
   indított session” hibájának.

② **A RESUME-nak nem volt fa-őre.** A `rc-new.sh` 09-23 óta elutasítja a foglalt fát, de a
   watchdog `resume()`-ja a halott/beragadt sessiont abba a fába támasztotta fel, amit az
   átirat-mappa neve adott — akkor is, ha ott már más élt. OF: két `--resume`-olt session a
   `/home/overseer/overseer` fő fában; MR: 3–4 örökölt session a `/home/mineral/minereal`-ban.

③ **A kapu-sor osztott állapota.** 182 őr közül: a szerver-importáló őrök `CIT_SHOT=1` nélkül
   (`consent-check` — MINDEN commiton —, `verdict-dialog-dom-check`, `mock-photo-gate-check`)
   elindították az `ensureAllLanguagePacks()` háttér-feltöltést, ami a KÖZÖS `language_pack`/
   `kb_translation` táblát írja a SAJÁT fa magyar forrásából — pontosan az a verseny, amit az
   ADR-0207 a commit-kapuból kivett, hátsó ajtón, AI-költséggel, minden session minden
   commitján. Plusz 5 fix nevű scratch-DB (induláskor `DROP`), fix DB-fixture-kulcsok
   (trigger-név, `XX` ország, `-9900xx` települések, `GUARD-*` tokenek), fix `/tmp/cit-*.html`
   és fix `assets/Temp/*.png` nevek — a „véletlenszerű piros land” forrásai.

**Döntés**

1. **Headless Claude = eszköz nélkül, adatként keretezett prompttal.** Bármely `claude -p`
   hívás ezen a gépen bypass-módú, ezért: `--tools ""` (vagy explicit lista) + `--permission-mode
   default` + üres cwd, a bemenet ADAT-ként keretezve, és a mellékhatás MÉRVE (`--selftest-title`:
   injekció + probe-fájl). Fail-closed: ha a CLI-nek nincs `--tools`, a címadó nem fut.
   ⛔ `--bare` nem alternatíva (a hitelesítést is kihagyja).
2. **Egy fa = egy session a RESUME-nál is.** Foglalt fába a watchdog nem támaszt fel:
   saját worktree (`rc-wt-prepare.sh <prefix><sid[:8]>`), a state rögzíti (`proj`/`wt`/
   `moved_from`), és az első prompt (`RC_NOTICE`) megmondja a sessionnek, hol maradt a
   commitolatlan munkája. Szabad fa → helyben. Az örökölt fő-fás sessionök így a következő
   újraindításukkor maguktól költöznek; kézzel ölni őket tilos marad. Önteszt:
   `--selftest-resume-guard` (pozitív + negatív ág). Mindhárom gépen él (CIT·MR·OF).
3. **A kapu osztott állapota futásonként EGYEDI, és csak a sajátját takarítja.**
   - Szerver-importáló őrben `CIT_SHOT=1` + `*_PORT=0` a DINAMIKUS import ELŐTT (a static
     import a `process.env` sor fölé emelődik) — őr: `scripts/server-import-env-check.mts`
     (172 őr, 29 importál; `--self-test` 9 esettel), a `hooks/pre-commit`-ben. Javítva:
     `consent-check`, `verdict-dialog-dom-check`, `mock-photo-gate-check`, `copy-panel-check`.
   - Scratch-DB: `scripts/lib/scratch-db.mts` — név `<alap>_<fa-kulcs>_<pid>`, induláskor csak a
     HALOTT pid-ű árvák söprése, a DROP process-`exit` hookban (a `process.exit(1)` után is
     lefut, mérve). Átállt: `entitlement-paid`, `module-upsell`, `domain-provision`,
     `domain-renewal`, `partner-registry`, `renewal-date-coherence`.
   - DB-fixture-kulcs pid-ből: `upsell-atomicity` (trigger-név), `market-gate` (`X`+betű —
     XA…XZ az ISO 3166 felhasználói tartománya), `module-config` / `programs-editor`
     (települések, dedup-kulcsok), `outreach-link-live` (lead-név, tokenek).
   - `/tmp`: `scripts/lib/session-tmp.mts` (`mkdtemp` + exit-hook törlés) — `barion-pixel`,
     `billing-checkout`, `configurator-price`, `checkout-viewport`, `consent-sticky-overlap`,
     `renewal-date-coherence`. `assets/Temp` képek: `_<név>-${SCOPE}` (a `guard-scratch-scope-
     check` látja) — `booking-offer`, `quote-request`, `price-on-request`, `season-year-price`,
     `template-diversity`.
   - Az őr sosem gyengíti a másik állítását. Nyitva maradt: a `copy-panel-check` a HEAD-en is
     bukik (`.cp-scale` hiányzik — termék/fixture kérdés, nincs a kapuba kötve); a
     fixture-települések koordinátái fixek (egy testvér futás „közeli település"-ként láthatja).

**Következmény.** A „fantom commit” osztálya megszűnik (a headless futásnak nincs keze); a
fa-osztás a resume-nál is zárt; a land pirosai közül a verseny-eredetűek eltűnnek. Ami marad:
a land-idő doksi-ütközések (MEMORY.md teteje; ADR-0210 kezeli az indexeket) és a MR/OF
örökölt fő-fás sessionök átmeneti állapota, amíg egyszer újra nem indulnak.
