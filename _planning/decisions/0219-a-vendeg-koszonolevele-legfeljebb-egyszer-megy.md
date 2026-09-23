## ADR-0219 — A vendég köszönőlevele legfeljebb egyszer megy ki; a vélemény-kezelő csillaga szín nélkül is igazat mond (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva, negatív kontrollokkal; nem élesítve)
· **Kapcsolódó:** ADR-0046 (a `reviews` modul: first-party, moderált), ADR-0036 (i18n-doktrína),
§2b terv-kapu.

**Kontextus — mérve.** A tenant-admin vélemény-listája (ADR-0046, 2026-08-21) három hibát hordott:
① a teli és az üres csillag UGYANAZ a „★" jel volt, csak egy sosem megírt szín választotta volna
szét — egy **1 csillagos vélemény ★★★★★-nak látszott**, és a tulaj ezzel döntött a kitételről;
② a `rev-*` osztályokhoz nem készült CSS (név, csillag, állapot egy sorba folyt; a gombsor a
következő kártyához tapadt); ③ a Google-kártya „Ez látszik most az oldalán"-t mondott kikapcsolt
kapcsolónál is. Emellett a `/admin/review/decide` útvonal egy eldöntött véleményt 'pending'-re állít
és újra dönt, a kitétel pedig mindig köszönőlevelet küldött: **a levett, majd újra kitett vélemény
írója másodszor is levelet kapott** (Google-meghívóval). Négy felirat és az `aria-label` burkolatlan
volt; az i18n-lint ÉKEZETET keres, ezek ékezet nélküliek, a pszeudo-nyelvi őr pedig ezt a képernyőt
nem renderelte.

**Döntés (tulaj, 2026-09-23).**
1. **B terv:** állapot szerint csoportosított lista (Döntésre vár · Az oldalon · Nem került ki), ★/☆
   ELTÉRŐ jellel + kiírt „N/5", ≤2★ pirosas szám; a Google-kártya a kapcsolót tükrözi, a csillagai
   úgy látszanak, ahogy a lapon (ugyanaz a kerekítés, mint a `honestStarCount`). Kontraktus:
   `assets/design-refs/console/reviews-inbox/README.md`.
2. **A köszönőlevél legfeljebb egyszer:** új oszlop `site_review.thanked_at` (migráció 0073). A küldés
   ELŐTT egy feltételes UPDATE (`WHERE thanked_at IS NULL`) foglalja le — két gyors koppintás sem küld
   kettőt; ha a küldés elbukik, a foglalás felszabadul. A tulaj a sémás megoldást választotta a séma
   nélküli helyett, mert az utóbbiban az „előbb elutasít, később mégis kiteszi" vendég SOSEM kapna
   levelet.

**Visszatöltés.** A már kitett, e-mail-címes vélemények `thanked_at`-et kapnak (megkapták a levelet).
Egy korábban kitett, azóta levett véleményről a státusz nem árulja el, kapott-e levelet — ott NULL
marad, tehát egy esetleges ismételt kitétel még egyszer küldhet, utána soha.

**Bizonyíték.** `scripts/reviews-inbox-check.mts` (böngészőben, 390/1280 px, a kapcsoló mindkét
állásában; 7 forrás-rontással pirosra futtatva) · `scripts/i18n-pseudo-check.mts` (a `reviews`
képernyő felvéve, az akadálymentes nevekkel együtt; a „Kiteszem" és az `aria-label` rontása piros) ·
`scripts/review-flow-check.mts` (levétel + újra kitétel → nincs második levél; a feltétel kivételével
piros).

**Visszafordíthatóság.** 🔄 additív oszlop; a kód nélküle nem fordul (a `schema.ts` mezője).

**Nyitott.** Az attribútum-szkennelés globálisan 4 meglévő, idegen szivárgást találna a konzolon
(„minimum", egy placeholder), ezért ma csak a `reviews` felületen fut — külön szál.
