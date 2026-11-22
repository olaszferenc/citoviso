## ADR-XXXX — Nemzetközi B: utánkövetés, válasz, elutasító és kiküldési sor a lead országában

**Státusz:** ELFOGADVA (tulaj-jóváhagyás 2026-11-22 a koordinátoron át, `cit9b4690e3`; brief
`~/rc-briefs/nemzetkozi-B-kikuldes-valasz-20261122.md`) · **Épít:** ADR-0437 (ország-réteg), ADR-0455 (CRM-óra),
ADR-0456 (hideg kiküldés), ADR-0462 (kísérlet-motor), ADR-0465 (HR ár-réteg).

### Kontextus

A 3/5-ös kör a HIDEG megkeresést tette a lead órájára. Ami utána jön — az eszkalációs emlékeztető (ADR-0287), a
viselkedés-üzenet (ADR-0439), a nem-nyitó levél (ADR-0334 ablak), a próba-eszkaláció napjai (ADR-0425) és a
próba-kampány — továbbra is budapesti órán futott, a lead ünnepnapjait nem ismerte, a pénz „Ft” volt, a naptár-mondat
minden országnak Szállás.hu-t mondott, a telefonszámot a magyar számterv olvasta (horvát szám = null kulcs), és a
nem-magyar emlékeztető a §C-kapun soha nem ment át (a keretezés-jelölők csak a hideg levél mondatát ismerték).
A „ne keressük” jel (lead.contact_block_at) csak a lead MEGLÉVŐ prospectjeit jelölte leiratkozottnak, egy később
született prospect átcsúszhatott a küldőkön, amelyek csak a prospect.unsubscribed_at-ot nézték.

### Döntés

① **A lead órája minden utánkövetőn** (`src/outreach/leadClock.ts`): az emlékeztető 8–20 helyi idő, nem ünnepnapon;
a viselkedés-üzenet munkanap 8–20; a nem-nyitó levél és a próba-üzenetek a hideg ablak (`outreachWindowBlocksIn`);
a próbanap a lead zónájának naptárán számol. Ország nélküli lead = zárva (soha nem HU). A HU-sor (Budapest, ünnep
nélkül) a régi függvény mondatát kapja bájtra — a futás csak akkor halaszt, ha EGYIK ország ablaka sincs nyitva.

② **Ház-szintű, nem ország-szintű:** a hideg RAMP (a küldő domain hírneve), a nem-nyitó követő postafiók napi
kerete és a kísérlet napi terve a HÁZ napját (APP_TZ) olvassa — egy feladó, egy hírnév. Az operátori riportok
(kísérlet-riport hete, Poe-pilot, napi token-keret) a tulaj/operátor budapesti hete, hu-HU formátum; ország-bontás
a riport FELÜLETÉN csak §2b-terv után.

③ **Védőháló:** minden küldő (hideg levél, hideg mobil, kiküldési sor, eszkalációs, nem-nyitó, viselkedés,
próba-kampány, szám-szintű tiltás, próba-eszkaláció) a lead.contact_block_at-ot is nézi. A kiküldési sor ország
nélküli sora nem számít a HU-kvótába.

④ **Pénz és tartalom:** idegen pénznemű összeg mellett nincs „Ft”/„forint” (viselkedés-SMS és -levél); a naptár-mondat
(hideg levél, próba-kampány) csak az ország-sor portáljait nevezi (`calendarSyncPortals`); a próba-kampány domain-pontja
a régió csomag-végződése (`packageDomainTld`), anélkül a pont kimarad („két dolog változott”). A HU-szöveg bájtra a régi.

⑤ **Kísérlet minden nyelven:** egy idegen nyelvű levél változatot csak teljes Bábel-fordítással kap (a katalógus-
sablon `T()`-n át, a kód-sablon `collectFallbacks`-szal mérve); hiánynál az adott dimenzió kontrollja. A bekapcsolási
rend (melyik változat fut) nem változott.

⑥ **Válasz és elutasító:** pt/nl idézet-jelölők; a válasz-lista települése a nem-magyar irányítószámból is (4–5
jegy a szegmensben); Poe jegye a lead nyelvén szokásos zárást és a lead helyi idejét kéri; az elutasítást BÁRMELY
nyelven felismeri, a jelölés nyelvfüggetlen: a „mire alapoztam” első sora a magyar „elutasító/nem érintett — …”
(Poe RUNBOOK §6b, `valasz-watch.py`). A „ne keressük” továbbra is a tulajé.

⑦ **Lánc (élő cron):** a sor-SQL-ek országfüggő kontakt-tesztje és a levélíró/ellenőrző nyelvi kiegészítője
MÁSOLATBAN készült (`*.nemzetkozi`, `rules-nyelv.md`, `rules-v2-nyelv.md`); HU-mintán (éles, csak olvasás)
azonos kimenet. Átállítás csak a koordinátor „mehet”-jére, mentéssel. A forrás-csomag (`source-pack.json`) a
nem-magyar leadnél `lang` mezőt kap; a magyar csomag bájtra a régi.

### Mérés

`scripts/nemzetkozi-b-e2e.mts` (scratch DB, HR-lead): hideg levél euróban, Szállás.hu és .hu nélkül; emlékeztető
karácsonykor nem megy, hétfőn igen; horvát telefon-kulcs; horvát elutasítás → minden küldő kihagyja (blokk utáni
prospecttel is). `scripts/country-layer-check.mts` ⑬: beégetett Europe/Budapest / budapesti ablak / „Ft” /
Szállás.hu / .hu / HU-csak szám a küldő kódban csak ALLOW-indokkal; a HU-sor órája két hét söprésen a régi.
