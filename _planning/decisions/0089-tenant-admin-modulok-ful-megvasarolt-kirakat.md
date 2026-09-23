## ADR-0089 — Tenant-admin „Modulok" fül: megvásárolt/kirakat szétválasztás + fizetés előtti oldal-előnézet

**Dátum:** 2026-08-31 · **Státusz:** ELFOGADVA és IMPLEMENTÁLVA lokálban ·
**Kapcsolódó:** ADR-0015 (modult csak LÁTHATÓAN adunk el), ADR-0034 (tenant modul-kezelés),
ADR-0044 (modul-beállítás → renderelt oldal), ADR-0061 (mock all-in, jelölt minta-szekciók),
ADR-0080 (B-opciós le/feliratkozás), ADR-0045 §J (tudásbázis-kapu), §B.17 (tényhűség),
§I (bait-and-switch tilalom), CLAUDE.md §2b (terv-jóváhagyási kapu).

**Kiváltó (tulaj-felvetés):** a fül EGY listába gyúrta a megvásárolt és a meg nem vásárolt
modulokat, és egy kapcsoló + egy ár-chip nem mondja meg a tulajnak, MIT kapna. „A cél az, hogy
lássa, ha mégis meg akar venni valamit, az hogy fog kinézni." A tulaj a 3 bemutatott terv közül
az A változatot fogadta el, kiegészítve teljes képernyős előnézettel és Mobil/Asztali váltóval.
Terv-kontraktus: `assets/design-refs/console/modules-tab/` (README + kattintható HTML).

**A döntések:**
1. **Két külön szerkezeti blokk.** ① „Az én moduljaim" = MUNKA-felület (állapot egy mondatban,
   Beállítás, Kikapcsolom). ② „Bővítés — amit még hozzáadhat" = KIRAKAT: termék-kártya a
   katalógus `publicLabel`/`publicDesc` szövegével. Egy modul sosem szerepel mindkettőben.
2. **A kirakat-kártya a szekció VALÓDI mini-renderjét viseli**, nem ikont és nem illusztrációt —
   ez adja el a modult a kattintás előtt (ADR-0015). Technikailag: EGY all-in előnézet-render
   (`?on=*`), amelyből minden kártya a HASH-en (`#only=<id>`) vág ki egy szekciót, így a
   böngésző ugyanazt a dokumentumot cache-eli — nem 12 külön render.
3. **Teljes oldalas előnézet a kosár állapotával**, a megnyitott modul szakasza kiemelve.
   Fejlécében: „Előnézet — még nincs élesítve", **Mobil/Asztali** nézetváltó (asztali nézetben a
   VALÓDI desktop elrendezés, telefonon arányosan kicsinyítve — nem a mobil szélesre húzva),
   **Teljes képernyő** (Fullscreen API); láblécében ár + Hozzáadom/Visszaveszem + Bezárom.
   A fókuszált modult a rendszer MINDIG hozzáadja az előnézett halmazhoz — enélkül a „mutasd,
   hogy nézne ki" a modul nélküli, már meglévő oldalt mutatná (mérve: ez volt az első hiba).
4. **⛔ Az előnézet SEMMIT nem ír.** Se entitlement, se snapshot-fájl, se DB-sor: a
   `renderTenantModulePreview()` egy kérdésre válaszol, a számlázás igazsága a
   `module_entitlement` marad. (A „additív írás nem kapu" incidens pontosan egy fizetés előtti
   ALL-IN előnézetből indult, ami túlélte a fizetett aktiválást.) Regressziós őr:
   `scripts/module-preview-check.mts` bit-azonosságot mér az előnézet előtt/után.
5. **Minden nem megvásárolt szakasz „MINTA — az Ön adataival töltjük fel" címkét visel.** Címke
   nélkül az előnézet azt állítaná, hogy a tartalom már a tulajé (§B.17), és a fizetés utáni
   valóság ettől eltérne (§I). Az adat nélküli modulok az ADR-0061 JELÖLT minta-szekcióiként
   renderelnek — üresen renderelő szakasz a kérdésre semmivel válaszolna.
6. **Felület nélküli modul nem kap előnézetet.** Aminek nincs `data-cit-module` horgonya (pl.
   egyedi e-mail cím = postafiók, nem szekció), annál nincs bélyegkép és nincs „Megnézem" gomb;
   a csak-tulaj-szövegből épülő modul (usp) a kivágatban őszinte mondatot kap, nem a lap tetejét.
7. **Motor-oldali kapu:** `renderSite(..., { sampleAllow })` — a minta-halmaz mostantól
   ÁTADHATÓ; megadva a fázis már nem kapuz. Alapértelmezés változatlan: minta CSAK mockon,
   élesre soha (a `native-content-check` „élesre semmi minta nem szivárog" állítása áll).
   `moduleContentFor(..., overrideActive)` a `renderableModules()`-ből vezeti le a helyettesítést,
   így egy előnézett `booking` pontosan úgy váltja ki az `enquiry`-t, mint kifizetve.

8. **A galéria-kapcsoló LÁTHATÓAN változtat** (tulajdonosi döntés, 2026-08-31 — három
   felkínált jelentés közül): a modul kikapcsolása a **fotógaléria-SZEKCIÓT** veszi le, a
   **fejléc-kép marad**. Eddig csak a fotó-plafont oldotta fel, vagyis a kapcsoló semmit nem
   mozdított — ez ugyanaz az „ál-választás", amit az ADR-0059 már egyszer kimondott
   (fizetsz valamiért, ami nem látszik). ⛔ Kép nélküli oldal továbbra sem születhet (§A):
   ahol a galéria MAGA a fejléc-képanyag (kollázs-hero, kompozíciós út), ott a lap egyetlen
   fotóval renderelődik újra, nem üresen. A vágás EGY ponton történik a renderelt kimeneten
   (`stripGallerySections`), nem 18 sablonban — és a szekcióval együtt megy a rá mutató
   **menü-link is**, mert egy nem létező szakaszra ugró gomb halott gomb (ADR-0062 szabálya).
   Mérve mind a 16 sablonon és minden archetípuson: horgony eltűnik, kép marad, nincs üres
   sáv, nincs halott link — és a `stripGallerySections` kiütésével az őr pirosra megy.
