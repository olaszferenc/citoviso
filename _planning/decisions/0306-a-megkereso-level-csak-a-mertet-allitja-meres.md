## ADR-0306 — A megkereső levél csak a mértet állítja: mérés-alapú szegmens-mondat, 4,0 ★ küszöb, szállásadó-szemű kritikus sablon-változáskor (2026-10-02)

**Státusz:** elfogadva (tulaj-döntés a koordinátoron át; SUB, brief `~/rc-briefs/javitas-elek-0930/l1-megkereso-level.md`) ·
**Lokál, nem élesítve** (§0) · **Kontraktus:** `assets/design-refs/console/outreach-letter-l1/` ·
**Kapcsolódó:** ADR-0101/0121 (a levél szerkezete és hangja), ADR-0112 (SMS), ADR-0292 (vendég-kritikus), ADR-0305, §B.17.

### Kontextus
Elek SZ-5/H-3: a levél gépies („A Google-on 4,8 csillagos, 145 vélemény alapján.”, „nincs a képben”), és a szegmens-mondat
nem a mérésből jött. Élesen mérve (csak olvasás): az „elavult” ág 388 leadből 256-nak olyat állított („telefonon nehezen
boldogul”), amit nem mértünk (211 nem töltött be, 45 mobilos); a „van lábnyom” ág annak a besorolásnak mondott ellent, ami
kiválasztotta; egy 1,0 ★-os lead „1 csillagos” dicséretet kapott volna.

### Döntés
1. A szegmens-mondat a honlap-ellenőrzés MÉRÉSÉT mondja ki (nem töltött be / nincs mobil-nézet), vagy semmit; modern
   oldalnál és mérés nélkül nincs hiány-mondat, nincs „Ezért”, és a terv „másik terv, hogy össze tudja vetni” (nem „új”).
2. 4,0 ★ alatt a levél nem idéz értékelést (`MIN_QUOTED_STARS`).
3. Tulaj-választás „B”: + csiszolás („elindítjuk az oldalt”, „forinttól indul”, „már listaáras”, két rendes mondat a
   keretezésben, „A Citoviso csapata”); az emlékeztető-levél ugyanazt a hangot kapja.
4. Őr: `scripts/outreach-letter-truth-check.mts` — minden ág (300) kirenderelve; régi kódon 20 piros, mutációval igazolva.
5. A vendég-kritikus mintájára szállásadó-szemű LLM-kritikus (`src/outreach/letterCritic.ts`) — a SABLON változásakor fut,
   az ítélet az ujjlenyomathoz rögzítve; küldésenként nem (nincs leadenként egyedi AI-mondat). Első futás: FLAG (modern
   oldal mellett „új honlap-terv” = ellentmondás) → javítva → PASS.

### Elvetett
- Küldésenkénti LLM-kritikus: ugyanazt a ~8 ágat bírálná újra és újra, pénzért, új információ nélkül.

**Visszafordíthatóság:** 🔄 olcsó (szöveg + őr).
