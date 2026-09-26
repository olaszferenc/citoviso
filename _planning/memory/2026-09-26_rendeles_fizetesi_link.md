# Rendelés → fizetés a vevő szemével: őszinte képernyő, vevő-levelek, tartós fizetési link (2026-09-25/26)

**Státusz:** kész, landolva a main-re (utolsó: `a0b2c4cb`), **NEM élesítve** (a nagy deployjal megy).

## Kiindulás (tulaj-bejelentés)
A tulaj a konzol-újraindulás pillanatában nyomta meg a „Fizetek” gombot: a konfigurátor azt írta,
„Megkaptuk a rendelését… kollégánk felveszi Önnel a kapcsolatot”, miközben **nem készült
order_intent és nem ment riasztás** (proxy 502 → nem-JSON → `{}` → `showThanks()`).
„És erről mint Citoviso nem kaptam értesítést.”

## Elvégzett munka (öt commit, mind landolva)
1. **Konfigurátor** (`assets/runtime/cit-configurator.js`): a köszönő képernyő CSAK `ok:true + pending:true`
   válaszra; minden más → `showSendFailed()` (semmit nem rögzítettünk, nem terheltünk, adatok maradnak,
   gomb újra él), `order_send_failed` esemény a lead-idővonalon. Őr: `scripts/order-send-failed-check.mts`.
2. **Vevő-levelek** (`src/email/orderEmail.ts`, `src/console/orderMail.ts`): ① visszaigazoló a pay-link nélküli
   ágon; ② a konzol „Fizetési kérés küldése ▸” gombja eddig csak DB-be írt — most kiküldi. E4 logó CID,
   Reply-To = SUPPORT_EMAIL, I18N_SOURCES-on. Őr: `scripts/order-mail-check.mts`.
3. **Leiratkozott ár** (ADR-0112 módosítás, tulaj döntése): a lap listaárat mutatott (6 840), a szerver
   kedvezményeset terhelt (5 130). Most az ajánlat mindkét ágon feloldódik; leiratkozottnál `offerQuiet` →
   nincs döntés-segítő kártya. Őr: `scripts/optout-offer-price-check.mts` + `optout-carrier-check` átírva.
4. **Tartós fizetési link** (ADR-0234): a levél nyers Barion-linkje 30 perc után „Lejárt fizetési tranzakció”
   volt, és a pending-újrahasznosítás ugyanazt a halott linket adta vissza. Most minden levél (rendelés,
   megújítás/felszólítás + SMS, domain-lezárás) `/pay/go/<fizetés-id>`-t visz (`src/payment/payEntry.ts`,
   `payEntryUrl.ts`). Őr: `scripts/pay-entry-check.mts`.
5. **Már-vásárolt lead** régi rendelésének linkje: „Ezt már megrendelte” lap, riasztás NINCS; a valódi
   megrekedt ágon a riasztás a lead nevével, rendelésenként óránként egyszer.

## Igazolva
- Barion sandbox-fizetés a levél tartós linkjéről végig: Villa Suzy Zamárdi, 3 420 Ft → `paid` → tenant +
  belépés (`o.laszferenc@`) + OV-2026-58 számla (`olaszferenc@`).
- Visszaigazoló + fizetési link levél valódi SMTP-vel a tulaj Gmailjébe, logóval.

## Tanulságok
- **Tesztalanyt előbb ellenőrizni**: az Aranykagyló 36 leadje már vásárolt → a tulaj hamis megrekedt-rendelés
  riasztást kapott (kétszer). Ebből lett az 5. pont.
- **ADR-XXXX a `hooks/pre-commit`-ben** kétszer buktatta a landot (a land ezt a fájlt nem írja át) — már a
  memóriában volt; szám nélküli hivatkozás kell.
- A hideg levél cím-szintű egy-lövés őre a Gmail pontos változatait egy postaládának veszi — új teszt-levélhez
  nem ad kiskaput (helyesen).

## Nyitott
- A Villa Suzy siteShot: a portál nyitóképe kétszer nem töltött be (valószínűleg a rothadó portál-URL).
- Dev DB-ben maradtak teszt-rendelések/fizetések (Éden, Aranykagyló, Villa Suzy) — a Villa Suzy és az Éden
  most „élő” tenant.
