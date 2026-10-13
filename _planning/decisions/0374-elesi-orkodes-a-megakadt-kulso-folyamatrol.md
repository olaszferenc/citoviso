## ADR-0374 — Élesi őrködés: a megakadt külső folyamatról levél + szűrt SMS (2026-10-13)

**Dátum:** 2026-10-13 · **Státusz:** elfogadva (SUB, koordinátor: a „deploy” fő session; tulaj: „Mehet mind
subban”, 2026-10-13; brief `~/rc-briefs/eles-orkodes-sms-20261013.md`) · **Kapcsolódó:** ADR-0276 (ház-riasztás, egy
csatorna), ADR-0283 (bukott számla), ADR-0098 (riasztási címzettek), ADR-0347 (próba-őrszem, állapotból), ADR-0372
(álló DNS/TLS), ADR-0279 („[TESZT] ” nem éles hoston), `_planning/DEPLOY-READY.md` 4b.3.

**Kontextus.** Tulaj, 2026-09-30: „ha valamely külső folyamat megakad, arról jöjjön értesítés + SMS: ha a tenant
fizetési folyamata megakad, ha a saját domain regisztrálás nem megy le, ha a számlázás nem megy, ha valamelyik API
kulcs hal meg stb.” Kódból felmérve 2026-10-13 (a main `465e5394`):
- a `houseAlert` (ADR-0276) szándékosan csak levél; SMS-t csak a megrekedt rendelés, az AAM, a .hu-megerősítő és a
  próba-őrszem küld, mindegyik saját úton;
- **néma** volt: a `pending`-ben maradt fizetés (a sor csak akkor frissült, ha a vevő magától visszajött); a domain
  `failed` ága (csak a tulaj kapott levelet, a ház nem); a `pending`/`registering`/`registered`-ben álló beszerzés (a
  0107-es óra csak `dns_pending`-től indul); az élesi SMS-sor (`sms_outbox`) elakadása — a modemes gép relaya áll; a
  24 órája hibás iCal-link (a tulaj kap levelet, a ház nem); és **minden** 401/403 (Places, Brave, Websupport,
  SMTP, Anthropic) — a hívók egy része osztályozta, riasztás sehol;
- a számlázás bukása KÉSZ volt (ADR-0283) — itt csak SMS-t kap.
Élesben ma 0 fizetés-sor és 0 domain-beszerzés van (olvasva 2026-10-13), tehát az új söprésnek nincs visszamenőleges
esete.

**Döntés.**
1. **Egy csatorna marad, SMS-ággal bővítve** (nem új riasztó): `alertHouse({ …, sms: true, smsKey })` a levél mellé
   ékezet nélküli SMS-t küld a meglévő címzettnek (`getAlertRecipients().phone`: konzol `/settings`, tartalék
   `OWNER_ALERT_PHONE`) a meglévő `sendSms`-en át (élesen `queue` → a dev gép modemje).
   **Zajszűrés** (`house_alert_sms`, 0108): ugyanaz a kulcs 6 órán belül egyszer; óránként legfeljebb 4 riasztó
   SMS; a visszatartottak száma a következő kimenő SMS végére kerül („+N tovabbi riasztas csak e-mailben”). A
   döntés tanácsadó zár alatt születik (több folyamat riaszt egyszerre), a sor a küldés ELŐTT íródik, bukáskor
   `failed`. A levél MINDIG kimegy, a szűrő csak az SMS-t fogja.
2. **SMS csak az éles hoston** (`isLiveHost`). A dev gépen `SMS_PROVIDER=gammu` (a valódi modem) és be van állítva
   a riasztási szám — minden pre-commit kapu, ami bukás-ágat hajt meg, SMS-t küldene a tulajnak.
3. **Bukó riasztó levél → egy „mail-down” SMS**, a riasztás súlyosságától függetlenül, egy kulcson: a levélküldő
   halála különben minden riasztást elnémítana, ezt is.
4. **Súlyos (levél + SMS):** megakadt fizetés, webhook 4xx/5xx, hiányzó számla, lezárt fizetésre jött siker, második
   terhelés, domain `setup_retry` / álló DNS-TLS / **új:** bukott regisztráció és regisztráció előtt álló beszerzés,
   halott API-kulcs, elhasalt időzítő / összeomló szolgáltatás, ki nem ment foglalási levél, el nem indult próba,
   kézi domain-igénylés. **Csak levél:** az SMS-sor elakadása (az SMS ugyanabban a sorban várna), az iCal (a tulaj
   már kapott levelet), a „söprés pótolta” fizetés, az SMS/MMS-relay soronkénti hibái.
5. **Óránkénti söprés ÁLLAPOTBÓL** (`src/console/stallWatch.ts` `runStallWatch`, a `citoviso-offer-followup`
   óránkénti tickjében, saját try-ban; az ADR-0347 mintája):
   ① `pending` fizetés 60 percnél régebben és 7 napnál frissebben (`barion` gateway; a mocknak nincs mit kérdezni):
   előbb a szolgáltatót kérdezi (ugyanaz az idempotens út, mint a `/pay/done`) — ha ott sikeres, az aktiválás
   lefut és „a söprés pótolta” levél megy; ha megszakadt/lejárt, csend (a vevő otthagyta); ha továbbra is függő
   vagy a lekérdezés hibás → súlyos riasztás.
   ② domain-beszerzés `pending`/`registering`/`registered`-ben 2 óránál régebben → súlyos.
   ③ `sms_outbox` `queued`/`sending` 30 percnél régebben → levél (egy eset = egy torlódás, a legrégebbi sorra kulcsolva).
   ④ import iCal-link `failing_since` 24 óránál régebben → levél (sorozatonként).
   ⑤ Anthropic-kulcs próba: `GET /v1/models` (ingyenes) → 401/403 → kulcs-riasztás.
   **Egy eset = egy riasztás:** `house_alert_once` (0108) — a kulcsot a riasztás ELŐTT foglalja, ha egy csatorna sem
   vitte ki, felszabadítja (a következő óra újrapróbál, a tick nem-nulla kóddal lép ki → `OnFailure=`).
   Fajtánként egy összesítő levél tickenként.
6. **Halott kulcs a hívás helyén:** `noteDeadKey(provider, detail)` (`src/console/keyDeath.ts`, dinamikus import —
   az adapterek statikus gráfja nem bővül, a levélküldőnél ez kör is lenne) a Places (`classifyFailure` + a
   fotó-média hívás), a Brave, a Websupport regisztrátor és DNS 401/403-án, és az SMTP `EAUTH`/535-én.
   Szolgáltatónként **naponta egyszer** (`api-key:<provider>:<budapesti nap>`), és **csak az éles hoston** (a
   `places-outage-check` szándékosan 403-at játszik le a dev gépen).
   Barion: a Start-hiba ma is riaszt (megrekedt rendelés, levél + SMS), a GetPaymentState-hibát az ① söprés jelzi;
   Számlázz: a hiányzó számla riasztása (ADR-0283) viszi, mostantól SMS-sel.

**Őr:** `scripts/stall-alert-check.mts` (pre-commit, az érintett fájlok változására; saját scratch-DB, mock
csatornák): ① az SMS-ág és a szűrő minden ága (ismétlés, sapka, „+N”, nem súlyos, nem éles host, nincs szám,
bukó levél → mail-down) · ② a meglévő súlyos riasztók SMS-t kérnek · ③ a söprés fixture-világon (megakadt / friss /
ősi / otthagyott / utólag fizetett fizetés, 3 órás és 30 perces domain, álló SMS-sor, 25 és 1 órás iCal, Anthropic 401) ·
④ egyszer, kulcs naponta egyszer, nem éles hoston nincs · ⑤ csatorna nélkül a foglalás felszabadul · ⑥ bekötés (tick,
hat adapter, a bukott domain-ág). `--self-test` (szabotált világ) PIROS (9 FAIL); a main-beli `houseAlert.ts`-sel
futtatva 8 FAIL — a régi kódon bukik. Az ADR-0276 őre (`house-alert-check`) változatlanul zöld.

**Éles beállítás (NEM ennek a szálnak a dolga — a deployhoz):**
- a `0108_house_alert_sms.sql` migráció (két új tábla, adat-átírás nincs);
- **riasztási telefonszám:** konzol `/settings` → „SMS-szám” (vagy `OWNER_ALERT_PHONE` a `.env`-ben). Ma élesen
  üres → amíg nincs kitöltve, az SMS-ág hangos naplósort ír, és csak levél megy. A tulaj teszt-mobilja
  +36 30 516 1631 (a +36 30 120 0971 a modem SIM-je — oda NE);
- élesen `SMS_PROVIDER=queue` (ma is), és a dev gépen a `citoviso-sms-relay` időzítő fut (ma is);
- az óránkénti söprés a meglévő `citoviso-offer-followup.timer`-en fut — új egység nincs;
- Anthropic-próbához `ANTHROPIC_API_KEY` az éles `.env`-ben; ha nincs, a próba kimarad (nem riaszt).

**Nem ebben döntve / nyitott.**
- Időzítő-„szívverés” (egy időzítő, ami nem fut vagy le van tiltva — az `OnFailure=` csak a bukást látja): külön szál.
- Az MMS-sor elakadása (az `mms_outbox` soronként riaszt, a torlódás nem) és a Cloudflare DNS (nincs implementálva).
- Csendes órák az SMS-re: nincs — a súlyos riasztás éjjel is szól; ha zavaró, a 4/óra sapka és a 6 órás ismétlés-tiltás fogja.

**Visszafordíthatóság:** 🔄 olcsó — az `sms: true` jelzők kivétele visszaadja a csak-levél viselkedést; a söprés
egy try-blokk a tickben.
**Elvetett alternatíva:** riasztónként saját SMS-kód (a `payLinkAlert`/`aamAlert` mintája) — öt újabb példány ugyanabból,
közös zajszűrő nélkül; a 18 Anthropic-hívóhely egyenkénti bekötése — egy ingyenes óránkénti próba ugyanazt méri.
