## ADR-0035 — Tenant-admin vizuális ráncfelvarrás: valódi SaaS-dashboard shell

- **Kiváltó (2026-08-18):** az ADR-0034 menü+modul strukturálisan jó volt, de a felület nem adta a
  „profi" érzetet (felső pill-fülek + központosított kártyák egy sík felületen = béna).
- **Döntés:** önálló, scope-olt admin design-rendszer (`.adm-*`, a citui tokenekre építve, egy
  injektált `<style>`-ban): DESKTOPON bal oldali sötét navy oldalsáv-navigáció (SVG-ikonok, aktív
  állapot cyan-akcenttel), felül lapcím + „Oldal megtekintése"; MOBILON (a tulaj telefonról használ)
  natív-app-szerű alsó tab-bar + slim felső sáv (brand+kilépés). Igényes kártyák (radius/shadow,
  ikonos fejléc), stat-csempék az áttekintőn, ikonos teendő-lista, és iOS-stílusú KAPCSOLÓK a
  moduloknál (a checkbox switch-re stílusozva), ár-chipekkel. Design-doktrína: minden ikon inline
  SVG, nincs emoji.
- **Visszafordíthatóság:** 🔄 könnyű — tisztán nézeti réteg (adminViews.ts), a route-ok/logika
  változatlan.
- **Státusz:** ELFOGADVA / implementálva (2026-08-18).
