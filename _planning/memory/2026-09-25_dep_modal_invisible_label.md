# 2026-09-25 — A blokkoló lemondás gombja üres volt (piros felirat piros alapon)

**Bejelentés (tulaj, képernyőképpel):** a Modulok fülön az „Árak, szezonok nem kapcsolható ki, amíg
Online foglalás él” párbeszédben a piros fő gomb felirat nélkül jelent meg.

## Ok
- A `.adm-mdl__go--warn` (ADR-0192 ④.2) csak `background`/`border-color`-t állított `--citui-bad`-re;
  a `color` az alap `.adm-mdl__go`-ból öröklődött — ami szintén `--citui-bad`. A JS kitöltötte a
  feliratot („Mind a {n}-t lemondom”), csak láthatatlan volt.
- Tanulság: egy módosító osztály, ami a HÁTTERET a szülő SZÖVEGSZÍNÉRE festi, a szöveget is
  állítsa be — egyik őr sem mér kontrasztot a modálokon.

## Javítás (commit `0e2783fa`, landolva `a25c53c7`)
- `public/assets/ui/citui-admin.css`: világosban `--citui-white` (3,91 — mint a többi danger-gomb),
  `[data-citui-theme="dark"]` alatt `--citui-navy-900` (5,81; fehérrel a `#ff7b7b`-n csak 2,51).
- Mérve Playwrighttal a valódi CSS-sel, mindkét témában. Felület-kapu: tulaj-engedélyes kivétel.
- NEM élesítve.

## Nyitott
- A többi piros alapú gomb (`adm-btn--danger`, `adm-btn-bad`, `.adm-toast.bad`) sötét témában
  fehér felirattal 2,51-es kontrasztú → közös „szöveg piros alapon” token javasolt.
