# Az idézet-doboz megnevezi a szerzőjét — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-14, tulajdonosi választás: **A változat — „címke a doboz fölött"**
(színes bal szegély, nagybetűs szerző-felirat). ·
**Hatókör:** `src/server/bookingViews.ts` ·
**Kapcsolódó:** Elek FK-007 H1, 03-INVARIANTS §B.17 (a felület ne állítson valótlant),
ADR-0117 (foglalás). **Őr:** `scripts/quote-author-check.mts`.

`quote-author-A.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** Ami itt
viselkedés, azt a kódnak produkálnia kell; a kész felületet ehhez mérjük (ui-shot,
mobil 390 + desktop).

## Miért létezik

Mérve (2026-09-13, Elek FK-007 H1): a tulaj döntése után Kovács „van-e etetőszék?"
kérdése **eltűnt** a nézetből — a helyén előbb a tulaj **saját** üzenete, majd a
lemondási indok állt, **ugyanabban a jelöletlen idézet-dobozban** (ugyanez Anna német
üzenetével). A doboznak így **három különböző szerzője** lehetett, szerző-megjelölés
nélkül: a tulaj nem tudta, kinek a szavait olvassa.

⛔ Az adat végig megvolt: a `booking_request.message` oszlopot egyetlen döntési út sem
írja felül. A hiba **kizárólag a megjelenítésben** élt — ezért mér az őr a renderelt
kimeneten, nem a rekordon.

## Amit a terv KÖT

1. **Minden idézet-doboz megnevezi a szerzőjét.** A felirat **„Vendég"**, **„Ön"** vagy
   **„Rendszer"**. Jelöletlen doboz nem maradhat: az őr a dobozok és a szerző-címkék
   SZÁMÁT veti össze, tehát egy új doboz-fajta némán nem csúszhat be.
2. **A vendég eredeti kérdése a döntés után is látható.** Nem kinyitható, nem
   összecsukott — ott van a soron (ez volt a tulajdonosi választás a „B" ellenében).
3. **A szerző az ADATBÓL származik, nem a renderelő ágból.** A `decided_by` enum
   (`owner | guest | auto | system`) dönti el a címkét. ⛔ A lemondás indokát a **vendég
   is írhatja** — azt „Ön"-nek címkézni hazugság lenne; az őrnek van rá külön esete.
   Ismeretlen (`null`, legacy sor) esetén **nem nevezünk meg szerzőt**: a felirat
   **„Megjegyzés"**, mert a téves név rosszabb, mint a hiányzó (§B.17).
4. **A megkülönböztetés nem csak színen múlik.** A szegély-szín kézjegy, de a FELIRAT
   mondja ki — színvak olvasó is megtudja, kié a szöveg.
5. **Az EMBER szava idézőjelben áll, a RENDSZERÉ nem** — az a mi közlésünk, nem idézet.
6. **Két elrendezés, nem egy lekicsinyítve.** Asztalon (≥760px) a kérdés és a válasz
   **egymás mellett** áll, a záró rendszer-üzenet teljes szélességben zár; mobilon
   **egymás alatt**. Egyetlen doboz nem lóghat félszélességben, üres cellával mellette.

## Amit NEM köt

A **függőben lévő** kérés kártyáján a vendég üzenete címke nélkül marad: ott egyetlen
szerző lehet, és a kártya kontextusa kimondja. A címkézés az ELŐZMÉNY-soré, ahol a
szerzők keverednek.
