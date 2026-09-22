# KONTRAKTUS — „árajánlatkérés" az árazatlan egységnél / időszaknál

**Jóváhagyva:** 2026-09-22, tulajdonosi döntés. Három változatot kapott (A: magyarázó doboz +
átnevezett gomb · B: csak a gomb beszél · C: mint az A, plusz jelölés az egység-választóban),
a válasza a **C** volt.

- Terv: `plan.html` (önhordó, kattintható; Mobil/Asztali váltó + „Árazott/Árazatlan egység" kapcsoló)
- A jóváhagyott kép: `plan-mobile.png`, `plan-desktop.png`
- A MAI állapot, amihez mérünk: `before-desktop.png`

**Hatókör:** `assets/runtime/cit-runtime.js` · `assets/runtime/cit-modules.css` · `src/tenant/editor.ts` · `src/engine/recipe.ts`

⚠️ A hatókör a ténylegesen érintett fájlokra szűkítve: az első változatom olyat is felsorolt,
amihez hozzá sem nyúltam. Egy őr hatóköre AZ ő doktrínája — a mindenhol keresés ugyanaz,
mint a sehol sem keresés.

---

## A mért tényállás, ami kiváltotta

Valódi böngészőben, eldobható fixtúrán (2 egység, egyikre 28 000 Ft, másikra semmi), mindkét
méreten: ha a kiválasztott egységre — vagy a tartózkodás **bármelyik éjszakájára** — nincs ár,
a teljes ár-doboz **némán eltűnik**. Asztalon üres lyuk marad a dátum-sáv alatt, mobilon
összecsukódik. A naptár, az űrlap és a gomb változatlanul működik, tehát a vendég

> kiválaszt dátumot, megadja a nevét, és megnyomja a **Foglalási kérés elküldése** gombot,
> anélkül hogy valaha árat látott volna.

⭐ Jó hír, amit szintén mértünk: az előző egység összege **nem ragad be** átváltáskor. Nem rossz
szám megy ki, hanem **semmilyen** — a kár a néma hiány, nem a hamis adat.

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

1. **A kiváltó a MEGLÉVŐ predikátum, nem egy új heurisztika.** Ott, ahol ma
   `renderQuote` üresre állítja a dobozt (`if (!q) { el.innerHTML = ""; }`), ezentúl az
   árajánlat-mód lép életbe. ⛔ Nem „az egységnek nincs ára": a `quoteStayFrom` `null`-t ad, ha
   a tartózkodás **egyetlen** éjszakájára sincs sor — tehát a mód **dátum-szintű**, és egy
   részlegesen árazott időszakra is életbe lép.
2. **Az üresség helyére magyarázat kerül**, ami megmondja, MIÉRT nincs szám, és hogy az
   elküldés még nem kötelezettségvállalás.
3. **A gomb nem foglalást ígér**, hanem árajánlatot kér.
4. **A gomb alatti mondat is átíródik.** ⛔ Ez nem részlet: ha a gomb árajánlatot mond, az
   alatta álló ígéret viszont a foglalás véglegesedéséről és a helyszíni fizetésről beszél,
   a lap két dolgot állít egyszerre. A két szöveg EGYÜTT vált.
5. **Az egység-választó már a választás pillanatában jelzi** (a C változat lényege), hogy arra
   az egységre egyedi ár jár — nem utólag derül ki.
6. **Ár esetén SEMMI nem változik.** A mai bontás, az alap-mondat, a helyszíni tétel és az
   „Összesen" változatlan. A jelzés **eltűnik**, amint van ár — ha nem tűnik el, zajt gyárt.
7. ⛔ **Az árazatlan egység NEM kerül ki a választóból.** A tenant kifizette az Online foglalás
   modult; egy meg nem adott ár nem veheti el a funkcióját (ADR-0193 ①, a „kapu ne tagadja meg
   a fizető vevőt" osztály). Az árajánlat-út megtartja a bejövő érdeklődést, és közben igazat mond.

## Feliratok, amiket a terv rögzít

⚠️ A jelölés a megvalósítás UTOLSÓ lépése volt: kötő feliratnak megjelölni olyat, ami még nem
él a kódban, azt jelentené, hogy a kapu a saját feltevésemen bukik el.

- **„Erre az időszakra a szállásadó egyedi árat ad."** — a magyarázó doboz címe
- **„Küldje el a kérését, és a szállásadó árajánlattal válaszol."** — mi történik most
- **„Az elküldéssel még nem vállal fizetési kötelezettséget."** — a vendég kockázata
- **„Árajánlatot kérek"** — a gomb
- **„A szállásadó árajánlattal válaszol. A foglalás akkor válik véglegessé, ha Ön az ajánlatot elfogadja."** — a gomb alatti ígéret
- **„egyedi ár"** — a jelölés az egység-választóban

## Mérve a terven (nem szemre)

- árazatlan állapotban **egyetlen összeg sem marad** a képernyőn, mindkét méreten;
- visszaváltva az ár **visszajön** — a jelzés nem ragad be;
- **kontraszt**: a gomb **5,05**, a magyarázó doboz **11,76** (küszöb 4,5);
- 0 JS-hiba mindkét méreten.

## Ami NEM ennek a tervnek a tárgya

- A **tulaj** értesítése arról, hogy árajánlat-kérés érkezett árazatlan egységre (az ADR-0197 ①
  javításának másik fele) — külön szelet.
- Az **év-specifikus szezonár** és a szezon-záró utáni nudge — külön ADR.
- Az árazás **kikényszerítése** (három állapot, új egységnél kérdezés, emlékeztető).
