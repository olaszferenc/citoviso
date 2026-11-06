# Facebook-modul — koordinátor-szál (2026-11-04 → 11-06, cit208299e0)

## Elvégzett munka
- Tulaj-kérdés: lehet-e automatán Facebook-oldalt létrehozni és kezelni a tenantnek. Válasz (webkeresés):
  személyes profilt nem, oldalt igen; API-val oldal nem hozható létre, böngészőben valós fiókból igen;
  posztolás Graph API-val, Reels max. 30 / oldal / 24 óra.
- Tulaj-döntések (MEMORY.md „Tények és döntések”, 2026-11-04 FACEBOOK-MODUL sor):
  - az oldalt a tulaj fiókjával hozzuk létre, a szállásadó plusz admin;
  - meglévő oldalnál a szállásadó vesz fel kezelőnek;
  - a kezelés/posztolás ne a tulaj felhasználójával menjen (rendszerfelhasználó);
  - program-posztok a meglévő `poi` modulból;
  - ⛔ TELJESEN AUTOMATA: a tulajnak semmi kézi lépése, belépést ad, a kolléga mindent beállít.
- Koncepció: `_planning/RESEARCH-2026-11-facebook-modul.md`.
- Pilot-SUB `citee3f0d8f` (brief `~/rc-briefs/facebook-pilot-20261104.md`): Reels-készítő, Graph-kliens,
  szabad-rés felismerő, minta-hét, Siófok-gyorstár javítás (migráció 0124), közelség-szabály
  (≤20 perc autó, komp nélkül). Jegyzete: `_planning/memory/2026-11-04_facebook_pilot_kod.md`.
- Mért keret: ≈ $1,1 / tenant / hét (javító körrel ~$2,0), 100 tenant ≈ a heti keret 5–9%-a.

## Módosított fájlok (ez a szál)
- `MEMORY.md`
- `_planning/RESEARCH-2026-11-facebook-modul.md`
- `_planning/memory/2026-11-06_facebook_modul_koordinator.md`
- fán kívül: `~/rc-briefs/facebook-pilot-20261104.md`

## Nyitott kérdések
1. A tulaj Facebook-belépése (felhasználó, jelszó, 2FA TOTP-kulcs) még nincs meg → `~/.config/citoviso/facebook-owner.txt` (600).
   Megérkezéskor új session a pilot-briefből: Meta-beállítás + élő kép-poszt és Reels a Citoviso saját oldalán.
2. Tulaj-döntés: a modul ára; a posztok szállásadói jóváhagyás nélkül menjenek-e ki.
3. A Magellan2 munkafa (`~/wt/magellan2`) „archivált, nem landolt” jelzése téves: a folyamat fut benne → nem töröltük.
