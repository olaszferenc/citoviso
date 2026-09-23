## ADR-0137 — A felderítés PLAFONJA nem lelet: a motor bejárjon, ne egyszer kérdezzen (2026-09-13)

**Kontextus.** A tulaj bejelentése így indult: „élesben pár napja indítottam a scrape-et és nem
futott le." A vizsgálat két, egymástól független hibát talált — az egyik a futás LÁTHATÓSÁGÁRÓL,
a másik magáról a FELDERÍTÉSRŐL szólt. A második a súlyosabb: ez a motorja az üzletnek.

**Amit mértünk.**
① A Google Places forrás EGY `places:searchText` hívást intézett EGY kulcsszóval („szállás"),
és a válasz első lapját (20 elem) hitte a régió teljes válaszának — se `pageToken`, se
terület-felosztás. Balaton-Keleten ez **20 hely** volt a Google-ből, **1009** mellett az
OSM-ből, egy 64×46 km-es dobozra. Az API lekérdezésenként legfeljebb 60-at ad ki, relevancia
szerint rangsorolva: egy kulcsszó tehát **szerkezetileg vak** arra, ami máshogy nevezi magát.
② Az első perc-kvóta 429 (`SearchTextRequest per minute`) véglegesnek minősült
(`enrichPlaces`: „a kvóta nem gyógyul egy futáson belül"), és a dúsítás mind az 5 szála leállt:
924 leadből ~900 maradt Places-adat (telefon, fotó) nélkül — egyetlen percnyi türelem híján.
A perc-limit 60 mp alatt magától gyógyul; a NAPI kvóta nem. A kettőt egy szó („quota") mosta össze.

**Döntés.**
1. **A felderítés BEJÁRÁS, nem lekérdezés.** Kulcsszó-halmaz (az iparág paramétere, mint az OSM
   tag-szűrő) × csempe; minden lekérdezés lapozódik a végéig; a 60-as plafont ÜTŐ (csempe ×
   kulcsszó) lekérdezés **telített** — az a terület többet rejt, mint amennyit az API valaha
   megmutat egy kérdésre —, ezért a csempe negyedelődik. Az egyesítés `place id` szerint megy.
2. **A telítettség a LEKÉRDEZÉSRŐL szól, nem a nyereségről.** A felosztás feltétele az, amit az
   API VISSZAADOTT, nem az, hogy hány új helyet hozott: az „csak-újat számolok" mérce egy
   korábbi kulcsszó által már lefedett sűrű csempét üresnek látna, és kihagyná a felosztást.
3. **A csempe-padló a településmag alatt legyen.** Mérve (éles API, Badacsony-doboz): 0,02°
   padlóval 2 csempe telített maradt és 258 hely jött; 0,005° padlóval nulla telítettség és
   **310 hely**. Az üdülőfalvak néhány utcába több mint 60 adatlapot pakolnak — a padló a
   tömbméret alatt kell legyen, különben épp a legsűrűbb (= legértékesebb) magok maradnak
   félig látva.
4. **Ami a várakozással gyógyul, arra VÁRUNK; ami nem, azt kimondjuk.** Egy közös transzport
   (`placesSearchText`) visz minden Text Search hívást: RPM-fék + a perc-429 korlátos
   kivárása; a napi kvóta és az auth-hiba azonnal, **osztályozva** (`quotaScope: minute|day`)
   jut a hívóig. A hívó csak azt tekinti végzetesnek, amit a várakozás nem old meg.
5. **Néma plafon SOHA.** A hívás-keret kimerülése hangos figyelmeztetés, a padlón telített
   csempe nevesítve naplózódik. A most javított hiba lényege épp az volt, hogy a plafon
   leletnek látszott.

**Következmény.** Éles API-n mérve ugyanarra a dobozra: **20 → 310 hely** (15×), ebből 129
honlap nélküli lead-jelölt. Őr: `scripts/scrape-coverage-check.mts` (szintetikus, lapozó és
fajta-vak Places-világ; lefedettség ≥95%, perc-429-túlélés, napi-429 azonnali bukás), önteszttel:
az egy-hívásos viselkedés pontosan 20-at talál, és a mérés pirosra vált.

**Nyitott — és ez a fontosabb fele.** A lefedettségre ma NINCS mérőszámunk, és a nyilvántartás
sem segít: az `enrichPlaces` beírja magát a lead `sources` mezőjébe, a `discovery` provenance-sorok
pedig ebből épülnek (`persist.ts`). Ezért a DB ma 450 leadre mondja, hogy „google_places találta",
miközben a régi forrás futásonként legfeljebb 20-at tudott adni — a „ki TALÁLTA meg" és a „ki
DÚSÍTOTTA" egy mezőbe csúszott. Amíg ez így van, a források átfedéséből (capture–recapture) nem
becsülhető az állomány mérete, tehát a „mindent megtalálunk?" kérdés megválaszolhatatlan.
Első lépés: a provenance szétválasztása (`discovery` vs `match`).

**Visszafordíthatóság:** 🔄 kód-szintű, adat-migráció nélkül; a bejárás env-kapcsolókkal
hangolható (`PLACES_DISCOVERY_MAX_CALLS`, `PLACES_MIN_TILE_DEG`, `PLACES_MAX_RPM`).
