# 2026-11-04 — Facebook-pilot: kódos rész + minta-hét + keret-mérés

SUB (CIT `citee3f0d8f`) a koordinátornak (`cit208299e0`), brief `~/rc-briefs/facebook-pilot-20261104.md`.
A brief menet közben módosult (tulaj, 11-04): teljesen automata, a tulajnak nincs teendője, tulaj-útmutató NEM készül.

## Elvégezve
- Reels-készítő ffmpeg-gel (`src/social/reels.ts`, `scripts/reels-make.mts`); a gépre felkerült az `ffmpeg` és az `oathtool` (apt).
- Graph API-kliens v26.0 (`src/social/facebookGraph.ts`) + pilot-CLI (`scripts/fb-pilot.mts`, token a `~/.config/citoviso/fb-pilot.json`-ban, 600).
- Szabad-rés felismerő (`src/social/freeGaps.ts`) a foglalónaptár szabályával; heti adatcsomag (`scripts/social-week-bundle.mts`).
- Minta-hét a [TESZT] Matróz Üdülőház éles pillanatképéből (csak olvasás): `out/facebook-pilot/minta-het/` (+ `~/rc-briefs/facebook-pilot/minta-het/`).
- Tényhűség: 1. kör FLAG → posztok és kód javítva. Keret: $0,51 írás + $0,62 ellenőrzés / tenant / hét.
- App Review-vázlat: `_planning/facebook-pilot/APP-REVIEW.md`; összefoglaló: `_planning/facebook-pilot/README.md`.

## Módosított / új fájlok
- `src/social/reels.ts`, `src/social/facebookGraph.ts`, `src/social/freeGaps.ts`
- `scripts/reels-make.mts`, `scripts/fb-pilot.mts`, `scripts/social-week-bundle.mts`
- `_planning/facebook-pilot/README.md`, `_planning/facebook-pilot/APP-REVIEW.md`
- `MEMORY.md` (Tények és döntések: 2 sor)

## Nyitott
- A Meta-beállítás és az élő poszt-próba: a `~/.config/citoviso/facebook-owner.txt` megérkezésére vár.
- Siófok hiányzik az éles `settlement` gyorstárból (poi-modul hibája) — a koordinátor döntse el, ki javítja.
