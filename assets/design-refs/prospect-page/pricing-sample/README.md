# Kontraktus — a mock ÁR-MINTA táblája (jóváhagyva 2026-09-14)

Tulaj-döntés: a **B** változat — *kitöltendő mezők*. Az A (kitöltött szezon-dátumok, üres
összeg) és a C (nincs tábla, helyette ígéret-kártya) elvetve.

Kattintható terv: **`plan-B.html`** (önhordó, méret-váltóval). A teljes lap-kontextus a
befagyasztott `../framing/plan.html` „B · kitöltendő" állapota (a lap tetején lévő
„Ár-tábla: A · B · C" kapcsolóval). Képek:
`plan-B-mobil.jpg` · `plan-B-asztali.jpg`.

**Miért kellett:** a minta-tábla sora `<td>Főszezon</td><td></td><td>—</td>` volt — **üres**
„Mikor" cella és egy gondolatjel —, a képaláírás pedig „ezek **nem valós árak**"-ról beszélt,
miközben a képernyőn **egyetlen ár sem volt**. A lead egy késznek látszó, de üres táblázatot
kapott, és egy mentegetőzést valamiért, ami ott sincs (Elek FK-004b).

---

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Minden kitöltendő cella kitöltendőNEK LÁTSZIK.** A „Mikor" oszlopban szaggatott
   helyőrző, az összeg oszlopában **„Ön írja be"**. ⛔ Üres cella nem maradhat: az üres
   cellát a látogató kész, de tartalmatlan táblázatnak olvassa.

2. **NULLA SZÁM A TÁBLÁZATBAN.** Nem „nincs Ft-jel", hanem **nincs számjegy** egyetlen
   cellában sem. Ez a §B.17 legerősebb alakja: nincs mit félreolvasni, és nincs szükség
   mentegetőző mondatra sem.

3. **A képaláírás CSAK arról beszél, ami a képen van.** Ha nincs ár a táblán, a felirat sem
   állíthatja, hogy „ezek nem valós árak".

4. **390 px-en minden cella meg van nevezve.** A fejléc-sor telefonon el van rejtve
   (`thead{position:absolute;clip}`), ezért a szaggatott vonal és az „Ön írja be" magában
   semmit nem jelentene. Mérve: *„Főszezon / ▭▭▭▭ / Ön írja be"* — nem derült ki, melyik a
   dátum és melyik az ár. A cellák `data-cit-col`-lal viszik az oszlopnevüket, és a
   telefonos elrendezés kiírja őket. *(A modul CSS-ének kommentje eddig is „each labelled"-et
   ígért — az ígéret most igaz is.)*

5. **A szoba-váltó marad.** Több egységnél a minta is egységenként mutatja a táblát — ez
   maga az eladott funkció (ADR-0015/0061).

6. **Az oszlopnév EGY forrásból származik**: ugyanaz a string megy a fejléc-sorba és a
   cella `data-cit-col` címkéjébe. Két kézzel írt példány így nem tud elcsúszni egymástól.

---

## ⚠️ ELTÉRÉS A JÓVÁHAGYOTT VÁZLAT SZÖVEGÉTŐL — kimondva

A vázlat képaláírása így szólt:

> „Minta — a szezonokat és az árakat Ön tölti ki; ezen az előnézeten **egyetlen szám sem a
> sajátja**."

A szállított szöveg:

> „Minta — az **időszakokat** és az árakat Ön tölti ki; ezen az előnézeten **szándékosan
> nincs egyetlen ár sem**."

Két okból: ① a tábla első oszlopának fejléce **„IDŐSZAK"**, tehát a felirat a képernyőn
látható szót használja; ② a vázlat mondata azt sugallja, hogy **számok vannak** a lapon, csak
nem az övéi — a tábla viszont **egyetlen számot sem** tartalmaz. **Ha a vázlat szövegét
kéred vissza, egy szó és átírom.**

---

## Az ŐR

`scripts/pricing-sample-check.mts` — a **renderelt** lapon, két elrendezés-családon
(`fullbleed`, `editorial`) × **390 és 1280 px**: nulla számjegy a cellákban · nincs néma üres
cella · helyőrző és „Ön írja be" soronként · látható „Minta" felirat · a felirat nem
mentegetőzik nem létező árakért · telefonon rejtett fejléc **és** megnevezett cellák.
**Négy piros önteszt:** a régi váz visszaírva · kitalált ár egy cellába · a régi
mentegetőző felirat · a telefonos cella-címkék leszedve.
