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

## Folytatás 2026-09-24 — partner-képek a kapu alatt (ADR-0220 kiegészítés)
- **Lelet:** a `partner-kb-shot` a KÖZÖS dev DB-ből fényképezett — ott 12 partner (köztük a tulaj
  cégeinek valós nevei) és 0 bizonylat; a 3 commitolt kép 1 hónapja elavult volt.
- **Javítás:** saját, egyedi nevű scratch-DB (migrál → demo-seed → demo-tenant a kb-shot fixture
  moduljaival: 6 070 Ft/hó → eldob), rögzített óra (`scripts/lib/frozen-clock.mjs`, a seed
  gyerekfolyamatába is `--import`-tal; a `created_at DEFAULT now()` a scratch-DB-ben rögzítve).
- **Második lelet:** rebase után 26 admin-kép ingadozott — a Google Fonts HÁLÓZATON jött. Most
  `pinNetwork()` (`scripts/lib/kb-settle.mts`) a commitolt pillanatképből (`scripts/lib/kb-shot-fonts/`,
  296 kB) szolgál ki, minden más külső kérést elutasít; hiányzó betű = hangos bukás (piros próba:
  egy woff2 kivéve → 27 kérés megnevezve). Frissítés: `npx tsx scripts/kb-shot-fonts.mts --refresh`.
- **Mérve:** `--determinism` 43/43 azonos nyugalomban + 3× 8 szálas terhelés alatt; kapu HEAD-en zöld
  (43), elavult partner-képpel piros. Az admin-képek a pillanatkép-betűvel pixelre egyeztek a régivel.
- ⚠️ Egy `sed`-em a `scripts/planning-index*.mts` `ADR-XXXX` mintáját is átírta — észrevettem és
  visszaállítottam a commit előtt (a helyőrző ott a MECHANIZMUS része).

## Dev DB takarítás 2026-09-24 (tulaj: „mehet")
- Törölve a közös `citoviso_dev`-ből: `Mineral Logistics kft.` partner (tenant nélkül, 0 bizonylat) + 2 kontaktja (kaszkád); visszamérve 0.
- ⛔ A 4 „Olasz Ferenc" partner MARAD (tulaj döntés): nem kóbor sorok, hanem 4 élő dev-tenant
  (Agrosz, Eldorádó, Aranykagyló 36, Rozé Fogadó) számlázási vevői — a megújítás (`src/payment/billing.ts`)
  innen veszi a vevő adatait. A javaslatom feltevése hamis volt; a törlés előtti újramérés fogta meg.
