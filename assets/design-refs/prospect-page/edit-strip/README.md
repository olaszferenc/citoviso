# Szerkeszthetőség-sáv a kiküldött mockon (JÓVÁHAGYOTT TERV, 2026-10-06)

A tulaj felvetése (2026-10-06 este): a lead számára nem egyértelmű, hogy megrendelés után
mindent módosíthat — pl. ha a terven nem az ő szobabeosztása, férőhelyei vannak. Villogó
fejlécet javasolt; a terv-körben a görgetés után egyszer becsúszó, bezárható sáv lett a döntés.
Döntés: ADR-XXXX. Kattintható terv: `plan.html` (méret- és indítás-váltó, bezárás, újra).

**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css`

A `/p/<token>` lapra kiszolgáláskor kerül — a mockfájlhoz nem nyúlunk, így a már legyártott és
kiküldött mockok is megkapják.

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Felirat:** **„Ez egy terv mintaadatokkal.”** + félkövéren **„Megrendelés után mindent Ön szerkeszt:”**
   + „képeket, szobákat, szövegeket, árakat.” — `tr()`-rel. Elől ceruza-ikon (SVG, cián pötty), a
   végén × (aria: „Bezárás”, ≥ 44 px).
2. **Nem látszik betöltéskor.** Akkor csúszik be felülre, amikor a látogató **a szobák szakaszáig
   görget (a szakasz a képernyő közepére ér), vagy legkésőbb egy teljes képernyőnyi görgetés után** —
   amelyik előbb jön. Ha a lapon nincs szoba-szakasz, csak a képernyő-szabály él.
3. **Nem villog, nem pulzál, nem tolja le a lapot:** a lap fölé úszik (rögzített, felső), egyszer
   csúszik be (`prefers-reduced-motion` alatt animáció nélkül).
4. **× után nem jön vissza** — leadenként (artefaktumonként) megjegyezve; tárhely nélkül (privát mód)
   is működik, ott csak az aktuális megnyitásra.
5. **Csak a vásárlás előtti mockon.** A már vásárolt lead lapján (owned-ág) és élő tenant-oldalon nincs.
6. **Skin-független szín:** a mock nem tölti be a `citui.css`-t → sötétkék háttér (`#10243a`, a
   `--citui-ink` tükre), világos felirat, cián pötty — rögzített értékkel, mint a rendelő gomb.
7. **Rétegek:** a felső keret-sáv (`framing`, a folyamban) addigra kigörgetett; a sáv nem fedi a
   rendelő gombot és a Foglalás-/süti-sávot (azok alul), és a rendelő-panel / döntés-kártya fölé
   nem mászik.
8. **A szobák mellé NEM kerül külön jegyzet, a levél-szöveg NEM változik** (tulaj, 2026-10-06:
   „nem kell litániát írni arról, amit úgyis tud”) — a sablon meglévő „Minta —” sora marad.

## Képek

`plan-mobil.png` (390 px, 4 sor) · `plan-asztali.png` (2 sor) — a sáv a szobák szakaszánál.
