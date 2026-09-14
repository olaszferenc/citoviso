# 2026-09-14 — Egy leadhez EGY ÉLŐ követett link (ADR-0169): levezetve, nem tárolva

**Szál:** `wt/megkeresesszerk` (B6 / Elek FK-004, harmadik kör) · **Élesítés: NINCS.**
**Tulajdonosi döntés:** a három panel-változatból az **„A — Egy ÉLŐ, a többi archív"**.
**Kontraktus:** `assets/design-refs/console/outreach-link-live-archive/` · **Migráció:** `0068`

## Amit szállítottam

1. **Az ÉLŐ link LEVEZETETT**: a lead legutóbb létrehozott, NEM archivált linkje. Nincs
   `is_live` zászló — az második igazság lenne, amit minden beszúrásnál karban kellene tartani.
   A `0068` csak azt tárolja, ami megtörtént: `prospect.archived_at`.
2. **Az archiválás nem törlés**: a `/p/<token>` cím továbbra is megnyílik, a mért adat marad;
   csak nem ez az ÉLŐ. Megerősítést kér, és **visszavonható**.
3. **Új link előtt a képernyő kimondja**, mi lesz a mostanival — állandó sávban (JS nélkül is)
   ÉS megerősítésben; benne, hogy a korábban kiküldött cím a RÉGI linkre mutat.
4. **Kártyánként egy elsődleges gomb**; a navigáció link lett.
5. A címzett-mező a **következményt** mondja, nem azt, hogy „(opcionális)".

## ⚠️ Egy szó eltér a jóváhagyott mocktól — és ez a lényeg

A mock „**Archív** linkek (N)"-t írt. A valódi adatban viszont a régebbi linkek **többsége
sosem lett archiválva**, csak újabb készült utánuk — őket „archív"-nak nevezni **valótlan
állítás** lenne a képernyőn. A szekció ezért „**Korábbi** linkek", és az „archiválva" pirula
CSAK azon ül, amit tényleg archiváltak. A szerkezet változatlan, a README és az ADR kimondja.
**Tanulság:** a jóváhagyott terv a KONTRAKTUS, de ha a valódi adat találkozásakor kiderül, hogy
egy felirat hazudna, a §B.17 erősebb — és az eltérést KI KELL MONDANI, nem elhallgatni.

## ⛔⛔ Az őr kétszer volt zöld a ROSSZ okból — mindkétszer én írtam

**① A park minden leadjén EGY link van.** Az első futásom 100 %-ban zöld lett — miközben a
feature LÉNYEGE (több link, ÉLŐ + korábbiak, archiválás) **egyszer sem mérődött meg**. Az őr
most SAJÁT fixture-t épít: egy megjelölt lead 3 linkkel, és az **archivált a LEGFRISSEBB sor**,
hogy az archiválás élő-kiütő hatása is mérve legyen. `finally`-ben törli.

**② Az önteszt hármat állított és kettőt mért.** A „két ÉLŐ jelölés" mérgezés egy EGY-linkes
leaden **no-op** volt (nincs másik kártya, amire klónozni lehetne) — 0 piros, mégis „✅ az őr
képes pirosra menni". Most az önteszt a több-linkes fixture-ön fut, és **ágankénti számlálót**
vezet: ha bármelyik mérgezés 0 állítást visz pirosra, az **önteszt bukik**.

⭐ Ahol egy állítás nem mérhető (nincs jóváhagyott mock → nincs létrehozó űrlap), az őr ezt
**kiírja**, nem nyeli el — különben a zöld azt sugallná, hogy megmértük.

⛔ **Független referencia:** az elvárt ÉLŐ linket az őr **nyers lekérdezésből** számolja, nem a
`getProspects` `isLive` mezőjéből. Egy őr, ami a vizsgált függvényt hívja, a visszarontást is
zöldnek látja.

## ⛔ Amit mérve találtam, de NEM javítottam (külön kör)

A konzolban a `class="ghost"` gomboknak **nincs CSS-szabálya** — vagyis a „halvány, másodlagos"
szándék halott, és a gomb navy elsődlegesnek látszik. Két másik felületen is így van
(`Adatok újragyűjtése`, `Portál-fotók újragyűjtése`). A saját gombjaimhoz külön
`con-btn2` osztályt vezettem be; a `ghost` globális javítása más lapok kinézetét is átfestené.

## Amit a változás majdnem eltört

- Az `elek/scenarios/FK-004b` lépése `kattints "Tevékenység — mit csinált"` — a felirat maradt,
  de a **gombból LINK lett**. A runner locatora `a:has-text(...)`-szel kezd, tehát fog. Mérve.
- Az FK-004 `kattints "Követett link készítése"` — mostantól **megerősítést** kap, ha van élő
  link. A runner `page.on("dialog")`-ja **elfogadja** és naplózza, tehát a lánc él.
- A KB-őr zöld maradt (a súgó nem idézte a megváltozott feliratokat), az
  `elek-label-drift-check` 161 állítása szintén.

## Módosított fájlok

- `migrations/0068_prospect_archived.sql` — `archived_at` + részleges index
- `src/db/schema.ts`, `src/console/data.ts` — a mező + a levezetett `isLive` + `setProspectArchived`
- `src/console/server.ts` — `POST /prospect/:id/archive|unarchive`
- `src/console/views.ts`, `public/assets/ui/citui-console.css` — a panel „A" terv szerint
- `scripts/outreach-link-live-check.mts` — ÚJ őr (fixture + ágankénti önteszt)
- `hooks/pre-commit` — bekötve (a CSS, a data/schema és az őr saját fájlja is trigger)
- `assets/design-refs/console/outreach-link-live-archive/` — a befagyasztott KONTRAKTUS
- `_planning/DECISIONS.md` — ADR-0169
