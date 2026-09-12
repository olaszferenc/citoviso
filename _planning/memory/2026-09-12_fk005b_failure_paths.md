# 2026-09-12 — FK-005b átnézés: a bukás-ágak kiútja és a fizetett-de-nem-élesedett rés

**Kiindulás:** tulaj-kérés a checkout-kör után — „nézd meg az FK-005b-t is".

## A futás

`npx tsx elek/bin/run-all.mts FK-005b` (szűkített; az időutazó NEM futott):
**8 gépi zöld · 0 piros · 5 kézi lépés.** A main-en egy párhuzamos szál 2026-09-11-én
már javította a H1/H3-at (ref + retry-gomb a bukás-oldalon), és a mock-ág mostantól
`303`-mal átadja a vezérlést a `/pay/done`-nak — egy út, nem két divergens másolat.

## A kézi lépések ítélete (ez a gépi zöld NEM adható rájuk)

| # | Amit ítélni kellett | Ítélet |
|---|---|---|
| 07 | a fizetőoldal státusza az elutasítás után | **PASS** — „A fizetés elutasítva — terhelés nem történt", státusz-sor, olvasható újrapróba-gomb |
| 10 | dupla-terhelésre utaló jel | **PASS** — „Ez a fizetés rendezve van", gomb nincs |
| 11 | a kifizetett modul nyugtája | **PASS** — „Kifizetve — 14 900 Ft · 2026. 09. 12. 10:10", megvásárolt nyelvek, hivatkozási azonosító, letiltott nyelv-pipák |
| 12 | a bizonylat-sorok | **PASS** — összeg + dátum + PDF, olvasható |
| 13 | összkép | a lépésnek **nincs saját nézete** → a 12. kép duplikátuma (forgatókönyv-gyengeség, nem termék-hiba) |

## ⛔ Két valós lelet — mindkettő javítva

**① A bukás-oldal EGYETLEN kiút-gombja olvashatatlan volt.** A `.con a` (specificitás
0,1,1) **veri** a `.citui-btn--*` szín-szabályait (0,1,0), ezért a link-alakú gomb a konzol
cián link-színét vette fel — **cián felirat a cián gradiensen**. Mérve:
**kontraszt 1.16** (a világosabb gradiens-végen 1.71), a WCAG AA minimum 4.5 / nagy
szövegre 3.0. Közben minden gépi ellenőrzés boldogan „láthatónak" jelentette a feliratot.
Javítva a `citui-console.css`-ben, **általánosan** (a következő `<a class="citui-btn">` is
beleesett volna): a variáns dönti a gomb színét, a link-szabály nem ér bele.
**Utána: 7.03 / 10.37.**

**② Saját rés a tegnapi szállításomban:** a `payResultPage` **`!activated` ága** (fizetett,
de az oldal még véglegesítés alatt) NEM mondta ki a tartós kötelezettséget. A kártyát
ekkor már megterheltük és az `ensureSubscriptionForOrder` már lehorgonyozta a fordulónapot,
tehát a kötelezettség FENNÁLL — a vevő a következő terhelésről a bankszámla-kivonatból
értesült volna. A checkout-fullscreen kontraktus ⑪ „a visszaigazolás"-t mond, és ez is az.
Javítva: az „AZ ELŐFIZETÉSE" doboz oda is bekerül (subscription-sor híján a doboz azt
mondja, amit tudunk, nem talál ki dátumot).

## Őr

`checkout-viewport-check.mts` **49 → 54 állítás**. Az új négy: a bukás-oldal kimondja,
hogy nem történt terhelés · van kattintható újrapróba-gomb · van idézhető azonosító ·
**és a gomb felirata MÉRTEN olvasható (kontraszt ≥ 4.5)**; plusz a `!activated` ág doboza.
Mindkét új ág piros-kontrollal igazolva (a javítás visszavételekor 1.16-ot mér és bukik;
a doboz kivételekor bukik).

## Amit NEM javítottam, és miért

- A „Ez a fizetés rendezve van" lapról nincs kiút-link. Ez a **mock fizetőoldal** (`payMockPage`)
  — élesben a Barion saját lapja áll a helyén, tehát vevőhöz nem jut ki.
- A 13. lépés duplikált képe forgatókönyv-kérdés, nem termék-hiba.
- A dev DB fordulónapja **2035-re csúszott** az FK-006 időutazótól (a Dokumentumok fülön
  „Következő fordulónap: 2035. 10. 10."). A KÖZÖS park torzítása, nem kód-hiba.

**Módosított fájlok:** `public/assets/ui/citui-console.css` · `src/console/views.ts` ·
`scripts/checkout-viewport-check.mts`.

---

## Utóirat (ugyanaznap): a közös park órája visszaállítva

**Tulaj-kérés:** „állítsd vissza a park fordulónapját".

**Mérve:** az ELEK-TESZT előfizetés `anchor_date`-je 2026-09-10 volt, a ciklusa viszont
**2035-09-10 → 2036-09-10** — kilenc évnyi halmozott megújulás, három nap alatt, több
sessionből (a legutolsó ugyanaznap 10:34-kor). A Dencs-tenant órája ÉP volt (2026-09-08 →
2027-09-08), azt nem érintettük.

⛔ **A visszaállítás NEM dátum-írás.** Az `elek-timetravel-fk006.mts` nem mezőt állít: a
VALÓDI `runBillingCycle()`-t futtatja hamis „most"-tal, tehát minden kör egy igazi éves
megújulást játszik le — renewal order + fizetések + számla + dunning-események. Ha csak a
`current_period_end`-et írnám vissza 2027-re, a `mintRenewalOrder()` a
`(tenant, renewal_period_start)` identitáson megtalálná a MÁR LÉTEZŐ, kifizetett 2027-es
rendelést, és a rendszer rendezettnek hinné az évet. A fél-visszaállítás rosszabb, mint a
csúszás.

**Eszköz:** `scripts/reset-elek-billing-clock.mts` — a ciklust az **anchorból** számolja
újra (a szabály újrafuttatása), és eltávolítja azokat a megújulásokat, amik csak az
időutazás miatt léteznek. Kapui: CSAK ELEK + CSAK `kind='renewal'`; teljes JSON-mentés
sha256-tal minden írás ELŐTT; `accounting_document` (FK **SET NULL**, nem CASCADE) esetén
megtagadja a futást, hogy ne hagyjon árva könyvelési sort; egy tranzakció; dry-run
alapból, `--go` hajtja végre; a végén **visszaolvasással** ellenőriz, nem a saját írását
hiszi el.

**Eredmény:** 9 rendelés / 42 fizetés / 9 számla / 54 dunning-esemény eltávolítva,
subscription **2026-09-10 → 2027-09-10 (active)**. Érintetlen: a `multilang` rendelések (8),
a Dencs-tenant, és az élő oldal (`live`).
Mentés: `_planning/backups/elek-billing-clock-2026-09-12T11-22-34.json` (sha256 RENDBEN).
Független igazolás a felületen: a visszaigazolás most `{"date":"2027-09-10","amount":99900}`-t
mond a korábbi 2035 helyett.

⚠️ **Ez nem tartós állapot:** a következő FK-006 kör újra elmozdítja. A script bármikor
újrafuttatható.

## Utóirat 2: az óra-visszaállítás igazolása a FELÜLETEN — és egy elrejtett előfeltétel

A tulaj kérte, hogy lássa a dátumot. Az újrafuttatott FK-005a **elsőre PIROS lett**
(4 zöld / 2 piros / 1 blokkolt) — és **nem a kód miatt**:

```
[payment] requestPayment … HALASZTVA: a mock artifact nem 'approved'
          (jelenlegi: generated) — pay-link nem adható ki jóváhagyásig
```

A fulfilment-kapu HELYESEN működött. A mock jóváhagyása az **FK-003b** körhöz tartozik,
ami szűkített futásnál nem fut, és a közös parkban egy másik szál időközben visszaállította
az artifactot `generated`-re. A panel közben tisztességesen viselkedett: a `showThanks()`
ágra váltott („Rögzítettük a választását… a fizetési linket e-mailben elküldjük"), nem tett
úgy, mintha fizetés történt volna.

Jóváhagyás a **valós kurátor-úton** (`curateArtifact(..., "approve", indoklás)`) — döntés-
naplóval és a korábbi mock fölérendelésével —, nem nyers SQL-lel, hogy a rendszer saját
szabályai fussanak. Utána: **6 gépi zöld / 0 piros**, és a visszaigazolás a képen
**„Következő terhelés — 2027. 09. 10. — 99 900 Ft / év"**.

⚠️ **NYITOTT (szerkezeti, nem most javítandó):** a szűkített Elek-futásnak vannak
KI NEM MONDOTT előfeltételei (itt: „az ELEK mock legyen `approved`"). Amikor hiányzik, a
runner nem az előfeltételt nevezi meg, hanem egy késleltetett tünetet jelent
(„nem jelent meg időben: Mock fizetőoldal") — az OK csak a szerver stdout-jában van, amit a
`run-all` elnyel (`spawnSync` + `encoding`). Egy előfeltétel-ellenőrzés a `run-all`-ban
(„FK-005a-hoz approved mock kell") percekkel rövidítené a diagnózist.
