# 2026-09-09 — A §C-kapu prózán mér (levél-ág is) + a dev DB-nek végre van mentése

**Szál:** a `_planning/PILOT-GO-LIVE-INVENTORY.md` C-blokkjából a 2. és a 4. tétel.
Tulaj-választás: „a két gyors gép-oldali rés". Élesítés NEM történt (§0.3).

**Tulaj-státusz rögzítve:** a **Citoviso saját GBP létrejött** → az ADR-0107 60 napos
órája elindult (2026-09-09 → ~2026-11-08-tól kérhető az API-jóváhagyás). A másik három
blokkoló (Barion éles bolt · Számlázz.hu éles kulcs · registrar kredit+ToS) NYITVA.

---

## ① A §C-kapu az URL-t is „üzenetnek" olvasta — KÉT irányban rontott

A leltár C2 tétele a hamis FLAG-ről szólt. A mérés ennél többet talált: **ugyanaz a
gyökér-ok a levél-ágon hamis PASS-t is termelt.**

**Hamis FLAG (a bejelentett tünet).** A `PLACEHOLDER_CONTACT` őr (`000-0000|1234567|xxx`,
`/iu`) a nyers szövegen mért, amiben benne van a link. A token
`randomBytes(18).toString("base64url")`, és a base64url ábécében ott vannak a betűk:
**2 000 000 generált tokenből 1 222 tartalmaz `xXx`-variánst → 1 : 1637.** 595 leadnél ez
~30% esély, hogy legalább egyet elszenved. Mérve mindkét csatornán: `xXX`-es tokennel a
lead kiküldhetetlen, és az operátor egy nem létező placeholder-telefonszámot keres egy
teljesen rendben lévő feladó-blokkban.

**Hamis PASS (ez volt a súlyosabb, és nem volt bejelentve).** Az ADR-0112 az SMS-ágon
már áttette a „mit MOND az üzenet" szabályokat a prózára — **a levél-ág kimaradt**.
Éles link-alakkal mérve (`https://citoviso.com/p/<slug>/<token>`):

| lead-név | verdikt | miért |
|---|---|---|
| `Bagolyvar` | a C3 ÁTMEGY | a név a slugban van |
| `Mintaterv Vendeghaz` | a C4 keretezés ÁTMEGY | a „terv" a slugban van |
| **`Mintaterv`** | **PASS, ÜRES okokkal** | egyszavas név → mindkettő az URL-ből teljesül |

Vagyis egy **teljesen névtelen tömeg-levél**, amiben nincs se a címzett neve, se
terv-keretezés, átment a kapun. **595 leadből 39 egyszavas nevű.**

**Javítás.** Közös `proseOf(text, urls)` helper; minden „mit mond az üzenet" szabály erre
mér mindkét csatornán (placeholder-kontakt, C3 személyre szabás, C4 félrevezetés +
keretezés, jogalap-mondat, ár-állítás). A link JELENLÉTÉT és elérhetőségét továbbra is a
nyers szöveg dönti el — az a szabály tényleg az URL-ről szól.

**Az őr hatóköre = a doktrína.** A `sms-gate-selftest.mts` → **`outreach-gate-selftest.mts`**
(pre-commit átkötve): most a levelet is méri. Új benne egy **szerkezeti** állítás, ami nem
egy szabályt nevez meg, hanem a tulajdonságot: *3 000 valódi tokennel a verdikt
változatlan* — ez akkor is fog, ha valaki később ír egy ÚJ szabályt a nyers szövegre.
Plusz 6 levél-negatív eset, éles URL-alakkal (dev URL-lel a teszt a rossz okból lenne zöld
— ADR-0112 tanulsága).

**RED-kontroll:** a javítás visszavonásával az őr pontosan a 3 érintett állítást bukja
(token-invariáns + a két levél-NO-OP), exit 1.

## ② A dev DB-nek nem volt mentése — most van, és ellenőrzi magát

Az ADR-0086 napi mentése az **élest** húzza le; a dev DB-n **nulla** mentés volt.
Az „eldobható tesztadat" itt téves: 595 lead + 2 119 provenance-sor, hetek scrape-munkája,
egyetlen lemezen, ~10 párhuzamos session közös használatában, menet közbeni törlésekkel.

- **`scripts/backup-dev.sh`** — napi 4× (00/06/12/18:15), 28 pillanatkép + havi archív,
  `~/backups/citoviso-dev/` (700-as jogosultság: valódi kontakt-adat van benne).
  Tábla-lista **származtatott** (a DB-ből, nem kézi listából — a 09-08-i purge-mentésből
  pont ezért maradt ki két kaszkád-tábla). A `sites/`-ból a `_`-os mérés-könyvtárak
  kimaradnak: **mérve 249 MB-ból 242 MB az `_engine-proof`**, ami újragenerálható.
  Egy pillanatkép így 1,3 MB.
- **`scripts/lib/backup-verify.sh`** — a visszaállítás-ellenőrző MOST KÖZÖS az élessel.
  Ezt a script saját kommentje írta elő („külön »ellenőrző« implementáció elcsúszna");
  ugyanez áll két MENTÉSRE is.

**Két dolog, ami csak méréssel jött elő:**

1. **A `pg_dump` megtagadta a munkát.** A dev cluster az `@embedded-postgres` csomagé
   (18.4), a Debian 13 viszont csak 17-es klienst szállít. Az éles mentést ez sosem
   érintette, mert ott a TÁVOLI gép `pg_dump`-ja fut. Megoldva: PGDG-tároló +
   `postgresql-client-18` (tulaj-engedéllyel, csak a dev gépen). A lib mostantól
   **megméri** a kliens/szerver főverziót, és névvel mondja meg a teendőt — különben egy
   gép-újratelepítés némán visszahozná, egy ütemezett mentésnél pedig a néma bukás a
   legrosszabb fajta.
2. **⛔ A visszaállítás-próba NEM fogta meg a csonkolást.** Mérve: egy **95%-ra csonkolt**
   dumpon a `pg_restore --exit-on-error` **exit 0-t ad**, a visszaállítás lefut, és minden
   sorszám egyezik — mert a levágott farokba üres táblák adat-blokkjai és FK-definíciók
   estek. Vagyis a „visszaáll és annyi sor van benne" ellenőrzés elvileg vak erre az
   osztályra, és zölden jelentett volna egy csonka mentést. Javítva: `db.dump.sha256` a
   kiíráskor, ellenőrzés visszaálláskor. **Az éles mentés is megkapta.** A régi, összeg
   nélküli mentések továbbra is ellenőrizhetők, de a kimenet KIMONDJA, hogy a csonkolás
   náluk nem kimutatható.

**RED-kontroll:** csonkolás 50/95/99%-ra, hamis sorszám a manifesztben, hiányzó tábla-adat,
hozzáfűzött szemét → mind bukik. Az éles ág `--verify-only`-ja a megosztás után is zöld.

---

## Módosított / létrehozott fájlok

- `src/outreach/outreachCheck.ts` — `proseOf()`; minden tartalmi szabály a prózán
- `scripts/outreach-gate-selftest.mts` — átnevezve `sms-gate-selftest.mts`-ből, levél-ág
  + token-invariáns + 6 levél-negatív eset
- `hooks/pre-commit` — az őr átkötve az új névre
- `scripts/lib/backup-verify.sh` — ÚJ, közös ellenőrző (kliens-verzió + sha256 + restore)
- `scripts/backup-dev.sh` — ÚJ, dev mentés
- `scripts/backup-pull.sh` — a közös ellenőrzőre állítva + sha256 a kiíráskor
- `deploy/systemd/citoviso-backup-dev.{service,timer}` + `README.md` — ÚJ unit
- gép: PGDG-tároló + `postgresql-client-18`; `citoviso-backup-dev.timer` enabled

## Nyitott kérdések / következő lépés

1. **A leltár C1 és C3 tétele nyitva.** C1 (a „következő számla" bontása nem tartalmazza a
   domain éves díját) §2b terv-kaput igényel; C3 (a landing „térképen"-ígérete ADR-0107
   után túlígérés) **tulajdonosi szöveg-döntés**.
2. **A levél-kapunak nincs feladó-azonosítás szabálya.** Az SMS-ágon van
   (`senderIsIdentifiable`), a levélnél csak a kitöltetlen placeholder-jelölőt nézzük.
   Ma nem éles rés (a levél-sablon viszi az aláírást), de a szimmetria hiányzik.
3. **A B-blokk (nagy élesítés) érintetlen** — a mai munka is a lokál kötegbe kerül.
4. Az `_engine-proof` 242 MB a fő fa `sites/`-jában ott marad; a mentésből tudatosan
   kimarad, de magától nem takarodik.
