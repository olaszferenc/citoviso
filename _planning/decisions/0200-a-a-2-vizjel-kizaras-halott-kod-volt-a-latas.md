## ADR-0200 — A §A.2 vízjel-kizárás halott kód volt: a látás mondja meg, a kapu végre tüzel

**Dátum:** 2026-09-19 · **Státusz:** elfogadva · **Horgony:** `03-INVARIANTS §A.2`

### A lelet

A `03-INVARIANTS §A.2` kimondja, hogy élesítéskor a nem-owner fotónál — jogi önnyilatkozat
mellett — **„az EGYETLEN feltétlen kizáró ok a vízjeles fotó"**. A kapu évek óta ott áll
(`src/engine/photoPolicy.ts` → `if (p.watermarked) return false;`).

Mérve 2026-09-19: a `watermarked` flaget a **termelési úton SEMMI nem állította `true`-ra**.
Egyetlen hely írta, egy teszt-fixture (`scripts/photo-rights-edit-check.mts:46`). A
`toSitePhotos` (`src/engine/siteData.ts`) az `url`-t, az `alt`-ot és a `provenance`-t
átmásolta, a `watermarked`-et nem — nem is volt honnan.

**Vagyis a fék be volt építve, a pedál működött, de soha senki nem nyomta meg:** egy vízjeles
portál-fotó akadálytalanul kiment egy FIZETŐ ügyfél élő oldalára. A §A.2 nem kapu volt, hanem
típusdefiníció — és ezt maga az ontológia is kimondta, javítás nélkül, két hónapon át.

⚠️ Ez ugyanaz a hibaosztály, amit a ház már megmért az `ad_banner`-nél: **megvett ítéletet
eldobni**. Ott a verdikt a cache-ben ült és a kiszállított lap mégis vitte a bannert; itt a
verdikt meg sem született, pedig a látás-kör minden képet megnéz.

### A döntés

**① A vízjel-ítélet a MÁR FUTÓ vision-körbe kerül, nem új pipeline-ba.** A `heroPick.ts`
minden kiszállított fotót megnézet (`HERO_SCORE_CAP` = 24 = `PORTAL_PHOTO_CAP`), tehát a
kérdést ugyanabban a hívásban, ugyanabba a cache-be lehet feltenni. A vízjelet csak LÁTNI
lehet: sem a fájlnév, sem a méret, sem a domain nem árulja el.

**② KÜLÖN MEZŐ, NEM `subject` KATEGÓRIA.** A vízjel ortogonális a tartalomra: egy vízjeles
fotó is lehet a szállás tökéletes külső képe — és pont AZ a §A.2 esete (a kép a szállásé, a
rányomott jel másé). Kategóriaként a vízjeles külső fotó elveszítené az `exterior`
besorolását, és egy jogi mező rontaná el a nyitókép-választást.

**③ A BÉLYEG A `dropNeverShown`-ban ragad rá.** Négy renderelő út olvassa a megvett ítéletet
(`generate` · `provision` · `tenant/editor` · `heroOverride`), és **mind a négy ezt hívja**.
Egy különálló `markWatermarked()`-et egy jövőbeli ötödik út némán kihagyna — pontosan az a
rés, amin az `ad_banner` egyszer már kiment. Egy megvett ítélet, egy alkalmazási pont.

**④ A BÉLYEG NEM DOB EL KÉPET A MOCKBAN.** A §A.2 fázis-mátrixa szerint MOCK/DEMO fázisban a
vízjeles kép megengedett; a kizárás az ÉLES kapué. A lánc tehát tudást visz, nem szűr.

**⑤ `PROMPT_VERSION`: `v2-adbanner` → `v3-watermark`.** A régi sorok ítélete hiányos, és a
cache-olvasó verzióra szűr, tehát be sem töltődnek — a hiányzó ítélet így **nem `false`-ként**,
hanem NEM LÉTEZŐ verdiktként viselkedik. Az újrapontozás ára mérve: 222 sor, ~$0,33. Egy
hiányos ítélet egy jogi kapu alatt ennél többe kerül.

**⑥ A BIZONYTALANSÁG LÁTHATÓ, NEM ELDÖNTÖTT.** Kétes esetben a modell `false`-t ad (egy téves
`true` elvenné a fizető ügyfél valódi szállás-fotóját — „a szűrés nem vehet el valódi
szállás-fotót"), de a `reason` elejére `VÍZJEL?` előtagot ír, és az a kurátor csempéjén
látszik. A kétes kép MARAD a lapon, de nem tűnik el a kétség.

### Amit ez NEM old meg (kimondva)

- **Az élesítés cache-ből dolgozik**, fizetős hívás nélkül (szándékosan). Egy KORÁBBAN
  legyártott mock pillanatképénél tehát nincs `v3` verdikt, és a §A.2 ezeken nem fut le.
  A `provision.ts` ezért mostantól **hangosan kiírja**, hány fotónak nincs ítélete — egy néma
  lefedettségi lyuk pontosan úgy néz ki, mint a siker. Feloldás: `scripts/rescore-photo-verdicts.mts`
  (alapból SZÁRAZ, `--go`-val pontoz újra). **Ez adat-pótlás, nem kód-hiba.**
- **A detektálás minősége nincs mérve valódi vízjeles korpuszon.** Nincs címkézett
  halmazunk; az őr a LÁNCOT bizonyítja (ítélet → bélyeg → kizárás), nem a modell pontosságát.
- **A `tenant/editor.ts` útja nincs a diff-scope-ban**: a bélyeget a közös `dropNeverShown`-ból
  kapja, de az őr nem méri külön azt az utat.

### Őr

`scripts/watermark-gate-check.mts` — 18 állítás, 7 fixture-mérés, diff-scope-olva a
pre-commitben. Méri a teljes láncot, a **feltétlenséget** (a kizárás a nyilatkozat ellenére is
áll — szerkezetileg is: a vízjel-elágazás a nyilatkozat ELŐTT fut), a negatív kontrollt (vízjel
nélkül a portál-fotó ÁTMEGY), a „mi kimaradásunk nem lelet" elvet (verdikt nélkül nincs bélyeg),
és a LEFEDETTSÉGET (`HERO_SCORE_CAP >= PORTAL_PHOTO_CAP`, különben ítélet nélküli kép megy ki).
Öt szabotázzsal igazolva, mindegyik elkapva. ⚠️ Egy hatodik szabotázs először **nem alkalmazódott**
(komment ékelődött a két elágazás közé), és `rc=0`-val „az őr vak"-nak látszott — a szabotázsnak
bizonyítania kell, hogy meg is történt.

**Migráció:** `0070_photo_hero_score_watermark.sql` (additív, `IF NOT EXISTS`).
