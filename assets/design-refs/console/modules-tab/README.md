# Tenant-admin „Modulok" fül — jóváhagyott terv (A változat)

Jóváhagyva: 2026-08-31 (tulajdonosi döntés — az A változat, kiegészítve a
teljes képernyős előnézettel és a Mobil/Asztali nézetváltóval).
Kontraktus-fájl: `modules-tab.html` (önhordó, kattintható; a `--citui-*` magból).

Ez a fájl **elvárt viselkedést köt**, nem stílus-javaslat. A megvalósult felületet
ehhez a képhez mérjük (`npx tsx scripts/ui-shot.mts /admin?tab=modulok --tenant`).

Kiváltó ok: a mai fül **egyetlen listába** gyúrja a megvásárolt és a meg nem
vásárolt modulokat, és egy kapcsoló + egy ár-chip nem mondja meg a tulajnak, mit
kapna. Modult csak **láthatóan** adunk el (ADR-0015).

---

## 1. Amit a terv KÖT

### ① Két külön szerkezeti blokk, ebben a sorrendben
1. **„Az én moduljaim"** — CSAK a megvásárolt (`active`) modulok. Soronként:
   név, állapot egy mondatban, ár-chip, **Megnézem**, **Beállítás** (ahol van
   `hasSettingsScreen`), **Kikapcsolom**. A gerinc-modul (`enquiry`) itt
   „az árban" chippel, kapcsoló nélkül.
2. **„Bővítés — amit még hozzáadhat"** — a nem vásárolt modulok **termék-kártyaként**,
   a mai `MODULE_CATALOG.publicLabel` / `publicDesc` szövegekkel, csoportonként
   (Amit bemutat / Elérhetőség / További lehetőségek).

⛔ Egy modul soha nem jelenik meg mindkét blokkban.

### ② A kirakat-kártya kötelező eleme: a szekció mini-renderje
A kártya fejlécében **a modul valódi szekciója kicsinyítve** látszik — nem ikon,
nem illusztráció. Ez az, ami a kattintás ELŐTT elad.

### ③ Teljes oldalas előnézet
`Megnézem az oldalamon` → az egész honlap előnézete, a **jelenlegi kosár-állapottal**
(bekapcsoltak be, lemondottak ki), a megnyitott modul szakasza **kiemelve**.
Kötelező elemek a fejlécében:
- `Előnézet — még nincs élesítve` figyelmeztető chip,
- **Mobil / Asztali nézetváltó** — asztali nézetben a VALÓDI desktop elrendezés
  (nem a mobil szélesre húzva); telefonon kicsinyítve fér bele, nem törik át,
- **Teljes képernyő** gomb (Fullscreen API),
- lábléc: ár + `Hozzáadom` / `Visszaveszem` + `Bezárom`.

A modul-váltás az előnézeten belül is működik, és a kosár azonnal követi.

### ④ Kosár-sáv (a mai `adm-planbar` viselkedése marad)
Változás esetén megjelenik: mi kapcsolna be / mit mondana le, a fordulónap
dátumával, és **jelenlegi havi díj → új havi díj (delta)**. `Elvetem` /
`Alkalmazom a módosításokat`. Alkalmazás után szöveges visszaigazolás.

---

## 2. Nem alkudható korlátok

- ⛔ **Az előnézet SOHA nem ír entitlementet.** Csak render, override-halmazzal.
  (A fizetés előtti ALL-IN előnézet egyszer már túlélte az aktiválást: 3 élő
  tenant futott nem fizetett modullal — lásd §additív írás nem kapu.)
- ⛔ **Minden nem megvásárolt szakasz `MINTA — az Ön adataival töltjük fel`
  címkét visel** az előnézetben. Címke nélkül ez §B.17-sértés (a tulaj azt hinné,
  ez már az ő adata) és bait-and-switch-kockázat.
- ⛔ A `booking` az előnézetben is **kiváltja** az `enquiry`-t (közös slot) —
  ugyanaz a szabály, mint a renderben.
- ⛔ A gerinc (`enquiry`) kapcsolója zárolt, de **bekapcsoltként** olvasható
  (halvány cián), nem szürkén = kikapcsolva.

---

## 3. Amit a megvalósítás megkövetel (technikai kapu)

`moduleContentFor(tenantId, siteId, photos)` — `src/tenant/editor.ts` — ma
**DB-ből** olvassa, mi aktív (`on(id)` a `module_entitlement`-ből). Az előnézethez
kapnia kell egy **override-halmaz** paramétert (pl. `overrideActive?: Set<string>`),
amit KIZÁRÓLAG a preview-út ad át; az élő render viselkedése nem változik.

Súgó: a `data-kb-anchor="admin.modules"` horgony marad; a KB-entry
(`kb/entries/admin-modules/`) szövegét és screenshotját frissíteni kell, mert
a fül felépítése változik (ADR-0045 §J, `kb-check --coverage` kapuzza).

---

## 4. Ellenőrzés

- Kép: `npx tsx scripts/ui-shot.mts /admin?tab=modulok --tenant` (390px + desktop),
  és összevetés ezzel a fájllal.
- Működés: az előnézet megnyitása, nézetváltó, teljes képernyő, kosár-delta és
  az `Alkalmazom` út végigkattintva, 0 JS-hibával.
