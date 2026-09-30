# 2026-09-30 — Eszkalációs ajánlat admin: koordinálás és élesítés (koordinátor cit94bb80e7)

## Mi történt
- A tulaj kérését („újrameghívás után pluszkedvezmény”) előbb félreértettem újra-kiküldésként. A pontosítás szerint
  a MEGLÉVŐ ADR-0088 §4 eszkalációs ajánlatról van szó (N. megnyitás → −P%), aminek két száma be volt égetve.
  ⭐ Lecke: ha a kért fogalom nincs a kódban, a legközelebbi LÉTEZŐ mechanizmust ajánld fel elsőként, ne újat tervezz.
- Egy SUB (`cit7785fd02`) vitte végig: §2b két mock → a tulaj az „A”-t választotta → megvalósítás → land (df3126f0, ADR-0285).
- A SUB beviteli mezőjében háromszor állt szürke prompt-javaslat („B, globális…”, „mehet a land”, „archiválhatod”);
  egyiket sem küldtem be (ESC[2m ellenőrzés).
- Élesítés: a nagy deploy (14:00, 9c71b7f3) a landot 3 perccel megelőzte, így a kör kimaradt belőle. A deploy-kapu
  (GATE 1c) tudasbazis-or verdiktet kért; az őr két körben két súgó-pontatlanságot talált (a mentés-felirat idézete),
  javítva a09dab55 + d4a85b53-ban. Az őr a harmadik körben PASS-t adott. A tulaj engedélyével `deploy-prod.sh d4a85b53 --go` →
  `prod/20260930-1433`, élesen visszaellenőrizve.

## Módosított fájlok
- `kb/entries/console-pricing/entry.hu.md` (két javítás)
- `_planning/DEPLOY-READY.md` (§4b.4 élesítve), `MEMORY.md`

## Nyitott
- A 72 h érvényesség állíthatóvá tétele → új koordináló session (handoff), brief: `~/rc-briefs/eszkalacio-72h-allithato.md`.
- Kérdés a tulajnak: a 24 h emlékeztető-késleltetés és a −25% bemutatkozó kedvezmény is kerüljön-e ugyanide.
