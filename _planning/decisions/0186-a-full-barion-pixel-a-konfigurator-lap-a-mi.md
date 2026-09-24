## ADR-0186 — A Full Barion Pixel: a konfigurátor-lap a MI lapunk lesz, és a Pixel csak hozzájárulás után beszél (2026-09-16)

**Dátum:** 2026-09-16 · **Státusz:** ELFOGADVA (tulajdonosi döntés: Advanced díjcsomag) ·
**Kapcsolódó:** ADR-0110 (a sáv bevezetése), ADR-0145 (a sáv stílusa + a navigáció szabadsága),
ADR-0151 (a hatókör a CÍMZETTÉ) — **ez az ADR az ADR-0151 útvonal-listáját módosítja**,
ADR-0172 (egy forrás, két kiszolgáló) · **Kapu:** `scripts/barion-pixel-check.mts`.

**Kiváltó.** A Barion elfogadóhely-bírálata (Remark -001/2) Full Pixelt kér, mert a
jelentkezéskor a kedvezményes díjcsomag lett bejelölve. Megmérve (Barion díjszabás,
2026-01-17): Starter 1,49% vs. Advanced 1,19% — 0,30 százalékpont, ami a mai méretünkön
ügyfelenként ~12 Ft/hó. A tulaj a méréssel a kezében is az **Advanced**-et választotta.

**Döntés ① — a `/p/<token>` és a `/configure/<id>` a SAJÁT lapjaink közé kerül.** A Full
Pixel a kosár- és pénztár-lépéseket kéri, azok pedig kizárólag ezen az egy lapon történnek;
a `/pay/…` már csak az eredményt látja. Az ADR-0151 ① kritériuma („ahol a látogató a mi
leendő ügyfelünk, ÉS ahol a mi fizetési utunk futhat") erre a lapra **igaz volt eddig is** —
csak az útvonal-lista mondott mást. ⛔ A `/mock/` és a `/site/` MARAD vendég-lap: azok
címzettje tényleg a szállás vendége. **Ára, kimondva:** a süti-sáv megjelenik az ajánlat-lapon
is; a kettő nem választható szét (ADR-0145 ③).

**Döntés ② — a Pixel egyetlen kapun szól: `window.citPixel(név, adat)`.** A gazdalap nem hívja
közvetlenül a Barion API-t. Hozzájárulás előtt az esemény a lap MEMÓRIÁJÁBAN várakozik, és
kizárólag az „Elfogadom" után megy ki; elutasításkor a sor soha nem ürül. Szerver-oldalon tudott
eseményt (a megtörtént `purchase`-t) a lap deklaratívan ad be (`pixelQueueScript()`).
⭐ **Miért nem dobjuk el a várakozókat:** a sáv a lap tetején jelenik meg, a vevő viszont
azonnal kapcsolgat — eldobással pont a kosár-események vesznének el, amiért az egész készült.

**Döntés ③ — a `revenue` és a szervernek beküldött ár EGY forrásból jön** (`payableTotal()`).
A képlet eddig egyetlen példányban, a beküldő törzsében élt; a Pixel egy második példánnyal két
igazságot mondott volna ugyanarról a vásárlásról. A kapu ezt a két számot hasonlítja össze.

**Döntés ④ — a hozzájárulás-sáv a legfelső réteg.** Mérve: a konfigurátor takarója
(z-index 2147483000+) elfogta a kattintást a sávról (9000) — a kérdés ott állt, de nem lehetett
rá válaszolni. A sáv 2147483600-ra emelve, a konfigurátor bútorzata pedig a `--citui-consent-h`
magasságot tartja fenn (ADR-0145 ④ ugyanazon tanulsága, új felületen).

**Amit a mérés a Barion oldaláról kiderített** (a doksi robotvédelem mögött volt, ezért a
`bp.js` 0.4.0 FORRÁSÁBÓL): (a) a szkript **magától nem küld `contentView`-t** — a Base nálunk
emiatt a JS-es látogatókra néma volt; (b) a kimenő üzenet egy iframe-hez kötött, amely
háromlépcsős kézfogással épül fel, és a `window.load`-hoz tapad.

**⛔ Két saját tévedés, mindkettő kimondva.** ① Először azt jelentettem, hogy „a Pixel élesben
soha nem küldött semmit" — ez a saját hiányos teszt-stubom műterméke volt (nem játszottam le a
kézfogást). ② Miután pótoltam, az ellenkontroll alapján azt állítottam, hogy a `load`-javítás
fölösleges — az viszont egy szerencsés időzítés volt: gyors elfogadásnál nélküle **6 állítás
bukik**. A hiba időzítés-függő, a javítás marad. Forrás-olvasatból vont következtetés nem mérés.

**Kapu.** `scripts/barion-pixel-check.mts` — valódi böngésző, valódi sablon, **a Barion élő
`bp.js`-e és annak saját validátora**; 15 zöld állítás (hozzájárulás-kapu mindkét irányban,
lap-megtekintés, kosár oda-vissza, kötelező mezők, pénztár + fizetésre átadás, ár-egyezés,
0 JS-hiba). **Piros önteszt:** a kosár-tétel kötelező `unitPrice` mezőjét elrontva a Barion
validátora eldobja az eseményt → 2 bukás. ⚠️ Hálózat nélkül az őr **hangosan kihagy** (rc=2),
nem ad PASS-t.

**Visszafordíthatóság:** 🔄 két útvonal-minta, egy z-index és egy futtató-réteg; nulla séma.
**Élesítés:** külön engedéllyel (§0.3).

**Kiegészítés (2026-09-24) — a bírálat lezárult, a TÉNYLEGES díj 1,39%.** A Barion a -001-es
észrevétel felülvizsgálata után az elfogadóhelyet az **Advanced Fix 1,19%** díjcsomagba tette.
Az ismétlődő fizetés (recurring) felára **+0,2%**, és mi előfizetést árulunk, ezért a ténylegesen
beállított díj **Fix 1,39%**. ⛔ Díjszámításnál ezt vedd alapul, ne a fenti 1,19%-ot. A Barion
Metrics elemzési adatai az Elfogadóhelyek menüpontban, az elfogadóhely neve mellett érhetők el.
