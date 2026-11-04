# Facebook-pilot — állapot (2026-11-04, CIT citee3f0d8f)

Brief: `~/rc-briefs/facebook-pilot-20261104.md` (teljes automata, a tulajnak nincs teendője).
Háttér: `_planning/RESEARCH-2026-11-facebook-modul.md`.

## Kész (kód, $0, helyi gép)

| Mi | Hol | Igazolva |
|---|---|---|
| Reels-készítő: 2–10 fotó → 1080×1920, 15–30 mp, lassú zoom (váltakozó be/ki), áttűnés, felirat az elején/végén, a fekvő fotó EGÉSZBEN látszik elmosott háttér előtt; zene csak licencfájllal, különben néma AAC-sáv | `src/social/reels.ts`, `scripts/reels-make.mts` | 20 mp-es render 6 fotóból, H.264 high / yuv420p / 30 fps / AAC 48 kHz, ~90 mp CPU-n, 8 MB |
| Graph API-kliens (v26.0): rendszerfelhasználó-token → oldal-token, token-vizsgálat, szöveg-, kép- (`caption`) és 3 fázisú Reels-poszt, státusz, törlés; a token sosem kerül hibaüzenetbe | `src/social/facebookGraph.ts`, `scripts/fb-pilot.mts` | típusellenőrzés; élő hívás a Meta-beállítás után |
| Szabad-rés felismerő a foglalónaptár SAJÁT szabályával (`getBlockedDaysFrom`: ADR-0114 egész ház ↔ szobák, ADR-0049 szezon); `openEnded` = a rés a lekérdezési ablak végén zárul, ott nem ér véget | `src/social/freeGaps.ts` | egységpróba kézzel |
| Heti adatcsomag a szövegírónak: szabad rések, élő poi-választások (ha egy sem él: a modul jelöltjei `fromPool` jellel), foglalási szabály = ISMERETLEN, távolság szándékosan nincs | `scripts/social-week-bundle.mts` | éles pillanatkép (csak olvasás) |
| App Review-szöveg + képernyővideó-forgatókönyv | `APP-REVIEW.md` | vázlat |

## Minta-hét — [TESZT] Matróz Üdülőház (éles teszt-tenant, csak fájl, KI NEM ment)

Fájlok (gitből kizárva): `out/facebook-pilot/minta-het/` — `matroz-reels.mp4`, `1-reels.md`, `2-program.md`,
`3-szabad-idopont.md`, `forrasok.md`, `adatcsomag.json`; másolat: `~/rc-briefs/facebook-pilot/minta-het/`.
A fotók Google Places-képek → csak demó.

Tényhűség (`tenyhuseg-or`): első kör **FLAG** — kitalált „távozás legkésőbb nov. 25.” (a rés csak a
21 napos ablak vége), túlígérő „bármelyik napon érkezhetnek” (foglalási szabály nincs az adatban),
félrevezető km-ek. Javítva a KÓDBAN (koordinátor, 11-04):
- `openEnded` + `freeWeekends` (péntek–vasárnap teljesen szabad hétvégék) → a poszt konkrét, igaz dátumokat mond;
- program csak a saját településről vagy ≤ 20 perc autóútról, KOMP NÉLKÜL (`src/social/proximity.ts`, OSRM, $0):
  Siófokról Tihany 35 perc kompal → kiesik; Balatonföldvár 18, Balatonszárszó 20 perc → marad;
- a Siófok-hiba javítva (0124 `settlement_cover`), a saját település Siófok.
Második kör (újraírt 2. és 3. poszt): **PASS**.

## Keret-mérés (pipemeter árai, a subagent-átiratokból)

| Lépés | API-$ |
|---|---|
| Szövegírás (3 poszt + forrás-lista, tiszta kontextusú ülés) | 0,51 |
| Tényhűség-ellenőrzés | 0,62 |
| Javító kör (2 poszt újraírása $0,46 + újra-ellenőrzés $0,37) | 0,83 |
| **Tenantonként / hét** | **≈ 1,1** ha az első kör átmegy (a javított adatcsomaggal ez a várható) · **≈ 2,0** ha javító kör kell |
| 100 tenant / hét | ≈ 110–200 = a heti keret (~$2 275) **~5–9 %**-a |

Valós pénzben (1 API-$ ≈ 2 cent): ~2 cent / tenant / hét. A Reels-render és a közzététel kód, $0.
A becslés ($1–3) alsó szélén. A pipeline mellett (heti ~59 %, 11-04) 100 tenant belefér.

## Leletek a meglévő rendszerről

- **A Siófok hiányzott az éles `settlement` gyorstárból** → a programajánló (`poi`) a siófoki szállásnál
  Zamárdit vette saját településnek. Ok: a gyorstár „meleg” volt, ha a körben bármi volt. JAVÍTVA (0124
  `settlement_cover`, `circleCovered`), élesen a következő deployjal; a weboldalak programlistája (km a
  saját településtől, légvonal) ettől még légvonal marad — a posztok autóutat használnak.
- A [TESZT] Matróz `poi`-választásának mind a 10 programja lejárt → élesben a program-poszt a tenant új
  választására várna.

## Nyitott (Meta-oldal — a hitelesítő fájlra vár)

`~/.config/citoviso/facebook-owner.txt` 2026-11-04 16:25-kor még nincs a gépen. Utána: belépés a tartós
Chrome-profilba → Citoviso üzleti portfólió → a Citoviso saját oldala a portfólióba → fejlesztői app
(„Manage everything on your Page”) → rendszerfelhasználó + oldal + app hozzárendelés → token
(`~/.config/citoviso/fb-pilot.json`, 600) → `fb-pilot.mts check` → 1 kép-poszt + 1 Reels → törlés.
Kutatás szerint saját portfólió oldalára **Standard Access elég** (App Review + üzleti ellenőrzés csak más
cégek oldalaihoz); a Meta-dokumentáció itt ellentmondásos, a pilot élőben dönti el.
