# 2026-10-01 — Elek SZ: a mock-szöveg valódisága — vendég-kritikus, véleményből nem lesz ajánlat, magázás

**Szál:** SUB a CIT „élesi teszt” koordinátor alatt; brief `~/rc-briefs/javitas-elek-0930/sz-szoveg-valodisag.md`.
Döntés: ADR-XXXX (vendég-kritikus). Tulaj-döntések: véleményből jövő szolgáltatás = **B (középút)**; vendég-oldal **MAGÁZ**.

## Lelet (élesen mérve, csak olvasva)
A Muschel „bérelhető kerékpár / főtt reggeli / bőséges saját parkoló” NEM kitalálás: a forrás-panelben mindhárom egy angol
Google-vélemény idézetével állt — **túlfordítva** („borrowing us bicycles” → bérelhető; „Cooked breakfast” → főtt reggeli;
„Sufficient parking” → bőséges saját parkoló). A tényhűség-kapu az idézet LÉTÉT nézte, nem azt, hogy az oldal többet mond-e.
Elek „forrástalan” besorolása ezért pontatlan volt. Megszólítás: nem volt ADR; sablon 49 magázó : 1 tegező sor.

## Elvégezve
- `src/generator/guestCritic.ts` — kritikus ↔ író kör (max 2 javítás, legjobb kritizált kör megy ki), determinisztikus iker
  (megszólítás, „főtt reggeli”, „X várja a …-kat”, ál-idézet, véleményből „bérelhető/ingyenes/foglalható”), fotó-csak kifogás
  szűrő, az újraíró új szavainak listája a kritikusnak.
- Bekötés: `generateEngine.ts` (a marketing-őr UTÁN) + `recopy.ts`; perzisztált `guestCriticVerdict/Reason/Rounds/Objections`.
- `mockVerdictGate.ts`: a `guestCriticVerdict` blokkoló verdikt (hiány átmegy); konzol névcímke „Vendég-kritikus”.
- Sablon: `editorial.ts` „várjuk a leveled” → „várjuk levelét”.
- Őr: `scripts/guest-critic-check.mts` (pre-commit), 6 mutációval igazolva. DOMAIN §B.17 „VALÓDISÁG” pont.

## Mérés (4 lead: Muschel, Mandula, Artemisz, Laguna)
Fő hibaosztály minden futásban eltűnt; leadenként ~0,16–0,25 USD; teljes mock kritikussal ~0,43 USD (Laguna, bekötött úton).
Bizonyíték: `_sz-kritikus/osszevetes-vegso.html` a `~/wt/cit807c5225`-ben (nem commitolt).

## Tanulságok
- Strukturált kimenetnél egy BEÁGYAZOTT objektum utolsó string-mezője végtelen szemétbe futott (a nyelvtan után csak `}`
  jöhetett) — lapos séma + elöl egy `plan` mező oldotta meg. Az `accent` szabad szöveg-mezőként kulcsszó-listába szállt el.
- `claude-opus-4-8`: a `temperature` tiltott (400) — szórás ellen a legjobb-kör választás és a gépi szabályok maradnak.
- Az újraíró néha új hibát szül (reggeli a kertben, túravezetés, újra „ingyenesen”) — ezért a végső szó a kritizált köré.

## Nyitott
- Az editorial-skin magazin-játéka (Szerkesztőség, Nyomtatva a világhálón, drop-cap) és az ADR-0218 minta-programok: külön terv.
- A megváltozott sablon-mondat idegen nyelvű fordítását a pack-guard pótolja (addig magyar fallback).
- Élesítés: a koordinátoré, a tulaj engedélyével.
