# 2026-08-26 — Többnyelvű honlap MODUL (ADR-0063) + az i18n-doktrína kiterjesztése a levelekre, a tenant-adminra és a konzolra (ADR-0067 ①②③)

## Két szál egy sessionben
1. **Új eladható modul:** „Többnyelvű honlap" — az ELSŐ egyszeri díjas modul.
2. Amikor a tulaj a modul teszt-értesítőjét MAGYARUL kapta meg, feltette a kérdést:
   *„ha lengyelországi a tenant, lengyelül küldjük ki?"* — a válasz NEM volt, és a
   vizsgálat sokkal szélesebb rést tárt fel, mint egy levél.

---

## ① A modul (ADR-0063)

A tenant 3 nyelvet választ, **egyszer fizet**, és a teljes site (a beírt szövegei + a
felület + a recept szekció-címei) legenerálódik nyelvenkénti statikus snapshotba
(`sites/<tenant>/<lang>/`), nyelvváltóval, `hreflang`-gal és sitemap-URL-ekkel.

**A fizetett tartalom-hash a horgony.** Bármely tartalom-mentés után a fordítások
`stale` állapotba lépnek — de **kint maradnak a kifizetett állapotukban** (tulaj-döntés),
a tenant EGY e-mailt kap epizódonként, és az újragenerálás/nyelvcsere **azonos árú** új
fizetés (tulaj-döntés). A fizetés a 0033-as `order_intent → payment` láncon megy
(`kind='multilang'`), a generálás a webhookból fut, életciklusa a `multilang_generation`
táblában (újrafuttatható).

**Mérve, nem tippelve:**
- A fordítandó tartalom NEM csak a `SiteData`: a recept `SectionCopy`-ja is vendég-látható
  — nélküle magyar szekciócímek maradtak a német oldalon.
- `PackStatus.ok` a KB-fordítás teljességét is beleszámolja; fizetett site-generálást CSAK
  a string-lefedettségre szabad kapuzni (egy elejtett KB-entry különben megbuktatta a
  vásárlást).
- §B.17 a fordításban: digit-integritás-őr — eltérő szám → a magyar forrás marad, hangosan.
- Lokál füst-teszt: de/en/pl generálás, stale→heal kör, SMTP-értesítés, újravásárlás.

---

## ② A rés, amit a tulaj kérdése nyitott (ADR-0067 ①②)

Nem egy levélről volt szó: **a TELJES kimenő levél-felület** beégetett magyar volt
(`<html lang="hu"`-val együtt) — belépési adatok, számla-kísérőlevél, előnézet-kész, és a
legsúlyosabb: a tenant **SAJÁT VENDÉGEINEK** menő foglalás-visszaigazolás/-elutasítás és
vélemény-köszönő, plusz **14 vendég-oldali űrlap-hibaüzenet**. Egy lengyel panzió német
vendége lengyel oldalon foglalt volna, és magyar hibaüzenetet kapott volna.

**A gyökér-ok nem a szabály volt, hanem az ŐR HATÓKÖRE:** három őr (PostToolUse-hook,
lint, katalógus-kinyerő) HÁROM kézi fájllistával dolgozott, és az `src/email/*` egyikben
sem szerepelt. A doktrínához kötést maga a listára kerülés adta → a levél-lánc őrizetlen
maradt, miközben minden kapu zöld volt. Fix: **EGY lista** (`scripts/i18n-sources.mjs`),
mindhárom őr onnan olvas.

Ezután a **tenant-admin** (~320 felirat) is átment a csomagon. ⛔ Kimondott kivétel:
`legalViews.ts` + `legal.ts` — a jogi szöveg országonkénti JOGI csomag, nem gépi fordítás.

**Új hibaosztály és a válasz:** az `i18n-lint` magyar ÉKEZETET keres, ezért **vak az
ékezet nélküli magyarra** — a lengyel tulaj adminja „1 db"-ot írt ki, minden kapu zölden,
és EMBERI szem kapta el egy képernyőképen. Ezért nem szótárat bővítettünk, hanem más
mérési elvet tettünk mellé: **`i18n-pseudo-check`** — a valódi felületeket szintetikus
nyelven rendereli, ahol minden fordított string «jelölt»; ami jelöletlen marad, az
definíció szerint nem ment át `T()`-n. Nem nyelvet találgat: **a hiányzó CSATORNÁT méri.**

A pszeudo-kapu azonnal talált olyat is, amit ember nem látott volna végig: az
**ADAT-REGISZTEREK** (modul-katalógus, mező-séma) címkéit — ezeket a view-k
`T(lang, m.label)`-lel fordítják, ami DINAMIKUS argumentum, tehát a kinyerő sosem látta.
Megoldás: mezőnév szerinti betakarítás. Plusz kibukott egy elmaradt `lang`-átadás
(`renderField`): a fordítás be volt kötve, csak épp nem hívódott.

---

## ③ A belső konzol (ADR-0067 ③)

Tulaj: *„készítsük fel a belsőt is arra, ha lesz nem magyar."* ~570 felirat ment át
(katalógus 861 → 1390 string).

**A nyelv itt az EMBERÉ, nem a piacé:** a tenant-admin a SITE nyelvén szól, a konzolt
viszont egy magyar és egy lengyel operátor UGYANAZON az adaton nézi — ezért a beállítás a
FIÓKHOZ tartozik (`operator_user.lang`, migráció **0037**), nyelvváltóval a fejlécben,
`hu` alapértékkel.

**Kérés-hatókörű nyelvi kontextus (AsyncLocalStorage), nem paraméter-átfűzés.** Indok
mérésből: ~53 egymást hívó nézet-függvénynél EGY kihagyott átadás némán magyarul hagy egy
töredéket (pontosan ez történt a tenant-oldalon), modul-szintű „aktuális nyelv" viszont
két egyidejű kérésnél versenyhelyzet. A nyelvet az az EGY hely tölti fel, ahol az operátor
amúgy is betöltődik (`currentOperator`) — így route nem felejtheti el.

A pszeudo-kapu 6 konzol-felülettel bővült (15 összesen), **szándékosan üres adattal**: a
„nincs találat" szöveget felejtik el a leggyakrabban, és épp azzal találkozik egy új
munkatárs az első napon. Itt is azonnal fogott: `Match`, `Kontakt`, `Mock`, `modern`,
`nincs honlap` (mind ékezet nélküli), szűrő-opciók, négy modul-szintű címke-térkép.

---

## Módosított / létrehozott fájlok (fő tételek)
- **Modul:** `migrations/0036_multilang.sql`, `src/tenant/multilangCore.ts` /
  `multilangGenerate.ts` / `multilangOrder.ts`, `src/modules.ts`, `src/pricing.ts`,
  `src/payment/service.ts`, `src/tenant/editor.ts`, `src/server/public.ts`,
  `src/server/adminViews.ts`, `kb/entries/admin-multilang/`
- **i18n-mag:** `src/i18n/mail.ts` (ÚJ), `src/i18n/lang.ts`, `src/i18n/packs.ts`
  (`installPack`), `src/console/i18nCtx.ts` (ÚJ), `migrations/0037_operator_lang.sql`
- **Levelek:** `src/email/*`, `src/booking/requests.ts`, `src/reviews/reviews.ts`,
  `src/billing/invoiceDelivery.ts`, `src/intake/mockRequest.ts`, `src/outreach/sendBatch.ts`
- **Felületek:** `src/server/adminViews.ts`, `src/server/moduleConfigViews.ts`,
  `src/console/views.ts`, `src/console/partnerViews.ts`
- **Őrök:** `scripts/i18n-sources.mjs` (ÚJ, közös lista), `scripts/i18n-pseudo-check.mts`
  (ÚJ), `scripts/i18n-lint.mts`, `scripts/i18n-scan.mjs`, `scripts/extract-i18n.mts`,
  `scripts/module-config-lint.mts`, `scripts/module-render-check.mts`, `hooks/pre-commit`

## Nyitott kérdések / következő lépés
- **ADR-0070 (másik szál):** a doktrína fájllistája legyen **SZÁRMAZTATOTT** (import-gráf),
  mert kézzel már kétszer maradt ki felület — legutóbb az `src/outreach/draft.ts`, ami a
  hideg megkeresés TELJES szövegét állítja elő. A mostani munka ezzel kompatibilis.
- A „Tervek" felület (ADR-0068) időközben visszavonva a main-en; a hozzá tartozó két fájl
  i18n-esítése tárgytalan lett.
- **Élesítés nem történt** — a multilang modul és a nyelvi réteg lokálban él, a prodra
  vitel külön, kimondott engedéllyel megy (`scripts/deploy-prod.sh`).
