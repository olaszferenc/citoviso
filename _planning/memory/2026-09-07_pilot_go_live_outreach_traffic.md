# 2026-09-07 — PILOT ÉLESÍTVE · ADR-0101 levél · ADR-0103 registrar+DNS · ADR-0107 GBP · ADR-0108 forgalom-mérés

## A nap fő eredménye: a pilot ÉLESEN fut

**Éles verzió: `dbbd5a7`** (`prod/20260907-1346`) — **136 commit, 19 migráció**. Ezzel minden
hónapok óta lokálban álló funkció kikerült: booking, előfizetés-motor, dunning, ajánlat-réteg,
domain-modul, dokumentum/üzenet fülek, ADR-0101 levél, ADR-0102 modul-kapcsoló, ADR-0103 adapter.

A deploy mellett rendbe téve:
- **`SESSION_SECRET` eddig HIÁNYZOTT** a prod .env-ből → a tenant-cookie a repóban látható
  dev-defaulttal íródott alá (hamisítható). Random értékkel kint.
- `BOOKING_FROM`, `DOMAIN_TARGET_IP`, `SMS_RELAY_SECRET` beírva (régi .env mentve).
- **Élesen 0 timer futott** → most 3 él: billing (07:00), booking-maintenance (óránként),
  domain-resume (2 percenként; első futása zölden lement valós DB-n). A repóbeli unitok a
  DEV útvonalra mutatnak, ezért élesre igazítva kellett kitenni (`/opt/citoviso/app`, `npx tsx`).
- Maradvány-fájlok törölve. Verifikáció: citoviso.com 200 mobilon+asztalon, admin 200.

⚠️ **A GATE 1c nem formalitás:** a tudásbázis-őr ÖT körön át blokkolt, és minden körben valódi
hibát fogott — köztük egy sajátomat, ami a `.hu` nyilvántartói megerősítést a TENANTRA osztotta
volna („kattintson a levélben"), holott a levél a MI kontaktunkhoz megy: a súgó sosem érkező
levélre várakoztatott volna, és adathalász-kattintásra tanított volna.

## ADR-0101 — a megkereső levél IMPLEMENTÁLVA (`469c581`)

A terv 09-06 óta be volt fagyasztva, a kód mégis a 2026-08-06-i „személyes jegyzet" alakot
futtatta. ⚠️ **A tulaj jogosan kérdőjelezte meg az állításomat** („biztos, hogy nincs
implementálva?") — mert az Outlookjában ott volt a kész levél. Az a JÓVÁHAGYÁSI MOCK volt
(`/configure/` link, „· B2" tárgy); a session a tervet commitolta, a kódot nem — §2b szerint
helyesen. Az ÉN első állításom viszont szűk grepből jött (rossz fájlnév).

⛔ **Közben talált valódi hiba:** az eszkalációs követő levél `{...base.draft, body}`-val épült,
így a HIDEG levél `parts`-át örökölte → a címzett szövegben a döntés-segítő kedvezményt kapta
volna, a látványban a bemutatkozót, MÁSIK százalékkal. A fordító a spreadet elfogadja.
Javítás: saját parts + a `buildOutreachEmail` hangosan elutasítja az eltérést.

Új kapu: `scripts/outlook-lint.mts` (pre-commit) — szerkezeti, mert a törés NÉMA.

## ADR-0103 — registrar + DNS adapter kész (`6a7325c`)

⛔⛔ **A nap legdrágább hibám:** engedélyt kértem a rendelés-alak „megmérésére", holott
ezen az API-n VETTÜK MEG a citoviso.hu-t — a bizonyíték az archivált session átiratában ült.
A tulaj joggal robbant. A DNS-íráshoz sem kellett engedély: a v1.zone CRUD publikus doksi.
→ [[feedback_evidence_may_be_in_the_archive]]

Az adapter mérve; ⚠️ kódba írva: a `.hu` regisztráció NEM ember nélküli (nyilvántartói
megerősítés + 8 nap), és a friss domain PARKOLÓ rekordokkal jön — az **AAAA a néma gyilkos**
(IPv6-ot preferáló kliens a parkolón kötne ki, miközben IPv4-es ellenőrzés zöld).

## ADR-0107 — a GBP KÜLÖN FIZETŐS MODUL (tulaj-döntés)

Mérve: a GBP API-hoz **jóváhagyás** kell, aminek előfeltétele egy saját, **60+ napja
hitelesített** GBP. Tulaj döntése: nem a nulladik pont része, hanem külön modul — az indok
általános szabály lett: *nem adhatunk el egy eljárást, amit magunk sem jártunk végig.*
⚠️ Nyitott: a landing ma „megtalálnak a **térképen**"-t ígér, ami GBP nélkül túlígérés.

## ADR-0108 — saját forgalom-mérés, az ALAPCSOMAG része

Tulaj kérdése indította: *„mi vagyunk a házigazdák, nem tudjuk ezt megcsinálni?"* — De igen.
Kész: mérés (`site_visit`), lekérdezés, **Forgalom fül** (jóváhagyott terv), **havi levél**.

⛔ A tudásbázis-őr itt is három valódi hibát fogott: (1) KÓD-hiba — a Google-arány
`= 'google.com'`-ra szűrt, így a `google.hu` némán kiesett, épp a fő piacunkon; (2) meg nem
írt funkciót ígértem (havi levél — azóta megírva); (3) a „vendég" NEM különböző embereket
számol, hanem naponta (a só éjjel forog — az adatvédelmi döntés ára).

## Módosított/létrehozott fájlok (mind landolva, `2e40cc9`)
- `src/analytics/{siteVisit,trafficReport,trafficMail}.ts` · `src/email/trafficEmail.ts`
- `src/domains/registrar/websupport.ts` · `src/domains/dns/websupport.ts` · adapter-selectorok
- `src/outreach/{draft,escalationFollowup}.ts` · `src/email/outreachEmail.ts`
- `scripts/{outlook-lint,traffic-mail,websupport-probe}.mts` · `hooks/pre-commit`
- `migrations/{0054_site_visit,0059_tenant_message_traffic}.sql`
- `kb/entries/admin-traffic/` + 4 javított KB-entry · `assets/design-refs/tenant-admin/traffic/`
- `_planning/DECISIONS.md` (ADR-0103, 0107, 0108) · `_planning/PILOT-GO-LIVE-INVENTORY.md`

## ⛔ HAND-OFF — amit a mérés-felületet szerkesztő MÁSIK SZÁLNAK tudnia kell

1. **A felület JÓVÁHAGYOTT, és a terv KÖT:** `assets/design-refs/tenant-admin/traffic/README.md`.
   Kinézeti változtatás → ÚJ §2b kör (a mostani `surface-gate approve` az ÉN ágamra szól).
2. **A négy KIHAGYÁSI szabály a felület lelke, nem szépészet.** Ha „javításként" 0-kat írtok ki
   (arány megkeresés nélkül, hoszt-bontás domain nélkül, üres állapot helyett nullás táblázat),
   az hamis állítás egy fizető vevőnek (§B.17).
3. **A havi levél UGYANAZT a keretet viszi.** Ha a képernyő sorai változnak, a
   `src/email/trafficEmail.ts` elcsúszik — a kettőt együtt kell mozgatni.
4. **KB-kötelezettség:** az `admin-traffic` entry + a `kb-shot` job létezik. Felület-változás után
   `npx tsx scripts/kb-shot.mts` ÉS az entry átolvasása kell, különben a deploy GATE 1c-n elbukik.
5. ⚠️ **A „vendég" napi számolású** — ha ezt a felületen máshogy nevezitek, az entry hazuggá válik.

## Nyitott kérdések / következő lépések
1. **A mai kód nincs élesen** (a `dbbd5a7` óta minden lokál) — tulaj: „majd a nagy élesítésnél".
   Akkor a `citoviso-traffic-mail.timer`-t is ki kell tenni a másik három mellé.
2. **Tulaj-blokkolók:** Barion éles bolt · Számlázz.hu éles kulcs · Citoviso GBP létrehozása
   (60 napos óra!) · registrar-kredit + ToS.
3. **Nyitott hibák:** a számla-előnézet nem mutatja a domain éves díját (felület-kapus, ADR-0100);
   a §C `PLACEHOLDER_CONTACT` őr a LINK tokenjére is ráfut (lappangó fals-pozitív); a landing
   „térképen"-ígérete ADR-0107 után túlígérés.
