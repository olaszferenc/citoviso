# JÓVÁHAGYOTT TERV — Több e-mail-cím egy leadhez (A változat)

**Hatókör:** `src/console/views.ts` · `public/assets/ui/citui-console.css`

Tulaj-jóváhagyás: 2026-10-04 („1. A · 2. Nem · 3. Igen · 4. Nem autofill ha van több email. · 5. ne legyen”).
Ez a terv a megvalósítás KONTRAKTUSA — elvárt viselkedés, nem stílus-javaslat. Döntés: ADR-0321.

## A hiány, ami kikényszerítette

A tulaj kérése: „lehessen több emailcímet menteni!”. Az „Adatok” fül E-mail mezője egyetlen
`type=email` mező volt: az `ezustnyar@outlook.hu; agrogere@gmail.com` beírásra a böngésző hibát
dobott, nem lehetett menteni. A tulaj végül egy címet mentett, a másik elveszett.

## Amit a terv KÖT

1. **Hely:** lead-lap → „Adatok” fül → „Begyűjtött adatok — szerkeszthető”. A címlista a
   **„E-mail-címek”** felirat alatt, SAJÁT, teljes szélességű sorban áll a Város/Cím sor és a Honlap
   között. Asztalon a Cím mező két hasábot foglal, hogy a rács ne maradjon foghíjas.
2. **Soronként egy cím.** Minden sorban: a cím mezője, a **„Megkeresés ide”** rádió és egy × gomb.
   Az első sor mindig az ELSŐDLEGES. Egy másik sor kijelölésekor az a sor a lista elejére kerül.
   Mobilon a rádió és a × a cím alá kerül, hogy a cím kiférjen.
3. **„További e-mail”** link: ha van üres sor, oda teszi a fókuszt, különben új sort ad.
   A × törli a sort. Ha az utolsó sor is törlődik, egy üres sor marad.
4. **Beillesztett lista szétbontása:** „;”, „,”, szóköz vagy új sor mentén a sor több sorra bomlik.
   Ugyanaz a postafiók (kis- és nagybetű, `+címke` nem számít — a leiratkozás kulcsa) nem kerül be
   még egyszer. Ilyenkor a lista alatt ez áll: **„Kihagyva, mert ugyanaz a postafiók már a listán van:”**.
5. **Címenkénti hibajelzés** a sor elhagyásakor („Hiányzik a „@”.”, „Nem érvényes e-mail-cím.”).
   **A formátum-szabály a mai** (a böngésző `type=email` szabálya, WHATWG; tulaj: szigorúbb ne
   legyen). Ugyanezt a szerver is ellenőrzi, címenként.
6. **Mindent-vagy-semmit** (ADR-0316): egy hibás cím, vagy ugyanaz a postafiók kétszer → SEMMI nem
   íródik (a többi mező sem), és piros „Nem mentettem:” sáv jelenik meg.
7. **Fejléc-sáv:** az E-MAIL alatt az elsődleges cím (`mailto:`), mellette „+N”; a további címek a
   tooltipben.
8. **Nincs gyűjtött-cím ajánlás / automatikus kitöltés** (tulaj 4.). Az elvetett vázlatban az
   „Az adatgyűjtés ezt is találta” sor szerepelt; kikerült.

## Ami NEM a felület része, de a terv része (ADR-0321)

- Tárolás: `raw.email` = elsődleges (jelentése változatlan), `raw.otherEmails` = a többi.
- A mock és a honlap CSAK az elsődleges címet mutatja. A további címekre a rendszer soha nem küld
  levelet.
- Leiratkozás: címenként, személy-szintű — változatlan. Egy cím leiratkozása NEM tiltja a lead
  többi címét (tulaj 2.).
- Az újragyűjtés nem írja felül a kurátor e-mailjeit (tulaj 3.).

## Ami a mockból NEM ment át (és miért)

- A mock `type=text` mezővel dolgozott; az éles is ezt használja (`inputmode=email`). Egy
  `type=email` mező a beillesztett „a; b” sort a böngésző buborékjával elutasítaná, mielőtt a
  szétbontás lefutna.
- Végigkattintáskor két mock-hiba is előjött, mindkettő ki van javítva a mockban is, az élesben is:
  - beillesztés után a régi mező késői blur-je az első címet üresre írta;
  - hibás mezőből a Mentésre kattintva a beszúrt hibasor lelökte a gombot a kattintás alól.

## Megvalósítás

- `src/email/leadEmails.ts` — `splitEmailList`, `isValidEmail` (WHATWG), `leadEmails`, `checkEmailList`
- `src/console/leadContactRules.ts` + `src/console/data.ts` `saveLeadEdits` — szabály és tárolás
- `src/console/server.ts` — `emailListFromForm` (sorrend + `emailPrimary`)
- `src/console/views.ts` — `emailRow`/`emailRows`, a lap-szkript, a fejléc „+N”, Elérhetőségek „további”
- `public/assets/ui/citui-console.css` — `.con-emails*`, `.con-fld--addr`, `.con-band-more`
- `src/scraper/curatorEmail.ts` — kurátori e-mail védelme (reenrichOne, reenrich, backfillek)
- `migrations/0086_lead_email_list.sql` — a már többcímes `raw.email` sorok szétbontása
- Őr: `scripts/lead-contact-guard-check.mts` ④–⑥
- Súgó: `kb/entries/console-lead/entry.hu.md` → „Több e-mail-cím”
