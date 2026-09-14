# 2026-09-14 — A MOBIL-VAKFOLT megszüntetése az Elek-mérőeszközben (ADR-0149)

**Státusz:** LANDOLVA. Élesítés NINCS (a mérőeszköz nem éles komponens).
Nyitott tétel volt: `2026-09-14_parallel_session_orchestration.md` 4. pontja.

## Miből indult

Az Elek runner indulása óta minden képet 1280 px-en készített, a tulaj viszont telefonon
dolgozik. A 2026-09-14-i teljes mátrixban **öt kiértékelő is külön leírta**, hogy a telefonos
nézetet nem tudta megítélni (FK-001, FK-004b, FK-005a, FK-005b, FK-007). Vakon javítottunk
arra a méretre, amit a tulaj használ.

## Amit szállítottunk

- **Runner:** minden lépésről KÉT felvétel — `NN.png` (1280) + `NN-mobil.png` (390), az ÉLŐ lap
  átméretezésével. `result.jsonl`: `shot` (jelentése változatlan) + új `shot_mobile`.
  A bukás-ág is kap telefonos képet (ezt az FK-005b kiértékelője külön hiányolta).
- **Összegző sor minden futáson:** hány kép készült méretenként, mennyi időbe került a
  telefonos fél, és **melyik lépésnél hiányzik** a telefonos pár (az ár sose legyen találgatás).
- **Charter:** RUN-PROMPT (banner + 1. és 7. pont), SCENARIO-FORMAT, CHARTER, BRIEF-TEMPLATE —
  mindkét képet nézni kell, a **méret-specifikus lelet önálló lelet**, a méretet ki kell mondani,
  és fel van sorolva a hét tipikus telefonos hibaosztály.
- **Jelentés (`report-html`):** a két kép egymás mellett, **megnevezve** („asztali — 1280px" /
  „telefonos — 390px"); a hiányzó telefonos felvétel KIÍRÓDIK, nem hallgatódik el.

## Döntési indokok, amik mérésből jöttek

- ⛔ **Miért nem második futás 390-en:** a forgatókönyvek mutálják a világot (FK-004 levelet küld,
  FK-005a fizetést vesz fel és tenantot hoz létre) — egy újrajátszás MEGDUPLÁZNÁ a mellékhatásokat.
- ⭐ **Miért minden lépésről, nem csak a kézi/bukott lépésekről:** a tulajdonosi rendelet (§7)
  szerint a ZÖLD képeket is használhatósági szemmel kell nézni, és a telefonos hibaosztály
  (hajtás alá eső gomb, kilógó elem) jellemzően pont a gépileg zöld lépéseken él.
- **Az átméretezés `finally`-ben áll vissza 1280-ra** — nem rendrakás: a következő lépés
  kattintásainak ugyanabban a viewportban kell landolniuk, amiben a forgatókönyveket mértük.
  Bizonyítva: mind a 36 kép a saját szélességén született.

## ⛔ Amit magam rontottam el, és mi fogta meg

1. **A `git reset --hard` alatt a watchdog GC ELVITTE a worktree-met.** A session a watchdog
   state-jében `retired: true` (tegnap archiválták), és a `wt_disposable(…, used_ok=bool(retired))`
   emiatt **kikapcsolja a „van user-üzenet" védelmet** — a tisztára tett fa (0 commit a main
   felett, nincs követetlen fájl) egy ÉLŐ session alatt eldobhatóvá vált. Semmi nem veszett el a
   verziózott munkából (a fa azonos volt az `origin/main`-nel), de **5 futás-mappa (62 kép,
   gitignore-olt) törlődött**; `LELETEK.md` nem volt bennük, a ~160 lelet máshol él (36 fájl,
   99 futás). Védekezés a fa újrahúzása után: egy követetlen marker-fájl, amíg a munka tart.
2. **Hamis következtetés a saját mérésemből:** a viewport-magasságú képeket „TALL-korlát"-nak
   olvastam, holott a lap volt rövid — a korlát-ágat az a kör **nem is érintette**. Ezért a
   terület-alapú korlátot **külön öntesztel** igazoltam (levitt korláttal mindkét méret
   viewport-képre esik), nem a zöld futásból következtettem rá.
3. **Rejtett aszimmetria a saját szállításomban:** a `magasság > 12 000 px` korlát nem
   méret-semleges (390-en ugyanaz a tartalom magasabb → a telefonos fél némán gyengébb
   bizonyíték). Terület-alapúra véve, pontosan az asztali budgettel — 1280-on ugyanaz a
   predikátum, tehát az asztali viselkedés szerkezetileg változatlan (mérve: 36/36 azonos magasság).

## Lelet a telefonos képekről (NEM javítva — külön kör)

**A `/leads` operátor-lista 390 px-en a 11 oszlopból 3-at mutat.** Mérve (a
`lead-filter-label-check` SAJÁT cut/overflow-definíciójával):

| | 1280 px | 390 px |
|---|---|---|
| görgető-doboz | client 1186 / scroll 1186 | client **320** / scroll **1070** |
| vízszintes túllógás | **0 px** | **750 px** |
| levágott cella/fejléc | **0** | **408** (16 oszlopban) |

Látható: Név · Felmérve · Terület. A látható sávon KÍVÜL: Ország, Város, Kvalifikáció, Fotók,
Anyag, Match, Kontakt, Mock — vagyis minden, amiből az operátor eldönti, mi legyen a leaddel.
⚠️ **Amit NEM mértem:** hogy egy ujjal görgető felhasználó felfedezi-e a vízszintes görgetést
(a mért 0 px-es görgetősáv overlay-scrollbart is jelenthet) — ez tervezői kérdés, nem az én mérésem.

⛔ **A tegnapi őr ugyanezzel a vakfolttal él:** a `lead-filter-label-check` állításai szó szerint
`@1280px`-et mondanak — a 0 px-es túllógás IGAZ, de csak asztalon. Az őr nem tévedett,
MÁS KÉRDÉSRE válaszolt.

## Ár, mérve

FK-003: 18 → 36 kép · futás 23,5 → **43,9 mp** (ebből telefonos felvétel 20,4 mp) · képméret
9,4 → **13,6 MB** (a telefonos rész 31 %, mert egy 390-es felvétel kb. fele akkora).
Teljes mátrix: ~110 → ~220 kép. A gépi ítélet változatlan (FK-003: 11/0/7/0 előtte és utána is).

## Nyitva maradt

1. **A `/leads` lista telefonos elrendezése** (fenti lelet) — külön kör, §2b terv-kapuval.
2. **A `lead-filter-label-check` csak 1280-on mér** — a 390-es mérés őrré emelése külön tétel.
3. **Az FK-001-et nem tudtam lefuttatni:** az ELEK-tenant hiányzik a parkból, és a lánc
   (FK-003b → FK-004 → FK-005a) **valódi LLM-generálást** indítana. A bizonyító kör ezért FK-003
   lett. Az Üzenetek fül két soros téma-szűrője telefonon **továbbra sincs megnézve**.
4. **A BRIEF-TEMPLATE.md módosítása** saját szövege szerint tulajdonosi jóváhagyást igényel —
   a változás a RUN-PROMPT-tal azonos tartalmú, a tulajnak jelezve.
5. **Infra:** a `retired` sessionök worktree-je élő munka alatt is GC-zhető (lásd fent) —
   a `has_user_msg` védelem a `used_ok` miatt nem érvényesül. Watchdog-tétel.
