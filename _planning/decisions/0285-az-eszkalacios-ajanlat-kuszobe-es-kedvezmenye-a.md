## ADR-0285 — Az eszkalációs ajánlat küszöbe és kedvezménye a /pricing-on állítható (2026-09-30)

**Dátum:** 2026-09-30 · **Státusz:** elfogadva (SUB, koordinátor: CIT fő session; brief:
`~/rc-briefs/eszkalacios-ajanlat-admin.md`; a felület §2b-terve jóváhagyva: „A” változat) ·
**Kapcsolódó:** ADR-0088 §4 (az eszkalációs mechanizmus: N. látogatás vásárlás nélkül → egyszeri, 72 órás
ajánlat az oldalon, majd e-mailben), ADR-0128 (a mentés nem dobhat el mezőt, amit a lap mutat),
`module_sales_disabled` (ugyanez a tárolási minta), kontraktus: `assets/design-refs/console/escalation-offer-admin/`.

**Kontextus.** A tulaj kérése: „a lead kap plusz kedvezményt, ha x-szer megnyitja a linket … ennek a
megnyitásnak a darabszámát és kedvezmény mértékét akarom az árazási felületen beállíthatóvá tenni, mert most
hardcoded.” Az ADR-0088 kimondta, hogy a százalék és a küszöb paraméter, de a kódban két konstans volt
(`offers.ts`: 3 és 50), vagyis a paramétert csak deployjal lehetett változtatni.

**Döntés.**
1. **Operátor-állítható, a /pricing „Lead-ajánlatok” szekciójában:** bekapcsoló, a „hányadik megnyitásnál”
   (a `mock_view` darabszáma) és a „kedvezmény az első díjból”. A mostani 3 / 50 az alapérték (seed).
2. **Globális, nem régiónkénti.** Az ajánlat a prospecthez születik, és a prospecthez nincs árazási régió
   rendelve: a régiót a lap a látogató alapján dönti el. A bemutatkozó −25% is globális.
3. **Tárolás: egyetlen `app_setting` sor** (`escalation_offer`, JSON: `enabled`, `threshold`, `percent`),
   migráció nélkül. Ha nincs sor, vagy a sor érvénytelen, a konstansok érvényesek (egy sérült sor nem
   mintázhat olyan ajánlatot, amit senki nem állított be).
4. **Érvényességi szabály (tulaj-jóváhagyás):** küszöb egész 2–10 (az 1. megnyitás maga a levél linkje, ott
   a −25% a helyén), kedvezmény egész a bemutatkozó %+1 és 90 között (a kedvezmények nem adódnak össze, a
   legnagyobb él, ezért 25% vagy alatta az ajánlat soha nem érvényesülne; a 100% ingyenes első díj lenne).
   Az alsó határ a `OUTREACH_OFFER_PERCENT`-ből SZÁRMAZIK, nem literál. EGY szabály
   (`escalationConfigErrors`), amit a szerver a mentésnél és az olvasásnál is alkalmaz; a lap szkriptje
   csak tükrözi.
5. **Kikapcsolás külön kapcsolóval**, nem „0 = ki” formában: kikapcsolva nem születik új ajánlat, a
   számok megmaradnak.
6. **A már kiadott ajánlat megtartja a %-át** (az `offer.percent` a sorba van pecsételve, ahogy eddig is).
   A felület ezt kimondja, és kiírja, hány élő ajánlat fut.
7. **A mentés nem nulláz:** a szekciót hordozó űrlap `esc_present` jelölőt küld; ha nincs (régi, nyitva
   hagyott fül), a beállítás érintetlen marad. Kikapcsolt állapotban a tiltott mezők nem jönnek, ekkor a
   tárolt számok maradnak. Hibás értéknél a szerver SEMMIT nem ment (az árakat sem).

**Őr:** `scripts/escalation-config-check.mts` (pre-commit, `offers.ts` / `views.ts` / `server.ts`
változásra): a beállított 2 / 40 mellett az 1. megnyitás nem, a 2. mintáz, 40 %-kal; kikapcsolva nem
mintáz; a határok; a POST-feldolgozás; a lap a tárolt értéket mutatja. A konstansokra visszarontva 3
ellenőrzés bukik (mérve). Folyamat-lokális felülírással dolgozik, a közös dev-DB `app_setting` sorát nem
írja.

**Nem hatókör (tulaj):** a 72 órás határidő, a 24 órás follow-up, a −25% outreach-kedvezmény és a kupon
konstans marad. Ha egyszer a −25% is állítható lesz, a két mező validációja összefügg (az eszkaláció alsó
határa belőle jön).

**Élesítés:** a nagy deploy utáni első kör (külön engedéllyel). Migráció nincs; élesen az `app_setting`
sor hiánya = a mai 3 / 50.

**Visszafordíthatóság:** 🔄 a sor törlése visszaadja az alapértéket; a kapcsolóval az egész mechanizmus
leállítható deploy nélkül.

**Elvetve:** (a) `pricing_config` oszlopok régiónként: a prospectnek nincs árazási régiója, és migrációt
kényszerítene; (b) „0 = kikapcsolva”: összemossa a kikapcsolást a hibás értékkel, és visszakapcsoláskor
elveszne a szám; (c) „B” változat (kompakt sorok a modulok után, csak a Magyarország oldalon): a tulaj az „A”-t
választotta.
