## ADR-XXXX — A poolos kapu szívverése: a csend-korlát a pufferelt kimenetű kaput nem öli meg (2026-09-29)

- **Kiváltó:** a kapu-koordinátor (`cit3bd83952`) az ADR-0269 után jelezte a kockázatot: a `scripts/lib/gate-pool.mts`
  az egységek kimenetét PUFFERELI, és csak a végén játssza vissza (`replay`).
- **Előzmény:** ADR-0268, ADR-0269 (csend-alapú korlát), ADR-0261/0263/0264 (poolos böngészős kapuk).

**Mérve (első bájt / leghosszabb csend, stdout+stderr):**

| kapu | egyedül | 4 CPU-égetővel |
|---|---|---|
| `lead-page-surface-check` | 98,3 s / 98,3 s (az első bájt a kilépéskor jön) | 183,2 s / 183,2 s (rc 1) |
| `room-card-overflow-check` | 33,0 s / 33,0 s | 61,2 s / 61,2 s |

A poolos kapu tehát a TELJES futása alatt néma. Egy nagyobb poolos kapu terhelés alatt (a készülő poolos
`cfg-sheet-scroll`: 25 egység, ~20 perc) átlépné a 900 s-os csend-korlátot, és HAMIS PIROS lenne, pedig halad.

**Döntés:**
1. A futtató minden kapunak átad egy szívverés-fájlt: `CIT_GATE_HEARTBEAT=<jobs>/<id>.<fázis>.hb`.
2. A `gate-pool.mts` minden BEFEJEZETT egység után megérinti ezt a fájlt (`utimes`, ha nincs, létrehozza).
   A kapu kimenetéhez nem nyúl: az ítélet-sorok betűre egyeznek, ez a szerződés.
3. Szívverésnek csak a befejezett egység számít, az indulás nem. Egy örökké tartó egység így sosem ver.
4. A futtató a csendet a kimenet mérete ÉS a szívverés-fájl mtime-ja alapján méri: amelyik változik, az haladás.
5. Pool nélküli kapuban a változó nincs használva, a viselkedés nem változik.

**Őr:** `scripts/gate-runner-check.mts` J-forgatókönyv. Egy valódi `gate-pool`-t használó fixture-kapu 20 × 1 s
egységet futtat egy szálon, azaz 20 s-ig egy bájtot sem ír.
- 8 s-os csend-korlát mellett ZÖLD kell maradjon.
- A 20 egység sorának változatlanul és sorrendben meg kell jelennie.
- Visszarontás: „a szívverés ki” → piros.

**Mellékes lelet:** a `lead-page-surface-check` 4 CPU-égető alatt rc 1-gyel bukott (183 s). Ez nem ebből a
változásból ered, a mérőszkript közvetlenül futtatta. Terhelés alatti törékenységre utal, és nincs kivizsgálva.
