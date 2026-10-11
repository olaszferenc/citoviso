## ADR-XXXX — Saját domain: egy tenantnak egy rendelés, a vétel utáni hiba „setup_retry” (nem bukás), `www.<domain>` → 301

**Dátum:** 2026-10-11 · **Kontextus:** Elek 10-11 SAJÁT DOMAIN köre (B1/B2/K5 koordinátori döntések, a
tulaj Elek-teszt koordinátorán át). **Kiegészíti:** ADR-0071 (beszerzés-állapotgép), ADR-0251 (kártyazárolás),
ADR-0103 ③ (zóna: apex + `www`). **Kapcsolódó:** ADR-0360 ③⑤, ADR-0356.

### Kiváltó (Elek mérései, mock regisztrátor/DNS/átjáró, scratch-DB)
1. **B1 — dupla beküldés.** Két fül ugyanarra a névre, egymás után fizetve: 2 regisztráció, 2 lehívott
   zárolás, 2 számla. Párhuzamos fizetésnél nyers `duplicate key … domain_provisioning_active_domain_idx`, és a
   2. zárolás örökre `reserved` (a bank 7 napig blokkolja a pénzt). Élő domain mellett is kiadtunk pay-linket
   egy másodikra. Élesben a 2. vétel „foglalt”-at kapna, és a `failed` a működő domain site-állapotát írta volna
   felül.
2. **B2 — DNS/TLS-hiba a vétel UTÁN.** A név megvéve, a pénz lehívva — a beszerzés mégis `failed`, a tulaj
   felülete és levele azt írta: „más lefoglalta”, „egy másik névre fordítjuk” (mechanizmus nincs mögötte). Az
   időzítő a `failed`-et nem próbálta újra, riasztás nem ment.
3. **K5** — a `www.<saját domain>` a Citoviso nyitóoldalát adta (200), mert a host-feloldás csak a pontos
   `custom_domain`-t nézte, holott a zóna a `www`-t is ránk irányítja.

### Döntés
**① Egy tenantnak egyszerre legfeljebb EGY élő vagy folyamatban lévő saját domain-rendelése van.**
- Rendelés-oldal (`/admin/domain/order`): tenantonként sorosítva (folyamaton belüli zár); elutasít, ha a site
  domainje él, ha fut beszerzés, vagy ha van zárolt (`reserved`) fizetés — ilyenkor a Webcím fül azt az állapotot
  mutatja. Friss (30 percen belüli), ki nem fizetett link UGYANARRA a névre → a meglévő fizetési linkre visz
  vissza (nincs 2. rendelés). MÁSIK névre → a régi link `cancelled` (felülírt), és új rendelés indul.
- Fizetés-oldal (`startDomainProvisioning`): ugyanannak a rendelésnek az újraküldött webhookja a saját sorát kapja
  vissza; MÁSIK rendelést elutasít, ha a site domainje él vagy fut beszerzés — a hívó a zárolását feloldja. A
  párhuzamos versenyt két részleges egyedi index fogja (domainenként és — új — site-onként), a vesztes ág
  ugyanígy feloldással és értelmes naplósorral zárul, nem nyers `duplicate key`-jel.
- Felülírt link utólagos kifizetése → a zárolás feloldva. Beszerzés-sor nélküli, 15 percnél régebbi `reserved`
  zárolást a resume-időzítő felold (árva zárolás).
- Élő site állapotát más sor SOHA nem írja vissza (`setStatus` őrfeltétel), és a duplikátum bukásáról nem megy
  „nem tudtuk megvásárolni” levél.

**② `setup_retry`: a vétel UTÁNI hiba nem bukás.** Ha a regisztrátor eladta a nevet (`registrar_ref` megvan), a
későbbi zóna-/A-rekord-/tanúsítvány-hiba új állapotba visz: `setup_retry` (site és beszerzés-sor; migráció 0106).
A zárolt díj lehívva marad (ha a vétel-lépés lehívása elmaradt, pótoljuk), a resume-időzítő a `registered`
lépéstől újrapróbálja (a zóna/A-rekord lépések idempotensek), a belépéskor EGYSZER operátor-riasztás megy a házi
riasztón (ADR-0279), a tulaj levelet kap: „A webcím az Öné — a beállítás tovább tart a vártnál … Önnek nincs
teendője”. A felület: „Az Öné: <név>”, a beállítás sora „A vártnál tovább tart — automatikusan újrapróbáljuk, és
munkatársunk is figyeli.” A `failed` ezentúl csak azt jelenti: a nevet NEM vettük meg (a zárolás feloldva).

**③ `www.<saját domain>` → 301 a csupasz saját domainre**, útvonal + query marad; POST helyben szolgál (mint a
régi-slug 301-nél, ADR-0356). Ismeretlen host viselkedése NEM változik (továbbra is a platform-útvonalakra esik;
Elek jelzése szerint 200 + nyitóoldal — ez külön döntés).

**④ A mock regisztrátor maga után vonja a mock elérhetőség-orákulumot** (Elek IT-kör K6, koordinátori
kiegészítés). Eddig csak a `DOMAIN_AVAILABILITY_SOURCE=mock` kapcsolta ki a valódi Websupport-`validate`-et, így
mock regisztrátor mellett, a dev-`.env` kulcsaival valódi API-hívás ment ki egy tesztfutásból. Most: élő
regisztrátor (`websupport`/`inwx`) → valódi orákulum; mock regisztrátor → mock orákulum; a valódi, csak-olvasó
orákulum mock regisztrátor mellett CSAK kifejezett `DOMAIN_AVAILABILITY_SOURCE=registrar` opt-innel.
⚠️ Következmény a dev-gépen: a Webcím fül mock-elérhetőséget mutat, amíg a `.env` nem kéri a `registrar`-t.
(Koordinátori K1 — ugyanaz a domain két egyidejű POST-tal: az ① sorosítás + a meglévő link visszaadása fedi; a
második rendelésnek nincs beszerzése, így „Elkészült” levél is csak egy megy.)

### Mellette javítva (ugyanebben a körben, döntés nélkül — a meglévő szabályok betartása)
- B3 „Másik név választása”: az `uj=1` végigmegy a GET-űrlapokon, a választott/beírt név nem esik vissza a
  hiba-képernyőre. B4: az Áttekintés a VÁLASZTOTT végződés díját mutatja (ADR-0360 ③), a Pénztárca/Modulok
  következő terhelése a domain-díjjal együtt, ugyanabból a forrásból, mint a megújulás (`domainFeeForRenewal`).
  B5: a saját domain mellé választott platform-cím külön mezőben (`order_intent.platform_label`) jut el az
  aktivációig (ADR-0360 ⑤). K1–K4, A1–A4: lásd a session-jegyzetet.
- Az ADR-0360 „utólagos, díj nélküli igénylés” nyitott pontja: a felület nem mutat díjat/zárolást, és nem „próbálja
  újra”-t mond, hanem kézi intézést; a kérés házi riasztásként megy a munkatárshoz (a beszerzés kézi).

### Őr
`scripts/domain-order-single-flight-check.mts` (bekötve a pre-commitba): két fül sorban és párhuzamosan →
1 regisztráció, 1 terhelés, 1 számla, 0 ragadt zárolás; felülírt link; árva zárolás; `setup_retry` → riasztás +
igaz levél → az időzítő `live`-ra viszi; B3/K1/ISMERT nézet; B4 (havi + éves) képernyő = kibocsátott megújulás;
K2 számla-levél. **A régi kódon mérve: 28 bukás** (a párhuzamos ág pont Elek nyers `duplicate key`-ével).

### Visszafordíthatóság
🔄 — a `setup_retry` állapot és a site-index migrációval visszavehető; a rendelés-zár és a blokkoló kódváltozás.
