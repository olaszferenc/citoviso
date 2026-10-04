## ADR-XXXX — Fejléc-link csak meglévő szekcióra; egy vágási szabály a mocknak és az élő lapnak; Parallax görgetett menüsáv (2026-10-04)

**Dátum:** 2026-10-04 · **Státusz:** elfogadva (tulaj: „A”, „Parallax: javítsd!”; SUB, brief `~/rc-briefs/sticky-header-modulok.md`) ·
**Kontraktus:** `assets/design-refs/tenant-site/parallax-menusav/` · **Őr:** `scripts/nav-target-check.mts`,
`scripts/unbought-module-leak-check.mts` ⑤ · **Kapcsolódó:** ADR-0253 (telefonos menü, ragadó foglalás-gomb), ADR-0089 ⑦ (galéria-vágás), LV-1.

### Kontextus
A tulaj: „Parralax mocknál a sticky headerben csak foglalás szabad időpontok van Galéria stb nincs… ellenőrizd: a sticky
headerekben csak azok a modulok szerepelnek amelyek elérhetőek (megvették)”. Mérve 21 sablonon, renderelt lapon:
- **Parallax:** a ragadó elem a foglalási dokk volt (Foglalás + Szabad időpontok megtekintése); a menü csak a hero-ban élt.
  Foglalás-modul nélkül a dokk egy ~227 px magas RAGADÓ űrlap volt, a címe sötét a sötéten.
- **Mock, „Alap” csomagra váltva:** 21/21 sablonon maradt fejléc-link elrejtett szekcióra — a konfigurátor a szekciót
  rejtette, a linket nem (masthead, görgetett sáv, pötty-nav, telefonos menü).
- **Két vágási szabály:** a mock mindig a TELJES szekciót vitte (gate-opening, wordmark-grow, brutalism, dopamine: a valódi
  bevezetővel együtt — az „A ház” link eltűnt), az élő vágás bármely `<p>`-t/ikont tartalomnak vett (organic, art-deco: üres
  „A szállás — Ahol megszállhat” fejléc maradt a ki nem fizetett szobák helyén, a „Szobák” link rá mutatott).

### Döntés
1. **Parallax (tulaj: „A”):** asztalon a hero után vékony görgetett menüsáv (név · masthead-linkek · foglalás); a dokk nem
   ragad; a dokk érdeklődés-űrlapja a sötét alapra festve. Telefon változatlan (ADR-0253).
2. **Link csak meglévő célra, a mockban is:** a konfigurátor a rejtett szekcióra mutató linket (telefonos menüben a sorát)
   is rejti, visszakapcsoláskor visszahozza (`syncNavLinks`).
3. **EGY vágási szabály** (`render.ts stampCutScope`): egy modul-felület akkor megy egyedül, ha a szekciójában SAJÁT tartalom
   van — kép, űrlap, lista-elem, táblázat, a lap `h1`-je, vagy ≥ 60 karakteres bekezdés (egy szlogen ~30, egy bevezető
   hosszabb); ezt a szerver `data-cit-cut="self"` pecséttel jelöli. Különben a szekció is megy, hacsak másik modul nem él benne.
   Az élő vágás és a konfigurátor UGYANEZT a pecsétet olvassa — a tartalom-teszt egy példányban él.
   „A ház” (gate-opening): a cél-szekcióban valódi bevezető van → marad, mindkét oldalon. Walk-through: a szekció csak a
   modul-tartalmat hordozza → mindkét oldalon megy (élesen eddig is).

### Visszafordíthatóság
🔄 olcsó: sablon-CSS, egy kliens-függvény és egy szerver-pecsét; adatot nem érint. A meglévő tenant-pillanatképek a következő
renderkor kapják meg (`scripts/rerender-tenant.mts`). Élesítés: a nagy deployjal.

### Elvetett
- **B — linksor a ragadó dokkban:** érdeklődés-állapotban 271 px ragadó blokk.
- **A mock a régi „mindig a teljes szekció” szabályon:** a mock szigorúbb lett volna az élő lapnál — a tulaj egységesítést kért.
- **Kliens-oldali saját tartalom-teszt:** két példány egy szabályból (feedback: one rule, two copies).
