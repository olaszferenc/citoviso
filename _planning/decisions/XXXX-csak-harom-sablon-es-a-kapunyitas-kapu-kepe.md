## ADR-XXXX — Új mockhoz csak három sablon (Parallax · Kapunyitás · Névből növő); a Kapunyitás szétnyíló képe sosem a nyitókép, hanem az admin második képe, külön mezőben

**Dátum:** 2026-11-04 · **Státusz:** elfogadva (tulaj, szó szerint a koordinátoron át) · Épít: ADR-0422 (a Fejezetes kivezetése), ADR-0311 (a Kapunyitás sablon) · Felülírja: a Kapunyitás 2026-10-03-i „B”/„A” kapu-szabályát

### Kontextus

A tulaj (2026-11-04): „ami még választható: parralax · kapunyitás (DE KURVÁRA NEM LEHET A SZÉTNYÍLÓ KÉP
UGYANAZ AMI AZ ANIMÁCIÓ UTÁN OTTMARAD!!!! Az admin második képe legyen, hogy tudja majd tenant ezt is
konfigurálni) · névből növő”.

A Kapunyitás kapuja addig a nyitókép utáni legjobb KÜLTÉRI fotó volt, és ha ilyen nem volt, maga a
nyitókép tompítva („A”) — vagyis a kapu a saját képére nyílt, pont amit a tulaj most kizár.

### Döntés

1. **Új mock csak ezzel a hárommal készülhet:** `parallax`, `gate-opening`, `wordmark-grow`
   (`templates.OWNER_ALLOWED_TEMPLATES`, az `isPickableTemplate` olvassa). A konzol választója, a
   Forrás-csomag sablonlistája, a `/generate` és a `/generate-curated` (`templatePicks.resolveTemplatePicks`,
   a megengedett hármat megnevezve utasít el) és a motor (`assertTemplateHonoured`: listán kívüli sablon
   új mockként nem renderel) is ezt követi. A többi sablon kódja marad: a már elkészült mockok és oldalak
   renderelnek.
2. **Nincs alapértelmezett sablon a konzolon** (tulaj, 2026-11-04: „random bazdmeg! amelyik jobb”): se első,
   se második terv nem fix. A `/generate` és a `/generate-curated` csak a hármasból KIFEJEZETTEN választott
   sablont fogad el (`templatePicks.requireExplicitPick`); üres kérésre hangosan bukik, a megengedett hármat
   megnevezve. A motor tartaléka (`FIRST_TEMPLATE_DEFAULT` = Parallax, a beégetett `fullbleed` helyett) csak
   a nem-konzolos hívóké (nyilvános mock-kérés, CLI).
3. **A Kapunyitás kapu-képe külön mező:** `SiteData.gatePhoto` — generáláskor a galéria MÁSODIK képe (az
   admin második képe), hogy a tenant az adminban később konfigurálhassa. SOHA nem azonos az animáció után
   ott maradó nyitóképpel: sem URL-re, sem ujjlenyomatra (a második kép is mindig ujjlenyomatot kap).
4. **Nincs ilyen kép → hangos elutasítás:** a generálás a fotók után, az AI-hívás ELŐTT bukik („Kapunyitás:
   nincs a nyitóképtől különböző második kép …”). A tompított, önmagára nyíló kapu („A”) megszűnt; egy régi
   mock, amelynek nincs különböző második képe, kapu nélkül renderel. Ha a nyitókép közben a kapu képére
   cserélődik (operátori hős-csere), a második kép áll be.

### Következmény

- Tesztek (pre-commit): `scripts/template-pick-check.mts` (csak a három választható; a többi 18 elutasítva;
  nincs alapértelmezés, üres kérés bukik; bekötés a motorba, a végpontokba és a választóba) · `scripts/gate-photo-check.mts` (a kapu = a második
  kép / a külön mező; URL- és ujjlenyomat-azonosság → nincs kapu; render: szárny ≠ nyitókép; a generálás
  az AI előtt utasít el).
- Ui-shot 390 + 1440 px, valódi éles bemenettel (Orchidea Apartman, Lola Vendégház): a kapu nyílásakor
  és az animáció után a két kép különbözik, JS-hiba 0.
- A sablon README-szerződése (`assets/design-refs/tenant-site/gate-opening/README.md`) ezt mondja.
