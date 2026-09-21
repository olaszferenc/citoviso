# 2026-09-21 — Ár-jogosultsági kapu a foglalási úton + egy kerekítési szabály (ADR-0193)

**Mandátum:** tulajdonosi SÜRGŐS brief (`rc-briefs/urgent-price-gate-brief.md`): az ADR-0192 ⑧
két pénzügyi/bizalmi kárt okozó lelete — javítás, őrrel és **negatív kontrollal**, majd landolás.
Élesítés NEM volt a feladat (§0.3).

---

## ① `/api/foglaltsag` — ár nélküli lap, kötelező erejű ajánlat

**Előbb reprodukáltam, aztán javítottam.** Eldobható fixture (aktív `booking`, lemondott
`pricing`, 28 000 Ft alapár, 2 éjszaka), valódi DB + valódi HTTP-szerver. A javítás ELŐTT
**4 állítás ment pirosra**, és a döntő bizonyíték nem egy mező volt, hanem a **kiszállított
levél**: `56 000 Ft` ott állt a vendégnek kiment `.eml`-ben, egy olyan szállásról, ahol a lapon
ár nem szerepel.

**A döntés: a foglalás ELINDUL, csak SZÁM NÉLKÜL.** A kérés nem vásárlás (ADR-0044 §6), és a
kifizetett `booking` modul funkcióját nem veheti el egy meg nem vett `pricing`
(`feedback_gate_must_not_refuse_the_paying_customer`); a vendégnek tett ígéret viszont kötelező
erejű, ezért §B.17 dönt: nincs szám.

**A predikátum EGY helyen.** `isRenderedModule()` + `siteRendersModule()`
(`src/tenant/modules.ts`) — a renderelő `on()`-ja is erre vált, tehát nem másolat készült,
hanem a MEGLÉVŐ szabály kapott nevet és két új hívót.

⭐ **A túl-kapuzás is hiba, külön állítás védi:** `cancel_at_period_end=true` mellett az ár
MARAD (ADR-0080 ③: a fordulónapig ki van fizetve).

## ② Kupon-kerekítés — 1 626 a képernyőn, 1 627 a terhelésen

A szabály két példányban élt: a kliens **modulonként**, a szerver a **végösszegen**.
Reprodukálva: `[490, 690, 990]` kosár, **HAVI** ütem, 25% → 1 626 vs 1 627.
Évesen a két út véletlenül egybeesik — ezért nem derült ki eddig, és **ezért mér az őr havit**.

**Nem parity-őrt írtam, hanem megszüntettem a második példányt.** A repó eddigi válasza a
böngésző/szerver kettősségre a `cit-money.js` + `money-format-check` páros: szándékos második
példány, mérésre bízva. Itt ez nem elég — **egy eltérő FORMÁZÓ csúnya stringet ír, egy eltérő ÁR
mást terhel, mint amit ígért.** A szabály most egyetlen fájl (`assets/runtime/cit-coupon.cjs`):
Node `require`-ral betölti, a tenant-admin ugyanazokat a bájtokat inline-olja.
⚠️ `.cjs`, mert a `package.json` `"type": "module"` — egy `.js` itt ESM-ként parse-olódna, és a
szerver be sem tudná tölteni.

⚠️ **Vállalt következmény:** a per-modul sorok legnagyobb-maradékkal oszlanak, hogy PONTOSAN
kiadják a végösszeget — így két azonos árú modul sora 1 Ft-tal eltérhet (mérve: 490 + 490 @ 4%
→ 471 és 470). A másik két lehetőség rosszabb: vagy a végösszeg hazudik (ez volt a hiba), vagy a
kártya olyan tételeket sorol, amik nem adják ki a saját alsó sorát.

---

## ⛔ Két SAJÁT hiba, amit a mérés fogott meg — nem a gondolkodás

1. **Az ① őr a KORÁBBI FUTÁS levelét olvasta.** A címzett-slug stabil
   (`guest-bare-example-com`), ezért a `readdir().sort().pop()` azonnal talált egy fájlt — a
   javítás utáni futásra a javítás ELŐTTI összegeket jelentette. Vagyis egy **hibátlan kódot
   mondott hibásnak**, és fordítva is megtehette volna. Javítás: pillanatkép a mérés ELŐTT,
   és csak olyan fájl válaszolhat, ami akkor még nem létezett.
2. **A ② őr piros kontrollja `ReferenceError`-ral halt meg.** `page.evaluate()`-ből akartam
   felülírni a `CitCoupon`-t, de az admin-script **IIFE**, tehát a `var` sosem ér a `window`-ra.
   Most a lap a TÖRTÉNETI szabállyal **renderelődik** (a `COUPON_JS` cseréje a kimenetben), és
   külön állítás bizonyítja, hogy a csere meg is történt — egy no-op `replace` ugyanis a
   javított lapot mérné, és arra mondaná, hogy „az őr vak".

⭐ **A ② őr ELŐSZÖR a saját fixture-jét bizonyítja:** a kupon-százalékot 1…99-ig végigpróbálja,
amíg a két szabály **bizonyíthatóan** eltér a kosáron, és ha egyik sem választja szét őket,
hangosan bukik ahelyett, hogy zöld sort írna. Egy fixture, ami a hibás kódon is zöld, nem fixture.

---

## Mérések

| Mit | Javítás ELŐTT | UTÁN |
|---|---|---|
| `booking-price-gate-check` | **4 piros** (végpont ár · `quoted_total` 56 000 · összefoglaló · a vendég levele) | zöld, önteszt 4 piros |
| `coupon-rounding-check` | a történeti szabály **1602**, a terhelés **1603** | zöld (mind egy szám), önteszt 3 piros |
| Sáv-sorok (asztali, mérve) | — | 471 + 470 + 278 = **1 219** = „Fizetendő most" |
| Szomszéd kapuk | — | `modules-quiet-list` · `module-upsell` · `modules-annual` · `module-purchase-state` · `module-config` · `booking-price-coherence` mind zöld |

## Módosított / létrehozott fájlok

- `assets/runtime/cit-coupon.cjs` **(új)** — a kerekítési szabály EGY példányban
- `src/payment/couponRule.ts` **(új)** — a betöltő (Node `require` + a böngésző-forrás)
- `src/payment/offers.ts` — `applyOffer` delegál
- `src/tenant/moduleUpsell.ts` — `splitFirstCharge().total` árazza a rendelést
- `src/server/adminViews.ts` — a kliens a KÖZÖS szabályt kapja (`fcPrice` kivezetve)
- `src/tenant/modules.ts` — `isRenderedModule` · `tenantRendersModule` · `siteRendersModule`
- `src/tenant/editor.ts` — az `on()` a közös predikátumra vált
- `src/server/public.ts` — `/api/foglaltsag` ár-kapu
- `src/booking/requests.ts` — a quote befagyasztása kapu mögött
- `scripts/booking-price-gate-check.mts` **(új)** · `scripts/coupon-rounding-check.mts` **(új)**
- `hooks/pre-commit` — mindkét őr bekötve, diff-scope-olt triggerrel
- `_planning/DECISIONS.md` — ADR-0193

## §2b

A felület-kapu **kivétel-ágán** ment, a tulaj sürgős mandátuma alapján (a brief NÉV SZERINT
jelöli ki az `adminViews.ts:1499` sort). Szám-helyesség, nem kinézeti döntés: egyetlen felirat,
szín, méret, elrendezés sem változott. ui-shot 390 px + asztali legyártva **és megnézve**, a
sáv számai **mérve** (nem szemmel: a képről 471/662/278-at olvastam ki, a DOM 471/470/278-at
mondott — a squint majdnem álhibát szült).

## 🔴 Nyitott (NEM az én szálam — ADR-0192 ⑧ maradéka)

A mock fizetőoldal „éves előfizetés" felirata upsellnél · a `rooms` eltünteti a fizetett
`amenities`-t · az előnézet ÍR · `renewableModuleIds` és a supersession · a nem-atomi
`activateUpsell` · `modules.ts:290-294` doc-hiba.
