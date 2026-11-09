## ADR-0435 — Honnan nyitották: csatorna-jel a kiküldött linkben + „Honnan nyitották” panel a Tölcsérben

**Dátum:** 2026-11-09 · **Döntött:** a tulaj (a „B” változat a mockon, a link-jellel együtt)

### Kontextus
A tulaj kérése: a Megkeresés-riport Tölcsér lapján látni, honnan (e-mail, SMS, Viber, WhatsApp)
nyitotta meg a lead a linket. A kiküldött link minden csatornán ugyanaz volt (a lead aldomainje,
ADR-0330), a `mock_view.referrer_host` csak a megnyitások ~15%-ánál mond valamit (Gmail-app).
Élesben mérve 2026-11-09: 272 megnyitó lead; időrendből + referrerből SMS 119, e-mail 80, nem
eldönthető 87.

### Döntés
1. Minden kiküldés a link végére egy betűt tesz: `?e` e-mail · `?s` SMS · `?m` messenger (a telefon
   a küldéskor választ Viber és WhatsApp között, a szöveg addigra kész — a tényleges appot az
   `mms_outbox.channel` adja) · `?w` az automatikus WhatsApp-utánküldés. A jel a KÜLDÉS utolsó
   lépésében kerül a szövegbe (`src/outreach/openVia.ts`), a vázlatba soha: a §C-kapu, a tulaj
   szöveg-felülírásai, a jóváhagyó sor és a `?sajat=1` átírás a jel nélküli linket hasonlítja.
2. A lap (`cit-configurator.js`) kiolvassa a jelet, a látogatás-hívással elküldi, és leveszi a
   címsorból; a szerver fehérlistával menti (`mock_view.open_via`, 0132).
3. A riport a jel nélküli (régi) megnyitásokat KÖVETKEZTETI: levelezőprogram-referrer → e-mail;
   a megnyitás előtt egyetlen csatorna → az; különben „Nem eldönthető”. A panel a „biztos” és a
   „következtetett” számot külön mutatja.
4. ⛔ A `prospect.sms_sent_at` nem jelent SMS-t, ha messenger-küldés volt (ADR-0430 a Viber-küldésnél
   is beállítja); SMS-érintés ilyenkor csak a tulaj MMS+SMS tartaléka.

### Következmény
A „Nem eldönthető” sor idővel kiürül. A próba-kampány (második érintés) linkjei nem kapnak jelet —
azok a Tölcsérbe úgysem számítanak (a második levél vágás). Terv: `assets/design-refs/console/honnan-nyitottak/`.
Őr: `scripts/open-via-check.mts`.
