# Saját cím a konfigurátorban — jóváhagyott terv (2026-09-07, tulaj: „c2")

A `plan.html` a KONTRAKTUS (kattintható, önhordó; képek: `plan-desktop.png`,
`plan-mobile.png`). Horgony: **ADR-0109**. Amit KÖT — ezek elvárt VISELKEDÉSEK,
nem stílus-javaslatok:

1. **A küszöb alatt a saját cím NEM választható opció.** A rádiógombos sor
   (`Saját domainnév`) ilyenkor **nincs a listában** — nem letiltva, nem
   halványan: nincs ott. (§I: nem kínálunk megrendelhetőként olyat, amit annak a
   vevőnek nem adunk el.)

2. **Helyette LÁTHATÓ meghívó-kártya áll ugyanabban a slotban** — a tulaj kérése
   az volt, hogy „sokkal szembetűnőbb" legyen. ⛔ A hangsúly **kerettel, akcent-
   színnel, ikonnal és tartalommal** születik, NEM nagyobb betűvel
   (`size_inflation_is_not_design`). A kártya kötelező elemei:
   - fejléc: földgömb-ikon + „Saját domainnév is választható" + `1 000 Ft/hó` badge,
   - **valódi példanév** a lead nevéből képezve (`hauselisabeth.hu`), keretes chipben —
     ez teszi kézzelfoghatóvá, nem a méret,
   - feltétel-mondat: „**7 000 Ft/hó feletti csomag**, kedvezmények nélkül számítva —
     a jelenlegi csomag {X}/hó",
   - **haladás-sáv + számsor** (ez a C2 lényege): `4 890 Ft / 7 000 Ft — 2 110 Ft hiányzik`,
   - két gomb: `Bekapcsolom (+{összeg}/hó)` — ténylegesen bekapcsolja a hiányzó
     modulokat — és `Most nem`, ami elrejti a kártyát.

3. **A küszöb átlépésekor a kártya helyét a VALÓDI, választható opció-sor veszi át**
   (`1 000 Ft/hó · 12 hó hűségidő`), a névjavaslat-listával és a feltétel-blokkal.
   A váltás élő: a modul-kapcsolók minden változásánál újraszámol.

4. **Visszaesés a küszöb alá VISSZAVONJA a választást.** Nem marad bent „csendben"
   egy olyan tétel, amire a vevő már nem jogosult (`additive_write_is_not_a_gate`).

5. **A jogosultságot a LISTAÁR dönti el, a kedvezmény soha** (tulaj: „kedvezmények
   nélkül"). Mérve a kontraktus-fájlban: listaár 7 250 Ft → jár; a fizetendő a
   −25%-kal 6 437 Ft, ami a küszöb alatt van, és a jogosultság MEGMARAD. Egy
   időszakos kedvezmény nem vehet meg egy tartós jogosultságot.

6. **A domain havidíját kedvezmény nem érinti** (ADR-0100 ③ / ADR-0109 ⑥). Az
   összesítő ezt ki is mondja: `saját cím 1 000 Ft (<név>) — kedvezmény nélkül`.

7. **A feltétel-blokk a valódi ADR-0109 szabályokat mondja ki**, nem szépített
   változatot: havidíj a fenntartásért; 12 hó hűségidő alatt a csomag nem csökkenhet
   7 000 Ft/hó alá; korai felmondás = hátralévő hónapok × 7 000 Ft, **plusz** a
   domain vételára (20 000 Ft) **csak ha a nevet elviszi**; a 12 hónap letelte után
   nincs hűségidő és nincs csomag-minimum, a név díjmentesen az övé, a havidíj
   addig fut, amíg nálunk tartja.

8. **Mindkét méret kötelező.** Asztalin a modulok és a cím-választó két hasábban
   (container query, nem media query), telefonon egy hasábban, a kártya
   teljes szélességben. A `plan.html` méret-váltója a VIEWPORTBÓL indul.

## Ellenőrzés

A tervet Playwrighttal végig kell kattintani, nem elég ránézni — ebben a körben a
kattintás-teszt két olyan hibát fogott meg, amit a screenshot nem mutatott:
a `[hidden]` sort a `display:flex` felülírta (látszott, aminek nem kellett volna),
és a lakat-ikon a kiválasztott soron is bent maradt (SVG-n a `hidden` property nem
úgy viselkedik, mint HTML-elemen). Mindkettőre van állítás.
