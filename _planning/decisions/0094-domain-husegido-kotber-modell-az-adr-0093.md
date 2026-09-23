## ADR-0094 — Domain-hűségidő = kötbér-modell (az ADR-0093 ③ „háromutas átszállás" FELÜLÍRVA)

**Dátum:** 2026-09-03 · **Státusz:** ELFOGADVA (tulajdonosi döntés, szó szerint: *„Olyan opció nem
lehet, hogy a hűségidő előtt lemondja a szolgáltatást!!!! … Lemondhatja a szolgáltatást, elviheti a
domaint … Csak akkor a fennmaradó hónapszámot és a domain definiált vételárát meg kell fizetnie.”*)
· **Felülírja:** ADR-0093 ③ (a „hűség-kivásárlás" út) · **Kapcsolódó:** ADR-0020, ADR-0071,
ADR-0080 (dunning/freeze), ADR-0093 ①②④ (ár-plafon, 12 hó, paraméterek — VÁLTOZATLANUL élnek).

**Kiváltó:** az ADR-0093 ③ terv-mockjait a tulaj elvetette — a modell önellentmondó volt: az
„elköteleződés" mellett a lemondás ingyen ment (csak a domain veszett el), így a hűségidő nem
volt hűségidő, a „maradj még N hónapot" opció pedig ennek a lyuknak a foltozása.

### Döntés — a klasszikus hűséges konstrukció

**① A domain-szolgáltatás = hűség-vállalás.** Előre definiált hűségidő + minimum tarifacsomag
vállalása → a domain 0 Ft, és a hűségidő KITÖLTÉSEKOR a tulajdonjog díjmentesen átszáll
(a meglévő „lejárat + 90 nap + maradéktalan fizetés" szabály él).

**② A hűségidő alatt NINCS szabad lemondás.** Korai kilépés kizárólag elszámolással:
- **kötbér = a hátralévő hónapok díja** (a vállalt minimum tarifán) — MINDIG jár;
- **+ a domain definiált vételára** — CSAK akkor, ha a kilépő a domaint el is viszi (tulaj-döntés:
  kiléphet domain nélkül is, akkor a domain nálunk marad, vásárlásra nem kényszerítünk).

**③ A behajtás elsődlegesen ÖNVÉGREHAJTÓ, nem per.** A domain a zálog: amíg az elszámolás nincs
maradéktalanul rendezve, a tulajdonjog nem száll át (ÁSZF §9), a nemfizetésre pedig a meglévő
gépi út válaszol (ADR-0080 dunning → freeze). A jogi behajtás szerződéses opció marad, de a
konstrukció enélkül is zárt.

**④ Csomag-padló a hűségidő alatt (tulaj-döntés: „a vállalt minimum a padló").** Fölfelé (új
modul) bármikor mehet — az upsell él —, a vállalt minimum alá viszont nem csúszhat: a
modul-lemondás/lefokozás a padló alatt tiltott a hűségidő végéig. ⚠️ Rés volt: a modul-felületen
a szabad lemondással a „minimum tarifacsomag" kijátszható lett volna. A padló értéke a
RENDELÉSKOR FAGY BE (`order_intent.committed_min_monthly`) — az operátor későbbi ár-módosítása
a futó hűségeket nem írja át. Ingyen-küszöböt el nem érő (éves díjat fizető) domain-rendelésnél
padló nincs (ott a vállalás a 12 hó előfizetés maga).

**⑤ Kivezetés:** a „hűség-kivásárlás hossza" paraméter (ADR-0093 ④, `domain_loyalty_months`)
TÖRÖLVE — a modellben nincs ilyen út. A „kivásárlási fix ár" paraméter marad: ez a domain
definiált vételára a ②-beli elszámolásban.

**⑥ ÁSZF §9:** a kivásárlós bekezdés újraírva a kötbér-modellre (hűségidő alatti felmondás csak
elszámolással; kötbér + opcionális domain-vétel; csomag-padló kimondva).

**Felület:** a felmondás-flow elszámolás-képernyője (hátralévő N hó = X Ft + domain-vételár = Y Ft
választhatóan) → ÚJ §2b terv-kör, a régi „háromutas" mockok eldobva.

**Visszafordíthatóság:** 🔄 — paraméter-törlés + additív order-oszlop + szöveg; a kötbér-érvényesítés
maga jogi/ügyviteli gyakorlat kérdése, kód-oldalon a zálog-logika (③) hordozza.
