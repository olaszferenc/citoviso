## ADR-0058 — Hiányzó/törött kép = DIZÁJNOS kitöltés, sosem üres doboz vagy alt-szám

**Dátum:** 2026-08-23 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0027 (template-first),
ADR-0057 (template-natív modul), 03-INVARIANTS §B.17 (tényhűség) + §I (nincs bait-and-switch);
tulajdonosi rendelet: „kép nélküli oldal SOHA" ([feedback_dont_reask_decided_photo_policy]).

### Probléma (tulaj, 2026-08-23, a Villa Rubin mockot tesztelve)

1. A szoba/unit-kártyák **üres placeholder-dobozként** jelentek meg, ha az egységnek nincs fotója
   (a `SAMPLE_ROOMS` mintaszobák sosem hoznak képet). „A paraszt azt hiszi, úgy fog kinézni."
2. A galériában **1,2,3,4 számok** — a tárolt Google Places fotó-URL-ek **lejárnak**, és a törött
   kép helyén a böngésző az `alt`-ot mutatja, ami `"<név> — N. kép"` → csupasz szám a lapon.

### Döntés

1. **Server-oldali `photoFill()`** (templateKit.ts): a fotó nélküli kép-slot egy token-témázott
   DIZÁJNOS panelt kap (lágy akcent-gradiens + halvány vonalas ikon), **nem hamis fotót** (§B.17 —
   a mintaszobák minta-címkével). Minden template, amely SAJÁT szoba-kép-slotot rendel (`r.photo`),
   ezt használja az üres ágon. Egy forrás, block-fill (nem `absolute`) → minden keretben robusztus.
2. **Futásidejű törött-kép kitöltő** (render.ts, minden oldalba injektálva egyszer): bármely `<img>`
   `error`-ra (és a már betöltéskor törött képekre) UGYANAZT a dizájnos panelt teszi be. Így egy
   lejárt Places-URL sosem csapódik le alt-számként. Framework-mentes, ~10 sor.
3. **Minden szín a `--cit-*` tokenekből** (design-token-doktrína); nincs nyers hex.

**Kikényszerítés (module-render-check):** (a) minden `r.photo`-t rendelő template forrása
tartalmazza a `photoFill(`-t (nincs üres-doboz-regresszió a 17. template-ben sem); (b) minden
renderelt oldal viszi a `data-cit-filled` futásidejű kitöltőt. Mindkettő PIROSRA tesztelve.

### Következmények

- A mock, amit a lead lát, sosem mutat üres kép-dobozt vagy csupasz galéria-számot — a „wow" sérülése
  megszűnik. Screenshot-verifikált 8 szoba-kép-template + törött-URL szimuláció (galéria/hero/kapcsolat).
- ⚠️ **Snapshot-drift:** a MÁR legyártott mockokra/tenant-snapshotokra ez nem propagál automatikusan
  ([reference_snapshot_rerender_propagation]) — determinisztikus újrarenderelés kell az `inputs`-ból.

### Visszafordíthatóság

🔄 Additív és token-alapú: a `photoFill` és a futásidejű kitöltő elhagyható visszaesés nélkül;
valós fotó jelenlétében egyik sem aktiválódik.
