# 04 — INDEX (Citoviso ontológia)

> A vállalati/domain ontológia belépőpontja. Session-indításkor + domain-döntés (adatmodell, árazás, generálási szabály) előtt KÖTELEZŐ átfutni.

- [00-GLOSSARY.md](00-GLOSSARY.md) — fogalmak egységes definíciója (szállás, vertikum, tenant, ingest, mag, provenance, jutalék-horog, archetípus/korpusz/recept, piac, suppression, kontraktus, hűségidő/csomag-padló…)
- [01-CALC-MODELS.md](01-CALC-MODELS.md) — unit economics, ügyfél-megtérülés (jutalék), árazási sávok, **előfizetés- és modul-számítás, dunning-létra, domain díja/jogosultsága/kötbére, adó (AAM) és fizetési mechanika**. ⚠️ KÉPLETET rögzít, nem összeget — az élő árak forrása a `pricing_config` tábla.
- [02-ENTITY-MAP.md](02-ENTITY-MAP.md) — entitások + kapcsolatok (iparág-agnosztikus 6-entitásos közös mag + hibrid JSONB-modell; Property = szállás-pilot generáló-nézet; pipeline; a realizált konverziós/pénzügyi lánc; propagáció = a mentés NEM publikálás). **Tenant és Booking MA MÁR REALIZÁLT** — csak a Vertical és az OutreachCampaign tervezett.
- [03-INVARIANTS.md](03-INVARIANTS.md) — mindig-igaz szabályok (kép-provenance §A, dizájn §B, outreach §C, deploy §D, presence §F, izoláció/jog/ember-a-hurokban §G, láthatóság/SEO/lokalizáció §H, ígéret⇔szállítás §I, tudásbázis §J, **számlázási identitás §K, egyedi domain §L, tenant-oldali jogi lábazat §M, az őr hitelessége §N**)
- [05-MODULES.md](05-MODULES.md) — modul-katalógus (szállás pilot): a generált oldal FUNKCIÓ-tengelye (KÍNÁLAT·ELÉRHETŐSÉG·KONVERZIÓ), Szint 0–1; a modul=adat, archetípus=befogadó (ADR-0009/0010)
- [06-UI-CONTRACT.md](06-UI-CONTRACT.md) — modul-megjelenítés archetípus-függetlenül (téma-token · modul-horog · nyelvi kontraktus); a 03-INVARIANTS §B dizájn-kontraktusa erre horgonyoz

## Karbantartás
- Élő dokumentumok — új tudás felbukkanásakor a megfelelő fájlt bővítsd, ne a memóriában hagyd szétszórva.
- A kód igazsága elsőbbséget élvez az ENTITY-MAP fölött (`src/scraper/types.ts` + `src/generator/`) — eltérésnél a doksit igazítsd.
- **Auto-desztilláló ÉLES** (`_tools/distill.sh`, cron: vasárnap 04:00, repo-scoped): a citoviso epizodikus memóriát `claude -p` read-only review-val a `_inbox/`-ba desztillálja. Első futás 2026-07-04 zöld (12 memória → 9 SKIP / 1 REFINE / 0 DRIFT).
- Idempotencia: a `_tools/.distill-manifest` jelöli a már feldolgozott memóriákat (változatlan → nem fut újra; edit → új hash → újra bekerül).

### A kör bezárása — DÖNTENI kell, nem szerkeszteni (`_tools/distill-apply.mts`)
⚠️ A „heti teendő (EMBER): olvasd el és vezesd át kézzel" szabály **mérve nem működött**: a
2026-07-12 és 2026-09-13 közti **9 review, 62 javaslat-blokk feldolgozatlanul állt**, mert a
„olvass el 50 KB-ot és szerkeszd kézzel az ontológiát" feladatra soha nincs idő. A desztilláló
hibátlanul futott — az emberi átvezetés volt a szűk keresztmetszet, és a tudás némán befagyott.

Ezért a `distill.sh` a review után **előkészít egy jóváhagyható változtatást**:

- A PROMOTE blokkok bekerülnek a megfelelő DOMAIN-fájlba, **a review által megnevezett szakasz
  végére** (ha a `§X` vagy a fejléc-név egyértelműen feloldható; különben a fájl végére), minden
  blokk `<!-- distill:begin … -->` keretben, ami kiírja a **kért helyet, a forrás-memóriát és a
  review-t**. A keret miatt egyetlen gépi javaslat sem tud kanonikus szabálynak látszani.
- ⛔ **REFINE és DRIFT SOHA nem kerül be automatikusan** — a kanonikus szöveg felülírása a
  legkockázatosabb művelet, és a review-k fele nem is szó szerinti idézettel dolgozik. Helyette a
  gép **megméri**, hogy az `OLD:` szöveg ma is megvan-e a fájlban (ÉLŐ / ÁTFOGALMAZOTT /
  NEM TALÁLHATÓ), és a `_tools/DISTILL-PENDING.md`-be írja egyetlen döntési listaként.
- Az egész egy **eldobható ágon** születik (`wt/distill<dátum>`, saját worktree). ⛔ A fő munkafát
  soha nem írja (az minden más session land-jét blokkolná), **nem pushol és nem landol**.
- Idempotencia **tartalom alapján**: egy blokk akkor „kész", ha a szövege már benne van a
  cél-fájlban (elfogadva és landolva) — nem külön nyilvántartás alapján. Ha az ágat eldobod, a
  javaslat a következő héten **visszajön** (a némán elnyelt javaslat rosszabb, mint az ismétlődő).
- Ha több hét ága gyűlt össze, a **legújabb ág a teljes kép** (semmi nem landolt, tehát minden
  korábbi tétel abban is benne van) — a régiek törölhetők.

**⭐ A TULAJ MOSTANTÓL ÉRTESÜL RÓLA** (2026-09-17). A gyökérok nem a gépezet volt, hanem hogy a
review egy gitignore-olt `_inbox/`-ba esett és **senki nem tudott róla** — a `distill.sh`
hook-pontja hónapokig úgy élt, hogy a hívott `notify.sh` NEM LÉTEZETT, tehát a `[ -x ]` mindig
hamis volt és a lépés **némán kimaradt** (ára: 9 review / 62 javaslat). Az értesítő (`_tools/notify.sh`)
**SMS-t és e-mailt** küld — de **CSAK akkor, ha van mit eldönteni** (a frissesség-őr konjunkciója:
párosítatlan ÉS érdemi tudást hordoz); üres heti futásra szándékosan néma, és a **felhalmozásról
is** szól olyan héten, amikor nem született új review. Az e-mail a lenti három parancsot viszi,
KONKRÉT útvonallal. ⛔ Fail-closed: `--mode=send` nélkül nem küld, ismeretlen kapcsoló = hiba.
Őr: `scripts/distill-notify-check.mts`.

**Heti teendő (EMBER) — három parancs**, a pontos útvonalakat az értesítő e-mail és a cron-log
vége is kiírja (`~/.claude/distill-citoviso.log`):
1. `git -C ~/wt/distill<dátum> diff HEAD~1` — mi változna
2. `less ~/wt/distill<dátum>/_planning/DOMAIN/_tools/DISTILL-PENDING.md` — az ember-döntések
3. elfogadás: a kereteket törlöd (a törzs marad), majd `bash scripts/land.sh` · elvetés:
   `git worktree remove --force` + `git branch -D`

Kézi futtatás: `npx tsx _planning/DOMAIN/_tools/distill-apply.mts` (**alapból SZÁRAZ**, semmit nem
ír; írni csak `--go`-val lehet, ismeretlen kapcsoló = hiba) · önteszt: `--self-test`.
