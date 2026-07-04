# Motor-tanulságok az elvi tesztekből (2026-07-04)

A `/home/mineral/mockups/` scratch-ben készült prototípusok (Badacsony szállások) tanulságai — ezek a `src/generate` + `src/scrape` tervezését vezetik.

## Adatforrás
- **Van saját (elavult) oldal** → onnan adat + kép (WebFetch a kép-URL-eket is látja).
- **Nincs saját oldal** (gyakori: 20-ból 17) → Google Maps + foglaló-portál (zimmerinfo.hu, hovamenjek.hu, utisugo.hu, badacsony.hu). A portál-oldalról a tényleges `<img src>` kiolvasható, a képek gépileg letölthetők (Maps consent-fal mögött a galéria közvetlenül NEM).
- ⚠️ szallas.hu WebFetch-re 403; hovamenjek/zimmerinfo megy.

## Stílus-visszaadás (fontos képesség)
A motor NEM csak adatot szed, hanem **„megnézi" a képeket**: paletta + stílus kiolvasása → arculat ehhez hangolva.
- Gépi paletta-kinyerés: Python PIL kvantálás a fotókból (pl. Gitta → terrakotta/tölgy/krém; első zöld tippem HIBÁS volt).
- Stílus-osztályozás (rusztikus/modern/mediterrán/tavi) → dizájn-preset + akcentszín. Ma kézzel; cél: vision-lépés (Claude) automatizálja.

## Dizájn-szabályok (user-rendelet)
- **NINCS emoji-ikon** — saját, vonalas **SVG ikonkészlet** (sprite, `currentColor`, egységes stroke). ~21 ikon (ágy, fő, konyha, fürdő, parkoló, hegy/panoráma, hullám/strand, láng/grill, wifi…).
- **Egyedi „mag" szállásonként** — nem generikus töltelék, hanem az adott szállás valós, megkülönböztető adata dedikált szekcióban (pl. Gitta „névadó lugas", Kati „dupla konyha + fedett kocsibeálló", Napsugár „gyerekbarát játszóudvar"). Ez a `Property.unique` (`src/generate/types.ts`).
- Szállásonként más betűpár + paletta → ne tűnjön klónnak.

## Architektúra bizonyítva
`gen.py` = **közös template + szállásonkénti adat-objektum**. Új szállás = új adat-rekord, nem új kód. Ezt portoljuk TS-be (`src/generate`).

## ⚠️ Jogi őrszem (kép-provenance) — `ImageSource` típus
- `owner` (tulaj-feltöltés Maps/portál) → demóra + rendelés után OK.
- `guest` (vendég-fotó Google-ön) → a vendégé a jog; demóra belefér, élesre engedély kell.
- `portal` (aggregátor/fotós joga) → NEM megy vakon élesre.
- Élesben a tulaj saját, tiszta assetjei (ez erősíti a modellt: rendeléskor ő tölti fel).
- A zimmerinfo-fotók vízjelesek → demóra jók, élesre a tulaj eredetije.

## Validáció (Badacsonytomaj minta)
20 szállásból **17 (85%) nem rendelkezik saját weboldallal** (proxy: saját-domain keresés; nem 1:1 a Maps „weboldal" mező). A „pár szoba/magánszállás" szegmens ~100% honlap nélküli — ez a célszegmens.
