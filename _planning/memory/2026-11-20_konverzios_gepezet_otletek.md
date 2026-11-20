# 2026-11-20 — Konverziós gépezet: ötlet-anyag + friss éles tölcsér (citb64f0ed0)

**Brief:** `~/rc-briefs/konverzi-20261120-190846.md` („Extrém szar a konverziós rátánk… ÖTLETEKET AKAROK”) + a tulaj két közbeszólása (gépi hívás kétlépcsős opt-innel; a 4 kapcsolati csatorna: Mobil · E-mail · GPS/fizikai · Social).

## Elvégzett munka
- Éles tölcsér kimérve (csak olvasás, 2745 valós kiküldött lead) — a számok az ötlet-anyag §0-jában és a MEMORY.md „Tények és döntések” 11-20-i sorában.
- A mai megkeresés dokumentálva (egy érintés, tárgy `{név} – kész honlap`, feladó „Citoviso”, 553 KB CID-kép, mobil + 3 utánkövetés kikapcsolva; tárgysor-A/B teszt soha nem volt).
- Ötlet-anyag: `_planning/OTLETEK-2026-11-20-konverzios-gepezet.md` — 4 csatorna mentén, kísérlet-motor (Thompson-sampling), levélnyitás-mérés, sorozat, gépi hívás, képeslap/doboz, lap-ötletek, 6 igen/nem döntési pont. A tulajnak elküldve (SendUserFile).
- Kód NEM változott.

## Nyitott
- A 6 döntési pont a tulajnál (MMS a nem-nyitóknak +4. nap · esti/vasárnapi szelet · személynév feladó · gépi hívás útja · képeslap-keret · falu-hirdetés).
- A gépi híváshoz jogi kör (Eht. 162. § hívórendszer) a jog-provenance-őrrel.

## A tölcsér SQL-je (éles, `sudo -u citoviso psql -d citoviso`, `SET default_transaction_read_only = on; SET TIME ZONE 'Europe/Budapest';`)
```sql
\set PF 'WITH c AS (SELECT p.id, p.lead_id, p.sent_at, p.email_sent_at, p.sms_sent_at, p.mms_sent_at, p.contact_email, p.unsubscribed_at, l.qualification, coalesce(l.raw->>''country'',''HU?'') AS country, l.name, CASE WHEN p.email_sent_at IS NOT NULL AND (p.sms_sent_at IS NOT NULL OR p.mms_sent_at IS NOT NULL) THEN ''email+mobil'' WHEN p.email_sent_at IS NOT NULL THEN ''csak email'' WHEN p.sms_sent_at IS NOT NULL OR p.mms_sent_at IS NOT NULL THEN ''csak mobil'' ELSE ''egyéb'' END AS chan, CASE WHEN p.contact_email ILIKE ''%@gmail.com'' OR p.contact_email ILIKE ''%@googlemail.com'' THEN ''gmail'' WHEN p.contact_email IS NULL THEN ''nincs'' ELSE ''más'' END AS mailkind FROM prospect p JOIN lead l ON l.id=p.lead_id WHERE p.sent_at IS NOT NULL AND NOT (ltrim(l.name) LIKE ''[TESZT]%'' OR l.name = ''ELEK-TESZT Vendégház'')), v AS (SELECT mv.prospect_id, mv.started_at, mv.open_via, mv.referrer_host, mv.device FROM mock_view mv JOIN c ON c.id=mv.prospect_id WHERE (mv.device IS NULL OR mv.device<>''bot'') AND mv.started_at >= c.sent_at), pf AS (SELECT c.*, (SELECT count(*) FROM v WHERE v.prospect_id=c.id) AS views, (SELECT count(DISTINCT (v.started_at AT TIME ZONE ''Europe/Budapest'')::date) FROM v WHERE v.prospect_id=c.id) AS view_days, (SELECT min(v.started_at) FROM v WHERE v.prospect_id=c.id) AS first_view, (SELECT count(*) FROM v WHERE v.prospect_id=c.id AND v.started_at < c.sent_at + interval ''24 hours'') AS views24, EXISTS (SELECT 1 FROM outreach_reply r WHERE r.lead_id=c.lead_id AND r.received_at >= c.sent_at) AS replied, EXISTS (SELECT 1 FROM free_trial t WHERE t.lead_id=c.lead_id AND t.tenant_id IS NOT NULL AND t.started_at >= c.sent_at) AS trialed, EXISTS (SELECT 1 FROM order_intent o WHERE o.prospect_id=c.id AND o.submitted_at IS NOT NULL) AS ordered, EXISTS (SELECT 1 FROM order_intent o JOIN payment py ON py.order_intent_id=o.id WHERE o.prospect_id=c.id AND py.status=''paid'') AS paid FROM c)'
SET default_transaction_read_only = on;
SET TIME ZONE 'Europe/Budapest';
\pset footer off
\pset pager off


\echo === FUNNEL (összes / 30 nap / 7 nap) — kiküldött, nézte ≥1, ≥2 nézés, ≥3 nap, 24h-n belül nézte, válasz, próba, rendelés, fizetett, leiratkozott
:PF SELECT w, count(*) sent,
  count(*) FILTER (WHERE views>=1) opened, round(100.0*count(*) FILTER (WHERE views>=1)/count(*),1) "open%",
  count(*) FILTER (WHERE views>=2) v2, round(100.0*count(*) FILTER (WHERE views>=2)/count(*),1) "v2%",
  count(*) FILTER (WHERE view_days>=3) d3,
  count(*) FILTER (WHERE views24>=1) o24h, round(100.0*count(*) FILTER (WHERE views24>=1)/count(*),1) "o24h%",
  count(*) FILTER (WHERE replied) reply, count(*) FILTER (WHERE trialed) trial, count(*) FILTER (WHERE ordered) ord, count(*) FILTER (WHERE paid) paid,
  count(*) FILTER (WHERE unsubscribed_at IS NOT NULL) unsub
FROM pf, LATERAL (VALUES ('1 összes', '2000-01-01'::timestamptz), ('2 30 nap', now()-interval '30 days'), ('3 7 nap', now()-interval '7 days')) AS t(w, since)
WHERE sent_at >= since GROUP BY w ORDER BY w;

\echo === csatorna-osztály szerint (összes)
:PF SELECT chan, count(*) sent, count(*) FILTER (WHERE views>=1) opened, round(100.0*count(*) FILTER (WHERE views>=1)/count(*),1) "open%",
  count(*) FILTER (WHERE views>=2) v2, count(*) FILTER (WHERE replied) reply, count(*) FILTER (WHERE trialed) trial, count(*) FILTER (WHERE paid) paid
FROM pf GROUP BY 1 ORDER BY 2 DESC;

\echo === csatorna-osztály szerint (7 nap)
:PF SELECT chan, count(*) sent, count(*) FILTER (WHERE views>=1) opened, round(100.0*count(*) FILTER (WHERE views>=1)/count(*),1) "open%"
FROM pf WHERE sent_at >= now()-interval '7 days' GROUP BY 1 ORDER BY 2 DESC;

\echo === e-mail címfajta (gmail / más) — csak e-mailt kapottak, összes és 30 nap
:PF SELECT mailkind, count(*) sent, count(*) FILTER (WHERE views>=1) opened, round(100.0*count(*) FILTER (WHERE views>=1)/count(*),1) "open%",
  count(*) FILTER (WHERE sent_at>=now()-interval '30 days') s30, count(*) FILTER (WHERE sent_at>=now()-interval '30 days' AND views>=1) o30,
  count(*) FILTER (WHERE sent_at>=now()-interval '7 days') s7, count(*) FILTER (WHERE sent_at>=now()-interval '7 days' AND views>=1) o7
FROM pf WHERE email_sent_at IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;

\echo === honnan nyitottak (open_via, nem-bot nézés, kiküldés után) + referrer_host top
:PF SELECT coalesce(open_via,'NULL (régi/jelöletlen link)') open_via, count(*) views, count(DISTINCT prospect_id) prospects FROM v GROUP BY 1 ORDER BY 2 DESC;
:PF SELECT coalesce(referrer_host,'(nincs)') ref, count(*) FROM v GROUP BY 1 ORDER BY 2 DESC LIMIT 8;

\echo === első nézés ideje a küldéstől (óra-sávok) + medián
:PF SELECT CASE WHEN h<1 THEN 'a <1 óra' WHEN h<3 THEN 'b 1–3 óra' WHEN h<24 THEN 'c 3–24 óra' WHEN h<72 THEN 'd 1–3 nap' WHEN h<168 THEN 'e 3–7 nap' ELSE 'f >7 nap' END sav, count(*)
FROM (SELECT extract(epoch FROM first_view-sent_at)/3600 h FROM pf WHERE first_view IS NOT NULL) x GROUP BY 1 ORDER BY 1;
:PF SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM first_view-sent_at)/3600)::numeric,1) median_h,
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM first_view-sent_at)/3600)::numeric,1) p90_h FROM pf WHERE first_view IS NOT NULL;

\echo === küldés napja szerint (Budapest), utolsó 16 nap: kiküldött, 24h-n belül nézte, nézte bármikor, gmail-arány
:PF SELECT (sent_at AT TIME ZONE 'Europe/Budapest')::date nap, to_char(sent_at AT TIME ZONE 'Europe/Budapest','Dy') d, count(*) sent,
  count(*) FILTER (WHERE email_sent_at IS NOT NULL) email, count(*) FILTER (WHERE views24>=1) o24, round(100.0*count(*) FILTER (WHERE views24>=1)/count(*),1) "o24%",
  count(*) FILTER (WHERE views>=1) opened, round(100.0*count(*) FILTER (WHERE views>=1)/count(*),1) "open%",
  count(*) FILTER (WHERE mailkind='gmail' AND views24>=1)||'/'||count(*) FILTER (WHERE mailkind='gmail') gmail_o24
FROM pf WHERE sent_at >= now()-interval '16 days' GROUP BY 1,2 ORDER BY 1;

\echo === küldés óra (Budapest) szerint — összes: kiküldött, 24h-nézés %
:PF SELECT extract(hour FROM sent_at AT TIME ZONE 'Europe/Budapest')::int ora, count(*) sent, count(*) FILTER (WHERE views24>=1) o24, round(100.0*count(*) FILTER (WHERE views24>=1)/count(*),1) "o24%", round(100.0*count(*) FILTER (WHERE views>=1)/count(*),1) "open%"
FROM pf GROUP BY 1 ORDER BY 1;

\echo === küldés hétnapja (Budapest) — összes
:PF SELECT extract(isodow FROM sent_at AT TIME ZONE 'Europe/Budapest')::int dow, to_char(min(sent_at AT TIME ZONE 'Europe/Budapest'),'Dy') d, count(*) sent, count(*) FILTER (WHERE views24>=1) o24, round(100.0*count(*) FILTER (WHERE views24>=1)/count(*),1) "o24%", round(100.0*count(*) FILTER (WHERE views>=1)/count(*),1) "open%"
FROM pf GROUP BY 1 ORDER BY 1;

\echo === lead-szegmens (qualification) szerint
:PF SELECT coalesce(qualification,'NULL') seg, count(*) sent, count(*) FILTER (WHERE views>=1) opened, round(100.0*count(*) FILTER (WHERE views>=1)/count(*),1) "open%", count(*) FILTER (WHERE views>=2) v2, count(*) FILTER (WHERE replied) reply, count(*) FILTER (WHERE trialed) trial, count(*) FILTER (WHERE paid) paid
FROM pf GROUP BY 1 ORDER BY 2 DESC;

\echo === ország szerint
:PF SELECT country, count(*) sent, count(*) FILTER (WHERE views>=1) opened, round(100.0*count(*) FILTER (WHERE views>=1)/count(*),1) "open%" FROM pf GROUP BY 1 ORDER BY 2 DESC LIMIT 8;

\echo === nézők: nézés-szám eloszlás (nézők között)
:PF SELECT CASE WHEN views=1 THEN '1' WHEN views=2 THEN '2' WHEN views<=5 THEN '3–5' ELSE '6+' END n, count(*) FROM pf WHERE views>=1 GROUP BY 1 ORDER BY 1;

\echo === válaszok: csatorna, és mennyi jött nézés nélkül
SELECT r.channel, count(*) replies, count(DISTINCT r.lead_id) leads FROM outreach_reply r GROUP BY 1;
:PF SELECT count(*) FILTER (WHERE views>=1) reply_with_view, count(*) FILTER (WHERE views=0) reply_without_view FROM pf WHERE replied;

\echo === próbák / rendelések / fizetések dátummal (teszt nélkül)
SELECT 'trial' k, l.name, t.started_at::date d, t.status FROM free_trial t JOIN lead l ON l.id=t.lead_id WHERE t.tenant_id IS NOT NULL AND NOT (ltrim(l.name) LIKE '[TESZT]%' OR l.name='ELEK-TESZT Vendégház')
UNION ALL SELECT 'paid', l.name, py.paid_at::date, o.kind FROM payment py JOIN order_intent o ON o.id=py.order_intent_id JOIN prospect p ON p.id=o.prospect_id JOIN lead l ON l.id=p.lead_id WHERE py.status='paid' AND NOT (ltrim(l.name) LIKE '[TESZT]%' OR l.name='ELEK-TESZT Vendégház') ORDER BY 1,3;

\echo === második érintés (trial_campaign) és viselkedés-üzenet nézései
:PF SELECT 'trial_campaign sent' k, count(*) FROM trial_campaign WHERE status='sent'
UNION ALL SELECT 'behavior_message sent', count(*) FROM behavior_message WHERE status='sent'
UNION ALL SELECT 'views via followup', count(*) FROM v WHERE open_via='followup'
UNION ALL SELECT 'views via behavior', count(*) FROM v WHERE open_via='behavior';

\echo === MMS/messenger kézbesítés-nyugták (mms_outbox)
SELECT coalesce(channel,'NULL') ch, count(*) FILTER (WHERE status='sent') sent, count(delivered_at) delivered, count(read_at) read, count(*) FILTER (WHERE status='failed') failed FROM mms_outbox GROUP BY 1 ORDER BY 2 DESC;

\echo === csak-mobil kiküldöttek alcsatornája (mms_outbox csatorna; NULL = régi MMS+SMS pár) — nézte-arány
:PF SELECT coalesce(m.ch,'nincs mms_outbox sor (SMS-only?)') sub, count(*) sent, count(*) FILTER (WHERE pf.views>=1) opened, round(100.0*count(*) FILTER (WHERE pf.views>=1)/count(*),1) "open%"
FROM pf LEFT JOIN LATERAL (SELECT string_agg(DISTINCT coalesce(channel,'mms-pár(régi)'), '+') ch FROM mms_outbox mo WHERE mo.prospect_id=pf.id AND mo.status='sent') m ON true
WHERE pf.chan='csak mobil' GROUP BY 1 ORDER BY 2 DESC;

\echo === kohorsz-ellenőrzés: kiküldött összes / kizárt teszt
SELECT count(*) FILTER (WHERE sent_at IS NOT NULL) sent_all, count(*) FILTER (WHERE sent_at IS NOT NULL AND (ltrim(l.name) LIKE '[TESZT]%' OR l.name='ELEK-TESZT Vendégház')) test_excluded FROM prospect p JOIN lead l ON l.id=p.lead_id;
```
