## ADR-0310 — Séta-jelzés a konzolon: ha a „Séta a kapun át” nem sétál, a választó, az előnézet és a mock-kártya kimondja; a sablon választható marad (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (tulajdonosi döntés: „A”, a koordinátoron át; SUB K2) · **Forrás:** Elek 2. élesi köre, S-1 (KÖZEPES) ·
**Kontraktus:** `assets/design-refs/console/walk-readiness/` (plan.html + README) ·
**Kapcsolódó:** ADR-0304 (Séta a kapun át; kevés tárgynál a séta elmarad — VÁLTOZATLAN), ADR-0309 (a K2 másik két lelete).

**A lelet.** A Muschel 6 fotójából (`pool_garden ×2, exterior ×3, interior`) a kollázs után nem maradt 3 különböző tárgy, a
„Séta a kapun át” mock séta nélkül, egyhasábos lapként készült — és erről a konzol sehol nem szólt: a választó „ragadós
séta-jelenet a fotókból” néven kínálta, a kész kártya hallgatott. Dev-korpuszon: 24 leadből 13-nál marad el (ADR-0304).

**Döntés (tulaj: A — figyelmeztet, választható marad; elvetve: B — kiszürkítés „Mégis kérem” gombbal).**
1. `walkReadiness(photos)` (`walkThrough.ts`): `ok` / `short` / `unknown` (nincs tárgy-ítélet), a megmaradt és a csak-kollázs
   tárgyakkal. A sablon és a jelzés KÖZÖS `walkCollage`-ot használ — a jelzés nem tud mást mondani, mint amit a lap rajzol.
2. A konzol négy helyen mondja: címke a kinézet-kártyán („Séta: nem áll össze (N/3)” / „Séta: előre nem tudható”),
   magyarázat a választó alatt a kártya bejelölésekor (a lap saját lépés-címeivel), figyelmeztetés az előnézet alatt,
   és „Séta” sor minden Séta-mock kártyáján („N lépés” / „elmaradt — N fotó-tárgy, 3 kell”).
3. Adat: a lead-route a legutóbbi pillanatképből (választó, előnézet) és artefaktumonként (kártya) méri, ugyanúgy, mint az
   előnézet-route (`dropNeverShown` + cache-olvasás — ingyenes, hálózat nélkül; `walkReadinessView`, `tplPreview.ts`).

**Őr.** `scripts/walk-readiness-check.mts` (pre-commit): 30 állítás; 8 mutációval igazolva (címke / magyarázat / előnézet /
kártya-sor / kliens-szkript / szerver-átadás kivétele, a render saját kollázsa, rossz állapot-szabály → mind piros).
Visszamérve a valódi konzolon (dev): Camping Carina „Séta: nem áll össze (1/3)” + magyarázat + előnézet-figyelmeztetés,
Nyugalom „Séta: előre nem tudható”, Három Huszár címke nélkül, kártyán „3 lépés”; JS-hiba 0, 390 és 1280 px.

**Visszafordíthatóság:** 🔄 — tiszta függvény + nézet-sorok.
