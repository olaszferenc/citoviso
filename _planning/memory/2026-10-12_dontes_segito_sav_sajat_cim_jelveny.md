# 2026-10-12 — Döntés-segítő felső sáv + saját cím jelvénye (SUB, §2b terv-kör → megvalósítás)

**Szál:** SUB az Elek-teszt koordinátor alatt (fa `~/wt/cit26ce7f8c`), brief `~/rc-briefs/vevo-domain-sor-eszkalacio-terv-20261012.md`. Élesre SEMMI nem ment.

## Elvégezve
- **Terv-kör (§2b):** két működő mock (saját cím: A/B/C; eszkaláció: A/B + „MA”), mobil + asztali, Playwrighttal végigkattintva. Tulaj-döntés: eszkaláció = **A (felső sáv)**, saját cím = **B (jelvény + a cím elöl), dinamikusan**.
- **Befagyasztva:** `assets/design-refs/console/escalation-topbar/`, `assets/design-refs/console/package-domain-badge/` (README köt; az `offer-ui` 4. pontja a felülírásra mutat).
- **Kód:** `assets/runtime/cit-configurator.{js,css}` (sáv; `freePkgTlds` / `presetCarriesDomain` / `syncDomainLead`; díj a javaslatsorokon; összegzés-sor), `assets/runtime/cit-pricing-admin.js` (`domInFree`), `src/console/pricingPage.ts`, `public/assets/ui/citui-console.css` (`.pr2-pkdom.is-warn`), KB `console-pricing`.
- **Őrök:** új `scripts/package-domain-badge-check.mts` (51 állítás, önteszt PIROS a tulaj állapotán); `optout-offer-price-check` az új sáv-kontraktusra (26 zöld, `--shot`).

## Eltérések a vázlattól (szándékosan, README-ben rögzítve)
- Vezető sor: „A választott csomagjához saját {tld} cím jár” (a vázlat csomagnevet mondott; egyedi összeállításnak nincs neve, a névelő is változna).
- A „saját .hu cím választható — 0 Ft” a fizetés-lépés összegzésében áll (a meglévő bontás-sor helyén), nem az 1. lépés egysoros láblécében.
- Admin-felirat: „…jelöld lent, a Saját domain résznél, a „Csomagban ingyen” oszlopban” — a koordinátor szövege „Domain-végződéseknél”-t írt, ilyen felirat a lapon nincs.

## Nyitva
- A tulaj élesen a pirulát mind a 3 csomagba tette, de ingyenes végződést nem jelölt: a jelvény addig nem jelenik meg, amíg a „Csomagban ingyen” nincs bejelölve (ez a szándékolt viselkedés).
