## ADR-0111 — PIAC-KAPU: egy ország akkor nyílik meg, ha a JOGI CSOMAGJA kész (2026-09-08)

**Státusz:** ELFOGADVA (tulaj, 2026-09-08: „Most csináljuk meg") ·
**Felülírja:** ADR-0036 §C kapujának IMPLEMENTÁCIÓJÁT (a `lang !== "hu"` hardkódot) ·
**Az elvet nem:** az ADR-0036 §C szándéka változatlan, most kapott nyilvántartást és két
további kaput. **Kiegészíti:** ADR-0110 (a jogi lapok publikálása tette sürgőssé).

### Kiváltó — a tulaj kérdése

Az ADR-0110 zárásakor a nyitott pontok közt szerepelt, hogy a jogi lapok magyarul élnek. A
tulaj rákérdezett: *„országonkénti jogi csomag: nulladik pontban kurvára remélem, hogy ez is
be van kötve a nyelvi kérdésbe, ami akkor aktiválódik ha olyan lead kerül scrapelésre amely
még nem regisztrált országban van"*.

**A mérés fele igazolta.** ✅ A hideg megkeresésnél VAN kapu (ADR-0036 §C): mérve, ugyanazzal
a levéllel `hu` átment, `pl` és `de` `C-ORSZÁG` tiltást kapott, és a `sendBatch` FLAG-nél
visszafordul. ⛔ De: (a) a kapu **hardkódolt `lang !== "hu"`** volt — nem létezett hely, ahol
egy piacot ki lehetne NYITNI, tehát a „tulaj-jóváhagyás" a doktrínában állt, a rendszerben
nem; (b) a **konverziós út** (konfigurátor → fizetés → élesítés) **nem volt kapuzva** — nulla
találat; (c) az **ADR-0110 óta ez élesebb**: minden élő oldal magyar jogszabályokra hivatkozó
impresszumot és adatkezelési tájékoztatót publikál, tehát egy osztrák tenant magabiztosan
HAMIS jogi dokumentumot kapott volna — ami rosszabb, mint a hiányzó.

### Döntés

① **A piac kulcsa az ORSZÁG, nem a nyelv.** A jogi csomag jogrendszerhez tartozik: Ausztria és
Németország nyelve közös, e-kereskedelmi és fogyasztóvédelmi joga nem. A régi szabály a hazai
piacon jó eredményt adott rossz okból — az első német nyelvű piac megnyitása Ausztriát és
Németországot EGYSZERRE nyitotta volna ki.

② **`market` tábla (0057) + `market_log`.** Státusz országonként, plusz append-only napló:
ki nyitotta meg, mikor, MIRE HIVATKOZVA. A megnyitás felelősségvállalás, nem bool — ugyanaz a
minta, mint a leiratkozás-visszavonásnál (0053). A `HU` sor a migrációban `approved`
(különben a fail-closed kapuk azonnal minden hazai élesítést blokkolnának).

③ **HÁROM KAPU, mind fail-closed:**
- **hideg megkeresés** — `checkOutreachDraft/Sms` a piac-verdiktből dönt; a verdikt HIÁNYA
  nem-magyar nyelven TILTÁS (hat hívóhely van, egy elfelejtett átadás nem nyithat piacot);
- **fizetési link** — `requestPayment` nem ad linket zárt piacra;
- **élesítés** — `activate()` a `status:"live"` kapcsoló ELŐTT ellenőriz; a site fizetett+
  provisioned marad, és a megtagadás HANGOS (a vevő FIZETETT — néma elutasítás tilos).

④ **A megújulás KIVÉTEL.** Egy piac lezárása nem teheti fizetésképtelenné a MEGLÉVŐ ügyfelet:
a szerződése akkor jött létre, amikor a piac nyitva volt, és a visszavonás a jövőre hat.
A `kind === "renewal"` ezért átmegy a kapun — különben a mi döntésünkből lenne dunning,
majd freeze, az ő kárára. Az élő oldalak kiszolgálása szintén érintetlen.

⑤ **Ami zárt piacon is SZABAD:** lead-gyűjtés, mock-generálás, mintaoldal megmutatása. Ezek
nem üzleti ajánlatok és nem publikálnak jogi dokumentumot (az ADR-0036 §C ezt már kimondta).

⑥ **Felület:** a konzol **Beállítások → „Piacok — jogi csomag"** panelje. A jóváhagyott
leiratkozás-visszavonás mintáját követi 1:1: a művelet lecsukott `<details>` mögött (nem
sülhet el félrekattintásból), az indoklás KÖTELEZŐ szerver-oldalon is (nélküle nincs
státusz-változás ÉS nincs naplósor), az actor a bejelentkezett operátor. A lista azokat az
országokat mutatja, **amelyekkel már találkoztunk** (scrape-terület vagy vevő) — különben az
imént érkezett lengyel lead láthatatlan maradna. A hazai piac innen nem zárható le.

### Mérés

`scripts/market-gate-check.mts` (pre-commit) — 20 állítás, mindkét irányban:
nyitott piac idegen nyelven ÁTMEGY (ez a lényegi különbség a régi szabályhoz képest) ·
zárt piac TILT · verdikt nélkül fail-closed · indoklás nélkül nincs döntés és nincs naplósor ·
kis/nagybetűs országkód ugyanaz a piac · VALÓDI order: zárt piacon nincs pay-link, megnyitás
után van, visszazárás után újra nincs · zárt piac + megújulás ÁTMEGY · az élesítési kapu
SORRENDJE (a live-kapcsoló előtt) és hangos megtagadása.

### Impl.

`migrations/0057_market.sql` · `src/markets.ts` (ÚJ) · `src/db/schema.ts` ·
`src/outreach/outreachCheck.ts` (a §C kapu piac-alapú) + `draft.ts` (a verdikt a drafttal
utazik) + a hat küldő hívóhely · `src/payment/service.ts` (pay-link + élesítés) ·
`src/console/views.ts` + `server.ts` (panel + `POST /settings/markets`) ·
`public/assets/ui/citui-console.css` · `kb/entries/console-markets` + `scripts/kb-shot.mts` ·
`scripts/market-gate-check.mts`.

### Nyitott

- **A jogi csomag TARTALMA** országonként (ÁSZF, elállás, adatkezelés, opt-in rezsim) — ez a
  kapu csak a KÉRDÉST teszi fel a megfelelő pillanatban; a választ jogi munka adja meg.
  A `src/legal.ts` ma egyetlen (magyar) csomagot ismer: a második piac megnyitása előtt a
  szövegeknek ország szerint kell szétválniuk.
- **Pénznem/árazás:** ma `hu` (HUF) és `global` (EUR) régió van; a `module_price` globális HUF.
  Egy megnyitott külföldi piac ezt is igényli.
- **Régi, ország nélküli rendelések:** az üres `buyer_country` a kapuban zártnak számít
  (fail-closed). Éles adaton a checkout kötelezővé teszi az országot; a dev-fixture-ökben
  előfordul üres — ott a kapu jogosan tilt.
