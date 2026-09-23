## ADR-0083 — Hideg mobil-megkeresés = MMS+SMS PÁROS; az önálló hideg SMS kivezetése a felületről

**Dátum:** 2026-08-29 · **Státusz:** ELFOGADVA (tulajdonosi döntés: „Építsük ki ezt a csatornát is…
amit javasolsz az meg zseniális"; kézi próba a saját számára KÉZBESÍTVE és jóváhagyva) ·
**Kapcsolódó:** ADR-0082 (csatorna-kapuk), ADR-0080 ⑦ (GSM-infra), `docs/mms-send.md`, 03-INVARIANTS §A/§C.

**A tulaj meglátása (a döntés magja).** „Egy hideg SMS talán az egyik legrosszabb megkeresési forma
a mai világban: itt a honlapod, kattints a linkre, eskü hogy nem lenyúlós link. Ha MMS-ben küldjük
a mock előnézetét, már a megnyitáskor jöhet a WOW!" — A hideg SMS-ben a link maga a KÉRÉS (bízz
bennem), ismeretlen számról a leggyengébb pozíció. Az MMS-ben a BIZONYÍTÉK érkezik: megnyitáskor ott
a lead saját vendégháza modern honlapként — a wow megelőzi a bizalmi döntést.

**A döntés: PÁROS modell.** A hideg mobil-megkeresés EGY egység, két üzenetben:
1. **MMS** — a mock hero-shotja (beégetett „ELŐZETES LÁTVÁNYTERV — CITOVISO" szalaggal, §A framing
   a képben magában), `sudo mms-send` a helyi SIM800C modemen át.
2. **SMS közvetlenül utána** — „ezt a látványtervet készítettük Önről — élőben: [link] ·
   Leiratkozás: [link]". A link itt már kontextussal bír: a kép az imént bizonyította, miről szól.

Miért KÖTELEZŐ a pár (nem opció): az `mms-send` csak képet + ASCII tárgyat visz — **se link, se
leiratkozási út nem fér az MMS-be**, opt-out nélkül pedig hideg megkeresés nem mehet ki (§C.1).
A kísérő SMS hordozza a jogi kötelezőket; a meglévő `checkOutreachSms` méri.

**Csatorna-könyvelés:** a pár EGY megkeresés — EGY bélyeg (`mobile_sent_at` vagy a meglévő
`sms_sent_at` átértelmezése — implementációs döntés), EGY kapu-soron át (ADR-0082 paritás-tábla +
allowlist + időablak). Ha az MMS elmegy, de a kísérő SMS elhasal → a claim marad (a lead már látta
a képet, újraküldés tilos), a hiba HANGOS az operátornak.

**Az önálló hideg SMS-gomb kivezetése a felületről.** A kódja marad (a pár SMS-fele ugyanaz az út),
de megkeresésként önállóan nem ajánljuk fel. A TRANZAKCIÓS SMS (dunning, freeze, emlékeztető —
ADR-0080) ÉRINTETLEN: az másik jogi aktus (élő szerződés), másik kód-út, és ott az SMS a jó forma.

**Korlátok (a `docs/mms-send.md`-ből, tervezési tények):** JPEG ≤300 KB; ~60–90 mp/MMS (NEM tömeges
— kézi, egyenkénti csatorna); küldés alatt a gammu-smsd + sms-relay áll (a dunning-SMS a DB-ben vár,
nem vész el); a feladó a megosztott fő SIM (+36 30 120 0971); `ok:true` = az MMSC befogadta, a
kézbesítéshez a címzettnél mobiladat kell. Az `OUTREACH_SMS_ALLOWLIST` fék a PÁROSRA is áll, amíg
nincs dedikált szám + STOP-kezelés.

**Kézi próba (bizonyíték):** 2026-08-29, Pitypang dark-luxury hero → 35 KB JPEG →
`mms-send` → `1000:OK`, message_id `4955D7A6…`, a tulaj telefonján kézbesítve, ítélete: „fasza".

**Következő lépés:** §2b terv-kör a draft-oldal csatorna-paneljére (a két kártya → E-mail +
„MMS+SMS páros" kártya), CSAK jóváhagyás után kód.

**Visszafordíthatóság:** 🔄 — a páros egy küldés-orchesztráció a meglévő adapterek felett; az önálló
SMS-gomb visszahozása egy view-változtatás.
