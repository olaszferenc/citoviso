## ADR-0430 — Messenger-első megkeresés: Viber → WhatsApp → MMS, az S10-ről, olvasás-méréssel

**Dátum:** 2026-11-07 · **Döntött:** tulaj („Cél írd fel: megkeresésnél sms mms előtt ellenőrizni, hogy a lead használ-e Vibert vagy WhatsAppot; ha igen, ott kiküldeni … és max küldjük sms mmsben”; a tervre „mehet”) · **Kapcsolódik:** ADR-0282 (MMS-relay), ADR-0332 (pár = egy egység), ADR-0334 (küldési ablak), ADR-0080 (SMS-relay), ADR-0339 (válasz-gyűjtő)

**Kontextus.** Az októberi Telekom-számla 90 000 Ft volt a modem-SIM-re (749 MMS + 785 SMS), a megrendelési arány mellett ez nem fenntartható. A modem-SIM 2026-11-06 óta a Samsung Galaxy S10-ben van (hívás-bot), a számon sima Viber- és WhatsApp-fiók él „Citoviso” névvel és a Citoviso-jellel. Mérés 2026-11-07, 30 még meg nem keresett no_site leaden, üzenet nélkül: WhatsApp 50%, Viber 60%, legalább az egyik **70%**; a Viber a profilnevet és az utolsó aktivitást idegennek is mutatja (10/30 az elmúlt héten aktív), a WhatsApp ezt idegennek nem mutatja, de küldés után a „Kézbesítve/Olvasott” állapot látszik.

**Döntés.**
1. **Csatorna-sorrend leadenként, a kiküldés pillanatában:** ① Viber, ha van fiók ÉS az utolsó aktivitás ≤ 30 nap · ② WhatsApp, ha van fiók · ③ Viber akkor is, ha régi az aktivitás · ④ MMS + kísérő SMS (a mai pár, ADR-0332). A jelenlét-ellenőrzés üzenetet nem küld.
2. **Messenger-üzenet = egy kép + egy szöveg** (a mai MMS-kép és a kísérő SMS szövege a linkkel). Messenger-úton kísérő SMS NEM megy (a link a szövegben van), és a tulaj-másolat sem.
3. **Az S10 a küldő:** a Debian relay a mai sorból (`mms_outbox`) húz, és az S10-en küld (Viber/WhatsApp az akadálymentességi hídon, `scripts/s10-a11y/`; MMS/SMS a telefon üzenet-appján, ugyanígy). A visszaigazolás megmondja a csatornát; a szerver ebből dönti el, kell-e kísérő SMS.
4. **Mérés:** csatorna, kézbesítve, elolvasva (WhatsApp „Olvasott”, Viber „Megtekintve”), Viber utolsó aktivitás a küldés előtt — leadenként, a konzolon látható. A relay óránként végignézi a messenger-csevegéseket.
5. **Válaszok:** a Viber/WhatsApp válasz ugyanabba a válasz-folyamatba kerül, mint az SMS-válasz (ADR-0339): az elutasító soha többé nem kap üzenetet, a válasz-szöveget a tulaj hagyja jóvá.
6. **Változatlan szabályok:** küldési ablak hétköznap 9–16 (ADR-0334), elutasító/nem érintett soha, egy gazda = egy megkeresés.
7. **Fék:** ~~messenger-úton napi 10-zel indul, hetente emelhető~~ — FELÜLÍRVA 2026-11-08 (tulaj: „ne legyen semmilyen keret, korlátlanul, ami jóvá van hagyva, az menjen ki”): NAPI KERET NINCS, a korlát a jóváhagyás. Ha a fiók korlátozást kap, vagy az olvasási/válasz-arány a felére esik, a messenger-út magától leáll és minden MMS-en megy tovább.

**Fázisok.** F1 (csak Debian/S10, élesítés nélkül): S10-sáv — jelenlét, küldés Viber/WhatsApp/MMS/SMS, állapot- és válasz-olvasás, próba a tulaj tesztmobilján. F2 (szerver, élesítéssel): csatorna a visszaigazolásban, kísérő SMS kihagyása, mérési mezők, messenger-válaszok, konzol-nézet (terv-kapuval, §2b). F3: a kapcsoló bekapcsolása (keret nélkül).

**Elvetve.** Hivatalos WhatsApp Business / Viber Business API (hideg első üzenetet nem enged, sablon-díjas, és API-költség); emulátoros fiók (a valódi telefon a hívás-bot miatt úgyis kell); a jelenlét tömeges ellenőrzése névjegy-szinkronnal (a tulaj névjegyzékét szennyezné).

**Visszafordíthatóság.** 🔄 A messenger-ág egy kapcsolóval kikapcsolható, ekkor minden a mai MMS-páron megy. A platform-fiók letiltása a számot nem érinti.

**Kockázat.** Mindkét platform szabálya tiltja a kéretlen üzleti első üzenetet; a tét a fiók (nem a szám). Ezért kis adag, személyre szabott szöveg, automatikus fék.

**F2 megvalósítás (2026-11-07, tulaj: „mehet F2”).**
- **Adat:** migráció 0129 — `mms_outbox.messenger_text` (a kép messenger-szövege, a sorba tételkor rögzítve), `channel` (mms/viber/whatsapp, az ack írja), `peer_seen_before` (Viber-aktivitás a küldés előtt), `receipt` + `delivered_at` + `read_at`, `peer_seen_last` + `checked_at`; az `outreach_reply` / `_poll` / `_send` csatornái + viber, whatsapp.
- **Szöveg:** `renderMessengerCaption` — ugyanaz a meghívás és link, de „a képen látható honlap-látványtervet” (nem „az imént MMS-ben küldött”), ékezetesen és rövidítés nélkül (messengeren nincs szegmens-díj). Ha a tulaj a jóváhagyó oldalon átírta a kísérő SMS-t, az ő szövege megy. A §C-kapu ezen is fut; FLAG esetén csak a messenger-opció esik ki, az MMS+SMS pár marad.
- **Kapcsoló, fék:** egy `app_setting` sor (`messenger_outreach`): alapból **KIKAPCSOLVA**. Napi keret NINCS (tulaj, 2026-11-08). A messenger-opciót a pull csak akkor adja ki, ha a kapcsoló be van kapcsolva, nincs fék, és ez a sor ELSŐ kísérlete. A bukott messenger-kísérlet újrapróbája mindig MMS: a „kiment-e” csak képernyő-olvasás, második messenger-üzenet soha. A fék leáll, ha az S10 korlátozott fiókot lát, vagy ha 40 rendezett (48 óránál régebbi) messenger-küldés után az utolsó 20 olvasási aránya (5 válasz fölött a válasz-arány is) az összesnek a fele alá esik. Ilyenkor egy riasztás megy a házi csatornán, és a féket csak az operátor oldja fel.
- **Visszaigazolás:** messenger-csatornánál az ack ugyanúgy bélyegzi az `mms_sent_at`-ot („a lead látta a képet”) és a pár-könyvelést (`sms_sent_at` = „megkapta a linket”, első érintés, státusz, ajánlat), de kísérő SMS NEM megy (`settleMessengerPair`). Melyik csatorna vitte, az az `mms_outbox` soron áll.
- **Figyelő:** `scripts/messenger-watch.mts` (Debian, `citoviso-messenger-watch.timer`, 10 percenként): `POST /api/messenger/watch` → a telefonon gépelés nélkül visszaolvas legfeljebb 6 csevegést. A friss küldést óránként nézi, az egy napnál régebbit 6 óránként, összesen 7 napig. Kiolvassa:
  - a WhatsApp „Kézbesítve/Megnézve” állapotát;
  - a Viber pipáját a színéből: a ciánkék dupla pipa jelenti, hogy megnézte (mérve 11-07);
  - az utolsó aktivitást;
  - a bejövő szövegeket.
  Az eredmény a `POST /api/messenger/report` végponton megy vissza: a bejövő szöveg az ADR-0339 válasz-folyamatba kerül, a receipt csak előre léphet.
- **Válasz a messenger-válaszra:** ugyanazon a messengeren megy, az S10 gépeli be. A sorban `queued` állapotban várakozik, a figyelő küldi ki és nyugtázza; SMS nem megy.
- **Konzol-nézet:** §2b terv-kapu, a tulaj A/B mockja `~/rc-briefs/messenger-meres-mock/`. Kód csak a jóváhagyás után.

**Egyesített felület (2026-11-08, tulaj: „mehet így élesre”; terv `assets/design-refs/console/messenger-felulet/`).**
- **Jelenlét:**
  - A telefon a jóváhagyásra váró leadek számán üzenet nélkül megnézi, van-e Vibere vagy WhatsAppja (migráció 0130, `messenger_presence`).
  - Futásonként legfeljebb 12 számot néz meg, 15–30 mp szünettel; a 14 napnál régebbi olvasást újranézi.
  - A jóváhagyó lap ebből csoportosít (`expectedChannel`); kiküldéskor a telefon újra dönt.
- **„Messengeren nem nézte meg”:**
  - Ide kerül a 3 napja olvasatlan messenger-küldés, ha a lead nem válaszolt, nincs letiltva és nem iratkozott le.
  - A „Mehet MMS + SMS-ben is” gomb ugyanazt a képet MMS-ként sorba teszi (`fallback_of`). Az MMS visszaigazolása után a kísérő SMS megy, mindig együtt, soha nem csak SMS. A kapuk újra lefutnak.
  - A „Nem kell” gomb csak rögzíti a döntést.
- **A jóváhagyó lap teljes szélességű** (tulaj: „jobban látszódjon a jóváhagyandó oldal … túl sok a kihasználatlan oldalsó rész”).

**Automatikus WhatsApp-követés (2026-11-08, tulaj: „igen, így mehet”; migráció 0131).**
- A sorrend:
  - a Viber-üzenet megy;
  - ha 3 nap alatt nem nézi meg, és van WhatsAppja (vagy még nem tudjuk), ugyanaz a kép és szöveg magától kimegy WhatsAppon (`force_channel = 'whatsapp'`, `fallback_of` = a Viber-sor);
  - ha azt sem nézi meg újabb 3 nap alatt, a „Messengeren nem nézte meg” fülre kerül, és onnan MMS + SMS csak a tulaj gombjára megy.
- A követő üzenet csak WhatsAppon mehet: kikapcsolt vagy fékezett messenger-útnál a sorban vár; ha a küldés bukik, végleges `failed`, MMS-újrapróba és riasztás nélkül.
- A kapuk újra lefutnak. Aki válaszolt, elutasított, leiratkozott, vagy akiről a tulaj már döntött, nem kap követő üzenetet.
- Az ütemező a figyelő 90 mp-es hívásán fut (`scheduleWhatsappFollowups`).

**WhatsApp-tiltás után (2026-11-08 este).**
- A tömeges előzetes WhatsApp-ellenőrzés után (kb. 1 óra alatt kb. 40 szám) a fiókot letiltották, a felülvizsgálatot kértük.
- Kapcsolók az `app_setting` sorban:
  - `whatsapp: false` — a WhatsApp mindenhonnan kimarad: a sorrendből, az ellenőrzésből és a követésből;
  - `presenceBacklog` — alapból `false`: a háttér-söprés tilos, csak a tulaj által megnyitott vagy számmal frissített lead kerül ellenőrzésre.
- Tulaj: „mindhárom igen”.
