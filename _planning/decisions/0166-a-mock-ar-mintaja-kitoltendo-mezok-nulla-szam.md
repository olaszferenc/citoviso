## ADR-0166 — A mock ár-mintája KITÖLTENDŐ MEZŐK: nulla szám, és a felirat csak a láthatóról beszél

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA (tulajdonosi választás: „**B — kitöltendő
mezők**"; az A — kitöltött szezon-dátumok üres összeggel — és a C — nincs tábla, helyette
ígéret-kártya — elvetve) · **Kapcsolódó:** ADR-0061 (mock ALL-IN, natív minta-szekciók),
ADR-0015, ADR-0159 (a lap keretezése; ez volt annak nyitott ② pontja), 03-INVARIANTS §B.17
· **Kontraktus:** `assets/design-refs/prospect-page/pricing-sample/` (README + önhordó
`plan-B.html` + mobil/asztali kép) · **Kiváltó:** Elek FK-004b.

**A LELET.** A minta-ártábla sora `<td>Főszezon</td><td></td><td>—</td>` volt: **üres**
„Mikor" cella és egy gondolatjel. A képaláírás közben „ezek **nem valós árak**"-ról
beszélt, miközben a képernyőn **egyetlen ár sem volt**. A lead tehát egy késznek látszó,
de tartalmatlan táblázatot kapott, és egy mentegetőzést valamiért, ami ott sincs.
Egyik fél sem azt mondta, ami van.

**A DÖNTÉS, ÉS AMI KÖT:**

① **Minden kitöltendő cella kitöltendőNEK LÁTSZIK** — szaggatott helyőrző a „Mikor"
oszlopban, **„Ön írja be"** az összegében. Üres cella nem maradhat.

② **NULLA SZÁMJEGY a tábla celláiban.** Nem „nincs Ft-jel": nincs szám. Ez a §B.17
legerősebb alakja — nincs mit félreolvasni, és **nem kell mentegetőző mondat** sem.

③ **A képaláírás csak arról beszélhet, ami a képen van.** Ha nincs ár a táblán, a felirat
sem állíthatja, hogy „ezek nem valós árak".

④ **390 px-en minden cella megnevezi az oszlopát.** A fejléc-sor telefonon rejtett
(`thead{position:absolute;clip}`), tehát a szaggatott vonal és az „Ön írja be" magában
semmit nem jelentene — mérve: *„Főszezon / ▭▭▭▭ / Ön írja be"*. A cellák `data-cit-col`-lal
viszik az oszlopnevüket. ⚠️ Ez eddig **rejtve maradt**, mert az egyik cella ÜRES volt (a
`td:empty` elrejtette), a másik meg önleíró pénzösszeg; a modul CSS-ének kommentje viszont
már akkor is „each labelled"-et ígért. **Az ígéretnek őr kell.**

⑤ **Az oszlopnév EGY forrásból** megy a fejléc-sorba és a cella-címkébe.

**AZ ŐR.** `scripts/pricing-sample-check.mts` — renderelt lapon, két elrendezés-családon
× 390/1280, négy piros önteszttel. ⚠️ Két hibás KÉRDÉS derült ki benne, mindkettő mérve:
a `checkVisibility()` **IGAZAT** mond a képernyőolvasós (`position:absolute; clip`)
fejléc-rejtésre — a **MÉRETET** kell nézni —, és a **THEAD** dobozát, nem a benne lévő
TH-ét, mert a levágás a **szülőn** van.

**⚠️ KIMONDOTT ELTÉRÉS A VÁZLATTÓL.** A jóváhagyott vázlat képaláírása „egyetlen szám sem a
sajátja" volt — ez azt sugallja, hogy **számok vannak** a lapon, csak nem az övéi. A tábla
viszont egyet sem tartalmaz, ezért a szállított szöveg: „**szándékosan nincs egyetlen ár
sem**"; és „szezonok" helyett „**időszakok**", mert a tábla fejléce IDŐSZAK. A README ezt
külön kimondja, és egy szóra visszaírható a vázlat szövegére.

**Visszafordíthatóság:** 🔄 — felület-szintű, nulla migráció, nulla adat-mozdulat.
🚪 Kifelé tett vállalás: a leendő vevőnek mutatott minta-ártábla tartalma.
**Élesítés NINCS** (§0.3) — külön, kimondott tulajdonosi utasítás kell hozzá.
