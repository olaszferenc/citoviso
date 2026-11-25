# 2026-11-25 — HR kontaktkereső országfüggővé téve, mérve Makarskán és Baška Vodán (dev DB)

**Session:** `citf21c0fb2`, koordinátor `cit9b4690e3`, brief `~/rc-briefs/hr-kontaktkereso-20261125.md`.
**ADR:** ADR-0477 „Országfüggő kontaktkereső (HR)”. **Élesen:** semmi (prod DB, éles lánc, valódi üzenet: semmi).

## Mi változott
- Repó: `src/countryLexicon/hr.json`. Új kulcsok: `chainKontaktSearchEngines` (startpage, qwant), `chainKontaktAggregatorRegex`
  (portálok, aggregátorok, valamint foglaló-aloldalak és ügynökségek: inn.fan, rentl.io, laganini.com, hrvatska.sk,
  croatia-hrvatska.eu), `chainKontaktFillWebsite`. A `chainKontaktSkipHostRegex` kiegészült az apartmanija.hr gépi fordítású tükreivel.
  A HU-szótár változatlan.
- Lánc (a repón kívül, staging `~/rc-briefs/uj-lanc-hr/`, saját helyi git; az éles lánc `~/rc-briefs/uj-lanc/` ÉRINTETLEN):
  - `orszag.mjs`: `CIT_DB=prod|dev` kapcsoló;
  - `kontakt/kereso.mjs`: ÚJ, Startpage/Qwant böngészővel;
  - `kontakt/kontakt.mjs`: a kereső a szótárból, település-index jelölt, aggregátor-szűrő, `portal-ti` forrás, website-írás;
  - `kontakt/lib.mjs`: profilkulcsok, psql/ssh a kapcsolóból;
  - `kontakt/email-google.mjs`: motoros SERP, ha a szótár kéri;
  - `kontakt/apply.mjs`: konzol a kapcsolóból, website-fill, többsoros jelszófájl;
  - `kontakt/selftest-orszag.mjs`: ÚJ.

  Átállás: `bash atallas.sh check|go|rollback`; a `go` a koordinátor engedélyére vár.

## Mérés (közös dev DB, $0 a keresésben)
**Makarska, 47 lead** (`raw.devProba='hr-makarska-20261123'`): **7 → 17 e-mailes**.
- A kontaktkereső 5-öt hozott: saját honlap 2, Facebook 2, apartmanija.hr település-index 1.
- A Startpage e-mail-kereső 5-öt hozott.
- 4 lead kapott képet (15–40 db); 1 website-írás (Central Beach 9).

**Baška Voda / Brela** (régió `hr-baskavoda-proba`, scrape_run `103a47aa`, OSM): 97 lead (59 honlap nélküli, 11 elavult, 27 modern).
- Előtte 32 e-mailes, ebből a honlap nélküliek közül 1.
- A kontaktkereső után 52 e-mailes (honlap nélküli: 18), 10 lead kapott képet.
- Az e-mail-kereső 6 biztos e-mailt adott, de 35/45 leadnél leállt, mert a Startpage és a Qwant is blokkolt
  (a kb. 200 kérésnyi határ). A 6-ból 1 a brelai turisztikai iroda címe volt (`tz-brela@`), ezt visszavontam, és a
  `chainKontaktEmailDenyRegex` kizárja a `tz-…@` / `@tz….hr` címeket.
- **Végeredmény: 32 → 57 e-mailes; a honlap nélküliek közül 1 → 22.**

Kézi átnézésnél 14 írás kiesett, mert hibás volt:
- 3 ügynökség-e-mail;
- 1 foglaló-aloldal website-ként;
- 5 rossz képlink: cavtati blog, hírportál, akciós oldal, és egy portál-hirdetés két különböző leadnél;
- 5 csak irányítószámos cím.

A címekből a Maps-ikon karaktere (U+E0C8) is kijött az apply előtt. Ez a meglévő kód hibája, HU-n is él (nyitott pont).

**Mock (teljes lánc):** Villa Dalmatino (Brela, honlap nélküli, saját oldalról vett e-mail, 37 kép) → Parallax
`b90c2a43`, horvát szöveg, dizájn-doktrína PASS. Költség: szöveg 1 × előfizetéses `claude -p` ($0,224 API-egyenérték),
hero-pontozás 1 API-hívás ($0,0387).

**HU-egyezés:** 14 HU no_site lead (dev DB, md5-minta), régi/régi/új futás. A keresőkérések száma azonos (Bing 25, Brave 3, Maps 9),
0 új kereső- vagy index-kérés; a verdikt+írás egyezése: régi–régi 11/14, régi–új 12–13/14 (ez a web zaja).

## Mért keresők (2026-11-25, dev box, headless)
- Startpage: működik (Google-index), kb. 200 kérés után 403.
- Qwant és Ecosia: csak az első kérésre válaszolnak.
- Blokkol: DDG (418), Mojeek (ALTCHA), Yandex (captcha), Google friss profillal (`/sorry/`).
- Portálok: apartmanija.hr (tulaj-telefon, néha e-mail). A tükrei gépi fordítással torzítják az e-mailt.
- Nincs tulaj-kontakt: HTZ accommodation.croatia.hr, TZ Tučepi lista.

## Nyitott
- Az átnéző (`egylepes-elo` / `kor.sh`) prod-kötött; az `orszag.py` nem kapott DB-kapcsolót.
- A Maps-panel címében marad az ikon-karakter (U+E0C8), és a csak irányítószámos cím is beíródik (a meglévő kód hibája, HU-n is).
- A felderítés 2,5 km-es köre Baška Vodán Brelát is lefedi; a mock-szöveg ezért helyesen Brelát írja.
- **Mock-fájl helye dev-en:** a `generateEngine.ts` (`mockArtifactPath`, ~799. sor) relatív fájlnevet ír a futó folyamat
  könyvtárába; a :4600 konzol (`serveMock`) a saját könyvtárából, a fő fa GYÖKERÉBŐL olvassa (ott él minden dev-mock, NEM a `sites/`
  alatt; a `rc-wt-prepare.sh` symlinkeli őket a munkafákba). Munkafából generált mock tehát a munkafa gyökerébe kerül, és a konzolon
  404 („A mock fájl nem található”), amíg át nem teszed a fő fa gyökerébe. Nem kódhiba; a b90c2a43 a helyén, operátor-sütivel 200.
- **„Üres szürke sáv” a mockon (2026-11-25, koordinátor):** a Parallax `t-par--band` háttérképe asztalin `background-attachment: fixed`,
  mobilon JS-es parallax-réteg. A teljes oldalas képernyőkép (ui-shot full page) ezt nem rajzolja ki, ezért szürke; nézőablakban
  görgetve a kép megjelenik (mérve mobilon és asztalin is). Nem mock-hiba; képernyőképes ellenőrzéshez nézőablaknyi kép kell.
