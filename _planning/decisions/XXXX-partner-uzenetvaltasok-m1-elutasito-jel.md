## ADR-XXXX — Partner-lap „Üzenetváltások” (M1 csevegő-szál), kézi e-mail/SMS, elutasító-jel a leaden

**Dátum:** 2026-11-04 · **Állapot:** elfogadva · **Kapcsolódik:** ADR-0418 (partner-adatlap A — Fülek), ADR-0340 (válasz az irányítópultról), ADR-0376/0379 (SMS csendes óra)
**Terv:** `assets/design-refs/console/partner-adatlap/JOVAHAGYOTT-M1-uzenetvaltasok.html` (tulaj-döntés 2026-11-04: M1, nem az M2 postafiók)

### Kontextus
A tulaj (2026-11-03): „üzenetváltások tab is kell, ahol lehet írni is (sms + email)”. A partnerrel
folyt üzenetek öt helyen éltek (tenant_message, mms_outbox/sms_outbox, prospect-bélyegek,
outreach_reply, outreach_reply_send), egy szál sehol. A memória szerint (2026-10-26) az elutasító /
nem érintett válaszoló SOHA nem kaphat további üzenetet — de erre a leaden nem volt jel; a
trialCampaign a „bármit válaszolt”-at zárta ki, ami a fizető vevőt is kizárná.

### Döntés
1. **Egy szál, olvasva a meglévő táblákból** — nincs másolás. A hideg SMS-t (az sms_outbox-nak
   nincs lead-kapcsa) a lead számára illesztjük, és csak a tenant létrejötte ELŐTTIT: utána minden
   tenantnak ment SMS a tenant_message-ben van. A megkereső levél szövegét a rendszer nem tárolja;
   a szál ezt kimondja, nem talál ki szöveget.
2. **Új tábla: `partner_message`** — a kézi kimenő üzenet (scheduled → queued → sent | failed) és a
   partner / aktív kapcsolattartó címéről jött, NEM megkeresési bejövő üzenet (received). A kézi
   üzenet a tenant_message-be is bekerül (`related_kind='partner_message'`), mert a vevő a saját
   adminjában is lássa; a szál ezt a tükörsort kihagyja.
3. **Küldés a meglévő utakon:** e-mail `getEmailSender()` (azonnal, az OUTREACH_FROM feladóval, így
   a válasz a gyűjtött postafiókba jön); SMS `sendSms()` (a sor), 22:00–07:00 között `scheduled`,
   reggel 7-kor indul. Az óra: a válasz-gyűjtő percenkénti hívása (`/api/replies/ingest`) és maga a
   partner-lap (`settlePartnerMessages`). Címzett CSAK a partner / kapcsolattartók / a lead telefonja
   lehet — szabad cím nincs. SMS-limit: 5 rész, a valós GSM-7/UCS-2 kódolással (`smsEncoding`).
4. **Bejövő:** a gyűjtő eddig eldobta, ami nem megkeresésre jött válasz; most a partner és az aktív
   kapcsolattartók címére (normalizált e-mail / E.164) illesztve a partner szálába kerül. Több partner
   ugyanazon a címen → a legutóbb frissített.
5. **Elutasító-jel: `lead.contact_block_at/_reason/_by`**, a Válaszok panel „Elutasító / nem érintett —
   ne keressük” gombjával, kötelező indokkal. Hatása: a lead prospectjei leiratkoznak (így a hideg
   utak meglévő őrei is fogják), a nyitott válaszai megválaszoltak lesznek, a sorban álló küldések
   (válasz és kézi) nem mennek ki; a partner-lapról és a válaszra adott válaszból is tilt (szerver
   oldalon, a sorból induláskor is). A jel NEM a „bármit válaszolt”. Levétele csak a jelet veszi le, a
   leiratkozást nem (az a lead lapján, indokkal megy).

### Következmények
- Migráció: `partner_message` tábla + 3 oszlop a `lead`-en (additív, backfill nincs).
- Őr: `scripts/partner-messages-check.mts` (pre-commit) — mock levélküldő + a dev SMS-sor (amit a
  relay nem ürít), semmi nem megy ki.
- Ami nincs: a hideg levél szövegének tárolása; a „Kézi” üzenetekhez melléklet.
