# 2026-09-23 — Több terv egy követett linken (tervváltó) — a `feat/multimocktabs` ágon, a pilot UTÁN megy a main-re

## Honnan indult

A tulaj kérdése: „mekkora meló, hogy ha több generált mockot hagy jóvá a kurátor, akkor a tenant a linkjét
megnyitva tudjon tabon váltva a mockokat változtatni?” Mérve: a kurátor MÁR MA is sok tervet generál egy leadnek
(dev: 3,00 artefaktum/lead; Villa Suzy: 19 terv egy futásban), és egyet küldünk ki — a többi generálás kifizetve,
eldobva. A fal: „egy leaden egy jóváhagyott mock” (0064, `curateArtifact`) — szándékos, mért hibára született.
Megoldás: **elsődleges + alternatívák**, nem N egyenrangú approved.

## ⛔ Hol él és miért nem a main-en

- Ág: **`feat/multimocktabs`**, fent az originen (`4429acb3`). **A `land.sh` erre NEM fut.**
- Tulajdonosi döntés: **a pilot elindulása UTÁN** kerül a main-re. A main-ről megy az élesítés, és bár a kód
  alvó (kurátori felület nélkül minden link egy-tervű, a levél bájtra a mai — mérve), a pilot kritikus
  küldési útját (e-mail/SMS/MMS claim) is módosítja. A tulaj: „tényleg ez a rész megvan, de az infrastruktúra
  további részei hiányoznak… akkor tök igazad van!”
- Döntés: `_planning/decisions/XXXX-tobb-terv-egy-kovetett-linken.md` **az ágon** (a számot a merge-kori land adja).

## Mi van kész az ágon (6 commit)

1. **Jóváhagyott terv** — `assets/design-refs/prospect-page/plan-tabs/` (README 22 ponttal + „Eldöntve” +
   a megkeresés jóváhagyott szövege). Négy §2b-kör: A változat, vékony sáv (mobil 116 px, asztal 44 px egy
   sorban), képes gombok sorszámmal, véges felvillanás, lap alji „Tetszett?” blokk. Egy-tervű lap: változatlan.
2. **A lead lapja** — `prospect_variant` (0071), `/p/<token>/v/<n>`, `src/console/planSwitcher.ts`, a rendelés a
   nézett tervhez kötve, a tervváltás folytatja a látogatást (`?s=<viewId>` — különben az ADR-0088 §4
   „3. látogatás” kedvezmény másodpercek alatt kijönne), `plan_view` esemény.
3. **A megkeresés szövege** — „{név} – N honlap-terv”, többes szám, képaláírás, rövid SMS-formák; egy tervnél
   a levél és mindkét SMS **bájtra azonos az origin/main-ével** (temp worktree-ben mérve).
4. **A jog/provenance-őr hat lelete zárva** (három kör, végül PASS): megajánlás után a terv áll (elutasítás,
   törlés, nyitókép-csere, szöveg-újraírás ellen); zár BÁRMELY csatorna claimjénél + tervszám-újraszámolás a
   claim tranzakciójában; a csatolás eltérő sablont + azonos fotókészletet követel. A szabályok saját,
   szövegmentes modulban: `src/outreach/planSet.ts` (a levél-lánc ne húzza be a konzol `data.ts` operátori
   szövegét az i18n-hatókörbe — az i18n-scope kapu fogta meg).
5. **Őrök (pre-commit)** — `scripts/plan-switcher-check.mts` (renderelt lap, 234 állítás, hat piros önteszt),
   `scripts/plan-variants-check.mts` (valódi dev DB, eldobható sorok, piros próbákkal),
   `scripts/outreach-gate-selftest.mts` bővítve.

## Nyitva (a következő szelet)

- **Kurátori felület:** alternatívák csatolása a konzolon (ma csak kódból) — konzol-felület → **§2b terv előbb**.
  Új adat-szabályok, amiket a felületnek ki kell mondania: max. 2 alternatíva, eltérő sablon, azonos fotókészlet,
  csatolás után fagy (nyitókép-csere/szöveg-újraírás tilt), claim után zárol.
- A rendelés-gomb (`cit-cfg-launch`) ütközés-kerülése a lap alji kártyákkal (kontraktus §F.20) — ma fölfelé
  menekülne előlük.
- Súgó-cikk a kurátornak (tudásbázis-őr), az eszkalációs utólevél többes száma (nem volt a jóváhagyásban →
  ma `planCount: 1`, változatlan).
- `deleteArtifact` ellenőrzés→törlés közti szűk verseny (a jog-őr szerint nem sértés, maradék).
- **Merge-kor:** a 0071-es migráció sorszáma a main-en közben foglalt lehet — a futtató fájlnév szerint tart
  nyilván, minden utasítás idempotens, de érdemes átszámozni. Rebase: a `server.ts`/`data.ts`/`draft.ts`
  gyakran mozog.

## ⚠️ A pilotot érintő, EZTŐL FÜGGETLEN leletek (a main-en élnek)

- A követett lap jogi láblécében **„Olasz Ferenc e.v..”** (dupla pont): a `senderSentence()` pontot tesz egy
  ponttal végződő név után (`src/console/prospectNotice.ts`). Élesben is így van.
- Gyanú, **NEM mérve élő lapon**: az „Ez lehet az Öné” gomb (`cit-cfg-launch`, bottom 24 px) a lap legalján
  ráülhet a jogi lábléc **Leiratkozás** linkjére — a gomb csak a ≥100×32-es kitöltött/keretes elemek elől tér
  ki (`cit-configurator.js` `blockingRects`), a szöveges linkek elől nem.

## Tanulság

- **Az idegen őr szó szerinti mintára kötött** (`optout-carrier-check`: „tracked\n        ? await recordView(”):
  az átszervezésem elbuktatta, pedig a viselkedés azonos volt → a védett szerkezetet szó szerint megtartottam,
  az idegen őrt nem írtam át.
- A jog-őrt **addig kell visszaküldeni, amíg PASS**: minden javítás után talált új, valódi utat (törlés,
  újragenerálás) — egy kör nem lett volna elég.
- A saját piros-ágam is hibás lehet: a „vastag sáv” rontásom hatástalan volt (ugyanabban a szabályban a
  későbbi `padding` felülírta) — a zöld önteszt előtt a rontást is meg kell nézni.
