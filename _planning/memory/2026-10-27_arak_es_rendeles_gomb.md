# 2026-10-27 — A rendelő gomb: „Árak és rendelés” + „havi X Ft-tól” (ADR-0408)

**Kérés (tulaj):** a leadek az árat kérdezik, a „Megrendelés”-jellegű gombra nem kattintanak; javaslat: „Árak és megrendelés”.

**Terv-kör (§2b):** a valódi Laguna dev-mockon (`/p/mFvp…`) a feliratot a lap betöltésekor cseréltük, és mértük.
- A szó szerinti „Árak és megrendelés” 390 és 360 px-en levágódik, és a „14 nap ingyen” pirulát is levágja; asztalon a pár a bal szélre ugrik.
- Változatok: A „Árak és rendelés” · B + „havi X Ft-tól” · C „Mennyibe kerül?”. **Tulaj: B.**

**Megvalósítás:**
- `assets/runtime/cit-configurator.js`: a pirula felirata `tr("Árak és rendelés")` + `<small>` `tr("havi {price}-tól")`; a szám a legolcsóbb csomag `presetMonthly`-ja, `fmt`-tel; nincs ár → nincs második sor.
- `assets/runtime/cit-configurator.css`: `.cit-cfg-launch--from` (8 px függőleges margó → 48 px marad), `.cit-cfg-launch__lbl`, `.cit-cfg-launch__from`.
- Konzol: `src/console/views.ts`, `reportViews.ts`, `reportData.ts` (komment) az új néven; súgó `kb/entries/console-report`, `console-pricing`; Elek FK-009, FK-011; `scripts/optout-offer-price-check.mts` üzenete.
- Terv befagyasztva: `assets/design-refs/prospect-page/arak-gomb/` (README + plan.html + képek); `order-pill/README.md` 1. pont felülírva.

**Ellenőrzés:** valódi lapon 360 · 390 · 844×390 · 1280 px — semmi nem vágódik le, magasság 48/44 px, panel nyílik, JS-hiba 0; domain-jelvénnyel is rendben. Zöld: lead-mobile-check --gate, lead-page-surface-check, configurator-float/placement/price-check, i18n-lint, design-token-lint, kb-check.

**Élesítés:** 2026-10-27 12:57, `34ab1322` (`prod/20261027-1257`); élesen mérve a Muschel teszt-leaden: „havi 2 780 Ft-tól”, nincs vágás, JS-hiba 0. Hatásmérés: Riport „Rendelés-panel”, `panel_open {via:"pill"}` az élesítés előtt/után.
