## ADR-0110 — A generált tenant-oldal jogi lábazata: adatvédelmi tájékoztató + impresszum; süti-sáv NINCS (2026-09-08)

**Státusz:** ELFOGADVA (tulaj, 2026-09-08: „C + B-lábléc", „indulhat a kód") ·
**Lezárja:** ADR-0058 „Nyitott" pontját („a generált TENANT-oldalak jogi minimuma külön szelet") ·
**Érintetlen:** ADR-0092 (a térkép egyből renderel — tulaj-döntés, marad).
**Kontraktus:** `assets/design-refs/tenant-site/legal-footer/` (plan.html + README).

### Kiváltó — és a mérés, ami átfordította a kérdést

A tulaj felvetése: *„az oldal építése közben kimaradt a sütik, a sütikezelés és annak
elfogadása."* A felvetés jogos volt, a hiány viszont NEM ott volt:

- **Süti-sáv nem kell, mert süti nincs.** Mérve (Playwright, friss profil, teljes
  végiggörgetés a legyártott élő oldalon): **0 süti**. A beágyazott Google-térkép
  (`maps.google.com/…&output=embed`) sem sütit, sem `localStorage`-ot nem ír — ezt külön,
  first-party betöltéssel is bemértem, üres. A `cit_session` / `cit_op_session` HttpOnly és
  technikailag szükséges → nem hozzájárulás-köteles (ADR-0058 sora ÁLL). Egy consent-sáv ma
  olyanra kérne hozzájárulást, ami nem történik: „cookie-theatre".
- **Ami tényleg hiányzik:** a lábléc „Adatkezelés" linkje `href="#"`
  (`src/engine/chrome.ts:81`) — halott, mindkét élő legyártott oldalon; a tenant hoston
  `/adatvedelem` route nem is létezik (`serveTenantHost` → 404). Ugyanez az oldal közben
  **két űrlappal** gyűjt személyes adatot (`/api/foglalas`, `/api/velemeny`: név, e-mail,
  telefon, dátumok, üzenet) GDPR 13. cikk szerinti tájékoztatás nélkül, és impresszum
  (Eker.tv. 4. §) sincs.
- **Harmadik felek tájékoztatás nélkül:** egy oldalbetöltés mérve `maps.googleapis.com` 15×,
  `www.google.com` 14×, `maps.gstatic.com` 2×; másik sablonon `fonts.googleapis.com` +
  `fonts.gstatic.com`; plusz hotlinkelt portál-képek (`hovamenjek.hu`, `balaton.hu`).
  Süti nincs, **IP-továbbítás van** — ez a tájékoztatóba tartozik.

⛔ **Tanulság a felvetés kezeléséről:** a kérdést nem a szó szerinti formájában kell
megválaszolni („tegyünk ki süti-sávot"), hanem meg kell mérni, mi történik valójában.
A süti-sáv kitétele elfedte volna az igazi jogsértést (tájékoztatás nélküli adatgyűjtést)
egy olyan sávval, ami semmiről nem szól.

### Döntés

① **Két külön oldal a tenant SAJÁT hostján:** `/adatvedelem` és `/impresszum`, a szállás saját
sablonjában (nav, lábléc, skin-tokenek). Két URL, mert a lábléc két linkje két külön célra
mutat, és a kereső külön indexeli. (Az „egy lap két füllel" változat elvetve.)

② **Dokumentum-elrendezés** (a jóváhagyott „C"): asztalon ragadós tartalomjegyzék
scroll-követéssel, mobilon nyitható-csukható szakaszok, a lap tetején emberi nyelvű
**„Röviden" doboz**. A méret-váltás `@container`, nem `@media`.
⚠️ A ragadós TJ-hez a keret nem lehet `overflow: hidden` (scroll-konténert csinál és megöli a
`sticky`-t) — `overflow: clip`.

③ **Lábléc-sáv** (a „B" változatból megtartva): a lábléc alján állandó sávban a szállásadó
**jogi neve + adószáma** + a két jogi link. A vendég a foglalási űrlap alatt lát valódi céget.

④ **Süti-sáv NINCS — de a „Röviden" doboz állítása KÖTELEZETTSÉG.** A doboz kimondja, hogy
nem használunk sütit; ez ma igaz és mérhető. **Ha bármikor analytics, pixel vagy más mérő süti
kerül a generált oldalra, ez az ADR-pont azonnal újranyílik**: akkor kell consent-sáv, ÉS a
„Röviden" doboz szövege hazuggá válik. Az őr ezt méri (⑦), nem a jószándék.

⑤ **A két űrlap jogalapja nem keverhető.** Foglalási kérés → szerződés előkészítése
(GDPR 6. cikk (1) b): egy mondat + link, **pipa nincs** (egy „elfogadom" pipa hamis jogalapot
állítana). Vélemény → hozzájárulás (6. cikk (1) a): **kötelező pipa, ami BLOKKOL**, és a
blokkolás **szerver-oldalon is** érvényes. ⛔ A kliens-oldali pipa önmagában nem kapu
(`feedback_additive_write_is_not_a_gate`): a `/api/velemeny` a hozzájárulás nélküli kérést
elutasítja, nem tárolja.

⑥ **Adathiányos ág hangosan.** Ha a szállásadóról hiányzik kötelező impresszum-adat, a sor
helyén **„— nincs megadva —"** áll, a mező nem tűnik el némán és a rendszer nem talál ki
semmit; a szállásadó a szerkesztőfelületén figyelmeztetést kap. ⛔ A hiányzó adatot
kitalálni vagy elhallgatni ugyanaz a hiba két irányból
(`feedback_missing_data_branch_is_the_blind_branch`, §B.17).

⑦ **A MOCK nem kap valódi jogi lapot.** A demó-fázisban nincs jogi adatunk a leadről, tehát a
mock lábléce nem állíthat impresszumot. A jogi lábazat a `phase: "live"` renderelés része.

### Amit a mérés fogott meg, nem a szem

- A 4 oszlopos jogi táblázat **444px** széles egy 390px-es telefonon: a „Meddig" oszlop némán
  levágódott (`overflow: hidden` a kereten), miközben a screenshot zöld volt. Javítás: mobilon
  kártya-lista `data-label`-lel. Ugyanaz a minta, mint az Outlook-törésnél
  (`reference_email_outlook_silent_break`): a kép nem bizonyít elrendezést.

### A látogatás-mérés adóssága, itt törlesztve

Az **ADR-0108 ②** szó szerint kimondta: *„Az adatkezelési tájékoztatóba be kell kerülnie — ezt
nem ugorjuk át."* Nem került bele. Ez a kör pótolja: a tenant tájékoztatója önálló szakaszt kap
(mit rögzítünk: időpont, oldal, eszköztípus, a hivatkozó hosztneve; mit NEM: IP, keresőkifejezés,
teljes URL, süti; a napi forgó, visszafejthetetlen azonosító számláló és nem profil; jogalap
6. cikk (1) f)). A „Röviden" doboz is kimondja, hogy MÉRÜNK — a puszta „nem használunk sütit"
technikailag igaz, de félrevezető lett volna.

### Impl.

**KÉSZ (ebben a szálban):** a kontraktus (`assets/design-refs/tenant-site/legal-footer/`) ·
`src/legal.ts` (tenant jogi csomag, adat-vezérelt blokkokkal) · `src/engine/legalPages.ts` (ÚJ) ·
`src/engine/chrome.ts` + 13 sablon lábléce (élő link) · `src/engine/render.ts` (mock-ági
link-eltávolítás) · `migrations/0056_tenant_legal.sql` + `src/tenant/legalIdentity.ts` ·
`src/tenant/editor.ts` (a két lap a snapshot mellé) · `src/server/public.ts` (route +
`/admin/legal` + a vélemény-kapu) · `assets/runtime/cit-runtime.js` (foglalási tájékoztató sor) ·
`src/server/adminViews.ts` („Jogi adatok" panel) · `kb/entries/admin-legal` + `scripts/kb-shot.mts` ·
`scripts/tenant-legal-check.mts` (őr, pre-commitban, önteszttel).
**Érintett a kódban:** `src/legal.ts` (tenant jogi szövegek, i18n-exempt, verziózva) ·
`src/engine/chrome.ts` (lábléc: élő linkek + jogi sáv, live fázisban) ·
`src/engine/legalPages.ts` (ÚJ — a két lap renderelése a szállás skinjében) ·
`src/tenant/editor.ts` (`renderAndPersist`: a jogi lapok a snapshot mellé) ·
`src/server/public.ts` (`serveTenantHost` route-ok) · `src/engine/moduleSections.ts` +
`assets/runtime/` (űrlap-tájékoztatás, vélemény-pipa) · `src/server/public.ts`
`/api/velemeny` (szerver-oldali hozzájárulás-kapu) · `src/server/adminViews.ts` (jogi adatok
szerkesztése + hiányzó adat figyelmeztetés) · `scripts/legal-check.mts` (tenant-oldali kapu) ·
`kb/entries/` (súgó).

### Ellenőrizhetőség — `scripts/cookie-audit.mts`

A „nem használunk sütit” állítás nem hit kérdése: egy paranccsal bármikor MÉRHETŐ.
`npx tsx scripts/cookie-audit.mts --demo` a motorból renderel egy élő oldalt + a két jogi
lapot (DB nélkül, a legrosszabb esetre: webfontos skin + beágyazott térkép), friss böngésző-
profilban végiggörget, és kiírja a sütiket, a `localStorage`/`sessionStorage` kulcsokat, az
összes külső hostot és az ismert követőket. Létező oldalra is ráfuttatható (fájl vagy URL).
Mérés 2026-09-08: **0 süti, 0 tárolás**, miközben a Google Maps (`maps.google.com`,
`maps.gstatic.com`, `www.google.com` 6×) és a Google Fonts (`fonts.googleapis.com`,
`fonts.gstatic.com`) betöltődik — vagyis IP-továbbítás van (a tájékoztató kimondja), süti nincs.
⛔ Az eszköz **nem ad zöldet, amit nem mért**: 404-es cél vagy hiányzó hálózat esetén
„NEM MÉRHETŐ” — az első változat egy törölt tenant 404-es oldalát mérte és „0 süti”-t jelentett.

### Nyitott

- **Nyelv:** a jogi szöveg országonkénti JOGI csomag, nem gépi fordítás (§B.18). Az első kör
  magyar; a fizetett többnyelvű modul (ADR-0063) nyelvi verzióihoz a jogi lap fordítása külön
  szelet — addig a jogi lap a site fő nyelvén él.
- **Google Fonts self-host:** a betűtípusok saját hostról kiszolgálása megszüntetné a
  font-célú IP-továbbítást (a térkép marad, ADR-0092). Külön kör, nem blokkolja ezt.
- **NTAK / szálláshely-nyilvántartási szám:** a szálláshely-szolgáltatónak van ilyen
  azonosítója; a mezőt a terv tartalmazza, a kitöltés a szállásadóé. Kötelezővé tétele
  tulaj-döntés.
