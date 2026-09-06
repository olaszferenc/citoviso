# 2026-09-06 — Adat-éhezés felszámolása: portál-próza minden úton (ADR-0097)

## Kiindulás (tulaj-panasz)

A Pitypang Vendégház mockja sokadszor hozott generikus, fotóból írt főcímet („Fedett terasz,
tágas nappali és kádas fürdő egy csendes falusi házban"), miközben a hely valódi horgai
(dézsa, szauna, medence, borkóstolás) a portál-leírásokban és az FB-névjegyben éltek.
Tulaj-kérdés: „ezeket leszedjük? merítünk a tulaj bemutatkozásából?" → döntés: scraper-bővítés
+ leadre kézzel indítható újra-scrape.

## Diagnózis (mérve, nem tippelve)

- A lead `raw`-jában `portalProfiles: 0` — a 3 ismert listing SOSEM lett tartalomra olvasva.
- Gyökér-ok: a kézi `reenrichOne` lánc KIHAGYTA az `enrichPortal` lépést (a leírás+amenities
  olvasót) — a fő scrape-futásban benne volt, a lead-oldali gombban nem.
- Flotta-mérés: 267 élő leadből 162-nek van listing-URL-je, 45-nek profilja, 36-nak prózája,
  18-nak amenity-listája → a generátor ~85%-ban fotó-only írt.
- Másodlagos vakfolt: a tény-szótár nem ismerte a „dézsá"-t és a „jakuzzi" magyar írásmódot.
- Az őr adathiányon vak (nincs amenity → nincs strukturális mérce) — a
  `feedback_missing_data_branch_is_the_blind_branch` minta újra.

## Elvégzett munka (mind élesben igazolva)

1. **reenrichOne + enrichPortal** (`src/scraper/reenrichOne.ts`): a kézi újragyűjtés a fő
   futás sorrendjében olvassa a portált (verbose). Pitypang: 0→2 profil, a szallashirdeto.hu
   behozta a tulaj saját bemutatkozó prózáját (medence, dézsafürdő, jakuzzi, grillező,
   fedett terasz, szarvasles).
2. **booked.hu-híd** (`registry.ts` `openTwin` + `portalListing.ts`): szallas.hu/<slug> →
   <slug>.booked.hu levezetés; a twin a normál robots/entitás-kapukon megy át; a főoldalra
   átirányító (nem létező) adatlap becsületes skip-okot kap. Élő mérés (Laguna Panzió):
   63 szolgáltatás + 1594 kar leírás + 56 fotó, high 0.83.
3. **Kurátor „Tulaj-bemutatkozás" mező** (`console/data.ts`+`server.ts`+`views.ts`,
   `ownerIntro`): FB-Névjegy kézi átemelése (robots tiltja a gépit — a kéz a jogtiszta út);
   a generálásba forrásolt leírásként, ELSŐ helyen folyik be (generateEngine + recopy iker).
   Felület-kapu: tulaj-jóváhagyott kivétel (mintakövető), ui-shot mindkét méretben ellenőrizve.
4. **Szótár-bővítés** (`marketCheck.ts`): dézsa/jakuzzi/pezsgőfürdő a súly-táblában (85),
   a próza-kinyerőben és az amenity-csoportban.
5. **Író-élesítés** (`brief.ts`): a tények súly szerint rangsorolva mennek be
   (`decisionWeightDesc`), a főcím a lista ELEJÉRŐL nevez meg 1–3 tényt; az alcím (tagline)
   NEM ismételheti a hero-lead tényeit (egy lapon jelennek meg — ezt a modell nem tudta).
6. **Idézet-verifikált nyílt kinyerés** (`brief.ts` sellingPoints): a brief-hívás nyílt
   szókinccsel kinyeri a próza eladási pontjait {label, quote} párként; determinisztikus
   substring-validálás dobja a nem szó szerinti idézetet (§B.17). Eredmény: „szarvasles a
   dézsából", „helyi borok", „Balatonszárszó 4 km" — az őr 6→12 igazolt tényt számolt.

## Proof-lánc (képekkel elküldve a tulajnak)

- v1 (portál-próza): „Medence, dézsafürdő és grill a kertben, fedett terasszal"
- v2 (+ownerIntro): szekció-cím „Medence, jacuzzi és *dézsa* a csillagos ég alatt"
- v3 (+író-élesítés): H1 „Medence, dézsafürdő és jacuzzi a kertben, fedett terasszal" +
  önálló alcím „Szólád csendjében, a Somogyi-dombok ölelésében — családoknak és baráti
  köröknek." · őrök: marketing PASS (12 tény), tényhűség PASS, dizájn PASS.

## Tanulságok

- A structured-output séma a `maxItems`-t nem fogadja (400) — plafon a validátorban.
- A tulaj menet közben Fable5-re váltott és teljes újragondolást kért — a szótár-foltozás
  önmagában tünet-kezelés lett volna; a mérés (267/45) mutatta meg a valódi tőkét.
- Backfill NEM kellett (tulaj: „ez csak teszt" — az állomány teszt-adat).

## Módosított fájlok

- src/scraper/reenrichOne.ts
- src/scraper/sources/portals/registry.ts
- src/scraper/sources/portalListing.ts
- src/console/data.ts · src/console/server.ts · src/console/views.ts
- src/generator/brief.ts · src/generator/generateEngine.ts · src/generator/recopy.ts
- src/generator/marketCheck.ts
- src/i18n/catalog.json
- _planning/DECISIONS.md (ADR-0097) · MEMORY.md · _planning/memory/INDEX.md

## Nyitott kérdések

- sellingPoints súly-aszimmetria (ismeretlen címke: named-kredit igen, követelmény nem) —
  tudatos fail-safe, ADR-0097 ⑥.
- A dev-DB-be a Pitypang-leadre beírt ownerIntro teszt-adat (a tulaj valódi FB-szövege) —
  bent maradhat, a lead teszt.
