# Szállás időzónája — megvalósított terv (A), tulajdonosi utólagos ítéletre

**Állapot:** 2026-09-30. A tulaj kimondta: „kód készüljön, ne várjon a mock-jóváhagyásra” (brief:
`~/rc-briefs/szallas-idozona.md`, MÓDOSÍTÁS). Az „A” változat készült el; ha a tulaj a „B”-t választja, a tenant-admin
kártya csak-olvasható sorra cserélhető, a konzol-oldal változatlan. Kapcsolódó: ADR-0290 (a szállás időzónája),
ADR-0287/0288/0289 (a kimenő ablakok és a platform-idők Budapest szerint).

- Terv: `plan.html` (önhordó, kattintható: kereső, ország-alapérték, élő óra, figyelmeztetés, mentés; „Mobil 390px / Asztali” váltó)
- Alternatíva: `alt-b.html` („B”: a tulaj csak látja, az operátor állítja)
- Képek: `plan-desktop.png`, `plan-mobile.png`; az élő felület: `live-tenant-fiok-desktop.png`,
  `live-tenant-fiok-mobile.png`, `live-konzol-lead.png`

**Hatókör:** `src/server/adminViews.ts` · `src/tenant/zonePicker.ts` · `src/console/views.ts`

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Hely (tulaj):** a tenant-admin „Fiók” fülén saját **„Szállás időzónája”** kártya, a fiók-adatok alatt, a jogi
   adatok fölött (`#idozona`). Magyarázat: ennek az órája szerint számol minden „ma”, lejárat és a vendégnek mutatott
   időpont; alapból a szállás országa adja.
2. **Hely (operátor):** a konzol lead-oldalán az átalakított ügyfél blokkjában egy **„Időzóna”** sor (a zóna neve +
   „most HH:MM”), **„Módosítás”** nyitja ugyanazt a választót. Mindkét felület ugyanazt a renderelőt használja
   (`zonePickerHtml`), egy szabály, egy példány.
3. **A választó:** natív lista minden IANA-zónával („Bécs (Europe/Vienna)” alak, a gyakori városok magyar nevével), JS
   nélkül is működik. JS-sel: kereső (ékezet-érzéketlen, városra és zóna-névre), „Nincs ilyen időzóna…” útmutató üres
   találatnál, élő **„Most itt: … · GMT±N · a „ma” ennél a szállásnál: ÉÉÉÉ-HH-NN”** előnézet, figyelmeztetés, ha a
   választás eltér az ország alapértékétől, **„Vissza az ország alapértékére”** gomb.
4. **Mentés:** **„Időzóna mentése”** csak változás után nyomható. A szerver CSAK valódi IANA-nevet ír
   (`isValidTimeZone`); minden más (kézzel gyártott POST, üres szűrt lista) a tárolt zónát hagyja, és ezt kimondja
   („Nem mentettük: válassz egy időzónát a listából.”).
5. **Hatás:** a mentés után a szállás „ma”-ja (foglalási szabályok, naptár múlt-napjai, lejáró árak, ár-hézag, szezon-
   kérdés reggele, programok, iCal-export), a vendégnek küldött ajánlat-lejárat és a tenant-admin időpontjai ennek a
   zónának az órája szerint számolnak. A platform-dolgok (kiküldési ablakok, operátori konzol, forgalmi riport, a mi
   számláink és szerződéseink dátuma, AAM-adóév) Budapesten maradnak.

Megvalósítás: `migrations/0082_tenant_time_zone.sql` (`tenant.time_zone`), `src/text/zoneTime.ts` (`todayIn` — az
egyetlen „ma”; `COUNTRY_DEFAULT_TIME_ZONE`), `src/tenant/timeZone.ts` (feloldók, mentés), `src/tenant/zoneCtx.ts`
(nézet-kontextus), `src/tenant/zonePicker.ts`, `public/assets/ui/citui-admin.css` + `citui-console.css` (`.tzp*`).
Őr: `scripts/tenant-zone-check.mts`.
