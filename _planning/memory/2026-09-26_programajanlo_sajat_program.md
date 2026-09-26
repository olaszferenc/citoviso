# 2026-09-26 — Programajánló: saját program a tenanttól + alapból dátum szerinti sorrend

**Kérés (tulaj, a Camping Carina képernyőjén):** „itt adhasson a tenant is hozzá üres elemet, ami
teljesen maga szerkeszt”.

## Menet
- §2b kör: két működő vázlat (A · üres kártya a listában / B · űrlap-ablak előnézettel), mobil +
  asztali, sötét/világos. A vázlat első körének MÉRT hibái (javítva a küldés előtt): mobilon az A
  belépője a rejtett fülön volt; az A-ban látszott a B gombja (`display` ütötte a `[hidden]`-t);
  a dátum-mezők 390 px-en kilógtak (431 px széles lap); a B előnézete szó közepén törte a címet.
- Tulaj: **„A)”, „a többi ok, csak a sorrend a dátumok alapján menjen!”** → kérdésre pontosítva:
  **„alapértelmezés: dátum. fel le override”**.
- Terv befagyasztva: `assets/design-refs/console/programajanlo-sajat/` (README = kontraktus);
  a régi B kontraktus ③ pontja megjelölve (módosítva).

## Megvalósítás
- `src/events/ownPrograms.ts` — EGY szabálykészlet (cím, dátumok, hely, webcím-normalizálás).
- `src/events/picks.ts` — `Pick` = gyűjtött | saját; `readOrder`, `resolvePicks(picks, pool)`
  (a pool-objektum a kört is viszi), `programsOnPage` (kéthetes ablak + dátum/kézi sorrend),
  `sanitizePicks` (mentés-út). `pool.ts` a kört (`around`) is visszaadja.
- `src/moduleConfig.ts` — poi v2 additív: `order` kulcs, `own-xxxxxxxx` pickek validálása.
- `src/server/moduleConfigViews.ts` — a választó: belépők, kártya, jelvény, „szerkesztem”,
  „dátum szerint / saját sorrend · dátum szerint rendezem”, datalist a kör településeivel.
- `src/server/public.ts` — admin-adat + mentés; `src/tenant/editor.ts` — oldal-tartalom;
  `src/engine/moduleSections.ts` — „A szállás ajánlja” sor; `src/events/ownerMail.ts` — autoCount.
- Súgó: `kb/entries/admin-modules-programs/` szöveg + kép (kb-shot fixture saját programmal).
- ADR-XXXX; DOMAIN `05-MODULES.md` poi sora.

## Őrök
- `scripts/programs-editor-check.mts` bővítve (saját program, sorrend, DB-visszaolvasás, honlapi sor,
  hamisított mentés, mobil) — zöld; negatív kontroll (honlap-szűrő + szerver-szabály visszarontva) → 2 FAIL.
- `scripts/module-config-check.mts`: a „tulaj választása ELSŐ” állítás a régi szabályt mérte →
  kézi módra szűkítve + új dátum-mód állítás.

## Nyitott
- Nincs élesítve (a nagy deployjal megy).
- A súgó képe a Javasolt fület mutatja; a „Saját ajánlás” sor nincs rajta (a szöveg leírja).
