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

## Folytatás — közös token (ugyanaz a nap)
- Új `--citui-on-bad` (`citui.css`): világosban fehér, `[data-citui-theme="dark"]` alatt navy-900.
  Sötét téma CSAK a tenant-adminban van (`adminViews.ts` állítja), ezért a konzol/vendég-lap érintetlen.
- Átkötve: `adm-bulk`/`adm-dlg` danger-gomb, `adm-toast.bad` (+ikon), `adm-state--bad` fej,
  `adm-owe__pay` (+hover), `adm-btn-bad`, `adm-mdl__go--warn` (az egyedi felülírás helyett),
  a fagyasztott panel (`adm-frz`, `adm-owe__dl`, `adm-frz__guest/glink`) szövegei, `bk-btn--danger`.
- Mérve: a fagyasztott panel sötét színátmenetén a legrosszabb pont 2,22 → 3,59 (a navy felé
  keveredő vég miatt ennél jobb egyetlen színnel nem érhető el).
- Nyitott: a zöld (`--citui-ok` sötétben #3ddc97) tömör felületek (`bk-btn--ok`, `adm-state--ok`)
  fehér felirata sötétben ugyanilyen gyenge — ugyanezzel a mintával `--citui-on-ok` kellene.
