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
