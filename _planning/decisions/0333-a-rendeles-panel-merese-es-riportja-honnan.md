## ADR-0333 — A rendelés-panel mérése és riportja: honnan nyílt, meddig jutott, mennyi ideig maradt

- **Kiváltó (tulaj, 2026-10-06):** „Az is legyen mérve a kiküldött linkben, hogy meg van-e nyitva az Itt
  rendelhetem meg gomb, és azon belül mi történik.” A gombnyomás (`panel_open`) már rögzült, de a riport
  sehol nem mutatta, a lead Tevékenység lapja pedig több panel-eseményt nyers kóddal írt ki.
  Élesen ma: 16 megnyitás, 0 gombnyomás.
- **Terv (§2b kapu lezárva, „mindkettő”):** `assets/design-refs/console/rendeles-panel/` (README = kontraktus).
- **Döntés — mérés (`cit-configurator.js`):**
  1. `panel_open { via: "pill" | "esc" | "tab" }` (gomb · eszkalációs ajánlat · szél-fül). A régi, `via`
     nélküli esemény „gomb”-nak számít.
  2. Új esemény: `panel_close { seconds }` (X). A `panel_collapse` is viszi a `seconds`-t, a `dwell_end` a
     `panel_seconds`-t (a nyitott panel ideje a lap elhagyásakor). A másodperc faliórás idő a nyitástól.
  3. Hiányzó másodpercnél (régi adatok) a szerver az esemény-időbélyegekből számol.
- **Döntés — riport (Viselkedés lap, „Rendelés-panel”):** egy munkamenet = egy nem-robot látogatás
  `panel_open`-nel. Lépcső: Megnyitotta → `checkout_step` → `billing_step_open` → `order_intent_submitted` →
  `checkout_redirect` → Fizetett (`payment.status='paid'`). A fizetést a lead fizetés előtti utolsó elküldő
  munkamenete kapja, így egy fizetés nem számít kétszer. A „Rendelés nélkül zárta” azt számolja, ahol nincs
  sikeres rendelés. Sikeres = `checkout_redirect`, vagy az utolsó beküldés után nem jött hiba
  (`billing_invalid` · `order_send_failed` · `module_dependency_unmet`). A szűrő-chip (`pv`) a munkamenet
  nyitási módjainak bármelyikére illeszkedik. A „Megnyomta a gombot” KPI-t nem szűri.
- **Tevékenység lap:** minden konfigurátor-esemény magyar feliratot kap egy közös forrásból (`EVENT_LABEL`);
  a `section_seen` sorok nem jelennek meg, a `via` zárójelben áll.
