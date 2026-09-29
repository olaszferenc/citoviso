# Súgó-javítás a deploy GATE 1c-hez: második kérdés, „Meglévő szobája”, KB_PATHS (2026-09-29)

SUB-szál (koordinátor: `cit92d2a67e`, „Deploy-készenlét felderítés”) · brief: `~/rc-briefs/dk-sugo-javitas.md`.
A száraz `deploy-prod.sh c96d0954` a GATE 1c-n állt meg: a tudasbazis-or FLAG-et adott a 263ef8dd..c96d0954 tartományra.

## Mit javítottunk

- `kb/entries/admin-modules-rooms/entry.hu.md`:
  - A „Nem, csak külön szobákat adok ki” válasz után a súgó azt írta, hogy „az eddigi szobája sima szobává válik”. Ez az ADR-0256 óta hamis: kötelező második kérdés nyílik (`wholeQuestion`, `src/server/moduleConfigViews.ts` ~1585).
  - A súgó most leírja a két választ („Ez az első szobám — nevet adok neki” / „Nincs ilyen szobám — rejtse el”), a futó foglalásokról szóló sort és a két literál hibaüzenetet.
  - A behelyettesített „Válassza ki, mi legyen az eddigi „{name}” egységgel.” üzenetet szándékosan nem idézi, csak körülírja.
  - A „Meglévő szobája” felirat kikerült a Szobák-képernyő leírásából: ott kártyarács van, a felirat a Foglalás-modul „Mit ad ki?” kártyáján él (`unitsCard`).
- `kb/entries/admin-modules-booking/entry.hu.md`:
  - Több szobánál a felirat „Meglévő szobái”, és a „Törlés” gomb csak több szobánál látszik.
  - Új kereszthivatkozás a Szobák súgóra a második kérdésről.
- `scripts/deploy-prod.sh` KB_PATHS: felvéve a `src/server/bookingViews.ts`, az `offerViews.ts` és a `contactViews.ts`.
  - A `contactViews.ts` az őr második körös lelete: ez az `admin.contact` horgonyt hordozza.
  - Grep szerint most minden `data-kb-anchor`-os src fájl benne van.

## Mérés

- `kb-check --coverage` zöld (39/39).
- `kb-shot --check-committed` zöld (50/50 kép friss). Új képre nem volt szükség, mert a szövegváltozás nem érint képet.
- `deploy-prod.sh --self-test` és `deploy-pipe-check` zöld a módosítás előtt és után is.
- tudasbazis-or: az 1. kör FLAG-et adott (hiányzott a `contactViews.ts`), a javítás utáni 2. kör PASS.

## Nyitott

- A PASS-tokent (`kb-gate.mjs pass`) a deploy-session rögzíti a végső tartományra, nem ez a szál.
- A KB_PATHS kézi lista, ezért egy új horgonyos nézet megint kimaradhat. Jobb lenne a `data-kb-anchor` grepből képezni: ez külön döntés, itt nem nyúltunk hozzá.
