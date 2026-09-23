## ADR-0193 — Az ár-jogosultsági kapu a foglalási úton, és egy kerekítési szabály egy példányban (2026-09-21)

**Dátum:** 2026-09-21 · **Státusz:** elfogadva (megvalósítva, őrökkel) · **Kapcsolódó:**
ADR-0192 ⑧.1 és ⑧.2 (itt mérték ki a két leletet), ADR-0044 §6 és /c §10 (a foglalás KÉRÉS;
a `pricing` ÁRAT tesz rá), ADR-0080 ③ (a lemondott modul a periódus végéig él), ADR-0113
(időarányos első terhelés), ADR-0088 (kupon), ADR-0175 (minden képernyő megmondja, mit fizet
a vevő), §B.17 (tényhűség: jobb nincs szám, mint rossz szám).

**Kiváltó.** Tulajdonosi sürgős mandátum (`rc-briefs/urgent-price-gate-brief.md`): a két hiba
**pénzügyi/bizalmi kárt okoz**, a függőségi rendhez semmi közük, ezért külön szálat kaptak.

---

### ① `/api/foglaltsag` — ár nélküli lap, kötelező erejű ajánlat

**A hiba, reprodukálva (nem átvéve).** A javítás ELŐTT, eldobható fixture-ön (aktív `booking`,
lemondott `pricing`, 28 000 Ft-os alapár, 2 éjszaka): a végpont kiadta az árat, a kérésre
**56 000 Ft** fagyott, és a szám ott volt a vendégnek **kiküldött `.eml`-ben** is. Négy állítás
ment pirosra. A lapon közben ár nem szerepelt — ez nem „hiányzó ár", hanem **ellentmondás**.

**A döntés: a foglalás ELINDUL, csak SZÁM NÉLKÜL.** Nem a kérést tiltjuk le.

- A foglalás **kérés, nem vásárlás** (ADR-0044 §6): a tulaj a levélből dönt, és egy dátum +
  vendégszám + telefonszám önmagában is teljes értékű megkeresés.
- A `booking` modult a tenant **kifizette**. Egy meg nem vett `pricing` nem veheti el egy
  kifizetett modul funkcióját — az a `feedback_gate_must_not_refuse_the_paying_customer`
  hibaosztálya (a kapu a fizetni akarót tagadja meg).
- A vendégnek tett ígéret viszont **kötelező erejű**, ezért §B.17 dönt: **nincs szám**.

**A megvalósítás: EGY predikátum.** A „renderel-e ez a modul?" kérdés eddig egyetlen helyen
élt (a renderelő `on()`-ja), és a két publikus út egyszerűen **nem kérdezte meg**. Mostantól:
`isRenderedModule(m)` = `m.active && !m.supersededBy` (`src/tenant/modules.ts`), és
`siteRendersModule(siteId, moduleId)` a site-ról induló felületeknek. A renderelő `on()`-ja is
erre vált — nem másolat készült, hanem **a meglévő szabály kapott nevet**.

⭐ **A túl-kapuzás is hiba, és külön állítás védi:** `cancel_at_period_end=true` esetén az ár
**MARAD** — a tenant a fordulónapig kifizette (ADR-0080 ③).

---

### ② Egy kerekítési szabály — 1 626 a képernyőn, 1 627 a terhelésen

**A hiba.** A kupon-kerekítés két példányban élt: a kliens **modulonként** kerekített
(`Math.floor(p*FCM*(100-CPCT)/100)`, majd összeg), a szerver a **végösszegen**
(`applyOffer(monthly*months)`). `sum(floor(x))` ≠ `floor(sum(x))`. Azért nem derült ki, mert a
park egyetlen upsellje **éves**, ahol a két út véletlenül egybeesik.

**A döntés: nem parity-őr, hanem EGY példány.** A repó eddigi válasza a böngésző/szerver
kettősségre a `cit-money.js` + `money-format-check` páros volt: **szándékos** második példány,
mérésre bízva. Itt ez nem elég, és az indok nem esztétikai: **egy eltérő FORMÁZÓ csúnya
stringet ír, egy eltérő ÁR mást terhel, mint amit ígért.** Ezért a szabály egyetlen fájl
(`assets/runtime/cit-coupon.cjs`): Node `require`-ral betölti, a tenant-admin **ugyanazokat a
bájtokat** inline-olja a scriptjébe. `applyOffer` delegál.

⚠️ **A `.cjs` kiterjesztés nem szeszély:** a `package.json` `"type": "module"`, ezért egy `.js`
ugyanitt ESM-ként parse-olódna, és a szerver **egyáltalán nem tudná betölteni**.

**A per-modul sorok a végösszegből származnak, nem fordítva.** `splitFirstCharge()` a terhelt
végösszeget adja *és* a hozzá **pontosan** összeadódó sorokat (legnagyobb-maradék elosztás).
⚠️ **Vállalt következmény:** két azonos árú modul sora 1 Ft-tal eltérhet (mérve: 490 Ft + 490 Ft
4%-kal → 471 és 470). Ez tudatos csere: az egyforintos maradékot **valahova** tenni kell, és a
másik két lehetőség rosszabb — vagy a végösszeg hazudik (ez volt a hiba), vagy a kártya olyan
tételeket sorol, amik nem adják ki a saját alsó sorát (`feedback_two_divisors_on_one_row`).

---

### ③ AZ ŐRÖK — és amiért a fixture-jük maga is állítás

| Őr | Mit mér | Piros önteszt |
|---|---|---|
| `scripts/booking-price-gate-check.mts` | eldobható fixture, **valódi DB + valódi HTTP-szerver**; a végpont ár-válasza, a `quoted_total`, az összefoglaló, és a **kiszállított `.eml`** | 4 piros — a történeti viselkedésen |
| `scripts/coupon-rounding-check.mts` | **böngészőben** a sáv és a megerősítő kártya, a terhelés a valódi `createFirstChargeOrder`-ből, **független referencia-számítással** összevetve | 3 piros (1602 vs 1603) — a lap a történeti szabállyal renderelve |

⭐⭐ **A ② őr ELŐSZÖR a saját fixture-jét bizonyítja.** A kupon-százalékot nem tippeli: végigpróbálja
1…99-ig, amíg a két szabály **bizonyíthatóan** eltér a kosáron, és ha egyik sem választja szét
őket, **hangosan bukik** ahelyett, hogy zöld sort írna. Éves kosáron a hibás kód is zöld lenne —
ezért havit mér. A referencia-számítás **szándékosan nem hívja a `couponRule`-t**: egy őr, ami a
vizsgált függvénnyel mér, minden visszarontást átenged
(`feedback_guard_must_not_borrow_its_subject`).

⛔ **Két saját hiba, amit a mérés fogott meg, nem a gondolkodás:**
① az ① őr első változata a **KORÁBBI FUTÁS levelét** olvasta (a címzett-slug stabil), és a
javított kódra a javítás előtti összegeket jelentette — azóta csak olyan fájl válaszolhat, ami
egy pillanattal korábban még nem létezett. ② a ② őr piros kontrollja `page.evaluate()`-ből
akarta felülírni a `CitCoupon`-t, de az admin-script **IIFE**, tehát a `var` sosem ér a
`window`-ra: a kontroll `ReferenceError`-ral halt meg ahelyett, hogy mért volna. Most a lap a
történeti szabállyal **renderelődik**, és külön állítás bizonyítja, hogy a csere meg is történt.

---

### ④ AMIT NEM CSINÁLTAM

Az ADR-0192 ⑧ további hat hibája (mock fizetőoldal „éves előfizetés" felirata upsellnél; a
`rooms` eltünteti a fizetett `amenities`-t; az előnézet ÍR; `renewableModuleIds` és a
supersession; a nem-atomi `activateUpsell`; a `modules.ts:290-294` doc-hiba) **változatlanul
nyitva áll** — külön szálat kérnek.
