# Ajánlat-UI kontraktus (ADR-0088 ② — „B: ár-kártya + visszaszámláló")

Tulajdonosi jóváhagyás: 2026-08-31 („B) verzió, de érdemes lenne tudatni, hogy meddig ér…
asszem abba maradtunk, hogy egyszeri tranzakció"). A `offer-ui.html` a jóváhagyott működő
vázlat; a képek a döntéskori állapotok. **Ez a terv KÖT — elvárt viselkedés, nem stílus-javaslat.**

## Amit a terv KÖT

1. **Ár-kártya a konfigurátor lábában** (aktív ajánlatnál): felül kis, áthúzott LISTA-összeg;
   alatta a FIZETENDŐ nagyban; alatta az ajánlat-sor; és MINDIG kiírt érvényesség-sor:
   „Egyszeri kedvezmény — a hosszabbítás listaáron megy." Határidős ajánlatnál a lejárat
   dátum+idő formában kiírva („érvényes {d}-ig").
2. **A kliens csak megjelenít**: a fizetendő = `floor(lista × (100−percent)/100)` — ugyanaz
   a matek, mint a szerveren (`src/payment/offers.ts applyOffer`); a terhelt összeget a
   szerver számolja és pecsételi. Amit mutatunk = amit terhelünk (§B.17).
3. **EGY legnagyobb kedvezmény** jelenik meg; kedvezmények SOSEM adódnak össze.
4. **Eszkalációs döntés-kártya** (3. látogatás, szerver-mintázta ajánlat): asztali nézetben
   középre emelt fehér kártya fátyollal, mobilon alulra horgonyzott; élő óra/perc/mp
   visszaszámláló; CTA a panelt nyitja; „Most még gondolkodom" csak a kártyát rejti el —
   az ajánlat él, és az ár-kártyában tovább látszik. Lejáratkor a kedvezmény MINDENHOL
   egyszerre tűnik el (kártya + ár-kártya), nehogy a felület olyat ígérjen, amit a szerver
   már nem terhel.
5. **Outreach-levél ár-mondata** (sima szöveg): listaár kimondva + kedvezményes ár +
   „az első díjra érvényes, a hosszabbítás listaáron megy".
6. Minden felirat fordítás-képes (`tr()` kliens / `T()` levél).

Megvalósítás: `assets/runtime/cit-configurator.{js,css}` (ár-kártya + döntés-kártya),
`src/generator/configurator.ts` (manifest-offer), `src/console/server.ts` (/p/:token
feloldás), `src/outreach/draft.ts` + `src/outreach/escalationFollowup.ts` (levelek).
