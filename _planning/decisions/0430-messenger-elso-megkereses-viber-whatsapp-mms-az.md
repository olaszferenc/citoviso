## ADR-0430 — Messenger-első megkeresés: Viber → WhatsApp → MMS, az S10-ről, olvasás-méréssel

**Dátum:** 2026-11-07 · **Döntött:** tulaj („Cél írd fel: megkeresésnél sms mms előtt ellenőrizni, hogy a lead használ-e Vibert vagy WhatsAppot; ha igen, ott kiküldeni … és max küldjük sms mmsben”; a tervre „mehet”) · **Kapcsolódik:** ADR-0282 (MMS-relay), ADR-0332 (pár = egy egység), ADR-0334 (küldési ablak), ADR-0080 (SMS-relay), ADR-0339 (válasz-gyűjtő)

**Kontextus.** Az októberi Telekom-számla 90 000 Ft volt a modem-SIM-re (749 MMS + 785 SMS), a megrendelési arány mellett ez nem fenntartható. A modem-SIM 2026-11-06 óta a Samsung Galaxy S10-ben van (hívás-bot), a számon sima Viber- és WhatsApp-fiók él „Citoviso” névvel és a Citoviso-jellel. Mérés 2026-11-07, 30 még meg nem keresett no_site leaden, üzenet nélkül: WhatsApp 50%, Viber 60%, legalább az egyik **70%**; a Viber a profilnevet és az utolsó aktivitást idegennek is mutatja (10/30 az elmúlt héten aktív), a WhatsApp ezt idegennek nem mutatja, de küldés után a „Kézbesítve/Olvasott” állapot látszik.

**Döntés.**
1. **Csatorna-sorrend leadenként, a kiküldés pillanatában:** ① Viber, ha van fiók ÉS az utolsó aktivitás ≤ 30 nap · ② WhatsApp, ha van fiók · ③ Viber akkor is, ha régi az aktivitás · ④ MMS + kísérő SMS (a mai pár, ADR-0332). A jelenlét-ellenőrzés üzenetet nem küld.
2. **Messenger-üzenet = egy kép + egy szöveg** (a mai MMS-kép és a kísérő SMS szövege a linkkel). Messenger-úton kísérő SMS NEM megy (a link a szövegben van), és a tulaj-másolat sem.
3. **Az S10 a küldő:** a Debian relay a mai sorból (`mms_outbox`) húz, és az S10-en küld (Viber/WhatsApp az akadálymentességi hídon, `scripts/s10-a11y/`; MMS/SMS a telefon üzenet-appján, ugyanígy). A visszaigazolás megmondja a csatornát; a szerver ebből dönti el, kell-e kísérő SMS.
4. **Mérés:** csatorna, kézbesítve, elolvasva (WhatsApp „Olvasott”, Viber „Megtekintve”), Viber utolsó aktivitás a küldés előtt — leadenként, a konzolon látható. A relay óránként végignézi a messenger-csevegéseket.
5. **Válaszok:** a Viber/WhatsApp válasz ugyanabba a válasz-folyamatba kerül, mint az SMS-válasz (ADR-0339): az elutasító soha többé nem kap üzenetet, a válasz-szöveget a tulaj hagyja jóvá.
6. **Változatlan szabályok:** küldési ablak hétköznap 9–16 (ADR-0334), napi keret, elutasító/nem érintett soha, egy gazda = egy megkeresés.
7. **Bevezetés és fék:** messenger-úton napi 10-zel indul, hetente emelhető; ha a fiók korlátozást kap, vagy az olvasási/válasz-arány a felére esik, a messenger-út magától leáll és minden MMS-en megy tovább.

**Fázisok.** F1 (csak Debian/S10, élesítés nélkül): S10-sáv — jelenlét, küldés Viber/WhatsApp/MMS/SMS, állapot- és válasz-olvasás, próba a tulaj tesztmobilján. F2 (szerver, élesítéssel): csatorna a visszaigazolásban, kísérő SMS kihagyása, mérési mezők, messenger-válaszok, konzol-nézet (terv-kapuval, §2b). F3: bevezetés napi 10-zel.

**Elvetve.** Hivatalos WhatsApp Business / Viber Business API (hideg első üzenetet nem enged, sablon-díjas, és API-költség); emulátoros fiók (a valódi telefon a hívás-bot miatt úgyis kell); a jelenlét tömeges ellenőrzése névjegy-szinkronnal (a tulaj névjegyzékét szennyezné).

**Visszafordíthatóság.** 🔄 A messenger-ág egy kapcsolóval kikapcsolható, ekkor minden a mai MMS-páron megy. A platform-fiók letiltása a számot nem érinti.

**Kockázat.** Mindkét platform szabálya tiltja a kéretlen üzleti első üzenetet; a tét a fiók (nem a szám). Ezért kis adag, személyre szabott szöveg, automatikus fék.
