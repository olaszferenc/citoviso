# Süti-hozzájárulás sáv — BEFAGYASZTOTT TERV (A változat)

*Jóváhagyva: 2026-09-11, tulajdonosi választás két kattintható változat és mobil+desktop
kép után. Ez a megvalósítás KONTRAKTUSA, nem stílus-javaslat.*

**Hatókör:** `public/assets/runtime/cit-consent.js` · `public/assets/home/home.css`
(`#cit-consent` szabályok) · `src/server/public.ts` (a sáv beillesztése)

---

## Miért létezik ez a felület

Az oldalunk 2026-09-11-ig **mérten 0 sütit** tett le, és pont ezért **nem volt süti-sávunk**
(ADR-0110: a kérdés akkor átfordult — hazugság lett volna tájékoztatni valamiről, ami nem
történik). A Barion Pixel viszont KÖVETŐ szkript, a kártyás elfogadóhely jóváhagyásának
feltétele. Vele a „0 süti" állapot megszűnik, tehát a sáv innentől kötelezettség.

## Amit a terv KÖT

1. **Alsó, teljes szélességű sáv**, sötét navy háttéren, a lap aljára rögzítve. Nem
   sarok-kártya, nem modális ablak.
2. **Két gomb, ebben a sorrendben:** **„Csak a szükségeseket"** (másodlagos, keretes) és
   **„Elfogadom"** (elsődleges, cián). Az elutasítás NEM lehet nehezebben elérhető vagy
   kevésbé látható, mint az elfogadás.
3. **Mobilon (≤560px konténer-szélesség) a gombok egymás alá kerülnek, teljes szélességben** —
   `@container` query, nem `@media` (a sáv szűkebb dobozban is helyesen kell rendeződjön).
4. A szövegben szerepel, hogy **a Barion csalásmegelőző sütikről van szó**, és hogy
   **enélkül is működik az oldal**, valamint egy link az **Adatkezelési tájékoztatóra**.

## Amit a VISELKEDÉS köt (ez nem kinézeti kérdés — nem alkudható)

- ⛔ **A Pixel KIZÁRÓLAG az „Elfogadom" után tölthet be.** Hozzájárulás előtt egyetlen
  külső szkript sem indulhat — különben a sáv díszlet, nem védelem.
- ⛔ **Az elutasítás nem írhat le sütit.** A döntést `localStorage`-ban tartjuk.
- ⛔ **Azonosító nélkül (`BARION_PIXEL_ID` üres) a sáv MEG SEM JELENIK.** Nem kérünk
  hozzájárulást olyan követésre, ami meg sem történik (§B.17).
- ⛔ **Csak a saját oldalunkon (citoviso.com).** A generált tenant-oldalakra NEM kerül: ott
  a vendég nem nálunk fizet, semmi nem indokolná a szállás látogatóinak követését.
- A döntés után a sáv eltűnik, és többé nem kérdezünk.

## Őr

`scripts/consent-check.mts` — a fenti négy tiltást méri, negatívan is.
