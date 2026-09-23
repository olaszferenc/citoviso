## ADR-0114 — Az „egész szállás" FÖLÉRENDELT egység: a szobáival kölcsönösen kizárják egymást (2026-09-08)

**Kontextus.** Az ADR-0044/b óta a foglaltság az EGYSÉGHEZ tartozik (`site_unit`), és minden
site kap egy alapértelmezett egységet („A szállás egésze"), hogy az egy-egységes tulaj soha ne
találkozzon a fogalommal. Ez a modell viszont az egységeket **teljesen izoláltnak** kezelte: az
„egész szállás" csak egy NÉV volt, semmilyen kapcsolat nélkül a szobákhoz.

**Mérve (2026-09-08, a kódban végigkövetve):** ha az egész szállást lefoglalják szept. 10–12-re,
az `Apartman1` ugyanarra a napra **foglalható marad** — `availability_day` kulcsa `(unit_id, day)`,
és mind az űrlap-ellenőrzés, mind az elfogadás-tranzakció CSAK a kért egységre kérdez. Vagyis a
rendszer **maga termeli a dupla foglalást**, pont abban a szegmensben, amelyik ezt a legkevésbé
tudja lekezelni (a tulaj egy telefonhívásból tudja meg, hogy két vendéget hívott ugyanoda).

**A tulaj rendelete (szó szerint):** „kell a szállás egésze, mert akkor az egész szállás! Na de!
Ilyenkor ha valaki az egész szállást kéri, akkor a többi egység adott napokra ne legyen elérhető.
ERGO az egész szállás mint egység mindig van, alapértelmezett."

### Döntés

1. **A fölérendeltség ADAT, nem névegyezés.** `site_unit.is_whole_property` (migráció 0059),
   site-onként legfeljebb egy (részleges unique index). A tulaj átnevezheti („A teljes ház"),
   a szabály nem a néven lóg.
2. **A kizárás KÉTIRÁNYÚ**, mert ugyanazt a fizikai tényt írja le — a házat nem lehet kétszer
   kiadni: az egész foglalása minden szobát elvesz arra az éjszakára, és **bármely** szoba
   foglalása elveszi az egészet.
3. **A szobák egymást NEM zárják.** Egy négy-apartmanos ház egyszerre négy foglalást vesz fel;
   az ellenkező irány ugyanolyan drága hiba lenne, ezért az őr külön méri.
4. **LEVEZETETT, nem tárolt.** Árnyék-sorokat írni az `availability_day`-be minden lemondásnál,
   lejáratnál és egység-törlésnél vissza kellene bontani — egyetlen kimaradt visszabontás olyan
   éjszakát hagy, amit senki nem tud felszabadítani. A `blockingUnitIds()` egy id-lekérdezéssel
   megmondja, kinek a foglaltsága számít; minden olvasó ezt használja.
5. **A szabály MIND A NÉGY kapun érvényes**, mert bármelyik kihagyása visszanyitja a rést:
   a vendég naptára (`getBlockedDaysFrom` → `/api/foglaltsag`), az űrlap gyors-elutasítása,
   az elfogadás-tranzakció (`isRangeFree` + a beírás előtti újraellenőrzés) és az admin
   hónap-nézete (`getMonthAvailability`).
6. **Az elfogadás az ÜTKÖZŐ kéréseket is lezárja** a kizárt egységeken: ha az egészet fogadja el
   a tulaj, a szobákra váró kérések automatikusan elutasításra kerülnek (és fordítva) — azok az
   éjszakák tényleg elfogytak, lejáratig várakoztatni őket a vendégnek hazugság.
7. **Az egész szállás NEM törölhető** (átnevezni lehet): ő a kizárás horgonya. Törölhetővé téve
   a szobák csendben visszakerülnének a régi, egymástól független állapotba.
8. **A más egység által tartott éjszaka az adminban ZÁROLT** (`source: "linked"`, nem
   szerkeszthető) — ugyanaz az elv, mint a portálról importált napnál: ha itt fel lehetne
   szabadítani, azzal adnánk el másodszor.

**Backfill (0059).** A migráció CSAK ott jelöl, ahol egyértelmű: a site egyetlen egysége, vagy a
nevén hordja („A szállás egésze"). Több, átnevezett egységnél nem TALÁL KI fölérendelt egységet —
az a tulaj tudta nélkül változtatná meg, mi foglalható; ott az `ensureUnits()` pótolja
(az első egység az, amit annak idején ő maga hozott létre az egész szállásként).

**Mérés.** `scripts/whole-property-check.mts` — saját eldobható fixture-ön méri mind a hat
állítást, és **negatívan is**: `--self-test` módban kiveszi a `is_whole_property` flaget, és
elvárja, hogy a mérések átbilljenek a 0113 ELŐTTI (hibás) viselkedésre. Ha az önteszt is zöld
lenne, az őr nem a szabályt mérné, hanem a semmit.

**Nyitva:** a naptár felirata („Az egész szállás foglalása miatt" vs. „Egy másik egység miatt")
a §2b felület-kapun várakozik a foglalás-képernyő tervével együtt; addig a zárolt nap a meglévő
minta szerint jelenik meg.
