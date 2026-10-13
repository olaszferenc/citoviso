## ADR-0376 — A riasztó SMS csendes órája: 22–07 között csak levél, reggel egy összesítő SMS (2026-10-13)

**Dátum:** 2026-10-13 · **Státusz:** elfogadva (SUB, koordinátor: a „deploy” fő session; brief
`~/rc-briefs/riaszto-sms-ejjel-20261013.md`) · **Kapcsolódó:** ADR-0374 (élesi őrködés, levél + szűrt SMS),
ADR-0288 (budapesti óra, nem a folyamaté), `_planning/DEPLOY-READY.md` 4b.3.

**Kontextus.** Tulaj, 2026-10-13: „Igen erre a számra [+36 30 516 1631]. Éjjel nagyon jönnek az SMS-ek.” Az ADR-0374
súlyos ház-riasztása csendes óra NÉLKÜL küldött SMS-t (csak 6 órás ismétlés-tiltás és óránként ≤4), vagyis élesítés
után egy éjszakai hibasorozat óránként négyszer ébresztette volna a tulajt — olyan ügyben, amit éjjel úgysem old meg
senki.

**Döntés.**
1. **Csendes óra:** `SMS_QUIET_FROM_HOUR = 22` (befoglaló) – `SMS_QUIET_TO_HOUR = 7` (kizáró), **budapesti** falióra
   (`budapestMinutes`; az éles VPS UTC-ben fut, a folyamat órája 1–2 órát csúszna). Ebben az ablakban riasztó SMS
   NEM megy, a „mail-down” SMS sem; a levél változatlanul kimegy. Az SMS-döntés `night` sorként rögződik a
   `house_alert_sms`-ben (migráció 0109 bővíti a státusz-CHECK-et).
2. **Reggeli összesítő:** az óránkénti `citoviso-offer-followup` tick (saját try-ban) a csendes óra után
   `flushNightSmsDigest(now)`-t hív: ha az éjjel volt visszatartott riasztás, EGY SMS megy („Citoviso RIASZTAS: ejjel
   (22-07) N riasztas: <tárgyak, amennyi 300 karakterbe fér> (+M tovabbi). Reszletek e-mailben.”), a sorok
   `night_digested`-re állnak — egy éjszaka egyszer összegződik. Ha nem volt, nem megy semmi. Bukott küldésnél a sorok
   visszaállnak `night`-ra, a következő óra újrapróbál. Csak éles hoston, mint minden riasztó SMS. Az óránkénti tick
   miatt a gyakorlatban ~07:00–07:01 között érkezik.
3. Éjjel a 6 órás ismétlés-tiltás és az óránkénti sapka nem számít (nem megy ki semmi); az összesítő maga `sent` sor,
   tehát a reggeli órában a sapkába beszámít.

**Elvetett.** „Még aktuális-e” szűrés az összesítőben (a hiba reggelre megszűnt-e): esetenként más-más állapotot kéne
újraolvasni, és a levélben úgyis ott a részlet — a tulaj egy SMS-ből látja, hogy éjjel volt valami, és megnézi.

**Őr.** `scripts/stall-alert-check.mts` ⑦: a határok télen és nyáron (21:59 nem, 22:00 igen, 06:59 igen, 07:00 nem);
éjjeli súlyos riasztás + bukó levél → 0 SMS; 03:00-kor nincs összesítő; 07:05-kor bukott, majd sikeres összesítő
pontosan egyszer; csendes éjszaka után nincs összesítő; 12 riasztás → ≤300 karakter „+N tovabbi”; a tick bekötése.
A régi (ADR-0374) kódon 6 FAIL.

**Felmérés (ugyanebben a briefben, csak olvasás):** az elmúlt 7 napban (10-06…10-13) a modem 22–07 között egyetlen
SMS-t küldött a tulajnak: a vasárnapi „desztillalo” heti jelentést (10-11 04:05, user-crontab `0 4 * * 0` →
`_planning/DOMAIN/_tools/notify.mts`, csendes óra nélkül). Az élesről éjjel senkinek nem ment SMS/MMS; az ADR-0374
még nincs élesen. Az éles `MOBILE_SEND_WINDOW_OFF=1` (a 09-30-i teszt ideiglenes kapcsolója) minden lead-SMS ablakot
felold. Ezekről a tulaj dönt (a koordinátor viszi).
