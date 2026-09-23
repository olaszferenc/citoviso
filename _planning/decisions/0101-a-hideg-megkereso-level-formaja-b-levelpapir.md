## ADR-0101 — A hideg megkereső levél formája: „B levélpapír + navy ár-kiemelés", Outlook-biztos markuppal

**Dátum:** 2026-09-06 · **Státusz:** ELFOGADVA (tulaj: „B verzió a jó de az itt is lehet navy
kiemelés mint a C-n") · **Kontraktus:** `assets/design-refs/console/outreach-mail/` ·
**Kapcsolódó:** ADR-0088 ① (érvényesség MINDIG kimondva), ADR-0067/0070 (a levél nyelve),
§C (outreach-kapu), §A (demo-framing), §2b (terv-jóváhagyási kapu).

**Kiváltó:** a tulaj a saját postaládájában nézte meg a kimenő levelet, és három baja volt
vele: (a) a horog után nincs tördelés, egy 60 szavas tömb hordozza az ajánlatot; (b) érezhetően
gépi a szöveg („a(z)", `TERVÉT`, „személyre szabott", gondolatjel-halmozás); (c) a levél
„köszönőviszonyban sincs a mockkal", amit hirdet.

### Döntés

**① A szöveg tördelt, egy-gondolat-egy-mondat.** Horog (= Gmail-előnézet) → ÖNÁLLÓ megszólítás
→ keretezett ajánlat-mondat → kép/gomb → kipróbálhatóság → ár → élesítés. ⛔ **„a(z)" tilos**:
ahol névelő kell, a `huArticle()` dönt; ahol a lead neve ragozódna, a nevet ki kell hagyni a
mondatból (a tárgy és a horog úgyis viszi) — ragot nem találgatunk. Tilos a csupa nagybetűs
kiabálás, a „személyre szabott" és a 40+ szavas körmondat.

**② A levél a CITOVISO arculatában marad, minden leadnél ugyanaz.** Felmerült, hogy a levél a
lead saját mock-skinjét viselje (a Rozé Fogadónál bordó `#6e1423` + krém, Fraunces szerif) —
ez a „köszönőviszony"-kifogás kézenfekvő olvasata volt, a tulaj mégis navy kiemelést kért.
Egy levél = egy arculat, kiszámítható feladó-kép. **Elvetve, nem elfelejtve.**

**③ Vizuális hangsúly: EGY navy ár-doboz** (`#0a1f36`), áthúzott listaárral és `−N%`-kal, plusz
egy elsődleges gomb, ALATTA a nyers URL-lel (a nyers URL bizalmi elem hideg levélben, nem dísz).

**④ Az ADR-0088 ① érvényesség-mondata MARAD, csak a helye változik**: az ár-mondat közepéről a
szürke lábjegyzetbe. A tulaj törölni akarta („ez meg nem kell"); mivel jóváhagyott ADR és
Fttv./bait-and-switch védelem, nem töröltem, hanem áthelyeztem — a mondat kimondva van.

**⑤ ⛔ OUTLOOK-BIZTOS MARKUP, géppel őrizve.** Az első kör böngészőben és Gmailben hibátlan
volt, **Outlookban szétesett** (a sötét ár-doboz az egész 1900px-es ablakot átérte, a
`float:right` fejléc-címke egymásba csúszott): a Word-motor eldobja a `max-width`-et
`<div>`-en és nem ismeri a floatot. A javítás fix `<table width="600">` — de az **mobilon**
vágta le a szöveget (mérve 390px-en). Kötelező tehát a **MSO-feltételes szellem-táblázat**:
az Outlook fix 600-at kap, minden más kliens folyékony `max-width:600px`-et. Vízszintes
elrendezés csak táblacellával; nincs `<style>` blokk, CSS-változó, háttérkép; a betű-stack
valódi telepített fonttal kezdődik. **Őr:** `outlook-lint` — és negatívan is le kell futtatni
(a valódi törött markupon PIROS), mielőtt zöldre hisszük.

**Mérés mellékesen:** mindhárom kiküldött változat — a legdizájnosabb is — a Gmail
**Elsődleges** fülére érkezett (nincs `CATEGORY_PROMOTIONS/UPDATES` címke). Egy címzett nem
statisztika, de a „a dizájn a Promóciók fülre lök" félelem ezen a mintán nem igazolódott.

**⚠️ Próba-küldés csapdája:** a levél gombja próbában SOHA nem a tracked `/p/<token>` linkre
megy, hanem a követés nélküli `/configure/<artifactId>`-ra. A tracked linken a 3. megnyitás
50%-os eszkalációs ajánlatot mintáz (`offers.ts ESCALATION_VISIT_THRESHOLD`), és 24 óra múlva
a napi billing-tick VALÓDI levelet küld a VALÓDI szállásadónak. A leiratkozó-link próbában
halott példa-útvonal, hogy egy kattintás ne iratkoztassa le az igazi leadet.

**Visszafordíthatóság:** 🔄 — a szöveg és a markup egy-egy fájlban él
(`src/outreach/draft.ts`, `src/email/outreachEmail.ts`); a §C-kapu változatlanul ítél.

**Impl.:** NYITOTT — a terv jóváhagyva és befagyasztva, a kód még nem módosult.
