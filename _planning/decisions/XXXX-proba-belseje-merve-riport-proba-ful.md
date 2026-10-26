## ADR-XXXX — A próba belseje mérve: tenant-aktivitás napló és a Riport „Próba” füle

**Dátum:** 2026-10-26 · **Kiváltó:** tulajdonosi kérdés: „Van arra kimutatás, hogy mennyien indították az ingyenes
próbát? … érdemes lenne azt is mérni, hogy a próba során hol bukik el vagy nem egy rendelés, hányszor lépnek be
a próba alatt … kvázi egy újabb réteget mérni.” Kontraktus: `assets/design-refs/console/proba-riport/`
(§2b-kör A/B/C → a tulaj: „A+B hibrid”, majd „mehet”).

**Mi volt:** a mock-réteg mérve (`mock_view`/`mock_event`, a Tölcsér „Próba” lépcsője), a próbáról viszont csak az
eleje (`free_trial.started_at`) és a vége (`converted_at`/`lapsed_at`). Belépésből a felülíródó
`tenant_user.last_login_at`; mentés, saját oldal, a „Megrendelem” megnyomása és a félbehagyott rendelés sehol.

**① Egy napló minden tenantra — `tenant_activity` (0117):** `login` (jelszó / egyszeri link) · `admin_open` (az admin
megnyitása, fél óránként legfeljebb egy — a megmaradt süti is számít, nem csak az új belépés) · `save` (sikeres
admin-mentés, a fül nevével) · `site_view` (az admin „Oldal” gombja / a webcím) · `order_open` (a „Megrendelem” út,
forrással: admin | levél) · `checkout` (a folytatás rendelőjének lépései). A próba csak egy időablak a tenanton —
a fizető tenant ugyanígy mérhető (a Riport „Tenantok” köre ebből épülhet). Ami már máshol igaz, az nem másolódik:
elküldés `order_intent`, fizetés `free_trial.converted_at`, lejárat `lapsed_at`, levelek `free_trial_notice`.

**② A „Megrendelem” megnyitását a böngésző jelzi, nem a szerver GET-je** (ADR-0291 mintája): a levélbeli
`/folytatas` linket a levél-szkennerek is lekérik. A konfigurátor az első emberi jelre (görgetés, érintés, 5 mp
látható fül) küld egy `order_open`-t a `/p/<token>/trial-event`-re, és ugyanoda a számlázási lépést, a hibás
adatot, a sikertelen küldést. A forrás `?from=admin|level` (az SMS linkje csupasz marad — a hossza számolt).

**③ Elakadás = származtatott, nem rögzített:** a megnyitott rendelés (vagy rendelő-lépés), ami után 1 órán belül
nincs elküldött rendelés. A riport az utolsó lépést nevezi meg (csomagválasztás / számlázási adatok).

**④ A mérés kezdete a 0117 migráció `applied_at`-je**, nem az első naplósor: napokig tartó csend az első sort
későbbre tolná, és az addig indult próbákat tévesen „nem mért”-nek mondaná. A korábban indult próba sora „A
belseje nem mért” jelet visel, a lépcső nélküle számol (§B.17: semmit nem találunk ki).

**⑤ A mock-oldali „visszatérő vagy továbbküldött” bontás új azonosító NÉLKÜL.** A terv-vázlat böngészőben tárolt
véletlen azonosítót írt; ez ütközik az ADR-0108-cal (süti és kliens-oldali azonosító nélkül), és a böngészőbe írt
elemzési azonosító hozzájárulás-köteles. A bontás a `mock_view` már mért eszköz-típus + rendszer + böngésző
hármasából dönt; két egyforma telefon egynek látszik — a lap kimondja, hogy inkább alulbecsül.

**⑥ A felület:** Riport → „Próba” fül (a bal menüben is). Felül a lépcső (meddig jutnak, hol állnak meg; egy fokra
koppintva az alatta lévő lista csak az ott megállókat mutatja), alatta próbánként a 14 nap sávja és egy mondat,
koppintásra az idővonal; a próba napjai szerinti aktivitás; a mock-oldali bontás; a jelek táblája. Linkek és
`<details>` — JS nélkül is működik. Súgó: `kb/entries/console-report-trial/`.

**Őr:** `scripts/trial-report-check.mts` (saját scratch-DB): minden admin-POST útvonal fülre képződik; a valódi
admin HTTP-n ír (`admin_open` egyszer, `save` füllel, `site_view`, session nélkül semmi); a próba-történetek
(belépés nélkül, csend, elakadás két lépésnél, fizetett, lejárt, nem mért); a lépcső; a szűrők; a lap; a bekötés.

**Visszafordíthatóság:** 🔄 — additív (új tábla, új útvonal, új fül); a napló a próba-törléssel együtt törlődik
(`PURGE_TABLES`). **Elvetett:** (a) a `last_login_at` mellé számláló — a „hol állt meg” kérdésre nem felel;
(b) a `/folytatas` szerveroldali GET-mérése — a levél-szkennerek hamis „Megrendelem”-et írnának; (c) böngészőben
tárolt látogató-azonosító a mockon — ADR-0108 + hozzájárulás. **Státusz:** elfogadva, landolva; élesre a
következő élesítéssel (§0).
