## ADR-0506 — A lapon volt ajánlat előbb, a régi állomány utána; bélyeg- és kapu-verzió emelés csak szabállyal és indoklással

- **Dátum:** 2026-11-27
- **Státusz:** elfogadva (koordinátor `cit9b4690e3`: „az 1) és a 2) mehet, egy commitban. A 3)-at kódszinten is kérem.”)
- **Kiegészíti:** ADR-0500 ① (régi mock újragenerálása), ADR-0501 ② (a lapon volt ajánlat ítélődik újra elsőként)
- **Érinti:** `src/generator/mockRefresh.ts` (`pageRejudgePending`, a frissítés párban), `scripts/chain-supply.mts`, `scripts/bump-guard-check.mts` (új), `hooks/pre-commit`, `scripts/approval-chain-e2e.mts`

### Mért helyzet (éles, olvasva, 11-27 16:10)
- 15:44-kor 20 HR sor volt a tulaj lapján, 16:08-kor összesen 2.
- A 15:50-es deploy (9a73a4e2) bélyeget (`supply2`) és kapu-verziót (17 → 18) emelt. Aznap ez a negyedik emelés volt; mindegyik egyszerre tett elavulttá minden átment tervet.
- A 20 korábban lapon volt HR ajánlatból:
  - 2 már kész;
  - 7-nél az egyik terv újraítélve, a másik még a régi bélyegen;
  - 11 újrarenderelve, de v17-es ítélettel.
- A sorrend (ADR-0501 ②) működött; a kapunak nem jutott gép.
  - A kiküldő tick kapu-lépése 165 s alatt 3 tervet ítélt (határidő-vágással).
  - Közben a lánc-utánpótlás régi-mock újragenerálása tüzelésenként 150–313 s-ot és ~1 GB-ot vitt ugyanazon a 2 magon.

### Döntés
1. **A lapon volt ajánlat előbb.** Amíg van olyan várakozó sor, amelynek mindkét terve utolsó ítélete passz volt, de valamelyik terve nincs a mai kapu-verzión vagy bélyegen (`pageRejudgePending`), a régi állomány újragenerálása tüzelésenként legfeljebb 1 leadet visz (90 s). A gép a kapué.
2. **A frissítés párban dolgozik.** Egy terv újrarenderelése után ugyanabban a körben az ajánlat második terve is újrarenderelődik, így a pár egyszerre ér a kapuhoz és a laphoz.
3. **Emelés csak szabállyal és indoklással** (`bump-guard-check`, minden commitnál):
   - a `MOCK_HEROFIX_STAMP` emelése csak generátor-, sablon-, kép- vagy médiafájl változásával mehet;
   - a `RENDER_GATE_VERSION` emelése csak a kapu saját szabályának változásával (`mockRenderGate.ts` a konstanson túl, `photoKind` / `townPick` / `textOverlap`);
   - mindkettőhöz kell a konstans fölött egy hozzáadott komment, amely megnevezi az új értéket.
   Az őr a fájlt nézi, a tartalmat nem: egy csak-komment változás egy generátor-fájlban átmegy. A megkerülés így szándékos, nem véletlen.

### Külön körben (koordinátor engedélyével)
- **Szelektív elavulás:** az emelés csak azokat a terveket tegye elavulttá, amelyekre az új szabály vonatkozik (sablon, szakasz, képhely). Ehhez a szabályoknak hatókör-címkét kell kapniuk, és a bélyegnek/verziónak hatókörönkéntinek kell lennie (pl. `stamp.parallax`, `gate.town`). A frissítés és a kapu is ezt nézné. Nagyobb munka, ezért nem ebben a commitban megy.

### Visszafordíthatóság
🔄
- `pageRejudgePending` → 0 esetén a régi viselkedés.
- A pár-frissítés egy blokk.
- Az őr eltávolítható a pre-commitból.
