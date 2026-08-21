# 2026-08-21 — Tudásbázis-doktrína (ADR-0045 ①–④): a súgó termék-réteg lett

## Mi történt (tulaj-rendeletből doktrína + teljes implementáció, egy session)

A tulaj igénye: a célközönség IT-kezdő → tudásbázis print screenekkel és folyamatleírásokkal,
doktrína-szinten, őrrel; a UI-ba épített súgó-ikonokkal; kereshető külön felülettel; és KIEMELTEN:
új entry automatikusan forduljon minden élő nyelvi csomagra, új régió nyelvi csomagja a KB-t is
tartalmazza. Megerősítő kérdése: „legyen hurok, ami minden commit előtt megnézi, kell-e menteni
a tudástárba — akkor jó, ha automatikus."

## A négy szelet (mind KÉSZ, pusholva: b3ff795 + 4d969ab)

1. **① Doktrína:** ADR-0045 (+/b/c/d) · 03-INVARIANTS **§J.24–26** · glosszárium · `kb/README.md`
   (szerzői kontraktus + markdown-részhalmaz) · `tudasbazis-or` agent (felület-hűséget ítél).
2. **② Felület:** `data-kb-anchor` + súgó-ikon az 5 admin-fül kártyafején (`helpLink`,
   adminViews) · **Súgó fül** (6. nav-elem, no-JS GET-keresés, `src/kb/kb.ts` betöltő + szűkített
   md-renderelő) · session-kapuzott kép-út (`/admin/kb/<id>/assets/…`) · `kb-shot.mts`
   (390px viewport-capture, nyelv-paraméteres, egyenesen az entrykbe).
3. **③ Locale:** `kb_translation` (0027; source_hash-staleness) · `src/i18n/kbPacks.ts`
   (markdown-tudatos fordítás; integritás-őr: **„label”**-ek MAGYARUL szó szerint túlélnek — a
   felület ma magyar —, kép-útvonal + alcím-váz egyezik, sértő fordítás eldobva) · EGY belépési
   pont: `ensureLanguagePack` hívja → mind a 4 trigger (scrape/generate/boot/CLI) fedi a KB-t ·
   kiszolgálás a tenant site-nyelvén (`getTenantContent().lang`).
4. **④ Modul-képernyők:** „Útmutató ehhez a képernyőhöz" pill a beállító-képernyőkön
   (moduleConfigViews `helpLink`; anchorok: admin.modules.booking/rooms/pricing/settings) +
   4 entry valós feliratokból, screenshottal. Portál-szinkron NEM dokumentált (dark UI).

## Az AUTOMATA hurok (a tulaj kérdésére a válasz)

- **Mentéskor:** `kb-scan.mjs` PostToolUse-hook — admin-view/KB-fájl írása → azonnali
  `kb-check --coverage`, sértés blokkol.
- **Commitkor:** pre-commit ugyanez.
- **Tartalom-drift:** entrybeli **„félkövér-idézett”** felirat szó szerint kell a view-forrásban
  → gomb-átnevezés piros, amíg a súgó nem követi.
- **Nyelv:** entry-változás → ensure újrafordít; új nyelv → UI-pack + KB egy hívásból.

## Bizonyíték

Minden őr pirosra futtatva (7 lint-sértéstípus; label-átnevezés; horgony-eltávolítás; 5 fordítás-
integritás eset; hash-rontásos öngyógyulás). A hook élesben blokkolta a ④ horgony-kirakást az
entryk elkészültéig (5→0), és fogott 2 valós hibát (sortöréses label, fantom-horgony kommentből).
Lengyel KB 9/9 ÉLESEN generálva (Pan/Pani regiszter, magyar labelek túléltek).

## Nyitott / következő

- Operátor-konzol súgó-rétege (audience: `operator` — struktúra kész, entry nincs; a konzol
  view-fájljai nincsenek a kb-check VIEW_FILES-ban).
- Ha a tenant-admin i18n-burkolást kap: a label-kontraktus vált (pack-ból fordul).
- Pilot-leltár: B) outreach küldő-pipeline a következő nagy tétel.
