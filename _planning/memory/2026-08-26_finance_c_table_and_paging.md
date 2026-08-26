# 2026-08-26 — Pénzügy C: sűrű bizonylat-tábla + lapozás, ami a pénzt nem vágja

**Landolva:** `db3a5e6` (C tábla) és `517e651` (lapozás). ADR: **ADR-0073**.

## Mi készült

### ① A jóváhagyott „C" terv kódba ültetése (`db3a5e6`)

Az `assets/design-refs/console/finance-c-tabla.html` (befagyasztott kontraktus, ADR-0066) alapján
a `/documents` és a partner-lap Bizonylatok füle átállt a sűrű operátor-táblára: sötét, ragadós
fejléc-sáv a szűrőkkel, per-deviza KPI-sáv, aktív-szűrő chipek egyenkénti törléssel.

**Új oszlop:** `Pénznem` + `Fiz. határidő`; az **`Esedékesség` ebből SZÁMOLT olvasat**
(`dueReadout` tiszta függvény, sosem tárolt): „3 nap múlva” / „9 napja lejárt”, sárga óra /
piros figyelmeztető ikonnal.

**Többvalutás KPI szétbontás az ADAT-rétegben** (nem csak nézet): `receivable` / `payable` /
`overdue` pénznemenként külön, soha nem összeadva; a nettó pozíció ebből származik.

A szűrő-CSS/JS a `public/assets/ui/citui-console-table.css|js`-be került, és **be lett véve a
design-token-lint FILES + design-token-scan SCOPE hatókörébe** (a doktrína hatóköre = az őr
fájllistája).

### ② A terv és az ADR-0064 ütközésének feloldása — a tulaj döntött

Az ADR-0066 „Utólagos lelet" három ütközést írt le, de nem döntötte el. **Mindhárom az
ADR-0064 szerint** (részletek az ADR-0073-ban): irány-ikon nincs · szerver-oldali GET-form
szűrő · dátum tól-ig. A tulaj indoklása az irány-ikonra: „bejövő kimenő… Költség / bevétel” —
tehát a Típus oszlop már hordozza, az ikon redundáns.

### ③ Lapozás (`517e651`) — a munka érdemi része nem a `LIMIT` volt

Klasszikus lapozó, **50 sor/oldal**, sima linkekből (JS nélkül is megy). De a lényeg:
**a KPI-sáv, a korosítás, a végösszegek és a fizetési szokás külön AGGREGÁLÓ lekérdezésből
jönnek a teljes szűrt halmazra.** A kézenfekvő `LIMIT` a sor-lekérdezésre a címsort némán
„az 1. oldal egyenlegévé" tette volna — ép felület, hibás pénzügyi szám, semmi nem látszik.

Egy szűrő-definíció táplálja mindhárom lekérdezést (sorok / aggregátum / szokás); a vödrözés a
guard-tesztelt `agingBucketFor` / `settleOffsetDays`-ben marad, az SQL nem másolja le.

**Ugyanez a csapda a hívóknál, tételesen bekötve:** mindkét CSV-export és a partner
**Áttekintés-fül** `{ all: true }`-val kér (a KPI-csík és a havi diagram a sorokból SZÁMOL —
lapozva 50 bizonylatot írt volna le). A szűrő-formok nem visznek `page`-et → szűrés vissza az
1. oldalra; a lapozó-linkek viszont viszik az aktív szűrőt. Rendezés **tie-break az `id`-re**,
különben azonos kelte mellett egy sor két oldalon is megjelenhet, egy másik sosem.

## Amit a screenshot buktatott le

A fejléc **„Bizonylatok (50)"**-t írt 214 helyett, és a „N találat" is az oldal méretét mutatta.
Kódból ez nem tűnt fel — **attól látszott, hogy tényleg ránéztem a képre**, nem csak legeneráltam.
(§2b első célja: lássam, amit generálok.)

## A kapu, ami majdnem dísz lett

A `scripts/documents-paging-check.mts` a kimutatást a naiv, mindent-beolvasó újraszámolással
veti össze 10 szűrő-kombináción. **De a dev DB 14 bizonylatot tartalmaz = egy oldal: a kapu
átment volna anélkül, hogy egyetlen oldalhatárt átlépett volna.** Ezért kapott a `getDocuments`
egy `pageSize` felülíró opciót, és az őr kis lapmérettel mér — így valódi többoldalas tiling
fut (hézag-/átfedésmentesség, utolsó oldal maradéka, KPI-azonosság az utolsó oldalon).
Szabotázsra (aggregátum az oldalra szűkítve) **64 hibával pirosra megy — mérve.**

A `partner-ui-check` view-szintű lapozó-állításokat kapott (tartomány, `aria-current`,
szűrő-megtartás, export nem oldal-szűkített, egy oldalnál elrejtve).

## Buktató, ami időt vitt: a symlinkelt `assets/Temp`

A lapozót valós adaton nem lehet látni (14 tétel = 1 oldal), ezért fixture-ös előnézetet
generáltam — és a scriptet **`assets/Temp/`-be tettem, ami symlink a FŐ FÁBA**. Emiatt a
`../../src/...` importok a **fő fa kódját** töltötték be, nem a worktree-ét: a lapozó „nem
jelent meg”, holott a kódom jó volt. A preview-scriptnek a worktree gyökerében a helye.

## Módosított fájlok

`src/console/partnerData.ts` · `partnerViews.ts` · `server.ts` · `views.ts` · `src/ui/icons.ts`
(clock) · `public/assets/ui/citui-console-table.css|js` (új) · `scripts/documents-paging-check.mts`
(új) · `partner-ui-check.mts` · `partner-kb-shot.mts` · `design-token-lint.mts` ·
`design-token-scan.mjs` · `hooks/pre-commit` · `kb/entries/console-documents/` (entry + 390px shot)
· `src/i18n/catalog.json` · `_planning/PARTNER-UI-SPEC.md` · `_planning/DECISIONS.md` (ADR-0073)

## Nyitott / következő

- **Bizonylat-részletlap** (sorra kattintva: teljes bizonylat + tételek + fizetési előzmény) VAGY
  **Riport-fül** (havi bontás, korosítás-riport export) — a tulaj választ.
- A rebase közben a párhuzamos ADR-0067 ③ szál `T(lang, …)`-ba csomagolta a konzolt; a 6 új
  lapozó-felirat felkerült a katalógusba. Élesítés NEM történt (külön utasítás kell, §0.3).
