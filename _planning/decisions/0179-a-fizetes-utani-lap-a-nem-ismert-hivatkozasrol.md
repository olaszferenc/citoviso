## ADR-0179 — A fizetés utáni lap a NEM ISMERT hivatkozásról sem találgat; és a néma átjárót ki kell mondani (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** ELFOGADVA (tulajdonosi utasítás: a landolást blokkoló
hibát is javítsam, két feltétellel) · **Kapcsolódó:** ADR-0178 (ugyanez a szál: halott
gomb-osztály), §B.17 · **Őr:** `scripts/consent-style-check.mts`.

⚠️ **ELŐSZÖR AZ, AMI NEM AZ ÉN ÉRDEMEM.** A `/pay/done` 500-as összeomlását — a `resp.json()`
nyers hívását a gateway nem-JSON válaszán, és a `handleWebhook` védtelen hívását a route-ban —
**egy PÁRHUZAMOS SZÁL találta meg és landolta ELŐBB**, tőlem függetlenül, ugyanazon a napon.
A rebase konfliktusában szembesültem vele: az ő változatuk él, az enyém duplikátum volt, ezért
**az övék maradt**. (Az ő megoldásuk egy ponton jobb is: a törzset `text()`-tel olvassa be és
abból parszol, mert a `json()` utáni `clone()` „Body has already been consumed" hibát szült —
azaz a fallback a SAJÁT hibájáról beszélt volna, eltakarva a valódi okot.)
Ez az ADR CSAK azt rögzíti, ami ezen felül maradt.

**A mérésem — amit érdemes megőrizni, mert a GYÖKÉROKRÓL szól.**
A park `paid` fizetés-során (`gateway_ref = park-seed-2609d02b-…`) a `GetPaymentState` válasza:

> `HTTP 429`, `content-type: text/html`, törzs: `<html><body><h1>429 Too Many Requests</h1> …`

⛔⛔ **Az első olvasatom hamis volt:** azt hittem, „a mock átjáró HTML-t ad a teszt-hivatkozásra",
vagyis dev-szemét. A napló cáfolta: a válasz a **VALÓDI Barion API-tól** jött, és **rate limit**
volt. A különbség óriási: nem „teszt-adat", hanem olyan mechanizmus, ami **élesben egy FIZETŐ
VEVŐNÉL** sül el, közvetlenül a kártyaterhelés után. (Malformált hivatkozásra mérve: `HTTP 400`
+ JSON `Model Validation Error` — az sem végállapot.)

**Döntés — ami ebben a commitban új.**
① **Ismeretlen vagy elavult hivatkozás: valódi lap, nem 404-es zsákutca.** A `/pay/done` eddig
`404 „Nincs ilyen fizetés."`-t adott: se azt nem mondta meg, mi történt, se azt, hova menjen a
vevő. Az új `payUnknownRefPage` mindkettőt megmondja.
⛔ **És kimondottan NEM állít semmit a kimenetelről:** nem ismerjük a hivatkozást, tehát nem
tudjuk, történt-e terhelés — a megnyugtató („nem terheltük meg") és az ijesztő („sikertelen")
mondat **egyaránt találgatás** lenne (§B.17). A lap a bankkivonatra irányít.
② **A néma átjárót a KÉPERNYŐ is kimondja.** A „feldolgozás alatt" lap magától frissül, ami azt
sugallja, hogy „mindjárt megjön" — holott ha a gateway-hívás elhasalt, épp az a csatorna néma,
amiből a válasz jönne. A lap ilyenkor kiírja, hogy a szolgáltatót nem értük el, és hogy a
képernyő a saját nyilvántartásunkat mutatja.

**Az őr — determinizmus a hiba ELFEDÉSE NÉLKÜL (tulajdonosi feltétel).**
A `consent-style-check` `executeTakeFirst()`-tel, **`orderBy` nélkül** választott fizetés-sort:
futásonként MÁS lapra mért, tehát a bukását „villódzásnak" lehetett volna könyvelni. Most
determinisztikusan rendez — **de ettől a hiba nem tűnik el**, mert ugyanez a commit egy ÚJ,
ELSŐ állítást ad hozzá: **„a lap HIBA NÉLKÜL szolgálódik ki"** (HTTP < 400). Hibalapon eddig a
sáv-mérések a TÜNETRŐL beszéltek („hiányzik a `.panel`"); mostantól az első mondat az, hogy a
lap elszállt. Egy 500 tehát **PIROS**, nem kimaradás. ⭐ Épp ez a tünet-hazugság vitt félre
engem is: a `.panel` nem hiányzott, a lap omlott össze.

**Amit ez NEM old meg (kimondva).** A **429-et magát** semmi. Minden `/pay/done` megnyitás egy
`GetPaymentState`-et indít, és a gép párhuzamos szálai fogyasztják a kvótát. Ha éles forgalomban
is előjön, a helyes irány a lekérdezés gyérítése (cache/backoff) — **külön kör**, és ez az ADR
nem állítja, hogy megtörtént.

**Visszafordíthatóság:** 🔄 nincs séma- vagy adatváltozás; fizetés-állapotot ez a commit sosem ír át.
**Élesítés:** NINCS (§0.3).
