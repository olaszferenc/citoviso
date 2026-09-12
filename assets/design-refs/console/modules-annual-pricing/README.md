# Kontraktus — Modulok fül: modul-ár és végösszeg a fiók számlázási ciklusában

**Jóváhagyva:** 2026-09-12, tulajdonosi döntés a §2b terv-körben (A/B/C változatból a **B**).
**Kiváltó:** Elek FK-002 (2026-09-12) Z1 · Z2 · GY1 leletei — éves számlázású fiók (99 900 Ft/év)
a modul-kártyákon csak „+490 Ft/hó" címkéket látott, éves átváltás és végösszeg nélkül.
**Hatókör:** `src/server/adminViews.ts`, `src/server/moduleConfigViews.ts`, `public/assets/ui/citui-admin.css`
**Kapcsolódó:** ADR-0080 (előfizetés-motor), ADR-0088 §8 (éves ütem, `data-mult`), ADR-0113
(fizetett modul csak fizetés után), 03-INVARIANTS §B.17 (tényhűség).

A `modules-annual-pricing.html` a jóváhagyott terv — **kattintható**, valós ELEK-TESZT adattal
(alapdíj 3 900 Ft/hó, 11 számlázott modul 6 090 Ft/hó, havi 9 990 Ft, éves 99 900 Ft, 2 hó ajándék).
A „Mobil 390px / Asztali" váltó mindkét elrendezést megmutatja egy fájlban.

---

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

### 1. A modul-chip mindkét ütemet kimondja — a havi elöl

Éves számlázású fióknál a modul-kártya ára **`+490 Ft/hó = 4 900 Ft/év`** alakú: a havi egységár
marad az elsődleges (ezen hasonlítja össze a modulokat), az éves összeg mellette, halványabban.

- Az éves szorzó **`12 − annualFreeMonths`** (ma 10) — **ugyanaz**, amit a tervsáv `data-mult`-ja
  már használ (`adminViews.ts` Következő-számla cella). ⛔ Nem új szabály: egy meglévő szabály
  kiterjesztése a statikus chipre. Ha a szorzó egy helyen változik, mindkettőnek követnie kell.
- **Havi fióknál a chip változatlan** (`+490 Ft/hó`) — az átváltás csak akkor jelenik meg, ha a
  fiók tényleg éves ütemű. Egy havi fiónak az éves szám zaj.
- Ugyanez áll a **modul-beállító képernyő** fejléc-árára is (`moduleConfigViews.ts` `moduleHeader`
  és `priceNote`): ha egy modul ára megjelenik, a fiók ütemében jelenik meg.

### 2. „Az én moduljaim" végén háromcellás összegző

Az Előfizetés-kártya **saját formanyelvén** (`.adm-sub__cell` mintájára), a lista alatt:

| Modulok együtt (N db) | Alapdíj (honlap + időpontkérés) | **Éves díja összesen** |
|---|---|---|
| 60 900 Ft | 39 000 Ft | **99 900 Ft** |
| 6 090 Ft/hó | 3 900 Ft/hó | 8 325 Ft/hó-nak felel meg · 2 hónap ajándék |

- **A legnagyobb szám az, amit fizet** (`feedback_screen_must_not_shrink_or_decide`): éves fiónál
  a 99 900 Ft a vizuálisan domináns érték, a havi ekvivalens a kíséret. Havi fiónál fordítva.
- Az összegző **a kapcsolókkal együtt mozog**: „Kikapcsolom" → az összegző azonnal újraszámol a
  valódi szabállyal. ⛔ Nem egy szerver-oldali statikus szám, amit a kapcsolgatás meghazudtol.
- A modul-darabszám a cellában **a számlázott** modulokat számolja, és a felirat ezt ki is mondja
  („Modulok együtt (11 db)") — a szám SZERKEZETILEG abból származzon, amit összead
  (`feedback_label_must_derive_from_predicate`).

### 3. A számláló megnevezi, mit számol

Az Áttekintés fül csempéje a számot és a jelentését EGYÜTT mondja ki — a kötő felirat
a kódban: **„Aktív modul · ebből {n} számlázott ·"** (a darabszám a `{n} db` sablonból jön,
tehát a rendered sor: „12 db · Aktív modul · ebből 11 számlázott · kezelés").
A 12 az `m.active`, a 11 a számlázott (`!spine && !supersededBy`) — mindkettő igaz, de eddig
egyik felület sem mondta meg, melyiket mutatja. ⛔ A két szám közül egyiket sem töröljük.

### 4. Amit a terv NEM enged

- ⛔ A havi alak eltüntetése éves fiónál (a C változat) — a tulaj elvetette.
- ⛔ Az éves összeg elhagyása a chipről (a mai állapot) — ez a lelet maga.
- ⛔ Olyan végösszeg, ami nem egyezik az Előfizetés-kártya „Következő számla" cellájával.
  A fülön **egy** igazság lehet.

> ⚠️ **Ez a pont KÉTSZER sérült meg a szállításkor — mindkettő „egy szabály, két példány".**
> A tudásbázis-őr találta meg, nem a gépi kapu.
>
> ① **Az ÉRTÉK duplikálva:** az összegző újraderiválta a számlázott halmazt `mv.modules`-ból,
> és a saját predikátuma nem ismerte a `cancelAtPeriodEnd`-et. Egy lemondott modul mellett a
> képernyőn **60 700 Ft** állt az összegzőben és **53 800 Ft** a „Következő számla" cellában.
> Ráadásul a visszakapcsolás duplán számolt (a szerver bázisa tartalmazta a sort, a
> `data-committed="0"` checkbox meg hozzáadta): 75 300 a 68 400 helyett.
> ② **A PERIÓDUS duplikálva:** az első javítás az értékeket egy forrásra kötötte, de az
> `annualMult` csak `billingPeriod === "annual"`-t nézett, a számla-cella viszont
> `pendingAnnual || annual`-t. Egy előjegyzett éves váltású HAVI fióknál ez **tízszeres**
> eltérés volt (5 570 vs. 55 700).
>
> **A kötelező forma:** a „számlázott modul" definíciója EGYETLEN függvény
> (`isBilledModule`, `src/tenant/modules.ts`), és a `Modulok` fül összegzője, a
> `subscriptionAdmin` számlatételei és az `Áttekintés` csempéje MIND ezt hívja; a periódus
> pedig ugyanaz a `pendingAnnual || annual` kifejezés, mint a számla-cellában. Új hívóhely
> nem írhat saját predikátumot.

> ⚠️ **HARMADIK példány, ugyanaz az osztály (2026-09-12, tulaj-kérésre javítva):** a
> **„Jelenlegi díj"** cella az éves ágon `sub.annualTotal`-t írt — ami a KÖVETKEZŐ számla.
> Egy lemondott modul mellett **53 800 Ft/év** állt „jelenlegi" felirattal, miközben a vevő a
> futó évre **60 700 Ft**-ot fizetett; ráadásul a cella pontosan ugyanazt a számot mutatta,
> mint a mellette lévő „Következő számla", tehát a kettő közül az egyik felirat biztosan
> hazudott. A cella mostantól a FOLYÓ időszakot mondja (`mv.totalMonthly`, ami a lemondott-de-
> kifizetett modult megtartja, a spine-t, a kiváltottat és az egyszeri díjast pedig eleve
> kihagyja). **A két cellának KÜLÖNBÖZNIE kell**, amint a fordulónapon változik valami — a
> különbség maga az információ.

---

## Mérési nyom (a terv-kör alatt)

- A viselkedés Playwrighttal végigkattintva, 390px **és** desktop: 0 JS-hiba, a méret-váltó a
  viewportból indul, a kapcsoló a valódi szabállyal (havi × 10) számol újra.
- ⚠️ A terv-kör **saját leletet** termelt: az első mockban 390px-en az „Asztali" gomb nem
  rendezett át — a `.con` shrinkelhető flex-item volt, így a `container-query` sosem tüzelt, és
  a tulaj telefonon a döntés felét nem látta volna. `flex:0 0 auto` + skálázás (az `adm-pv`
  előnézet bevált mintája) javította.

## Az őr, ami ezt méri

`scripts/modules-annual-check.mts` — a **renderelt** Modulok fülön méri (nem a forráson):
éves fiónál a chip tartalmaz-e éves alakot, van-e összegző, egyezik-e a végösszeg az
Előfizetés-kártyával, és havi fiónál NEM jelenik-e meg éves alak. Negatívan is futtatva.
