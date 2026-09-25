# 2026-09-25 — Modul-almenü a tenant-admin oldalsávjában

**Kérés (tulaj, képernyőképpel):** a Modulok menüpont alatt legyen lenyitható a megvásárolt modulok
listája, és egy elemre kattintva az adott modul beállításai jelenjenek meg.

## Menet (§2b)
- Két terv valós Boróka ház adattal (a fő fa :4800-ról olvasott admin-lapokból, a worktree-szerver
  indítását a port-őr tiltja): **A** fa-vonal, csak a Modulok fülön nyitva · **B** pöttyös, mindig nyitva.
- ⚠️ Az első mock (5,5 MB, iframe srcdoc-cal) a tulaj nézőjében **nem renderelt** → keret nélküli,
  változatonként külön 0,6 MB-os fájl (a `<style>`-blokkok deduplikálva a head-be) — ez működött.
- Döntés: **A**, + a Modulok-ra kattintva a lista azonnal nyíljon le → a nyíl-állapot NEM tárolódik,
  így a Modulok fül mindig nyitott listával érkezik.

## Elkészült
- `src/server/adminViews.ts`: `moduleSubNav()` (oldalsáv + fiók, közös szabály), `NavCounts.subModules/openModule`,
  `crumbTail()` (útvonal: szállás › Modulok › modul), `AdminOpts.openModule`, SHELL_SCRIPT nyíl + azonnali nyitás.
- `src/server/public.ts`: `openModule` átadása, ha a modul-képernyő tényleg elkészült.
- `public/assets/ui/citui-admin.css`: almenü, ikonsáv-rejtés, fiók-méretek (csak tokenek).
- Kontraktus: `assets/design-refs/tenant-admin/module-subnav/` (HTML + 3 kép + README).
- Őr: `scripts/admin-linear-check.mts` module-subnav blokk (2 méret; szabotázs: szerver-oldali nyitás elvétele).
- Súgó: `admin-modules-settings`, `admin-overview` — a menüs út leírva.

## Nyitott
- A Modulok számlálója a lista elemszáma (10), az előfizetés-kártya „11 modul aktív” — a tulaj a
  10 vs 11 kérdésre nem felelt; ha zavarja, a kártya is a listát számolhatja.
