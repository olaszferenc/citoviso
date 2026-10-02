# 2026-10-02 — „Séta a kapun át” (`walk-through`): a tulaj által választott mockból generálható sablon

**Szál:** SUB a CIT koordinátor alatt; brief `~/rc-briefs/seta-sablon.md`. Döntés: ADR-XXXX.
Kontraktus: `assets/design-refs/tenant-site/walk-through/` (az elfogadott `plan.html`, `img/`, a tulaj képernyőképe, README).

## Elvégezve
- Új sablon `src/engine/templates/walkThrough.ts` (+ regisztráció `templates.ts`), új skin `gravel-grotesque` (`skins.ts`),
  görgetés-történet motor `motion.ts` `storyCss`/`storyJs` (`data-cit-story*` horgok; JS nélkül / reduced-motion /
  `data-cit-no-motion` alatt kép+szöveg párok).
- A séta lépései a fotók vision-tárgyából (`Photo.subject`, új mező `recipe.ts`); a tárgy a `heroPick.dropNeverShown`-ban
  ragad a fotóra (ugyanott, ahol a vízjel-bélyeg) → mind a négy renderelő út viszi; `siteData.toSitePhotos` továbbadja;
  a konzol sablon-előnézete (`tplPreview.ts`) és a `template-preview.mts` a cache-ből tölti.
- A lépés csak a tárgyat nevezi meg (cím), bekezdés nincs — a tényhűség-őr FLAG-je után (a témaszó szerinti
  kiemelés-párosítás a képről állított: „Reggeli a virágos kertben” beltéri étkező mellett).
- Őrök: jog/provenance PASS · dizájn-doktrína FLAG a régi Nyugalom-renderen („Séta” cím séta nélkül) → a mai kód
  „A ház”-at ír, újrarenderelve igazolva · tényhűség FLAG → bekezdés kivéve.
- Közös modulok helyén: foglalás (`bookingSlot` + `closing` slot sötét sávban), galéria-kontraktus (11 látszik +
  „Összes fotó”), szoba-kártya réteg, négy slot, telefonos menü/sáv a runtime-ból.
- A mock lelete (első képernyőn hiányzó számok) javítva: a számok betöltéskor csúsznak fel.
- Előnézeti képek: `public/assets/ui/tpl-walk-through{,-prev,-full}.jpg` (a `shot-previews` demó-fotói `subject`-et kaptak).
- Mobil séta: a lépés-kártya a lépés közepén ül (a mockban az alján — a képernyő felső felében a KÖVETKEZŐ fotó fölött
  úszott a felirat).

## Mérve
- Végiggörgetve 390/1440: Három Huszár (24 fotó, 3 lépés), Nyugalom (3 fotó, nincs értékelés → nincs séta, nincs
  értékelés-sáv), Aranykagyló 36 (23 fotó, nincs értékelés, 4–5 lépés). JS-hiba 0, vízszintes túlcsordulás 0.
- Korpusz (24 lead): 11-nél áll össze séta, 13-nál elmarad — ebből **8-nál nincs aktuális (`v3-watermark`) vision-ítélet**
  (a régi verziójú cache-sort a `readCachedScores` szándékosan nem tölti; újragenerálás / `rescore-photo-verdicts` pótolja),
  **4-nél** (Mandula, Alig-vár Tanya, Camping Carina, Éden) a kollázs után nem marad 3 különböző tárgy.

## Nyitott (koordinátornak)
1. Séta a kevés-tárgyú leadeken: A = elmarad (ma) · B = a kollázs 2–3. képe is lehet lépés (Bánó Porta 3 → 4 lépés).
2. Accent: a fotó-akcentus (Három Huszár: terrakotta) vs. a mock lombzöldje.
3. Lépés alatti bekezdés (csak fotónként megerősített leírásból lehetne).
4. A Három Huszár pillanatkép két forrás nélküli kiemelése (copywriter, 09-26) — újragenerálás javítja.
5. Foglalás: a közös naptáras modul, nem a mock kétlépcsős ajánlatkérője.
