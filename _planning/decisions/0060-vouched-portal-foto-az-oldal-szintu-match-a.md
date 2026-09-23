## ADR-0060 — Vouched portál-fotó: az OLDAL-szintű match a bizalmi horgony + a legélesebb kép a hero

**Dátum:** 2026-08-23 · **Státusz:** elfogadva (tulaj) · **Visszafordíthatóság:** 🔄

### Kontextus

Az ADR-0050 800px-es méret-padlója a téves tulajdonítás (falusi templom = kemping-hero) ellen
kalibrálódott — de a Villa Rubin-eseten kiderült az ára: a szallas.hu (ahol a nagy galéria van)
Cloudflare-védett és szándékosan nem scrapeljük, a nyílt portálok (hovamenjek, apartman) pedig
CSAK kis derivatívát szolgálnak (≤574px) → a padló a lead TELJES valós galériáját eldobta, a
mock 6 Places-képre szorult. Első próbálkozásként fájlnév-egyezéshez kötöttük a lazítást; a
tulaj kapta el, hogy ez fölösleges bonyolítás, és kizárja a numerikus fájlnevű valódi galériákat.

### Döntés

1. **A bizalmi horgony az OLDAL-szintű verifikált match:** ha a listing high-band (a dedikált
   adatlap igazoltan a leadé), a galériája a szállásé — a fotói `vouched` jelet kapnak, fájlnévtől
   függetlenül. A vouched fotó méret-padlója **400px** (a 800 helyett); minden más szabály
   (arány, URL-deny, scenery, hirdetés-méret) változatlanul él. A szemetet az oldalon a meglévő
   generikus lánc szűri: `ownContentOnly` + URL-deny + caption-check + a 400px padló (a
   „kapcsolódó szállások" widget-thumbok kicsik).
2. **Méret-upgrade CSAK verifikálva:** `PortalAdapter.largestPhotoUrl` a portál legnagyobb
   derivatívájára írhatja át a kép-URL-t, de az átírt URL-t `probeImageSize` igazolja — ha nincs
   (404), az eredeti marad. (A vak átírás mérve törött URL-eket tárolt: a „mérhetetlen → megtart"
   irgalmi ág átengedte őket.)
3. **A legélesebb kép a hero:** a gated fotókészlet `longEdge` szerint csökkenően rendeződik
   (portál = mért méret, Places = névleges 1200px; stabil rendezés). A Places a portál-készlet
   mérete mellett IS feloldódik — különben nagy-felbontású hero-jelölt sincs.

### Kikényszerítés

`photo-quality-check` kétirányú esetei: vouched 574px + numerikus-WP 500px MEGTART; ugyanaz
vouched nélkül ELDOB (a lazítás opt-in); vouched 242px ELDOB (a padló él); vouched szalag-arány
és deny-listás út ELDOB (a vouch csak a méret-padlót lazítja); largestPhotoUrl csere + no-op.

### Következmények

- Villa Rubin: 0 → 8 portál-fotó + 6 Places; a hero az 1200px-es Places-kép.
- A már legyártott mockokra nem propagál (snapshot) — újragenerálás kell.
- A 400px-es kép hero-nak lágy; a rendezés emiatt teszi a nagyobb Places-képet előre.

### Visszafordíthatóság

🔄 A `vouched` flag és a rendezés additív; a RELAXED_MIN_LONG_EDGE visszaemelése egyetlen
konstans, a régi viselkedés (800px mindenre) a flag kiosztásának törlésével visszaáll.
