# 2026-09-17 — Az ontológiai lenyomat felzárkóztatása, és a kör bezárása

**Kiinduló kérdés (tulaj):** „a Citovisonál is épül egy ontológiai lenyomat, ami felhalmozza az
összes releváns tudást, mint a Mindreal-ban?"

**A mért válasz: a GÉPEZET épült, a LENYOMAT nem.** Az auto-desztilláló (`_tools/distill.sh`,
cron vasárnap 04:00) hibátlanul futott hónapokon át — de a review-k egy **gitignore-olt**
`_inbox/`-ba estek, és az „olvasd el és vezesd át kézzel" lépésre soha nem volt idő.
**2026-07-12 és 2026-09-13 között 9 review / 62 javaslat-blokk állt feldolgozatlanul.**
A tudás nem veszett el — **némán befagyott**, ami rosszabb, mert a rendszer közben úgy
viselkedett, mintha lenne ontológiánk.

## Amit szállítottunk (4 commit → `origin/main`)

| Commit | Tartalom |
|---|---|
| `d607238` | `01-CALC-MODELS` felzárkóztatása (22 → **154** sor) |
| `9a0f215` | `00-GLOSSARY` (40 → **52**) + `02-ENTITY-MAP` (45 → **175**) |
| `e740fad` | `03-INVARIANTS` (141 → **482**) + a ledger lezárása |
| `e9d816a` | `distill-apply.mts` + `domain-inbox-freshness-check.mts` + hook + land |

**Ledger: 12/12 review átvezetve, 0 feldolgozatlan.** Az őr zöld a munkafából ÉS a fő fából is.

### ① A kör bezárása — `_planning/DOMAIN/_tools/distill-apply.mts` (1177 sor)
A desztilláló mostantól **jóváhagyható ágat** készít (`wt/distill<dátum>`, saját worktree),
nem olvasnivalót. A PROMOTE blokkok `<!-- distill:begin -->` keretben kerülnek be (gépi
javaslat nem tud kanonikus szabálynak látszani), **nem pushol és nem landol**, idempotencia
**tartalom alapján**. ⛔ **REFINE és DRIFT SOHA nem automatikus** — mérve: a 20 valódi REFINE
blokk formátuma nem gépelhető, és rossz parse-ra kanonikus szöveget felülírni a legrosszabb
kimenet; helyette `DISTILL-PENDING.md` egyetlen döntési listaként (ÉLŐ / ÁTFOGALMAZOTT / NEM
TALÁLHATÓ).

### ② Az őr — `scripts/domain-inbox-freshness-check.mts` (633 sor)
**Konjunkció**, nem egyszerű kor-mérés: párosítatlan review **ÉS** érdemi javaslatot hordoz
**ÉS** > 21 nap. `CYCLE=7 · WARN>7 · FAIL>21` (indok: az egyetlen dokumentált felzárkóztatás
8 napos volt). Git-dátumból dolgozik, nem `mtime`-ból. **Diff-scope-olt** a `pre-commit`-ben
(csak aki az ontológiát piszkálja), `--warn-only` a `land.sh`-ban — egy heti adósság nem
foghatja meg 25 szál commitját.

### ③ Amit a felzárkóztatás menet közben talált
- **A „tervezett" entitások fele már két hónapja élt** (Tenant, Booking).
- **`04-INDEX` — a kötelező belépőpont — két hónapja NEM sorolta fel a `06-UI-CONTRACT`-ot.**
  Aki a doktrína szerint dolgozott, nem is tudott róla.
- **HAT ütköző migráció-sorszám** él a fában (a szál kettőt jelentett; újraszámolva hat).
  Ugyanaz a mechanizmus, mint az ADR-számoknál, csak itt a **közös Postgres nyeli el némán**.
- **Az AAM-küszöb három számának NULLA kódhorgonya van** → a `01-CALC-MODELS`-ben kimondott
  ⛔ VERIFIKÁLATLAN keret áll rajta, amíg valaki a hatályos jogszabályból nem igazolja.

## ⭐ A kör legfontosabb lelete — csak KERESZTBE olvasva állt össze
Két szál két féligazsága külön-külön ártalmatlannak látszott:
**B**: nyilatkozat esetén a kód MINDEN provenance-osztályt élesre enged, az egyetlen
feltétel nélküli kizárás a **vízjeles** kép. **A**: a `watermarked` flag létezik, de
**semmi nem állítja `true`-ra**.

**Összerakva és megmérve: a megengedő szabály EGYETLEN fékje halott kód.** A flaget egyedül
egy teszt-fixture állítja (`scripts/photo-rights-edit-check.mts:46`); a termelési úton
(scraper → ingest) **nincs vízjel-detektálás**. Vagyis nyilatkozat után **minden kép kimehet
élesre, vízjelesen is** — miközben a `03-INVARIANTS §A.2` az ellenkezőjét ígéri, két komment
(`recipe.ts:77`, `payment/service.ts:912`) még a régi szigorú szabályt mondja, és egy
**ZÖLDEN futó őr** a flag továbbélését méri, nem azt, hogy valaha beáll-e.
*(A megengedő ág maga SZÁNDÉKOS: tulajdonosi döntés, 2026-08-20, `editor.ts:508`.)*

## ⛔ Saját hibáim ebben a körben
1. **A záró jelentésemben ELAVULT commit-SHA-kat idéztem** (`04f6283`/`1dea14b`/`7111147`) — a
   `land.sh` rebase-e átírta őket, a valódiak `9a0f215`/`e740fad`/`e9d816a`. A tartalom fent
   volt, a hivatkozás mégis hamis. **A saját doktrínánk mondja ki, hogy a commit-szám hazudik
   — és mégis SHA-val riportoltam.** Szemantikus próba (fájl/route a `main`-en) az egyetlen
   érvényes bizonyíték.
2. **Szűk grep-minta:** `isLiveSafePhoto|LiveSafe` → 0 hívó; a valódi export
   `applyLivePhotoPolicy`. Pont az a hiba, amire a szálakat figyelmeztettem.
3. **Csövön át mértem kilépési kódot** (`... | head` → `$?` a `head`-é) és `EXIT=0`-t
   jelentettem. Cső nélkül újramérve: 1 (blokkol) / 0 (`--warn-only`).
4. **Bemocskoltam a FŐ FÁT** (9 követetlen másolat) → a `land.sh` ff-frissítése elbukott, a
   `:4600` NEM frissült. Pontosan a rögzített hibaosztály. Javítva: mind a 9 bitre azonos volt
   a felküldöttel → törölve, `merge --ff-only`, fa tiszta.
5. **Az ügynök-jelentés BEMENET, nem eredmény:** egy szál a munkája ELEJÉN mért állapotot
   idézett tényként (mire beszámolt, egy testvér-szál már javította), egy másik hat
   duplikátumból kettőt számolt.

## Nyitott — a tulaj döntése
1. **Vízjel:** valódi detektálás (akkor a §A.2 él), vagy a §A.2 törlése (akkor legalább igazat
   mondunk)? A két elavult komment törlése már nem döntés, csak munka.
2. **A gyökérok: `notify.sh`.** A hook-pont ÉL (`distill.sh:151-155`: `[ -x "$NOTIFY" ]`), de
   **a fájl maga nem létezik** — ezért nem értesül soha senki, és ezért maradhatott két hónapig
   észrevétlen. ➡️ **Ezen indul a következő session** (tulajdonosi döntés, 2026-09-17).
3. **12 „ÉLŐ" REFINE** vár a `DISTILL-PENDING.md`-ben — kanonikus szöveg felülírása, szándékosan
   nem automatizálható, külön kör kell rá.
