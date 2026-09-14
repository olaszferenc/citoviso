# 2026-09-14 — A kiküldés-kapu csak a TÖRÖTT képet fogta, a NULLA-fotósat „ok"-nak mondta

**Forrás:** Elek FK-004b GY-1 (a 2026-09-13-i teljes futásból), a mai `origin/main`-en
újraellenőrizve. **ADR-0156.** Élesítés NINCS (§0.3).

## A rés

`src/outreach/mockPhotoHealth.ts` — `verdict: broken.length ? "broken" : "ok"`.
Ha nincs mit töröttnek mérni, a verdikt **„ok"**, tehát a kiküldés-kapu (jóváhagyás ·
követett link · levél · SMS) **átengedi a kép nélküli lapot**. Ez az ADR-0134 SZÁNDÉKÁNAK
kijátszása: a vevőnek üres oldal megy ki, zöld kapuval.

⚠️ **És a kockázat NŐTT:** az ADR-0136 óta a generálás ELDOBJA a véglegesen halott
fotókat, vagyis a „törött kép" esetének helyét rendszerszinten a „nincs kép" veszi át —
pont az, amire a kapu vak volt. A két javítás EGYÜTT csökkentette a kapu hatókörét.

**A kapu nem tévedett — MÁS KÉRDÉSRE válaszolt:** azt mérte, hogy a lapon lévő képek
élnek-e, nem azt, hogy van-e egyáltalán kép.

## Mérve (a szám döntötte el, mekkora a baj)

| mérés | eredmény |
|---|---|
| jóváhagyott artefaktum a parkban | 3 (2 mérhető a lemezen) — **mindkettőn 6 élő fotó**, ma egy sem nulla-fotós |
| lead 0 portál-fotóval | **558 / 595 (93,8 %)** |
| …ebből 0 Places-fotóref is | **148 / 595 (24,9 %)** → ezekre a lap **biztosan** kép nélkül állna elő |
| a maradék 410 | a Places élőségén múlik — a Places-út ma **él** (1 hívás: 10 fotóref) |
| fotó nélküli lap kép-hivatkozásai | **19 sablon × 2 fázis + template-first → MIND 0** |

⛔ **Amit a 148 NEM jelent:** nem 148 kiment lapot. Ma egyetlen ilyen artefaktum sincs a
parkban — a szám a KITETTSÉG, nem a kár. A leletet ettől függetlenül javítani kell: a
generálás bármelyik leadre indítható, és a kapu addig nem szólt volna.

⚠️ **A Places-állapotot újramértem, nem a memóriámból vettem:** a 2026-09-09-i „403
PERMISSION_DENIED" sorra hivatkozva alábecsültem volna a kitettséget. Egy valódi hívás
**10 fotóreffel tért vissza** — a Places-út ma él. (A memória-bejegyzést egy párhuzamos
szál ma már helyesbítette; ugyanarra a tanulságra jutottunk külön-külön: külső rendszer
állapota pillanatkép, nem leltár-sor.)

## Amit szállítottam

- **Új `nophoto` verdikt** (`refs.length === 0`), és a kapu blokkol rá. A predikátum a
  hivatkozások SZÁMÁRA néz, nem a távoliakra: relatív/`data:` képről nem mértünk semmit,
  tehát nem állíthatjuk, hogy nincs fotó (§B.17).
- **A predikátum ÉRVÉNYESSÉGE mérve** (nem feltételezve): ha egy jövőbeli sablon dekoratív
  képet tenne a fotótlan lapra, a kapu némán vakká válna — ehelyett az őr pirosra megy.
- **Kimondott ÉS INDOKOLT kivétel** (`inputs.noPhotoAck`: ki · mikor · **miért**, min. 10
  karakter). Az ADR-0134 névsoros pipája itt értelmetlen lenne (nincs névsor, mert nincs
  kép); az indoklás nélküli sor NEM tudomásulvétel.
- **§2b kör lefutva:** 2 kattintható változat, mobil+asztali kép, tulajdonosi döntés —
  **„B" (két lépés) + kötelező indoklás**. Kontraktus befagyasztva:
  `assets/design-refs/console/nophoto-gate/` (README **Hatókör**-rel és 6 KÖTŐ felirattal,
  amiket a `contract-drift-check` a szállított kódon mér).
- **A levél/SMS saját indoklást ad** — a törött-kép mondat egy üres lapon hamis lenne.
- **ADR-0129 megtartva és MÉRVE:** a vevői rendelés emelése nem akad el ezen a kapun.

## Saját hibák, amiket a mérés fogott meg

⛔⛔ **Az őr szerkezeti mérése a MÁSIK FÁT olvasta.** Az `import`-ok a script fájához
képest oldódnak fel (worktree), a `readFile(path.resolve(process.cwd(), …))` viszont a
munkakönyvtárhoz — és a `--sweep` miatt az őrt a FŐ FÁBÓL futtatjuk. Így a szerkezeti
állítások a fő fa forrását mérték, a viselkedési részek az enyémet: **három kész
javításomat jelentette hiányzónak.** Javítva: `SRC_ROOT` = a script saját fája.
(Ugyanez az osztály egyszer már négy javítást tüntetett el — `reference_elek_runner_measured_other_tree`.)

⛔ **A felület-mérésem KIVÉTELLEL állt le jelentés helyett.** Az öntesztben nincs
kapu-doboz, a `summary.click()` Playwright-timeouttal ölte meg a futást — a maradék
állítás sosem hangzott el. Egy hangosan bukó őr még nem használható őr.

⛔ **A saját `pgrep -f "mock-photo-gate-check"` mintám a SAJÁT parancssoromra is
illeszkedett** → végtelen várakozás. Ez a CLAUDE.md §8 self-pkill csapdájának pgrep-es
testvére.

⛔ **A README-m a tulaj VÁLASZ-CÍMKÉIT idézte `**„…"**` alakban** („B — két lépés"), amit a
`contract-drift-check` joggal kötő UI-feliratnak olvasott, és bukott. A jelölést átírtam a
VALÓDI kötő feliratokra, `**Hatókör:**` sorral — így a kapu most tényleg mér valamit
(6 felirat, mind él a kódban).

## Mért, NEM javított (kimondva, nem elnyelve)

**A `.con button.bad` felirat-kontrasztja 3,91 (fehéren) / 3,57 (a kapu dobozán)** — a
4,5-ös küszöb alatt. Ez a ház **13 helyen** használt piros gombja, a meglévő ADR-0134
tudomásulvétel-gomb ugyanez; **nem az én változásom hozta**, és egy házon átívelő
szín-döntés tulajdonosi kör. Amit az őr ehelyett mér: a felirat a márka-piros **marad**
(a `.con button` 0,1,1 specificitása nem írja felül — ez a csapda a házban háromszor
ütött), és a tiltott gomb **tiltottnak is LÁTSZIK** (opacity 0,5).

## Őr

`scripts/mock-photo-gate-check.mts` — **71 állítás** (volt 39), önteszt **26 piros**.
⛔ **Két irányban bizonyítva:** a `--self-test` a fotótlan lapnak ad képet (26 piros), és
külön, kézzel visszarontva a verdikt-ágat + a kapu-sort **13 piros** — vagyis a
predikátum-állítások sem beégetett elvárásból zöldek.
Pre-commit trigger kiterjesztve (`src/console/data.ts`, `citui-console.css`, és **az őr
saját fájlja** — iker-javítás: egy párhuzamos szál ugyanezt tette, a rebase-konfliktust
unióként oldottam fel).

## Infra

- Párhuzamos szálak őr-futásai a KÖZÖS parkot mozgatják: a `consent-style-check` egy
  commit-körben **hamis pirosat** adott (3 újrafuttatásból 3 zöld), miközben a
  `wt/azragozas` fából ugyanaz a `mock-photo-gate-check` futott. A `sites/`-fixture-ütközés
  ismert (`reference_shared_sites_fixture_race`) — most a tünete egy MÁSIK őr pirosa volt.
- A commit-kapu kör ~5-8 perc (böngészős őrök), és háromszor kellett újraindítani
  (idegen piros · contract-drift · a saját pgrep-csapdám).

## Nyitott

- A `.con button.bad` kontrasztja (fent) — külön kör.
- Ha a lap MINDEN képe törött (0 élő fotó), a kár azonos a `nophoto`-val, de a kiút az
  ADR-0134 névsoros tudomásulvétele marad. Ha ez rutinná válik, a két ág összevonandó.
- A `mock-photo-gate-check` fixture-je továbbra is a közös `sites/`-be és a közös DB-be ír.

## Módosított / létrehozott fájlok

- `src/outreach/mockPhotoHealth.ts` · `src/outreach/sendBatch.ts` · `src/outreach/sendOutreachSms.ts`
- `src/console/server.ts` · `src/console/views.ts` · `public/assets/ui/citui-console.css`
- `src/i18n/catalog.json` · `hooks/pre-commit` · `scripts/mock-photo-gate-check.mts`
- `assets/design-refs/console/nophoto-gate/` (README.md · plan.html · A-B-mobil.png · A-B-asztali.png)
- `_planning/DECISIONS.md` (ADR-0156) · `_planning/memory/INDEX.md` · `MEMORY.md`
