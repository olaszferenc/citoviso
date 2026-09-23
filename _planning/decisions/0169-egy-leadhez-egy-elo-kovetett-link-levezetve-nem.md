## ADR-0169 — Egy leadhez EGY ÉLŐ követett link: levezetve, nem tárolva; az archiválás nem törlés (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA (tulajdonosi választás: a három bemutatott
panel-változatból az **„A — Egy ÉLŐ, a többi archív"**) · **Forrás:** Elek FK-004 (B6 köteg),
2/3/5. lelet · **Terv-kontraktus:** `assets/design-refs/console/outreach-link-live-archive/`
(plan-A.html + README.md + 4 kép) · **Migráció:** `0068_prospect_archived.sql` ·
**Őr:** `scripts/outreach-link-live-check.mts` · **Kapcsolódó:** ADR-0122 (cím-szintű
egyszer-küldés), ADR-0114 (levezetett, nem tárolt), ADR-0160 (a piszkozat-lap küldés-sávja).

**Kontextus.** A `/lead/<id>#prospects` panelen **korlátlanul** lehetett új követett linket
gyártani, **semmi nem jelölte, melyik az élő**, és egyetlen törlő/archiváló űrlap sem volt.
A három művelet-gomb — navigáció, navigáció és az **állapotot ÁTÍRÓ** „Megjelölöm
kiküldöttként" — **azonos navy gradienst** viselt: a felület nem mondta meg, melyik kattintás
ír. A címzett-mező helyőrzője „(opcionális)" volt: igaz, de félrevezető — a link tényleg
elkészül cím nélkül, csak épp a rendszer **nem tud levelet küldeni** vele, és ezt az operátor
csak a piszkozat-lapon tudta meg.

**Döntés.**
① **Az ÉLŐ link LEVEZETETT, nem tárolt:** a lead legutóbb létrehozott, **NEM archivált**
követett linkje. Egy `is_live` zászló második igazság lenne, amit minden beszúrásnál karban
kellene tartani; a `0068` migráció ezért **csak azt tárolja, ami megtörtént**
(`prospect.archived_at`). Új link készítése vagy az élő archiválása magától átrendezi a
sorrendet. Ha minden link archivált: **nincs élő**, és a panel ezt kimondja.
② **Az archiválás NEM törlés.** A `/p/<token>` cím továbbra is megnyílik (a leadnek már
kiküldhettük), a mért adat megmarad; annyi változik, hogy nem ez az ÉLŐ, és megkeresés nem
indul róla. Megerősítést kér, és **visszavonható** — egy téves kattintás nem lehet zsákutca
(a ház mintája az opt-out `resubscribe`-ja, csak itt nincs jogi állapot, ezért indoklás sem kell).
③ **Új link ELŐTT a képernyő kimondja, mi lesz a mostanival** — állandó sávban (JS nélkül is)
**és** az űrlap megerősítésében; benne az is, hogy a leadhez korábban kiküldött cím a **RÉGI**
linkre mutat.
④ **Kártyánként EGY elsődleges (navy) gomb** — a `Küldés ▸`. A `Tevékenység` és a
`link másolása` LINK; a `Megjelölöm kiküldöttként` és a `Visszaállítás` másodlagos gomb;
az `Archiválás` piros szegélyes.
⑤ **A címzett-mező a KÖVETKEZMÉNYT mondja**, nem azt, hogy „(opcionális)".

⚠️ **EGY SZÓ ELTÉR A JÓVÁHAGYOTT MOCKTÓL, szándékosan.** A mock „**Archív** linkek (N)"-t
írt. A valódi adatban viszont a régebbi linkek **többsége sosem lett archiválva** — csak
újabb készült utánuk. Őket „archív"-nak nevezni **valótlan állítás** lenne a képernyőn
(§B.17 magunkra is áll), ezért a szekció **„Korábbi linkek (N) — nem ezek mennek a leadhez"**,
és az „archiválva" pirula CSAK azon ül, amit az operátor tényleg archivált. A szerkezet
(egy kiemelt ÉLŐ + összecsukott többi + figyelmeztetés) változatlan. A README kimondja.

**Őr.** `scripts/outreach-link-live-check.mts` — valódi konzol, 390 és 1280 px:
pontosan egy ÉLŐ jelölés, és az a **független lekérdezésből** számolt link (⛔ nem a
`getProspects` `isLive` mezőjéből: egy őr, ami a vizsgált függvényt hívja, a visszarontást is
zöldnek látja) · a többi az **összecsukott** „Korábbi linkek" szekcióban · **egy elsődleges
gomb kártyánként**, a gomb-súlyt **kirajzolva** mérve (a class-név lehet halott szabály) ·
figyelmeztetés + megerősítés · a helyőrző nem „opcionális".
⛔ **A park minden leadjén EGY link van**, tehát a feature LÉNYEGE (több link, ÉLŐ + korábbiak,
archiválás) élő adaton sosem mérődne meg, és az őr **zöld lenne a ROSSZ okból**. Ezért az őr
SAJÁT fixture-t épít (egy megjelölt lead 3 linkkel, köztük egy archiválttal — és az archivált
a LEGFRISSEBB sor, hogy az archiválás élő-kiütő hatása is mérve legyen), `finally`-ben törli.
Ahol egy állítás nem mérhető (nincs jóváhagyott mock → nincs létrehozó űrlap), az őr ezt
**kiírja**, nem nyeli el.
**Piros önteszt:** három mérgezés a betöltött lapon (nincs ÉLŐ · KÉT ÉLŐ · a „Korábbi linkek"
nyitva születik) → 6 állítás piros, és az önteszt **külön ellenőrzi, hogy MINDHÁROM ág fogott** —
az első változatom egy EGY-linkes leaden futott, ahol a „két ÉLŐ" mérgezés **no-op** volt, vagyis
hármat állított és kettőt mért.

**Amit menet közben mértem, de NEM javítottam.** A konzol `class="ghost"` gombjainak **nincs
CSS-szabálya** (`citui-console.css`), ezért navy elsődlegesnek látszanak — két másik felületen
is (`Adatok újragyűjtése`, `Portál-fotók újragyűjtése`). A saját gombjaimhoz külön
másodlagos osztályt (`con-btn2`) vezettem be; a globális `ghost` javítása más lapok kinézetét
is átfestené, ezért **külön kör**.

**Visszafordíthatóság:** 🔄 a migráció additív (egy nullable oszlop + részleges index); a
felület-változás adatvesztés nélküli.
**Élesítés:** NINCS (§0.3). ⚠️ Élesítéskor a `0068` migráció **fut** — a `deploy-prod.sh`
pg_dumpot készít előtte.
⚠️ **Sorszám:** `git fetch` + rebase után, közvetlenül írás előtt ellenőrizve (az origin/main
legmagasabbja 0162 volt) — a landolás pillanata is ütközhet.
