# 2026-11-04 · Portál-naptár bemutató (videó + leírás képekkel) a foglalás-modulban

**Kiváltó ok:** a telefonos kérdések közül ez volt a leggyakoribb: hogyan kell összekötni a portál (Booking.com / Szállás.hu / Airbnb) naptárát a Citovisóval (brief: `~/rc-briefs/port-l-integr-ci-20261103-101357.md`).

## Tulaj-döntések (sorrendben)
- 11-03: a rajzos vázlatot elvetette („ez így nagyon fos”). Leírás ÉS videó kell, valós képekkel.
- 11-03: a videó túl gyorsan ugrott a lényegnél („mit hol lehet megtalálni”) → ráközelítés, keret és megállás minden menüpontnál.
- 11-03: az Appartman YouTube-videói (XNl6bDXI6Lg, RR4--pjRf9g) a minta: szakaszkártyák a menüúttal és szobánkénti zárókártya. Beágyazni nem lehet őket (versenytárs-márka).
- 11-03: „a video alatt legyen audió is” → magyar narráció, helyi Piper TTS (Anna hang), $0.
- 11-04: „ok jó így, haladjunk” → beépítve.
- 11-04: „mehet az élesítés” → már élesen volt: a 20:38-as deploy (`73da1b4b`, prod/20261104-2038, más szál) kivitte; élesben ellenőrizve: 39 fájl, a webm Range-kérésre 206, a webp 200.

## Elkészült
- `src/server/portalGuide.ts`: portálválasztó, „Videó” / „Leírás képekkel” nézet, nagyítás. A videó csak `hu` nyelvnél jelenik meg. Bekötve a `moduleConfigViews.ts` `portalSyncCard`-jába (a portál-dobozok fölé), a CSS a `MODCFG_STYLE`-ban.
- A public szerver (`src/server/public.ts`): `.webm` MIME, valamint `serveVideo()` HTTP Range/206 kiszolgálással (enélkül nem lehet tekerni, és Safarin nem indul).
- `public/assets/help/portal-naptar/`: 6 videó (VP9+opus, 2,8–7 MB) és 33 webp.
- `scripts/portal-guide/`: felvevő, terv, hang, keverés + README. Gate-listák: `scripts/i18n-sources.mjs`, `scripts/kb-check.mts`.
- KB: `kb/entries/admin-modules-booking/entry.hu.md`, új bekezdés a bemutatóról.
- Terv befagyasztva: `assets/design-refs/console/portal-bemutato/README.md` + képek.

## Ellenőrzés
- Valódi admin, mobil és asztali méret: a Range-kérés 206-ot ad, a videó betölt és 60 mp-re tekerhető, a portálváltás a megfelelő fájlt tölti be, 7/7 lépéskép él, a nagyítás nyílik és zárul. JS-hiba és 4xx nincs.
- Lintek: i18n, katalógus, design-token és kb-check zöld; tsc tiszta.

## Nyitott
- ⚠️ Élesen így ment ki (a tulaj tudtával): a portál-oldali képek harmadik fél súgóiból valók (Appartman, Plum Guide, Rental Ninja, szallaskeres.hu), licenc nélkül → saját portálfiókos felvétel kell (`scripts/portal-guide/README.md`).
- Hangminőség: Piper „Anna”. A tulaj jóváhagyta, cserélhető (`VOICE=berta|imre`).
- A Booking-képek angol felületűek.
