# Visszamenőleges próba-levél + SMS — jóváhagyott terv

**Jóváhagyva:** 2026-10-09, tulajdonosi döntés (§2b terv-kapu): a proba-E mock „C · Személyes” levele és
az „SMS” változata, azzal, hogy a „Helyezést nem ígérünk.” mondat KIMARAD (a „Ha kipróbálja” Google-pontjából is).
A 42 csak-mobilos lead az SMS-t kapja. Jogalap: eldöntve, nem nyitjuk újra.
**Vázlat:** `terv.html` (C + SMS, Mobil 390px / Asztali váltó, a gombok és a „mi tartja vissza?” oldal működik).
**Valódi render:** `level.html` (a VALÓDI építővel, mintaadattal: `npx tsx scripts/trial-campaign.mts --render`),
képei `level-mobile.png` · `level-desktop.png`; az SMS: `sms.html`, `sms-mobile.png` · `sms-desktop.png`.
**Megvalósítás:** `src/email/trialCampaignEmail.ts` (levél + SMS-szöveg) · `src/outreach/trialCampaign.ts` (célcsoport,
kapuk, egy-lövés, küldés) · `src/console/prospectFeedback.ts` (a „mi tartja vissza?” oldal) · futtató:
`scripts/trial-campaign.mts` · őr: `scripts/trial-campaign-check.mts` · ADR-0348.

**Hatókör:** `src/email/trialCampaignEmail.ts` · `src/console/prospectFeedback.ts` · `src/outreach/trialCampaign.ts`

> **Kiegészítve / felülírva:** `../proba-c/3-levelek-sms.html` (ADR-0354 „C” + ADR-0356, jóváhagyva 2026-10-10):
> a nyitány egy mondat (Elek #22), gombpár (Elek #10), az ajánlat a próba alatt is megmarad (a régi „helyett választható”
> kupon-mondat kivezetve), az SMS ajánlattal. A lenti 2., 3., 6., 8. pont már a C-szöveget köti.

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **Tárgy:** **„{name}: {days} napig ingyen, élesben”** — a nap a próba beállításából (`getFreeTrialConfig().days`).
2. **Nyitás (C):** **„Tisztelt {name}!”**, majd **„{when} küldtünk Önnek egy honlap-tervet.”**
   (a dátum a hideg megkeresés napja, Budapest, „Szeptember 24-én” alakban), majd
   **„Most nem kell rögtön döntenie: {days} napig ingyen, élesben kipróbálhatja — kártya és előfizetés nélkül.”**
3. **A terv képe + gombpár:** elsődleges **„Kipróbálom {days} napig ingyen”** → a mock linkje `forras=proba&proba=nyit`
   paraméterrel (a tervlap a próba-űrlapot nyitva mutatja), másodlagos (keretes) **„Megnézem a tervemet”** → a mock linkje
   `forras=proba`-val (a lead saját aldomainje, ADR-0330; a link meglévő paraméterei megmaradnak). A szöveges rész mindkét
   linket viszi; a gomb alatt a puszta URL.
4. **A kérdés a terv UTÁN (nem a végén):** **„Ha nem érdekli: mi tartja vissza?”** / **„Egy koppintás, és megtudjuk. Ez nem leiratkozás.”**
   és három gomb: **„Drágának találom”** · **„Most nem időszerű”** · **„Nem értem, vagy nem bízom benne”**.
   A gomb CSAK MEGNYIT egy oldalt (`/p/<token>/why?forras=proba&ok=<ok>`), ahol a koppintott válasz előre kijelölt,
   mind az öt ok választható, és a leiratkozás egy koppintásra van. A GET semmit nem ír (ADR-0291); a válasz a POST-tal,
   `prospect_feedback.source = 'trial_mail'` forrással rögzül. Csak a három levél-ok jelölhető ki előre.
   Az oldal: **„Mi tartja vissza?”** / **„A válasz nem kötelező, és nem iratkoztatja le. Egyetlen kérdés, nevet nem kérünk.”**
5. **„Ha kipróbálja” — csak ami VAN (§B.17):** a saját aldomain (a próba VALÓDI slugja, ADR-0347 ④), a szerkesztő,
   minden funkció az online foglalással, és **„A Google számára olvasható felépítés (szállás-adatok, oldaltérkép).”**
   ⛔ „Helyezést nem ígérünk.” — SEHOL (az őr méri).
6. **A vég:** szünetel, nem terhelünk, az adatok a próba végétől `TRIAL_RETENTION_DAYS` (90) napig megmaradnak; ha a leadnek
   van ma élő ajánlata: **„A korábbi levelünkben ajánlott {p}% kedvezmény a próba alatt is megmarad: ha a próba végéig megrendeli, megkapja — éves fizetésnél az első évre, havinál az első hónapra. Utána a listaár érvényes.”**
   A {p} ugyanaz a szabály, ahogy a próba indulásakor rögzül (`pinTrialOffer` → `trialCampaignOfferPercent`: a lead
   legnagyobb élő bevezető ajánlata, ennek híján az operátori bevezető %); 0%-nál a mondat elmarad.
7. **Lábléc, változatlanul a mockból:** **„Erről a próbáról több levelet nem küldünk; ha nem kér tőlünk több megkeresést, leiratkozhat.”**,
   a leiratkozó link, a jogalap-sor, a cégazonosítás (`advertiserIdentity`). Az egy-lövés sor KÓDKÉNYSZER: `trial_campaign` tábla
   (leadenként és címenként egy), és az eszkalációs follow-up utána nem megy. Az ígéret a SZEMÉLYNEK szól (ADR-0353): egy ember
   (közös cím VAGY közös mobil) egy üzenetet kap — levelet, ha van levél-célpontja, különben SMS-t.
8. **SMS:** ékezet nélkül (GSM-7), a linkkel, ≤ 2 szelet; hosszú névnél a NÉV rövidül, a link soha. Szövege (ékezetes forrás, majd
   GSM-7-re hajtva), élő ajánlattal: **„{name}: {art} {date} küldött honlap-tervet most {days} napig ingyen, élesben is kipróbálhatja, kártya nélkül. Ha a próba végéig megrendeli, {pa} {p}% kedvezmény megmarad. ({pa} = a/az a szám kiejtése szerint, `huArticle`) {link} Leiratkozás a lap alján. Citoviso”**;
   ajánlat nélkül — és ha a legrövidebb névvel sem fér 2 szeletbe — a régi: „{name}: {art} {date} küldött honlap-tervet most {days} napig ingyen, élesben is kipróbálhatja. Nincs kártya,
   nincs előfizetés, a végén nem terhelünk. {link} Leiratkozás a lap alján. Citoviso”.
9. **Küldés:** csak hétköznap 9–16 (ADR-0334), sorban (SMS ≥ 90 mp), szárazon alapból; élesen `--go`, a tulaj külön „mehet”-jével.
   Minden célpontot a foglalás ELŐTT újramér (próba, rendelés, archiválás, kizárt lead); a levél csak a hideg levél címére megy;
   a beragadt foglalást a száraz futás listázza, feloldása kézi (`--felold`) — ADR-0353.
