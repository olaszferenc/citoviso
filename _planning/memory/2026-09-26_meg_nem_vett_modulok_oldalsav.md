# 2026-09-26 — Meg nem vett modulok az admin oldalsávban, + jellel (module-subnav ⑨)

## Kiváltó
A tulaj a Camping Carina admin Modulok fülén (képernyőkép): „baloldalt látszódjanak a még meg nem
vett modulok — pl. megvétel jellel”.

## §2b kör
Három változat (valódi `adminDashboard` render + injektált oldalsáv, mobil/asztali váltó):
A · külön blokk a lista alján „Még nem vette meg · N” címkével · B · egy listában katalógus-sorrendben ·
C · összecsukott „+ N további modul” sor. **A tulaj az A-t választotta.** A „minden fülön nyitva?”
kérdésre nem felelt → a meglévő szabály maradt (Modulok fül + modul-képernyők: nyitva, máshol csukva).

## Elvégezve (landolt: 4ae68448, nem élesítve)
- `src/server/adminViews.ts`: `NavCounts.buyModules` (= a Bővítés-kártyák predikátuma: `!active && !spine`),
  `moduleSubNav` ⑨ blokk (`.adm-nav__buyh`, `a.is-buy[data-buy]`, `.adm-nav__plus`), a shop-kártya
  `id="mod-<id>"`, a telefonos fiók bezárul `a[data-buy]` kattintásra.
- `public/assets/ui/citui-admin.css`: halvány sor + kerek cián + jel; `.adm-shop__card:target` keret,
  `scroll-margin-top:72px` (a ragadó fejléc alá ne ugorjon).
- `scripts/admin-linear-check.mts`: lista + címke + jel; sor → létező kártya megfeleltetés; piros kontroll
  (egy kártya horgonyát leveszi) → self-test küszöb 7.
- KB `admin-modules`: új szakasz „A bal oldali menüben is látja, mi hiányzik még”.
- Kontraktus: `assets/design-refs/tenant-admin/module-subnav/README.md` ⑨ + `meg-nem-vett-A.html` + 3 kép.

## Tanulság
- A `file://`-os mérés egy `/admin?...#mod-x` linket file:///admin-ra visz → a lapon belüli ugrást
  kis helyi http-szerveren, `/admin` útvonalon kell mérni.
- Egy „⛔” sor a `--self-test` futás kimenetéből jött (szándékos szabotázs), nem a rendes futásból —
  a két futás kimenetét külön fájlba fogd, mielőtt bukást diagnosztizálsz.

## Nyitott
- A KB új bekezdésének fordítása (a következő KB-fordítás körben).
- Ha a tulaj kéri: a lista minden fülön nyitva.
