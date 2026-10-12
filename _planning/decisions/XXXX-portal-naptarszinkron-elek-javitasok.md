## ADR-XXXX — Portál-naptárszinkron élesítés előtt: export a tenant-hoszton, ütközésnél nem döntünk, csak publikus cím, a kiküldött mock friss runtime-ot kap, tartós hibáról levél

**Dátum:** 2026-10-11 · **Státusz:** elfogadva (koordinátori döntés a K1-re, Elek-teszt koordinátor; a többi Elek 4. körének
javítása) · **Kiváltó:** Elek 2026-10-11-i foglalás + portál-iCal köre (1 blokkoló, 8 közepes, 13 apró) ·
**Kiegészíti:** ADR-0361 (a portál-naptárszinkron első köre), ADR-0044/b, ADR-0114, ADR-0145 ④

### Döntések

1. **B1 — az export-link ott él, ahol a tulaj megkapja.** A `/naptar/<token>.ics` a tenant-hoszton, a saját domainen és
   a dev `/t/<slug>/` alakon is kiszolgálódik (eddig csak a platform-hoszton — a tulajnak kiírt link mindenhol 404 volt,
   a hurok félig zárt). A tenant-hoszt CSAK a saját szállása egységeit adja ki. A fizetés-fagyasztás (503) előtt fut:
   a portálnak a már eladott éjszakák zárva tartása a számla állapotától függetlenül jár.
2. **K1 — ütközésnél NEM döntünk a tulaj helyett** (koordinátori döntés). Ha a behúzott portál-éjszakát nálunk egy
   ELFOGADOTT foglalás tartja (ADR-0114: az egész szállásé vagy a szobáé is), egyik foglalást sem töröljük; a kártya
   kiírja a napot és a vendéget, a tulaj a meglévő tulaj-levél keretben levelet kap a szállás nevében — ütközésenként
   EGYSZER (`calendar_conflict.notified_at`), és a megszűnt ütközés sora törlődik (ha visszajön, újra hír). A kártya
   darabszáma a ténylegesen átvett éjszakákat mondja, nem a jelentetteket.
3. **K3 — a tulaj-link csak publikus címre mehet.** Loopback, privát, CGNAT, link-local/metadata, ULA, multicast és a
   többi nem-publikus tartomány (IPv4 + IPv6, a beágyazott IPv4-alakokkal) elutasítva — a DNS-feloldás UTÁN, a socket
   saját `lookup`-jában (amit ellenőrzünk, oda kapcsolódunk), és minden átirányítás-lépésnél. A belső cím és a zárt port
   ugyanazt a mondatot kapja („A link nem érhető el, vagy nem naptár…”), így a mező nem térképezi a belső portokat.
   Kivétel csak a helyi tesztekhez: `CALENDAR_SYNC_ALLOW_PRIVATE=1`, és csak LOOPBACK-re, és csak ha a
   `publicSiteUrl` nem a platform — élesen hatástalan.
   K2 mellé: a 4 MB-os korlát a letöltés KÖZBEN érvényesül (content-length nélkül is megszakad).
4. **K4 — a kiküldött mock a mai runtime-ot kapja.** Az `injectRuntime` egy már feldolgozott oldalon a régi
   runtime-blokkokat CSERÉLI (nem hagyja ki); a lead-oldal (`injectConfigurator`, `/p/<token>`) kiszolgáláskor ezt
   hívja. A tárolt mock-fájl nem változik, élesen nincs újrarenderelés és nincs backfill — a deploy után a már
   kiküldött mockokon is megjelenik a minta-sáv és a „a portálon foglalták” jelölés.
5. **K7 — tartós szinkron-hibáról levél, egyszer.** 24 óra folyamatos hiba után a tulaj levelet kap (a link
   `failure_notified_at`-ot kap), a gyógyulásig nem újra; a sikeres szinkron nullázza. A kártya kimondja az utolsó
   SIKERES szinkron idejét, és linkenként rövid szinkron-napló él (`calendar_sync_run`, az utolsó 10 futás).
6. **K8** — az óránkénti szinkron legfeljebb 6 linket húz egyszerre, a legrégebben frissítettet elöl, 120 mp-es
   összesített kerettel (a keret után nem indul új link; a futó a maradék időt kapja) — a lejáratás-feladatok
   nem csúsznak. **A6** — a „Másolás” link portálonként más (`/naptar/<token>/<portál>.ics`), és abból kimaradnak az
   attól a portáltól jött éjszakák; a régi `/naptar/<token>.ics` mindent ad (visszafelé kompatibilis).
   **A7** — `DTSTAMP` = a generálás ideje.

### Nem változott

- A3 (≤1 óra rés egy saját jelölés levétele után) és A8 (UTC „Z” idő a UTC-napot veszi) marad, ahogy Elek javasolta.
- A10 („Nem kell két naptárat vezetnie” a lead-mockon) — tulaj-döntés, nem nyúltunk hozzá.
- A13 — a döntő oldal az ADR-0145 ④ mintát követi (a lap a sáv mért magasságát fenntartja); a sáv maga marad.

### Őr

`scripts/portal-sync-guard-check.mts` (saját scratch-DB, helyi feed-szerver, valódi public szerver): B1 négy hoszt-alakon
+ idegen token a tenant-hoszton 404; K1 egy levél két futás után; K2 végtelen feed RSS-plafonnal; K3 belső célok
(IPv4/IPv6/decimális/átirányítás) egységes mondattal; K4 csere; K5 forduló-nap a runtime-ban; K6 két egyidejű POST
→ egy kérés; K7 egyszeri levél + gyógyulás; K8 keret; A1 23505 → „időközben elkelt”; A6; A7. `--self-test`: a régi
viselkedés visszaszimulálva pirosra megy.
