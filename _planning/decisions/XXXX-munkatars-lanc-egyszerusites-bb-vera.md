## ADR-XXXX — Munkatárs-lánc egyszerűsítése: -bb szabályai Verához, dupla ellenőrzések le

**Dátum:** 2026-11-04 · **Státusz:** elfogadva (tulaj: „ok nézzük meg a javaslataidat. add át a koordinátor sessionnek aki végig viszi a javaslataidat!”) · Kiegészíti: ADR-0329 (Vera a kurátori és a kézi szöveg kapuja), ADR-0405 (automata megkeresés-kiküldő)

### Kontextus

A heti előfizetési Claude-keret nagyjából 70%-át a pipeline-munkatársak viszik el. A pipemeter mérése (10-28 → 11-03) szerepenként:

| munkatárs | a heti keret %-a |
|---|---|
| Magellan | 9,1% |
| Neo | 13,2% |
| Poe | 16,0% |
| Vera | 14,8% |
| -bb | 13,2% |

Ez heti ~220 kiküldés mellett **~$7 API-egyenérték kiküldésenként**. A mock maga olcsó: 30 nap alatt 50 AI-mock készült $25-ért, a kurátori úton a generátor nem hív AI-t.

Napi ezres léptéknél a keret nem lesz elég. A lánc ugyanazt többször ellenőrzi:
- **Honlap-ítélet:** Magellan és Neo is ítél.
- **Mock-állítások:** Neo 6. lépése és Vera is átolvassa a kész mockot.
- **Kontakt- és háló-ítélet:** Neo dönt, utána a -bb újraellenőrzi.
- **Képátnézés:** Neo, Poe és a -bb is nézi a képeket, de egyikük sem felel érte egyedül.

A forrás: a repó `MEMORY.md` „Tények és döntések” szakaszának 2026-11-03/04-i sorai (CIT `citf1f3528f`, keret-elemzés).

### Döntés

1. **A -bb négy szabálya Vera ellenőrzőlistájába kerül** (`vera/charter/CHARTER.md` §3b, `RUNBOOK.md` §4b):
   - **Kontakt:** magyar mobil vagy saját e-mail kell, közvetítő kontaktja nem számít.
   - **Iker:** egy gazda, egy megkeresés (`~/rc-briefs/bb-tools/tw.sh`, csak olvas).
   - **Sorrend:** no_site → outdated 8:2 arányban, modern soha.
   - **Képátnézés:** a gazdája Vera.

   A lánc vége így Vera. A Vera-charter „PRÓBAIDŐ, nem kapu” fejléce az ADR-0329 szerinti „KAPU”-ra javítva.
2. **A dupla ellenőrzések kimaradnak:**
   - Neo elfogadja Magellan honlap-ítéletét, és csak a „bizonytalan”-nál keres rá. Magellan ezért kétség esetén „bizonytalan”-t ír, nem „nincs”-et.
   - Neo 6. lépése (a kész mock állításainak átolvasása) megszűnik.
   - A -bb nem ellenőrzi újra Neo kontakt- és háló-ítéletét.
3. **A képátnézés gazdája Vera:**
   - A kész mockon a ténylegesen kiválasztott képeket nézi: személy, rendszám, vízjel, hálókép, ≥6 saját kép.
   - Poe a szöveghez nézi a képeket. Ha feltűnik neki valami, jelez, de nem ő felel érte.

**Átfedéses hét (2026-11-04 – 11-11):**
- A -bb változatlanul fut, és minden MEHET/TARTVA döntését egy sorban naplózza a `~/rc-briefs/atfedes/bb-ÉÉÉÉHHNN.txt`-be.
- Vera ugyanígy naplóz a `~/rc-briefs/atfedes/vera-ÉÉÉÉHHNN.txt`-be.
- A koordinátor naponta összeveti a kettőt. Amit a -bb kiszűrt, Vera pedig nem, az új pontként Vera listájára kerül, és a próba egy héttel hosszabbodik.
- A MEHET-sort (`~/rc-briefs/kikuldesi-sor-ÉÉÉÉHHNN.txt`) a hét után Vera írja.

**A -bb végleges leállítása KÜLÖN tulaj-döntés** a mérés után. A koordinátor egy sort ír a tulajnak: a mért eltérést és a javaslatát.

**Mérés:**
- **Keret:** a pipemeter előtte–utána, szerepenként. A cél ~15–20% heti keret felszabadítása; ez becslés, nem mérés.
- **Minőség:** a -bb és Vera eltérés-listája, valamint a kiküldés utáni panaszok és képlevételek.

### Visszafordíthatóság

Teljes. A -bb az átfedés alatt fut, a régi lépések a charterekben áthúzva/megjelölve maradnak. Ha Vera nem fog el mindent, a hiányzó pont az ő listájára kerül, vagy a régi lépés visszaáll.

### Elvetett alternatívák (tulaj-döntések, nem javasolhatók újra)

- **API-tokenes megoldás** (Batch, olcsó API-modell, más gyártó API-ja): nem opció.
- **A munkatárs-munka visszavitele kódba:** a kódos megoldás minősége katasztrofális volt.
- **Kisebb modell a munkatársaknak** (Haiku/Sonnet): a próba rossz minőséget adott, ezért Opus marad.
- **Helyi vagy bérelt GPU:** nem irány.
- **A -bb azonnali leállítása mérés nélkül:** a tulaj csak a bevezetést és az átfedést hagyta jóvá.
