# JÓVÁHAGYOTT TERV — a generált tenant-oldal jogi lábazata (C + B-lábléc)

Tulaj-jóváhagyás: 2026-09-08 („C + B-lábléc"). Ez a terv a megvalósítás KONTRAKTUSA —
elvárt viselkedés, nem stílus-javaslat. ADR: **ADR-0110**.

## A hiány, ami kikényszerítette

A tulaj felvetése süti-kezelésről szólt. A mérés mást talált:

- **Süti nincs.** A legyártott élő oldal (Playwright, friss profil, teljes végiggörgetés)
  **0 sütit** tesz le; a beágyazott Google-térkép (`maps.google.com/…&output=embed`) sem sütit,
  sem `localStorage`-ot nem ír (külön mérve, first-party betöltéssel is üres). A `cit_session` /
  `cit_op_session` HttpOnly és technikailag szükséges → nem hozzájárulás-köteles.
  **Süti-sáv tehát NEM kell** — kitenni „cookie-theatre" volna.
- **Jogi lábazat viszont nincs.** A lábléc „Adatkezelés" linkje `href="#"`
  (`src/engine/chrome.ts:81`), mindkét élő legyártott oldalon; a tenant hoston `/adatvedelem`
  route sem létezik (`serveTenantHost` → 404). Közben ugyanaz az oldal **két űrlappal**
  gyűjt személyes adatot (`/api/foglalas`, `/api/velemeny`: `name`, `email`, `phone`,
  `checkin/out`, `message`) — GDPR 13. cikk szerinti tájékoztatás nélkül, impresszum nélkül.
- **Harmadik felek, tájékoztatás nélkül:** egy oldalbetöltés mérve `maps.googleapis.com` 15×,
  `www.google.com` 14×, `maps.gstatic.com` 2×; másik sablonon `fonts.googleapis.com` +
  `fonts.gstatic.com`; plusz hotlinkelt portál-képek (`hovamenjek.hu`, `balaton.hu`).
  Süti nincs, IP-továbbítás van.

Ez az ADR-0058 „Nyitott" pontja („a generált TENANT-oldalak jogi minimuma külön szelet").

## Amit a terv KÖT

1. **Két külön oldal, nem egy:** `/adatvedelem` és `/impresszum` a tenant SAJÁT hostján,
   a szállás saját sablonjában (nav, lábléc, skin-tokenek, betűk). Két URL, mert a lábléc két
   linkje két külön célra mutat, és a kereső is külön indexeli. (A „B" fülek elvetve.)
2. **Dokumentum-elrendezés — ez a C változat lényege:**
   - **asztali**: bal oldali *ragadós* tartalomjegyzék, a szöveg jobbra; a TJ követi, hol tart az
     olvasó (scroll-követés). ⚠️ A ragadós elem működéséhez a keret NEM lehet `overflow: hidden`
     (scroll-konténert csinál és megöli a `sticky`-t) — `overflow: clip` kell.
   - **mobil**: nincs oldalsáv, a szakaszok nyitható-csukható blokkok (`<details>`), az első nyitva.
   - A mockban a váltás `@container` query-vel dől el (a keret egy `<div>`); az ÉLES
     lapon a viewport maga az ablak, ott ugyanezek a töréspontok `@media`-ként élnek.
3. **„Röviden" doboz a lap tetején**, emberi nyelven, a részletes szakaszok fölött:
   nem használunk sütit · nem adjuk el az adatait · a foglaláshoz megadott adat a kérés
   megválaszolására kell · a vélemény külön hozzájárulással jelenik meg.
   ⚠️ Ez a doboz **csak addig maradhat**, amíg mind a négy állítás IGAZ. Ha analytics vagy
   bármilyen mérő süti bekerül, a „nem használunk sütit" sor azonnal hazugság lesz —
   akkor a süti-kérdés is újranyílik (ADR-0110 ④).
4. **Lábléc-sáv (a B változatból megtartott elem):** a lábléc alján állandó sávban a szállásadó
   **jogi neve + adószáma** + a két jogi link. A vendég a foglalási űrlap alatt, a döntés
   pillanatában lát valódi céget. Mobilon a sáv tördel, a szeparátor `·` ilyenkor eltűnik
   (mérve: árván maradt a sor végén).
5. **Az űrlapok jogalapja NEM keverhető:**
   - **foglalási kérés** → szerződés előkészítése (GDPR 6. cikk (1) b): egyetlen mondat +
     link a tájékoztatóra, **pipa NINCS** (egy „elfogadom" pipa itt hamis jogalapot állítana);
   - **vélemény** → hozzájárulás (6. cikk (1) a): **kötelező pipa, ami BLOKKOL**, és a
     blokkolás **szerver-oldalon is** érvényes, nem csak a böngészőben.
6. **Adathiányos ág hangosan:** ha a szállásadóról hiányzik egy kötelező impresszum-adat,
   a sor helyén **„— nincs megadva —"** áll, a mező nem tűnik el némán és a rendszer nem talál
   ki semmit; a szállásadó a szerkesztőfelületén figyelmeztetést kap, amíg ki nem tölti.
   ⚠️ A mockban ez piros; az ÉLES lapon a szállás **akcent-színe** + félkövér + dőlt viszi a
   hangsúlyt, mert a motor 11 tokene közt nincs hiba-szín, nyers hexet pedig a
   dizájn-token-doktrína tilt (ADR-0021 ①). A cél a feltűnés, nem a konkrét árnyalat.
7. **Mobil táblázat:** a 4 oszlopos adat-táblázat 390px-en kártya-listává rendeződik
   (fejléc cellánként, `data-label`). ⚠️ Enélkül mérve **444px** széles egy 390px-es kereten
   belül, és a „Meddig" oszlop némán levágódik — a screenshot ettől még zöld volt.
8. **A mock (nem fizetett lead) NEM kap valódi jogi lapot.** A demó-fázisban nincs jogi
   adatunk a szállásadóról; a lábléc ott nem állíthat impresszumot. (§I — amit megajánlunk,
   az pontosan az, amit szállítunk; ez fordítva is áll: nem ajánlunk meg nem létező jogi lapot.)

## Amit a MEGVALÓSÍTÁS hozzátett (a terv szellemében)

- **Látogatottság-mérés szakasz.** Az ADR-0108 ② szó szerint kimondta: *„az adatkezelési
  tájékoztatóba be kell kerülnie — ezt nem ugorjuk át"*, és addig nem került be. Most benne van
  (mit mérünk, mit nem, napi forgó azonosító, jogos érdek), és a „Röviden" doboz is kimondja,
  hogy mérünk — a puszta „nem használunk sütit" technikailag igaz, gyakorlatilag félrevezető
  lett volna.
- **„Jogi adatok" panel a tenant-admin Fiók fülén** + `admin-legal` KB-entry: a hiányzó
  kötelező mezőket a szállásadó itt pótolja, és amíg hiányoznak, figyelmeztetést lát.

## Amit a terv NEM köt

- A jogi szöveg pontos szófordulatai (a `src/legal.ts`-ben élnek, verziózva, i18n-exempt).
- A tartalomjegyzék scroll-követése elhagyható az első körben (a TJ ugrása enélkül is működik) —
  a mobil nyitható szakaszok és a „Röviden" doboz NEM hagyható el.

## Mérés, ami a terv mögött van

- `plan.html` végigkattintva 390px-en és 1280px-en: 21/21 állítás zöld, **0 JS-hiba**
  (kezdőállapot a viewportból · lábléc-linkek · TJ-ugrás · mobil nyit-csuk · foglalás
  validáció · vélemény pipa nélkül NINCS siker · adathiány-ág · nincs `@media` · nincs emoji).
- Képek: `mobil-*.png`, `asztali-*.png` — a lábléc-sáv, az adatkezelési tájékoztató és az
  impresszum mindkét méretben.

## Fájlok

- `plan.html` — a jóváhagyott, működő terv (önhordó; a szállás valós skin-tokenjeivel)
- `mobil-lablec.png`, `asztali-lablec.png` — a lábléc-sáv
- `mobil-adatkezeles.png`, `asztali-adatkezeles.png` — az adatkezelési tájékoztató
- `mobil-impresszum.png`, `asztali-impresszum.png` — az impresszum
