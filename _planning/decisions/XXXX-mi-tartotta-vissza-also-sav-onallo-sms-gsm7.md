## ADR-XXXX — A „Mi tartotta vissza?” kérdés kis alsó sáv; az önálló hideg SMS is GSM-7; a kérdés nem marad el gyors × után

**Dátum:** 2026-10-12 · **Kontextus:** Elek lead-köre (10-12, K-új-1, A-új-1, A-új-2), tulaj-döntés a koordinátoron át: „ok rendben” (K-új-1). **Felülírja:** az `escalation-topbar/` kontraktus (ADR-0369) 4. pontjában a „változatlan” kérdés-kártyát. **Megtartja:** ADR-0322 ④/B (a kérdés, az 5 opció, a mentett adat), Elek2 Ú3 (a próba-űrlap alatt nem látszik, a süti-sáv nem takarja), ADR-0366 (a kísérő SMS GSM-7 szabálya).

### Kiváltó
1. **K-új-1 (mérve):** a felső ajánlat-sáv × gombja után feljövő „Mi tartotta vissza?” kártya mobilon 366×353 px volt, a képernyő ~42%-a, és mindkét rendelés-pirulát takarta. Az ADR-0369 célja (ne takarjon) a második lépésben elveszett.
2. **A-új-1:** ha az ajánlat már élt (2. látogatás a 72 órán belül), a sáv a betöltéskor jött, a kérdés viszont a `/view` válaszáig (viewId) nem mountolhatott, és a × után nem volt újrapróba. Gyors × → a kérdés csendben elmaradt, a riport válaszokat veszített.
3. **A-új-2:** az önálló (MMS nélküli) hideg SMS még „–” gondolatjellel és ékezettel ment: UCS-2, 218–252 karakter, **4 szelet**; a kísérő SMS-t az ADR-0366 már GSM-7-re tette.

### Döntés
**① A kérdés egy kis sor alul** (befagyott terv: `assets/design-refs/prospect-page/survey-bar/`): a kérdés, egy nyíl és egy rajzolt × (≥ 40 px); zárva legfeljebb 64 px (mérve: ~44 px, a mobil-képernyő ~5%-a). Mobilon csak „Mi tartotta vissza?”, asztalon mellette a második mondat. A válaszok **koppintásra nyílnak**, fölfelé. Fátyol nincs. **A rendelés-pirulák, a sablon alsó foglalás-sávja és a süti-sáv FÖLÖTT ül**: a pirula-elhelyezés által közzétett `--citui-cfg-clear` magasság fölött (ha nincs, a süti-sáv fölött). A × csak elrejti. Kinézet: a felső ajánlat-sáv nyelve (fehér, sötétkék, cián, rajzolt × kör). A kérdések, a gombok, a köszönő mondatok és a mentés változatlanok.

**② A kérdés megvárja a viewId-t.** Ha a sávot a látogató a `/view` válasza előtt zárja be, a kérdés a válasz megérkezésekor jelenik meg (`fbWanted`).

**②b Elek újrafuttatásának két lelete, ugyanebben a körben:** a sáv a nyitott rendelés-panel alatt nem látszik (mobilon a 3. csomagkártyát takarta), és hős-gombot sem takar: ha a helyén kitöltött/keretes gomb áll, asztalon jobbra, a pirulák fölé kerül, utána fölfelé lép (`placeFb`, ugyanaz a mérés, mint a pirula-elkerülésnél). Asztalon süti-döntés után 96%-ban a „FOGLALÁS” / „FEDEZZE FEL” gombon ült.

**②c N5 (Elek tenant-köre, a koordinátor kérésére):** a felső ajánlat-sáv és a szerkeszthetőség-sáv (ADR-0335) mobilon egymásra csúszott. Amíg az ajánlat-sáv kint van, közzéteszi az alsó szélét (`--citui-esc-h`), és a szerkeszthetőség-sáv alatta jelenik meg; a fehér sáv vékony keretet kap.

**③ Az önálló hideg SMS ugyanúgy GSM-7 és legfeljebb 2 szelet, mint a kísérő** (közös `foldedSms`: ékezettel fordít, utána hajtogat; hosszú nevet rövidít; a link betűre marad). Mérve: 218 / 252 / 306 / 226 karakter, mind GSM-7, 2 szelet (a régi kódon 4).

### Őrök
- `scripts/mock-trial-overlay-check.mts` ⑦ (zárva ≤ 64 px, nem takar pirulát, a válaszok csak koppintásra; kinyitva sem takar; a nyitott panel alatt nem látszik), ⑨ (minden sablon, mobil+asztali, süti-sávval és utána: nem ül hős-gombon), ⑩ (a két felső sáv nem fedi egymást) és ⑧ (gyors × a késő `/view` előtt → a kérdés megjön), mobilon és asztalon; a ② az „Inkább nem”-et a kinyitott sávon méri. `--self-test`: a `cit-cfg-trialfx-*` blokkok nélkül ①–⑩ mind piros (34 állítás).
- `scripts/pair-sms-gsm7-check.mts`: a kísérő mellett az önálló SMS-t is méri (4 név × GSM-7, ≤ 2 szelet, link, §C személyre szabás, kontroll); a régi kódon az önálló ág piros.

### Visszafordíthatóság
🔄 könnyű — kliens-oldali elrendezés és SMS-szöveg-kódolás; adat, séma és pénzút nem változott. Élesre a nagy deployjal megy.
