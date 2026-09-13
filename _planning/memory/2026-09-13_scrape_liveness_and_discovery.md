# 2026-09-13 — A scrape: a néma futás és a 20-as plafon

**Indító mondat (tulaj):** „Élesben pár napja indítottam a scape-et és nem futott le."
**Záró mondat (tulaj):** „Ez a motorja az egész vállalkozásnak! Ennek MINDENT MEG KELL TALÁLNIA!"

Egy bejelentésből két, egymástól független hiba jött elő. ADR-0137 (felderítés) és
ADR-0138 (életjel + deploy-kapu).

## ① Amit bejelentett: a „running", ami két napja halott volt

Mérve (éles, csak olvasás):
- a futás ELINDULT 2026-09-11 08:49:59-kor és ~3 percig ment;
- 06:52:53 UTC-kor egy **deploy** újraindította a `citoviso-console`-t
  (`DEPLOYED`: `prod/20260911-0853`), a unit `KillMode=control-group`;
- a scrape a konzol **gyerekfolyamata** (`scrapeJob.ts` spawn) → a systemd a cgrouppal
  együtt megölte; 0 lead, `finished_at` NULL, `error` NULL, státusz `running`.

**Miért nem derült ki:** a `failScrapeRun()` csak a folyamaton BELÜLI hibát zárja le; a napló
a konzol memóriájában élt (ring buffer), tehát az újraindítással elpárolgott.

Javítás: életjel (0066 migráció) + fázis a soron + SIGTERM-re önlezárás + olvasás-úti takarítás
+ magyar státusz-szótár + Europe/Budapest idő + deploy GATE 4.
Őr: `scripts/scrape-liveness-check.mts` (24 állítás, `--pixel` böngésző-méréssel, önteszttel).

**Élesítve:** `9cfc5e7` → `prod/20260913-1818`. Az éles beragadt sor magától lezárult.

## ② Amit közben találtunk: a felderítő motor 20-nál megállt

A napló egy sora (`[google_places] 20 players`) mellett 1009 OSM-találat állt. Ok: EGY
`searchText` hívás, EGY kulcsszó, első lap. Se lapozás, se terület-felosztás.

Mérve az ÉLES API-n, ugyanarra a Badacsony-dobozra:

| verzió | találat | hívás | telített csempe |
|---|---|---|---|
| régi (1 hívás, 1 kulcsszó) | 20 | 1 | – |
| új, 0,02° padló | 258 | 50 | 2 |
| új, 0,005° padló | **310** | 160 | 0 |

Ebből 129 honlap nélküli = lead-jelölt. Őr: `scripts/scrape-coverage-check.mts`.

Második lyuk ugyanitt: az első **perc**-kvóta 429 az egész dúsítási kört megölte (924 leadből
~900 maradt Places-adat nélkül), pedig a perc-limit 60 mp alatt gyógyul. Most: közös transzport
RPM-fékkel és korlátos kivárással; a NAPI kvóta azonnal, osztályozva (`quotaScope`) bukik.

**Élesítve NINCS** — a tulaj úgy döntött, a többi committal együtt megy ki (`0307438`).

## Amit magamról tanultam (mind mérésből, nem önvizsgálatból)

- **A viewport nem a vágó doboz.** A mobil-levágást a képernyőhöz mértem és zöldet mondtam;
  valójában a `.tblwrap` görgető konténer vágott 10 px-t minden sorból. A tudásbázis-őr fogta meg.
- **A `position: sticky` a colspan-os cellán némán hatástalan** (a cella = a sor szélessége):
  teljes oldalra húzás után a magyarázat minden sora szó közepén levágódott — nyugalmi
  helyzetben viszont a mérésem zöld volt. A tapadás a `span`-re való.
- **A fixture alakja dönti el, mit mér az őr.** A pixel-mérésem csupa tördelhető prózát kapott,
  ezért a VALÓDI (URL-es) hibaüzenet 396 px-es kilógása átcsúszott rajta.
- **A „csak-újat számolok" mérce hazudik a telítettségről** (a bejárásban): egy másik kulcsszó
  által már lefedett sűrű csempe üresnek látszana, és kimaradna a felosztás.

## Nyitott

1. **Nincs lefedettség-mérőszám, és a nyilvántartás sem segít.** Az `enrichPlaces` beírja magát
   a lead `sources` mezőjébe, a `discovery` provenance-sorok pedig ebből épülnek → a DB 450
   leadre mondja, hogy „google_places találta", miközben a régi forrás futásonként max 20-at
   tudott. A „ki TALÁLTA" és a „ki DÚSÍTOTTA" egy mezőbe csúszott, ezért capture–recapture
   becslés sem készíthető. **Első lépés: a provenance szétválasztása.**
2. **A portál csak adatlap, nem katalógus.** 592 leadből 34-nek van portál-adatlapja. A
   portálok régió-listái (szallas.hu, zimmerinfo, hovamenjek, booked.hu) pont a honlap nélküli
   szereplőket sorolják — a legértékesebb szegmensünket —, de ma csak akkor nyitjuk meg őket,
   ha egy MÁR megtalált leadhez keresünk adatlapot.
3. **Places: típus-alapú keresés** (`includedType: lodging` / Nearby) a kulcsszavas mellé — a
   relevancia-rangsor kulcsszó-vak marad arra, ami máshogy nevezi magát.
4. **OSM tag-kör:** ma 8 `tourism` érték; mérni kell, hány NEVES objektum esik ki a szűrőn.
5. **Gyökér-törékenység:** amíg a scrape a konzol gyereke, minden konzol-újraindítás megöli.
   Mérve újra 19:51-kor (párhuzamos szál élesítése) — a GATE 4 csak azt védi, aki a
   deploy-scriptet használja. Külön systemd-egység kell.

## Módosított fájlok

`migrations/0066_scrape_run_heartbeat.sql` · `src/db/schema.ts` ·
`src/scraper/{persist,run,enrichPlaces}.ts` · `src/scraper/sources/googleMaps.ts` ·
`src/console/{data,views}.ts` · `public/assets/ui/citui-console.css` ·
`scripts/{deploy-prod.sh,scrape-liveness-check.mts,scrape-coverage-check.mts,kb-shot.mts}` ·
`kb/entries/console-scrape/*` · `_planning/DECISIONS.md` (ADR-0137, ADR-0138)
