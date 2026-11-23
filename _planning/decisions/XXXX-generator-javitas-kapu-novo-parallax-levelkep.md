## ADR-XXXX — Generátor-javítás: kapunyitás más témájú szárnnyal, névből növő nagy kerettel, parallax mobilon, levélkép intro nélkül, a mock-oldalon intro

**Dátum:** 2026-11-23 · **Státusz:** elfogadva (tulaj) · **Session:** `cite2d1c9b4`
**Terv (kontraktus):** `assets/design-refs/tenant-site/generator-javitas/`
**Felülírja:** ADR-0159 ⑦ (nincs nyitó-animáció a kiküldött mockon) · **Érinti:** ADR-0423 (kapu képe), ADR-0115 (intro), ADR-0472 (térhatás)

### Mi volt a baj (a tulaj vette észre, mérve)
1. **Kapunyitás:** a szárnyakon a galéria 2. képe — a szabály (`gatePhotoOf`) csak URL- és
   ujjlenyomat-egyezést nézett; Krisztina Panziónál a 2. kép ugyanaz a sárga ház más szögből →
   a kapu „önmagára nyílt”. A nyitás 1,5 s — túl gyors.
2. **Névből növő:** a keretben váltó sorozat utolsó képe maga a hős volt, az nőtt fel → ami
   felnő, ugyanaz, ami mögötte marad; a keret túl kicsi.
3. **Parallax:** mobilon a CSS szándékosan `scroll`-ra esett vissza (iOS nem tud
   `background-attachment:fixed`-et) → a „hátul maradó kép” hatás mobilon eltűnt.
4. **Levélkép:** a heroShot a névből növő mockon a BEVEZETŐT fényképezte (krém lap, név, kis
   keret) — 773 kiküldés 11-09 és 11-23 között (éles DB, minden csatorna).
5. **ADR-0159 ⑦ félreértés:** a tulaj 09-14-i „kapcsold ki a nyitó-animációt” a LEVÉL KÉPÉRŐL
   szólt („az emailben ne ezt mutassuk, mert nem látszik semmi”), a kód viszont a mock-oldalon
   kapcsolta ki — fordítva működött mindkét helyen.

### Döntés (tulaj, 2026-11-23)
- **Kapunyitás** („kép, 3,5 mp szerintem tök jó”): a szárnyon **más témájú** fotó
  (`Photo.subject` csoport: épület / kert-kilátás / belső; más csoport, különben más téma; ha a
  hős témája ismert és nincs eltérő → nincs kapu, a generálás elutasít); a tenant választása
  (`gatePhoto`) elöl; téma-ítélet nélküli hősnél a régi szabály. Nyitás **3,5 s** (.45 s késleltetés),
  a hős utána-ülése 4,2 s, a térhatás 4,0 s után indul.
- **Névből növő** („1. B”): **nagy keret** (`min(54vh,38vw)` / álló `min(82vw,54vh)`), **4 nem-hős**
  fotó vált benne, a növés kezdetén a hős áttűnik a keretben (0,6 s), és a hős marad (nincs
  képcsere a végén).
- **Parallax** („Mehet”): ahol a böngésző nem tud rögzített hátteret, a panel fotója egy
  rétegbe kerül, amit szkript a képernyőhöz rögzít; a térhatás-vászon minden méreten rögzítve.
  Csökkentett mozgásnál semmi nem mozog.
- **Térhatás erőssége 1,5** (volt 2; „a finomított animáció”, Elek A3: 2-nél kenődtek az előtér-szélek).
- **Levélkép intro nélkül** (heroShot: `data-cit-no-intro` az első szkript előtt; gyorsítótár v6).
- **A mock-oldalon (`/p/…`) a bevezető FUT**: `disableIntroAnimation` helyett `introJsOffNet` — csak
  a JS nélküli háló marad (ADR-0159 ⑧), hogy régi artefaktumon se legyen üres opak panel.

### Következmények
- A keretezés-őr (`prospect-framing-check` ④) az új szabályt méri: JS-sel az intro fut, JS nélkül
  a háló rejti, régi artefaktumon a kiszolgáláskor tett háló menti; két új piros önteszt.
- A keretező sáv a bevezető alatt marad, amíg az intro fut (~10 s a névből növőn) — a tulaj döntése.
- Élesre csak külön engedéllyel, hotfix-ágon (az ország-réteg nem mehet ki).
