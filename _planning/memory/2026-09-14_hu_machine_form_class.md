# 2026-09-14 — A gépies magyar alak („a(z)", „10-a/-e") teljes hibaosztálya lezárva

**Szál:** A2 (BRIEF) · **ADR:** 0153 · **Élesítés:** NINCS (a tulaj külön engedélye kell).

## Amit mértem

A bejelentés (Elek FK-002 E1 · FK-005b E-11 · FK-006a/b ZAVAROS-6) **három** helyet nevezett
meg. Az első grepem **csak a kisbetűs `a(z)`-re futott** — ez maga volt a mérési hiba: a
kis- ÉS nagybetűs sweep **17 emberi felületre kerülő** előfordulást talált **15 fájlban**.
Az őr építése közben előkerült egy **18.** is, másik alakban („elrendezés(ek)re").

| Hol | Mi |
|---|---|
| bérlői admin (`adminViews`, `moduleConfigViews`, `bookingViews`) | Fordulónap `10-a/-e`, modul-leváltás, webcím-vásárlás/-elszámolás, foglalás-naptár — 11 hely |
| VEVŐI levél + SMS (`billingEmail`, `domainEmail`) | felfüggesztés-figyelmeztető SMS, „a webcím elkelt", lemondás-elszámolás — 4 hely |
| VENDÉG (`generator/runtime`) | a no-JS foglalás-kártya („Vegye fel a kapcsolatot a(z) X szállással") |
| operátor (`partnerData`, `outreachCheck`, `sendBatch`, `sendOutreachSms`, `pairRepair`, `multilangResume`, `reenrichOne`, `views`) | hibaüzenetek, kapu-ok-sorok, riasztó-levelek — 10 hely |

⛔ **Szándékosan NEM nyúltam** a `console.*` naplóhoz és a `throw new Error()` kivétel-szöveghez
(`domains/registrar/websupport.ts` 13 hely, `payment/*` 4 hely): azt fejlesztő olvassa, és a
CLAUDE.md §4 tiltja a nem kért működő kód módosítását. A határ STRUKTURÁLIS, nem kivétel-lista.

## Amit változtattam

- `src/text/day.ts` — **új `formatMonthDay(day, lang)`**: `1-je`, `2-a`, `10-e`. A 31 nap
  végződése ZÁRT TÉNY, nem heurisztika. Idegen csomag a puszta számot kapja.
  (A `formatDayStem` azért nem ért ide: az ISO **dátumot** formáz, a Fordulónap-cellába
  viszont sosem érkezik ISO string — csak egy hónapnap-szám. Más részprobléma volt.)
- A 18 hely a MEGLÉVŐ eszközökkel javítva (`huArticle` / `huArticleLower` / `formatMonthDay`),
  a feliratok `{art}` / `{Art}` / `{day}` placeholderrel mennek a katalógusba.
- `kb/entries/admin-subscription` + `admin-modules-booking` — a súgó a régi, gépies feliratot
  IDÉZTE; egy javított képernyő mellett a cikk hazudott volna.
- `scripts/hu-machine-form-check.mts` — új őr, pre-commit `--fast` (~15 mp).

## Amit az őr építése tanított (a leletnél értékesebb)

1. ⛔⛔ **Az első lefedettség-tanúm ZÖLDEN VÉDTE a vakfoltot.** A körbejárás „11/11 lap
   megmérve"-t írt, és a „Fordulónap" tanú is zöld volt — csakhogy a szót a tenant-admin
   **SÚGÓ fülén**, a KB-cikkben találta meg. Az Előfizetés kártya **meg sem jelent**: a közös
   dev-parkban **0 db `subscription` sor** van. → a tanú a termék KIMENETÉNEK alakjára
   illeszkedik, a kártyát pedig a ② réteg a valódi `modulesSection()`-ből állítja elő,
   **31 nap × 2 ütem = 62 render**, park-függetlenül.
2. ⛔ **A túl általános szabály 189 hamis leletet adott** a nyers forrás-literálokon — a
   `<script>` blokkok JS-hívásaira (`forEach(function(el){…}`). Egy őr, ami szigorúbban mér,
   mint a mért rendszer, hamis leletet gyárt → a szabály csak EMBERI szövegen fut.
3. **A kis-nagybetű a mérésben is számít** — kétszer: egyszer a sweepben (`A(z)` kimaradt),
   egyszer a tanúban (a „Leadek" az „Aktív leadek"-re csak érzéketlenül illeszkedik).

4. ⭐ **A landolás maga bizonyította a kaput.** A rebase egy PÁRHUZAMOS szál ugyanaznapi
   bekezdés-átírásával ütközött (`loginHelpPage`: tegezés → magázás + i18n-csomagolás), és az
   az átírás **ÚJRA behozta a tiltott alakot**. Iker-javítás: az ő újabb, becsomagolt szövegük
   maradt, rajta az én javításommal. Kapu nélkül ez némán landolt volna — ugyanazon a napon,
   amikor javítottuk.

## Bizonyíték

- **Piros ág:** a javítást visszarontva `--fast` → **190 lelet**, köztük a RENDERELT kártyáról
  („Fordulónap minden hónap 1-a/-e"); `bash -c 'set -e; …'` alatt **rc=1** (a commit megáll),
  zöld ágon rc=0.
- **Negatív önteszt:** 13 helyes alak (`Ft/hó`, `7/24`, `be-/kikapcsolás`, `Alap/Bővített`,
  ISO-dátum, `Ptk. 6:78. §`, „(a Foglalások fülre visz)") NEM sül el.
- **Teljes futás (böngészővel):** konzol 23/23 + tenant-admin 11/11 lap, 19 sablon,
  2 no-JS kártya, 12 vevői üzenet, 38 kapu-ok-sor, 62 Előfizetés-kártya → TISZTA.
- **ui-shot** (§2b kivétel, a tulaj BRIEF-je nevesítette a javítást): 390 + 1280 px,
  megnézve — „Fordulónap / minden hónap **10-e**" és „Ezt most **a** „Foglalás (upsell)"
  váltja ki". Az elrendezés nem változott, csak a szó.
- `tsc --noEmit` tiszta, `i18n-lint` tiszta, `kb-check --coverage` 35/35,
  `elek-label-drift-check` 156/156.

## Nyitott

- A `domains/` és `payment/` kivétel-/napló-szövegeiben maradt 17 `a(z)` — **tudatos** döntés
  (fejlesztői olvasó). Ha valaha felületre kerülnek, az őr fájllistáját bővíteni kell.
- A teljes (böngészős) futás az Előfizetés kártyát a parktól függően nem látja; a hiányt
  a futás KIMONDJA, és a ② réteg fedi. Ha a park kap `subscription` sort, a tanú magától zöld.
