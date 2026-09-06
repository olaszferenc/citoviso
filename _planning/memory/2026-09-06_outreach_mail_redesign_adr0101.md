# 2026-09-06 — A hideg megkereső levél újratervezése (ADR-0101)

## Kiváltó

A tulaj a saját postaládájában nézte meg a kimenő levelet, és három baja volt vele:
tördeletlen (a horog után egy 60 szavas tömb), érezhetően gépi a szövege, és a `a(z)`
névelő-workaround ott éktelenkedett benne. Plusz külön kérte a kedvezmény-zárójel törlését.

## Amit csináltunk

**§2b kapu végigjátszva, kód NEM módosult.** 3 dizájn-változat (A kézzel írt levél /
B levélpapír / C ajánlat-kártya), valós adaton, működő mockban (méret-váltó @container +
zoom-illesztés, „Mai levél / Új terv" összevetés), ui-shot mobil+asztali, Playwright-kattintás
(0 JS-hiba), majd VALÓDI kiküldés a tulaj postaládájába.

**Tulaj döntése:** „B verzió a jó de az itt is lehet navy kiemelés mint a C-n" → a B levélpapír
a C sötét navy ár-dobozával. Befagyasztva: `assets/design-refs/console/outreach-mail/`.

### Szöveg (ADR-0101 ①)

Horog (= Gmail-előnézet) → ÖNÁLLÓ megszólítás → keretezett ajánlat-mondat → kép/gomb →
kipróbálhatóság → ár → élesítés. A `a(z)` megoldása nem jobb névelő-találgatás, hanem a
mondat átszabása: ahol a lead neve ragozódna, a nevet KIHAGYJUK (a tárgy és a horog úgyis
viszi); ahol névelő kell, a meglévő `huArticle()` dönt.

### Két hiba, amit a MÉRÉS adott, nem a gondolkodás

**① Outlook-törés (néma).** Az első kör böngészőben és Gmailben hibátlan volt, Outlookban
szétesett: a sötét ár-doboz az egész 1900px-es ablakot átérte, a `float:right` fejléc-címke
egymásba csúszott. Ok: a Word-motor eldobja a `max-width`-et `<div>`-en és nem ismeri a
floatot. **Csak a tulaj képernyőképéből derült ki** — az én ui-shotom (Chromium) zöld volt.

**② A javítás ellen-hibája.** A fix `<table width="600">` megjavította az Outlookot, és
LEVÁGTA a szöveget mobilon (mérve 390px-en). A kettőt csak az MSO-feltételes szellem-táblázat
békíti ki: az Outlook fix 600-at kap, minden más kliens folyékony `max-width:600px`-et.

Ezért készült az `outlook-lint` szerkezeti őr, és **negatívan is lefuttatva** (a valódi törött
markupon PIROS: `float, max-width-div, no-fixed-table, no-ghost-table`), mielőtt a javítottat
zöldnek hittük volna.

### Amit NEM tettem meg, és miért

- **A kedvezmény-mondat törlése.** A tulaj kérte („ez meg nem kell"), de az ADR-0088 ①
  jóváhagyott döntése, hogy az érvényesség MINDIG ki van mondva (Fttv./bait-and-switch).
  Nem töröltem: átvittem az ár-mondat közepéről a szürke lábjegyzetbe. Jeleztem, hogy a
  teljes törléshez az ADR-0088 megnyitása kell.
- **A levél NEM veszi fel a lead mock-skinjét.** A „köszönőviszonyban sincs a mockkal"
  kifogásra ez volt a kézenfekvő olvasat (Rozé Fogadó = bordó `#6e1423` + krém + Fraunces),
  de a tulaj navy kiemelést kért → Citoviso-arculat marad. Elvetve, nem elfelejtve (ADR-0101 ②).

### Próba-küldés csapdája (elkerülve)

A levél gombja NEM a tracked `/p/<token>` linkre megy, hanem a követés nélküli
`/configure/<artifactId>`-ra: a tracked linken a 3. megnyitás 50%-os eszkalációs ajánlatot
mintázna (`offers.ts ESCALATION_VISIT_THRESHOLD`), és 24 óra múlva a napi billing-tick VALÓDI
levelet küldene a VALÓDI szállásadónak (Rozé Fogadó, `viktoria.balogh1@gmail.com` — 1
megnyitáson állt). A leiratkozó-link halott példa-útvonal, hogy egy kattintás ne iratkoztassa
le az igazi leadet.

### Mérés mellékesen

Mind a 4 kiküldött levél (A/B/C + B2) a Gmail **Elsődleges** fülére érkezett — nincs rajtuk
`CATEGORY_PROMOTIONS/UPDATES` címke, a legdizájnosabb C-n sem. Egy címzett nem statisztika,
de a „a dizájn a Promóciók fülre lök" félelem ezen a mintán nem igazolódott. (A korábbi,
2026-08-25-i mérés a `List-Unsubscribe` FEJLÉCRŐL szólt — az továbbra is áll.)

## Módosított / létrehozott fájlok

- `_planning/DECISIONS.md` — ADR-0101 (új)
- `assets/design-refs/console/outreach-mail/README.md` — a kontraktus (új)
- `assets/design-refs/console/outreach-mail/outreach-mail-b-navy.html` — jóváhagyott vázlat
- `assets/design-refs/console/outreach-mail/mail-markup.mts.txt` — a levél tényleges markupja
- `assets/design-refs/console/outreach-mail/hero.png`, `ui-outreach-mail-b-{mobile,desktop}.png`
- `_planning/memory/2026-09-06_outreach_mail_redesign_adr0101.md` (ez) + `INDEX.md`

## Nyitott / következő lépés

1. **Implementáció (a terv KÖT):** szöveg → `src/outreach/draft.ts` (tördelés + `a(z)`
   kigyomlálása; ugyanez a `src/outreach/escalationFollowup.ts` follow-up levelében is,
   ott is ott ül a `a(z)` és a kedvezmény-mondat), markup → `src/email/outreachEmail.ts`.
2. **`outlook-lint` valódi kapuvá** a `scripts/` alá, bekötve a levél-építés mellé.
3. **i18n:** a `T()` kulcsok a magyar forrás-stringek → kulcs-változás = katalógus-frissítés
   (`scripts/extract-i18n.mts`), pre-commit ellenőrzi.
4. **Design-token-őr hatóköre:** a levél-fájlok ma KÍVÜL esnek a
   `scripts/design-token-lint.mts` FILES-listáján (e-mailben nincs `var()`), ezért a
   brand-hexek őrizetlenek. Javasolt: ALLOW-bejegyzés a levél-fájlra a pontos hexekkel —
   így minden EGYÉB hex bukna. (Vö. „a doktrína hatóköre = az őr fájllistája".)
5. **ADR-0088 ①** kedvezmény-mondat: a tulaj teljes törlést kért, ma lábjegyzetben ül —
   döntés kell, ha törölni akarjuk.
