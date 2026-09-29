## ADR-XXXX — A következő négy lassú böngészős kapu is a közös poolon mér (`room-card-overflow` · `configurator-float` · `configurator-placement` · `whole-only-guest`); a `mobile-chrome --selftest` kimarad (2026-09-29)

- **Kiváltó (tulaj, 2026-09-29):** „Ok a és b” — a „B” opció a koordinátor (`cit3bd83952`) javaslatából:
  a következő öt lassú kapu párhuzamosítása. Brief: `~/rc-briefs/ot-lassu-kapu-parhuzamositasa.md`.
- **Előzmény:** ADR-0261 (`mobile-chrome-check` 4 munkással), ADR-0263 (közös `scripts/lib/gate-pool.mts`).
  A `gate-pool.mts`-hez nem kellett nyúlni: a négy kapu a meglévő `pool()`/`out()`/`err()`/`replay()`-t használja.

**Döntés**

1. **`room-card-overflow-check`:** a (szélesség, lap) párok a poolon; munkásonként és szélességenként
   saját lap (a soros futás is egy lapot használt szélességenként). A lapok a pool ELŐTT íródnak a
   futás saját `mkdtemp`-jébe, a pool csak olvas. Az önteszt két mátrixa ugyanígy.
2. **`configurator-float-check`:** a fixture-ek ELŐBB, sorosan íródnak (munkafa-kulcsú `_cfgfloat-<fa>`);
   a sablonok egységként a poolon (a `measure()` eddig is mérésenként SAJÁT kontextust nyitott), a négy
   önteszt-mérés (②③④) egy második poolon, a verdiktek az eredeti sorrendben. Az időkeretek
   (`LOAD_SLACK_MS`) VÁLTOZATLANOK — hét párhuzamos sessionre méretezték, négy kontextus ezen belül van.
3. **`configurator-placement-check`:** a 19 sablon-betöltés és a három forgatókönyv (kapcsolók, csomagok,
   régi artifact) mind a SAJÁT frissen írt `mkdtemp`-fájljára navigál → független egységek; a hosszú
   csomag-bejárás áll a sor ELEJÉN (különben ő lenne a farok). A kiírás a soros sorrendben. Tárhelyet
   (`localStorage`/cookie) a konfigurátor nem használ — a közös lap elvesztése nem visz el állapotot.
4. **`whole-only-guest-check`:** a soros ciklus szélességenként ÚJRA renderelte ugyanazt a fájlt — két
   munkás egymás alatt írta volna. Most minden lap EGYSZER, a pool előtt renderelődik; a (szélesség,
   sablon) egységek csak olvasnak. A képek neve (sablon, szélesség) szerint egyedi, mint eddig.
5. **Eredmény nélküli egység = hangos bukás** mind a négyben („⛔ a mérés nem futott le”; a
   whole-only-ban az egység mindhárom mérése bukottnak számít).
6. **KIHAGYVA — `mobile-chrome-check --selftest`:** már ADR-0261 óta 4 munkással fut (18 egység), ÉS
   `self-overlap-safe`, vagyis a futtató a fő futással (183 s) EGYMÁS MELLETT indítja — a kritikus úton
   nincs rajta. Több munkás csak a párhuzamos kapuktól venne el magot. Nem változott.

**Audit — közös írt állapot:** scratch-DB, közös `sites/`, port: egyik sem. A float-kapu a DB-ből csak
olvas (`mock_artifact` id), a fájljai munkafa-kulcsúak; a többi a saját `mkdtemp`-jébe ír. Önátfedés-
jelölés nem kell: a hook mind a négyet egyszer hívja (önteszt nincs a hookban).

**Mérés (egyedül; a gépen közben idegen land-ok, load 6–29 / 8 mag):**

| kapu | előtte (soros) | utána 1 | utána 2 (load ~28) |
|---|---|---|---|
| `room-card-overflow-check` | 111 s | **34 s** | 56 s |
| `room-card-overflow-check --selftest` (nincs a hookban) | 230 s | **68 s** | — |
| `configurator-float-check` | 86 s | **32 s** | 60 s |
| `configurator-placement-check` | 61 s | **39 s** (a csomag-bejárás egymaga 32 s) | 52 s |
| `whole-only-guest-check` | 50 s | **26 s** | 42 s |

- **Ítélet-sorok:** a négy kapu teljes kimenete betűre azonos a soros futáséval. Normalizálva: a
  float-kapu „(N ms a görgetéstől)” ideje és egy `y=` koordináta (a becsúszó pirula mintavételi
  pillanata; ✓ mindkétszer), a room-card önteszt aurora/asztali leletének `@[x,y]` pontja
  (`[334,554]` ↔ `[341,555]`; a lelet-szám és -fajta azonos).
- **Negatív kontrollok párhuzamosan is pirosak:** room-card önteszt 15/0/11 és 32/32/0 piros (= soros);
  float ②③ (páncél nélkül kiesik; átlátszó pirula) minden futásban; whole-only kontroll (egyben IS
  kiadó ház) minden futásban piros — különben „KONTROLL” sor bukna.
- **Nyitva:** a `configurator-placement` plafonja a csomag-bejárás (32 s, állapotot visz csomagról
  csomagra, a visszaút a lényege) — nem bontható.
