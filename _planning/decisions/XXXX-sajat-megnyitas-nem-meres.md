## ADR-XXXX — A tulaj saját megnyitása nem mérés: `?sajat=1` a másolatokon és a konzolban (2026-10-05)

**Dátum:** 2026-10-05 · **Státusz:** elfogadva (tulaj: „Az a jó, ha a tulajnak küldött mock-megnyitások nem
számlálódnak.” · „Elfogadom a javaslataidat.”) · **Kapcsolódó:** ADR-0291 (a `/p/<t>` GET semmit nem ír, a látogatás
`POST /p/<t>/view`), a pilot-másolatok (EMAIL_BCC, OUTREACH_COPY_PHONE, 2026-10-05).

**Kontextus.** A tulaj szerint a számláló 0-t mutatott, pedig megnyitotta a neki küldött másolatokat. Élesen
mérve (nginx-napló + `mock_view`): a számláló működik, de csak emberi jelet adó látogatást számol (ADR-0291). A
Napfény Villa linkjét 11:12:54-kor Androidról nyitották meg, 8 mp-cel a Google Messages előnézete után, és 2 mp-en
belül jött a `/view` — szinte biztosan a tulaj SMS-másolata, mégis a lead látogatásaként számolódott, a prospect
„opened” lett. A Yorki (Android) és az Oleander (Windows, a konzolból) megnyitásán nem volt emberi jel, nem
számított. A hiba tehát fordított: a tulaj megnyitása megkülönböztethetetlen a leadétől, mert a másolat ugyanazt
a tokent viszi (az e-mail Bcc betűre azonos a lead levelével).

**Döntés.**
1. **Jelölés a linken:** `?sajat=1` (`src/console/prospectPath.ts`: `OWN_VIEW_PARAM`, `ownViewHref`,
   `markOwnViewLinks`). A `GET /p/<t>?sajat=1` ugyanazt a lapot és keretezést adja, amit a lead lát, de
   látogatás-hívás (beacon) NÉLKÜL: nincs `mock_view`, esemény, „opened” állapot, eszkalációs ajánlat. A jelölés
   nem titok — egy lead, aki ráírja, csak a saját mérését kapcsolja ki.
2. **SMS/MMS-másolat:** a másolat szövegében a `/p/` lap-link jelölt (`pilotCopySmsText`).
3. **E-mail-másolat:** követett linket tartalmazó levélre a Bcc helyett KÜLÖN másolat megy az EMAIL_BCC címre
   (`PilotOwnViewCopy`, `src/email/sender.ts`), „[Másolat → <címzett>]” tárggyal, jelölt linkekkel és a
   List-Unsubscribe fejlécek NÉLKÜL (a tulaj postafiókjának egy-kattintásos leiratkozása különben a LEADET
   iratkoztatná le). Csak a lead levelének sikeres kimenete után; hibája nem buktatja a lead küldését. Követett
   link nélküli levél (számla, belépés) marad Bcc-n.
4. **Konzol:** a lead lapjának linkje, a Tevékenység lap „a látott oldal ▸” linkje és a levél-előnézet linkjei
   jelöltek. A „link másolása” gomb a JELÖLETLEN címet másolja (azt a leadnek szánják).
5. **Visszamenőleg:** a Napfény Villa 2026-10-05 11:12-es (tulaj-)látogatása élesen törölve, a prospect vissza
   „sent”-be (külön engedéllyel, mentéssel).
6. **Őrök:** `mail-link-get-safe-check` ⑦ (a jelölt lap nem viszi a `/view` hívást, a jelöletlen igen — mindkét
   link-alakra); `pilot-copy-check` ④ (jelölő-esetek, SMS-másolat, külön e-mail-másolat, a lead levele jelöletlen
   és Bcc nélküli). Súgó: console-outreach-draft „A saját megnyitásod nem számít”.

**Következmény.** A számláló a lead látogatását méri, nem a tulajét. Ami továbbra is a leadnek számít: a lead
levelének továbbítása a tulaj saját eszközére, vagy a jelöletlen link kézi elküldése magának.
