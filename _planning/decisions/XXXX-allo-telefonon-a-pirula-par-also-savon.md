## ADR-XXXX — Álló telefonon a pirula-pár egy alsó, rögzített sávon áll, nem lebeg a hős fölött

**Dátum:** 2026-10-19 · **Kontextus:** a tulaj a [TESZT] Rebeka Panzió mockot nézte a telefonján (fullbleed sablon, süti-sávval): a „14 nap ingyen” + „Itt rendelheti meg” pár a szállás neve alatti „Tihany, az apátság közelében” soron és a főcím tetején ült. Szó szerint: „Ez most valami vicc?”. Két változatot kapott (A: alsó sáv, B: felső sáv), és az **A**-t választotta. **Részben felülírja:** ADR-0242 ④ és ADR-0382 (a kikerülés álló telefonon); **megtartja:** ADR-0377 (fekvő telefon: jobb sarok, egymás alatt) és az asztali kikerülést.

### Kiváltó (mérve)
Az ADR-0382 kikerülése álló telefonon a hős-gombsor fölé, a cím fölé emelte a párt. 412×735-ön, süti-sáv nélkül a pár alja 6 px-re volt a főcímtől, süti-sávval (a tulaj képernyője) a cím alatti sorra került. A tegnapi (ec2032d5) és a mai (8a93cabe) futtatókóddal ugyanez az eredmény, vagyis nem a 10-19-i panel-élesítés okozta.

### Döntés
1. **Álló telefonon** (`max-width:560px`, nem a fekvő-telefon lekérdezés) a pirula vagy a pár egy sötét (`#101216`, a keretező sáv színe), a képernyő aljára rögzített sávon áll. Alatta csak a süti-sáv és a sablon Foglalás-sávja lehet. A sáv a pirula magassága + 2×10 px.
2. Nincs felfelé lépés és nincs cím-kerülés. A lapon mozgó tartalom a sáv alá görgethető. A lap utolsó blokkja a sáv tetejéig kipárnázza magát (`--citui-cfg-clear`).
3. A sáv csak akkor látszik, amikor a pirula is: rejtett pirulánál, beúszás előtt és nyitott panelnél (`html.cit-cfg-is-open`) eltűnik.
4. Fekvő telefonon és asztalon semmi nem változik.

### Kód
`assets/runtime/cit-configurator.js` (`cit-cfg-dock` blokk: `isDocked`, `syncDock`; `placeLaunch` álló telefonon kihagyja a `findSpot`-ot) + `.css` (`.cit-cfg-dock`).

### Visszafordíthatóság
🔄 könnyű: kliens-oldali elrendezés; adat, séma és pénzút nem változott.
