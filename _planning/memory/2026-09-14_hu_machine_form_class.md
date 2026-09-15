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

## Utóirat (2026-09-15) — a park vakfoltja megszűnt, a megjegyzésből KAPU lett

A fenti „nyitott ② " tétel lezárva, tulajdonosi kérésre.

**A lyuk oka, mérve.** A park FÉLIG KIPURGÁLT állapotban élt: `tenant` 1 · `site` 1 (live) ·
`module_entitlement` **12 aktív** — de `order_intent` 0 · `payment` 0 · `subscription` 0.
Tizenkét kifizetett jogosultság nulla vásárlási előzménnyel; ezért az Előfizetés kártya
(`sub === null`) meg sem renderelődött, és a körbejárás „11/11 lap megmérve"-t írt egy olyan
képernyőre, amit sosem látott.

**A pótlás a TERMÉK saját útján megy** (`scripts/seed-park-subscription.mts`), nem nyers
`INSERT`-tel: `order_intent (kind='initial', a prospecten át)` → kifizetett `payment` →
`ensureSubscriptionForOrder()`. ⛔ Egy kézzel írt sor olyan állapotot is előállíthatna, amit a
termék soha — és akkor az őr egy **fikciót** mérne. A fordulónapot így az ADR-0144 ① egyetlen
definíciója adja, nem az én dátum-írásom. A horgony a bérlő SZÜLETÉSE (`2026-09-14`), nem a mai
nap: egy „mai" horgony sosem létezett fordulónapot adna, és minden futtatás elcsúsztatná a
park óráját. Dry-run alapból, idempotens, kiírja a visszavonás azonosítóit.

**A tanúból kapu lett.** Amíg a hiány nem volt egy paranccsal orvosolható, az Előfizetés-tanú
csak megjegyzés lehetett. Most `line()`-kapu, a hibaüzenetében a pótló paranccsal.

**Bizonyítva (a COMMITOLT fájlból, nem a /tmp-s vázlatból):** töröltem, amit a vázlat csinált →
dry-run · írás · második futás („🟢 már van" — idempotens). Majd **piros önteszt**: a sort
törölve a teljes futás `⛔ BUKÁS — 0 gépies alak + 1 szerkezeti hiba`, a tanú megnevezi a
pótló parancsot; a seeder visszaállítja, és mind a három tanú zöld, megjegyzés nélkül.
Képen is megnézve (390 + 1280): **„Fordulónap — minden hónap 14-e"**.

⚠️ A `MEMORY.md` aktív blokkját NEM írtam át: időközben egy másik szál (ADR-0169) vette át,
és ez itt az ő munkájuknál kisebb utóirat — a helye ebben a jegyzetben van.

## Nyitott

- A `domains/` és `payment/` kivétel-/napló-szövegeiben maradt 17 `a(z)` — **tudatos** döntés
  (fejlesztői olvasó). Ha valaha felületre kerülnek, az őr fájllistáját bővíteni kell.
- A park purge-ölése visszahozza a lyukat; a kapu ilyenkor pirosra megy, és megmondja a
  pótló parancsot. Automatikus újravetés SZÁNDÉKOSAN nincs: egy őr, ami magának gyártja a
  fixture-jét, a saját mérését is megírja.
