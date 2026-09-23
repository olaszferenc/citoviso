## ADR-0027 — SABLON-ELŐSZÖR (template-first): a referencia-oldalak = teljes, adat-slotos oldal-sablonok; a vékony primitív-kombinatorika kikerül a mock-útból

- **Kiváltó (2026-08-08):** a tulaj élesben tesztelve három egymás utáni mockot kapott, amelyek
  (1) egyformák (az AI-tervező mindig meleg-krém skin + „masthead" — kép nélküli — hero-t választott)
  és (2) referencia-szint alattiak („téglalap-szövegek egymás után"). Gyökérok: az architektúra a
  kraftot a KÖZÖS, vékony primitív-készletre bízta, az archetípus pedig szerződés szerint CSAK
  elrendez (nem gazdagíthat) → akármit választ a tervező, ugyanazok a sovány dobozok jönnek ki.
  A referencia-oldalak ereje SZEKCIÓ-SZINTŰ kézműves munka, ami sosem került be a generáló útba.
  Bizonyíték, hogy a rés a modellben van, nem a képességben: ugyanabból a valós Fortuna-adatból
  kézzel megírt oldal (sites/_engine-proof/) referencia-szintű.
- **Döntés (tulaj, 2026-08-08: „csináld meg"):** a modell MEGFORDUL — nem a generikus kompozíciót
  próbáljuk kraftra tornázni, hanem a REFERENCIA-OLDALAK válnak teljes, adat-behelyettesíthető
  OLDAL-SABLONOKKÁ (`src/engine/templates.ts`). Egy sablon a SAJÁT teljes HTML+CSS-ét birtokolja
  referencia-hűségen (hero, üveg foglaló-sáv, mozaik, vélemény-sáv, lábléc — mind a sablonban él),
  és a `--cit-*` token-kontraktusból öltözik (skin-réteg + őr-kapuk változatlanul működnek).
- **Ami marad az AI-nak:** copy (brief + editorial copywriter — hang, nem tény) + fotó-akcentszín.
  A sablon- és skin-VÁLASZTÁS determinisztikus: sablononként kurált skin-lista, lead-név-hash
  szerinti szórással → a monokultúra (mindig ugyanaz a krém) determinisztikusan kizárva.
- **mock=live:** a recept `template` mezőt kap; `renderSite()` a template-ágon rendereli MINDKÉT
  fázisban (mock: jelölt minta-vélemények; live: §B.17 fázis-kapu — minta-tartalom kiesik,
  places-fotó a fotó-policy szerint kiesik → a hero fotó nélkül is áll). A perzisztált
  recept+adat páros determinisztikusan újra-renderelhető — a garancia változatlan.
- **Szeletelés:** 1. szelet = a 01-fullbleed-glass irány sablonja (`fullbleed`) mint alapértelmezett
  mock-út (fotós leadre); a kompozíciós út marad fallback (fotó nélkül / kurátori archetípus-override).
  Következő szeletek: a további 4 referencia (dark-luxury, card-sidebar, editorial, parallax) sablonná,
  majd az AI art-direction-választó a sablonok KÖZÖTT (nem a sablonon belül).
- **Visszafordíthatóság:** 🔄 könnyű — additív (`template` opcionális recept-mező; nélküle a régi
  kompozíciós út fut változatlanul; régi artifactok érintetlenek).
- **Státusz:** ELFOGADVA (tulaj, 2026-08-08). 1. szelet implementálva ebben a sessionben.
