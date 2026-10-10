## ADR-0355 — A tenant-admin modulszámai egy definícióból; a nem rendelhető modult a Bővítés megnevezi

**Dátum:** 2026-10-10 · **Kontextus:** Elek 2. kör, #14 #15 (`08k`, `08l` képek, fizetés utáni admin). Kiegészíti: ADR-0102 (email-modul nem eladható), modules-quiet-list §8, admin-linear (Teendők-számláló).

**A hiba**
- #15: egy képernyő-párson „11 modul aktív” (oldalsáv), „Modulok 10” (menü), „11 modul · 10 számlázott” (Teendők), és a Modulok fülön „Aktív az oldalán mind a 10 modul” alatt „11 modul él az oldalán”. A 11 a LISTÁZOTT aktív sorok száma volt — benne a kiváltott „Időpontkérés”, ami az oldalon NEM jelenik meg (a KB is ezt mondja). Három helyen három másolat számolt.
- #14: a próba minden nem-kivezetett modult bekapcsol, az email-modul azonban nem eladható (ADR-0102), ezért a folytatással kikapcsolt, a `getTenantModules` el is rejti, és a Bővítés azt írta: „Minden elérhető modult megvett”.

**Döntés**
1. **Egy definíció:** `moduleCounts()` (`src/tenant/modules.ts`) — `listed` (az „Az én moduljaim” sorai), `live` (= `isRenderedModule`, az oldalon élő), `billed` (= `isBilledModule`). Az oldalsáv-kártya, a Teendők fejléce és a Modulok fül mondatai mind innen olvasnak; az „él az oldalán / modul aktív” szám MINDIG a `live`.
2. A Modulok fül összevető mondata mindhárom számot megnevezi: „A fenti listában {all} modul áll: {live} él az oldalán, és {billed} szerepel a számlán — … helyén most … jelenik meg, ezért azt nem számítjuk.”
3. A menü-számláló marad a module-subnav ⑤ kontraktusa szerint (a lista sorai — beállítható, nem kiváltott modulok); a fixture-ben = `live`.
4. **Az email-modult NEM tesszük eladhatóvá** (ADR-0102 tulaj-döntés). Helyette `TenantModuleView.notOrderable` (tiltott eladású, nem birtokolt, nem kivezetett modulok; `heldInTrial`, ha a tenant próbája `converted`): a Bővítés név szerint kimondja, hogy most nem rendelhető, próbából jövőnél azt is, hogy a próbában be volt kapcsolva és a folytatással kapcsolt ki. Ilyenkor az üres-kirakat mondata „A most rendelhető modulokat mind megvette.”; a „Minden elérhető modult megvett” csak akkor áll, ha nincs ilyen modul.

**Őr:** `scripts/admin-module-count-truth-check.mts` (+ `--self-test`), pre-commit.
