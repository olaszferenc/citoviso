# KONTRAKTUS — „Hol látják a vendégek az árait?” (Árak képernyő, 2. változat)

**Jóváhagyta:** a tulaj, 2026-09-28 („④ 2”; előtte: „ott lássa a tenant ahol nincs ár. azaz ne
csak felül”) · **Terv:** `plan.html` (a MAI Árak képernyő + a javaslat; a jóváhagyott a „2” gomb) ·
**Képek:** `terv-mobil-doboz.png`, `terv-mobil-kartya.png`, `terv-asztali-doboz.png`,
`terv-asztali-kartya.png` · **Hatókör:** `src/server/moduleConfigViews.ts` · `src/tenant/priceSiteView.ts` ·
`src/engine/moduleSections.ts` · **Őr:** `scripts/price-where-check.mts`.

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.**

## Kiváltó ok
Ha minden szobának csak alapára van, a honlapon nincs ártáblázat — szándékosan (ADR-0059 §2: a
szobakártyák már mutatják ugyanazt). A tulaj 490 Ft/hó-t fizet az Árak modulért, és a honlapján
semmi nem jelezte, mit kapott. A tulaj döntése: **a SZABÁLY MARAD, a TÁJÉKOZTATÁS hiányzott.**

## KÖT
1. **Felül egy doboz** a jegyzet alatt: **„Hol látják a vendégek az árait?”**. Minden mondatát a
   lap SAJÁT válasza dönti el (`siteShowsPriceTable` a végső lap-adaton) — soha nem egy második
   szabály-példány:
   - nincs tábla, vannak ár-sorok: **„Most a szobakártyákon — ezekkel az árakkal:”** + a kártyák
     ár-sorai szó szerint, ahogy a vendég olvassa; **„Külön ártáblázat ezért nem jelenik meg —
     ugyanezeket a számokat mutatná még egyszer, egy képernyővel lejjebb.”**; és mi hozza elő:
     időszaki ár VAGY a „Megjegyzés az árakhoz” mező;
   - van tábla: **„A honlapján az árai két helyen látszanak: a szobakártyákon, és egy külön ártáblázatban is”** + az ok (időszaki ár / megjegyzés);
   - semmi ár: **„Még egyetlen ára sem látszik a honlapján — adja meg lent az alapárakat.”**
2. **Az ár nélküli szoba felül is:** egy sárga, **„Ár nélkül:”** kezdetű sor megnevezi, a név
   koppintásra a szoba kártyájára ugrik.
3. **És HELYBEN is** (a tulaj „ne csak felül”-je): a szoba kártyáján a meglévő sárga **„Nincs ára.”**
   sor kiegészül: **„A honlapon a szobakártyáján nem lesz ár, és az ártáblázatban sem szerepel.”** —
   CSAK ha mindkettő igaz a lapon (a kártyán nincs ár-sor ÉS a táblában sincs).
4. **Ahol van ár, ott a szobánál nincs új sor** (nem kért zaj).

## Nyitott, más szál viszi
Ha a tulaj csak részegységeket ad ki, az „A szállás egésze” eltűnik a vendég elől (tulaj,
2026-09-28, (a)) — a Foglalás-szál vezeti be (`isGuestVisibleUnit`, `src/tenant/units.ts`). Utána
a „Nincs ára” sor, az Áttekintés teendője és a heti emlékeztető erre a predikátumra épül; a doboz
„Ár nélkül:” sora a lap adataiból jön, így magától követi.
