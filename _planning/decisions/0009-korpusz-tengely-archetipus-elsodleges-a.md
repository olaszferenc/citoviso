## ADR-0009 — Korpusz-tengely: ARCHETÍPUS-elsődleges (a környezet lefokozva grounding-hintté)

- **Dátum:** 2026-07-10
- **Kontextus:** az ADR-0008 a korpuszt 9 környezet × 4 minőség = 36 metszetre partícionálta. Az első
  éles pilot-demó (27 korpusz-dizájn + 4 grounded per-lead mock valós badacsonyi leadeken) empirikus
  bizonyítékot adott, hogy a **környezet mint hard-partíció gyenge tengely**:
  1. **Fuzzy határok:** a klasszifikátor a badacsonyi leadeket szórta (legtöbb borvidek, de tengerparti
     [a Balaton nem tenger] és videki is) — a 9-cellás rács egy folytonos stílus-teret vág szét mesterségesen.
  2. **A paletta a groundingnál születik:** mind a 4 grounded mock a VALÓS fotókból hangolta a palettát
     (meleg, bordó/terrakotta), függetlenül a blueprint „besütött" környezet-színétől → a környezet fő
     haszna a groundingban úgyis megvan.
  3. **A szerkezet ortogonális a környezetre:** a diverzitás az ARCHETÍPUSBÓL jött (editorial-magazine vs
     vertical-ribbon-nav vs diagonal-split-grid), nem a környezetből. Egy archetípus minden környezetben áll.
     A 27 dizájnban 21 EGYEDI archetípus — minimális redundancia.
- **Döntés — a korpusz tengelyei újrarendezve:**
  1. **ELSŐDLEGES = ARCHETÍPUS (szerkezet).** A korpusz egy növekvő, kurált archetípus-könyvtár. Nyílt
     halmaz (a generátor talál ki újat, mi rögzítjük) — NEM fix enum. Környezet-független → egy jó
     szerkezet minden környezetben újrahasznosul.
  2. **MÁSODLAGOS = MINŐSÉG (tier, tónus).** Marad 4 (egyszeru/kozep/premium/luxus): a tier valósan
     SZERKEZETET befolyásol (luxus = sok levegő, cinematic; budget = sűrű, info-first), amit a grounding
     nehezen szab át utólag; plusz tonális/jogi kockázat (budget-re luxus = félrevezető). A korpusz
     tier-particionált: `corpus/{tier}/{n}.html`.
  3. **KÖRNYEZET → NEM korpusz-tengely, hanem GROUNDING-HINT.** A klasszifikátor továbbra is ad env-et,
     de az a per-lead grounding paletta/hangulat/feature-szótár súgása (copy), NEM mappa-választás.
- **Következmény:** a korpusz nem 36×5=180, hanem ~N archetípus × 4 tier töredéke → jóval olcsóbb
  (releváns: kreditfalba futottunk), kevesebb redundancia, NAGYOBB effektív pool leadenként → *jobb*
  anti-collision. Kiválasztás: tier-szűrés → archetípus anti-collision (szomszéd-kerülés) + rotáció.
- **Migráció:** a 27 meglévő dizájn megmarad — újra-kulcsolva {archetípus, tier}-re (env elhagyva),
  `corpus/{tier}/`-be sorolva. A HTML env-ízű tartalma egy instancia; groundingnál úgyis lecserélődik.
- **Visszafordíthatóság:** 🔄 · Felülírja az ADR-0008 env×tier partícióját; a két-agent pipeline,
  grounded adaptáció, anti-collision, rotáció, usage-ledger VÁLTOZATLAN.
- **Státusz:** ELFOGADVA (a pilot-demó empíriája alapján).
