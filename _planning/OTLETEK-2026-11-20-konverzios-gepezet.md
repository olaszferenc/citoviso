# Konverziós gépezet — ötlet-anyag (2026-11-20)

**Brief:** `~/rc-briefs/konverzi-20261120-190846.md` („Extrém szar a konverziós rátánk… ÖTLETEKET AKAROK, NE TARTSD VISSZA MAGAD! MINDEN OPCIÓ OPCIÓ”) + a tulaj két közbeszólása (gépi hívás; a 4 kapcsolati csatorna: Mobil · E-mail · GPS/fizikai · Social). **Session:** `citb64f0ed0`.
**Forrás:** friss éles mérés 2026-11-20 19:15 UTC (csak olvasás, SQL a §0 végén hivatkozva), a 11-05-i tölcsér (`~/rc-briefs/elemzes/funnel-data.md`), a 11-18-i kézbesítési kutatás (`_planning/RESEARCH-2026-11-18-hideg-email-kezbesites.md`), a mai megkeresés kódja (`src/outreach/draft.ts`, `src/email/outreachEmail.ts`).

Jelölés: 🟢 meglévő kódból, kapcsolóval · 🟡 kis fejlesztés · 🔴 új erőforrás (eszköz, szolgáltatás, pénz) · ↩️ korábbi tulaj-döntést fordít · ⚖️ jogi őrrel egy kör kell · 📏 mért számra épül.

---

## 0. Hol szakad a tölcsér — friss éles számok

Nálunk a **„megnyitás” = a link kattintása** (`mock_view`). A LEVÉL megnyitását **nem mérjük** (nincs pixel, a kép beágyazott: `src/email/sender.ts:89`). Ezért a „nem nyitó” három, teljesen különböző embert takar, és ma nem tudjuk szétválasztani őket:

| csoport | mi történt | mi segít |
|---|---|---|
| A. nem kapta meg | spam / nem kézbesült | kézbesítés (ADR-0459, hírnév) |
| B. látta a tárgyat, nem nyitotta a levelet | a tárgy+feladó nem érdekes vagy gyanús | tárgy, feladó, első sor |
| C. elolvasta, nem kattintott | a törzs nem húz, a link gyanús | törzs, kép, bizalom |

**Tölcsér (2745 valós kiküldött lead, 4 teszt nélkül):**

| | összes | 30 nap | 7 nap |
|---|---|---|---|
| kiküldött | 2745 | 2568 | 1077 |
| nézte ≥1 | 560 (20,4 %) | 488 (19,0 %) | 134 (**12,4 %**) |
| 24 ó-n belül | 464 (16,9 %) | 407 | 121 (11,2 %) |
| nézte ≥2× | 177 (6,4 %; a nézők 32 %-a) | 144 | 25 |
| ≥3 külön napon | 18 | 10 | 0 |
| válaszolt | 71 (2,6 %) | 60 | 9 |
| próba | 4 (0,15 %) | 4 | 0 |
| rendelés / fizetett | 1 / 1 (0,04 %) | 1/1 | 0 |
| leiratkozott | 33 (1,2 %) | 27 | 14 |

**Bontások (összes):**
- Csatorna-osztály: csak e-mail 1522 → 16,6 % · csak mobil 735 → 17,8 % · **e-mail+mobil 487 → 36,3 %**. A 7 napos minta már szinte csak e-mail (1024/1077). ⚠️ Nem tiszta kísérlet: az e-mail+mobil csoport az, akinek MINDKÉT elérhetősége megvolt (teljesebb adatú lead), nem véletlen kiosztás — a második csatorna hatása ennél kisebb is lehet; a motor (2.1) ezt méri majd tisztán.
- E-mail cím fajtája: **Gmail 1173 → 28,1 %**, nem-Gmail 836 → **11,8 %** (7 nap: 17,4 % vs 7,1 %). A freemail/t-online/saját domain címzettek a jó hetekben is 2–5 %-on.
- Mobil-alcsatorna: régi MMS+SMS pár 655 → 18,8 % · WhatsApp 79 → 10,1 % · Viber ~0. MMS/SMS-nek **nincs kézbesítési nyugtája** (0/1174).
- Szegmens: no_site 1851 → 21,1 % (**3 próba, 1 fizető — minden konverzió innen**) · outdated 698 → 15,5 % · modern 195 → 31,8 % (0 próba: kíváncsi, nem vevő).
- Első nézés a küldéstől: medián **1,4 óra**, p90 47 óra; aki nyit, 83 %-a 24 órán belül. A 7 napos 12,4 % tehát nem „még nem ért oda”.
- Küldési óra 8–16 és hétnap H–P: **±5 pont, nincs hatás** (9h 19,5 %, 11h 12,7 %, 14h 11,1 %). Este és hétvége mérve soha.
- Napi trend (24 ó-s nézés): 11-05 30 % · 11-09 21 % · 11-13 22 % · 11-16 14 % · **11-17 6 % · 11-18 11 % · 11-19 10 % · 11-20 12 %** (Gmail 14/102). A getcitoviso.com sáv 2 napos, a hírneve nulláról épül.
- **A 71 válaszból 34 nézés nélkül jött** — a levélre reagálnak (zömmel elutasítva), nem a tervre.
- A nyitók 80 %-a ≥30 mp-et olvas, 71 % mélyre görget (11-05): **a lap megfog, aki odaér** — de a nézőkből 0,7 % próbál, 0,2 % fizet.
- A 10-26-i tömeges 2. levél (182 lead): 5 új nyitó, 6 leiratkozás, 0 próba. **Kampány-ízű 2. kör nem megy; a második CSATORNA viszont duplázott.**
- **Fizető: 1** (Duna Vibe House, 11-03: MMS+SMS 09:06 → nyitás 09:22 → SMS-ben visszahívást kért → rendelés 10:15, próba nélkül, 4 957 Ft). **Valós próba: 4** (a 11 `free_trial`-ból 7 teszt): Sáma (MMS, nyitás 25 perc, próba, 0 belépés, lejárt), Marilyn (MMS, 86 perc, 0 belépés, lejárt), Móriczka (MMS 11-05, nyitás 11-07, **próba 11-16 10:33 — 3 perccel a viselkedés-SMS után**, 2 aktivitás), Talentum (csak e-mail 11-13, első nyitás = próba 11-16 08:49, 0 belépés). Tehát az 5 cselekvőből 4 MMS+SMS-en kapta, 1 csak e-mailen; 3 egy órán belül nyitott, 2 napok múlva.
- **Érintések leadenként (mérve):** a 2745-ből 2140 (78 %) pontosan egyet kapott, 417 kettőt, 122 hármat, 65 négyet. A 11-13 óta kiküldött 1265-ből 1241 (98 %) egyet. **Ma (11-19-től) csak az első levél megy:** `nonopener_followup_daily_cap`=0 (100 ment 11-16…18, utána 4 nézés), `behavior_message` enabled=false (58 ment, utána 9 nézés + 1 próba), `escalation_followup` enabled=false (29 emlékeztető összesen), `mms_daily_cap`=0 (**1036 MMS vár a sorban**, 659 az utolsó 7 napból). `outreach_auto` enabled, holdCap 130.

**Két következtetés, ami az ötletek súlyát adja:** (1) a tulaj állítása igaz — 100-ból 80–88 soha nem nyit —, de a lyuk NEM a tárgysor vagy az óra (azok ±5 pont), hanem a **kézbesítés + az egycsatornásság + a mérés-vakság**; (2) ha a nyitás vissza is áll 25 %-ra, a mai lap-alj ~1 fizető/1000 levél marad — **a lap alját ugyanúgy kell építeni** (§7).

*(SQL: `…/scratchpad/funnel2.sql`, a kohorsz és a lekérdezések a session jegyzetében.)*

---

## 1. A lead pszichéje — kiből indulunk ki

Feltevés, nem mérés (ami mért, mellette a forrás): 1–10 szobás vendégház/apartman gazdája, a telefonján él (a nyitások 79 %-a mobilról, 10-11-i mérés), a portáloktól kapja a vendéget és fizeti a 13–18 % jutalékot. Novemberben nincs vendége és nincs pénznyomása, de ráér (KSH: a magánszállások 44 %-a novemberben nem fogad vendéget). Hetente kap „honlapot készítünk” levelet; a Booking-adathalászat (177 M Ft kár) óta **minden linkes megkeresés gyanús**; az állami „ingyen honlap” voucher azt hagyta benne, hogy **a honlap ingyen jár**.

Ami mozgatja — a mért viselkedés sorrendjében:
1. **Kíváncsiság a saját házára** („mit csináltak az ENYÉMBŐL?”). A nyitók 80 %-a olvas. A tárgy ma ezt nem használja („– kész honlap” = termék, nem az ő háza).
2. **Gyanakvás.** Logó + gomb + árdoboz + „−25 %” = marketing és adathalászat egyben. A 34 nézés nélküli válasz erre reagál. A „nem bankkártyás trükk” mondatod pont ide üt.
3. **Veszteség-kerülés** — a saját portál-árából kiszámolt évi jutalék konkrétabb a „jutalék nélkül” mondatnál.
4. **Büszkeség** — 4,7 csillag, 120 vélemény. A lapon ez lehetne az ő sikere, nem a mi termékünk.
5. **Falu-hatás** — a szállásadók egy faluban ismerik egymást; „a szomszéd is megnézte” erősebb minden referenciánál.
6. **Szezon-óra** — novembertől februárig terveznek; „szezonra kész” időkeret.
7. **„Nincs időm, nem értek hozzá”** — a NULLA-tulaj-munka ígéret (a kolléga mindent beállít) ma nincs kimondva.

**1.1 🟡 Lead-pszichogram** minden leadhez a meglévő adatból: tech-szint (FB-oldal? válaszol a véleményekre? hány portál?), fájdalom (portal_only → jutalék; outdated → „telefonon olvashatatlan”), büszkeség (rating, reviewCount), **aktivitás-óra** (a saját Google-vélemény-válaszainak időbélyegei megmondják, mikor van a telefonján), nyelv/ország. A tárgy, horog, csatorna, küldési óra ebből választódik.

**1.2 🟡⚖️ A házigazda keresztneve a vendégvéleményekből.** Tulajnév-mezőnk nincs; a vélemények tele vannak vele („Marika néni”, „Zoli mindenben segített”), a portál-profilokon „Házigazda: …”, a szállásnév gyakran keresztnév. Kinyerés csak ≥2 független forrás egyezésénél. Keresztnévvel szóló tárgy és első sor — a hideg levél legismertebb nyitás-emelője. (A vélemény szövege a mockra nem kerül, §B.7; a név használata egy sor jogi ellenőrzés.)

---

## 2. A GÉPEZET: kísérlet-motor + mérés (ami minden ötletet gépi döntéssé tesz)

**2.1 🟡📏 Kísérlet-motor.** Minden kiküldés változat-címkét kap (tárgy × első sor × feladó × törzs-típus × óra × csatorna-sorozat). A 24 és 72 órás link-nyitás, a válasz és a leiratkozás változatonként mérődik; **Thompson-sampling** osztja a következő napi keretet (a jobb többet kap, a gyengébb nem hal ki azonnal). Nulla ember: a gép hetente egy sort ír a Riportba. Őr: minden változat átmegy a §C- és a tényhűség-kapun; leiratkozás > 0,5 % → a változat kiesik. **Ez teszi gépezetté a megkeresést** — az alábbi ötletek változatok, nem tulaj-körök.

**2.2 🟡📏 Levélnyitás-mérés pixel nélkül.** A hős-kép ne beágyazva (CID, 553 KB), hanem a getcitoviso.com-ról töltődjön, leadenként egyedi URL-en. A Gmail/Apple Mail a megnyitásnál letölti → **A/B/C csoport szétválik**, a levél 20 KB-ra zsugorodik (a Gmail 102 KB felett vág). Képtiltó kliensben alt-szöveg + gomb marad.

**2.3 🟡 Napi automatikus spam-próba.** 5 saját seed-cím (Gmail, Outlook, freemail, citromail, saját domain), minden reggel egy valódi levél, a gép IMAP-on megnézi, melyik mappába ért. A fék ma egy napot vár a nézési arányra; ez percek alatt szól.

**2.4 🟡 Mérési hiányok a Riportba:** visszapattanás/panasz csatornánként naponta; válasz-kategória mező az `outreach_reply`-on (elutasító / nem érintett / érdeklődő / kérdés — gépi szabályból, a tulaj jóváhagyó sora változatlan); MMS/SMS kézbesítési nyugta (a modem DLR-je); pszichogram-mezők a `lead.raw`-ban.

---

## 3. CSATORNA: E-MAIL

**Kapu 0 — kézbesítés** (eldöntött, épül: ADR-0459). Ami még nincs benne:
- **3.1 🟡 Melegítés engaged leadekkel:** a felfutás első napjain az MMS-ről már nyitott, ismert érdeklődők kapják az új domainről a levelet → kattintanak, válaszolnak → pozitív hírnév-jel.
- **3.2 🟡 Válasz-gyűjtés:** a levél kér egyszavas választ („ha nem Ön a gazda, egy „nem””). A válasz a legerősebb Gmail-hírnév-jel, és a listát tisztítja; a „nem az enyém ≠ elutasítás” szabály (11-09) gépi útra kerül.
- **3.3 🔴 Útválasztás domainek közt** (`.store` már van): Gmail → A domain, magyar szolgáltatók → B; egy égés nem állít le mindent.
- **3.4 🟡 Nem-Gmail címzettek (12 %, 7 napon 7 %):** itt vagy spam, vagy nem olvassák — nekik az e-mail csak a sorozat első lépése legyen, és a mobil (§4) vagy a fizikai (§5) hozza a nyitást.

**Kapu 1 — a tárgy és a feladó** (ma `{szállásnév} – kész honlap`, „Citoviso”, „Elkészült a honlapja, nézze meg!”; **tárgy-teszt soha nem volt**). Változatok a motorba, mind tényhű (§C):
- `{Keresztnév}, a {szállásnév} honlapja` (1.2)
- `Ez az Ön szállása? ({szállásnév}, {város})` — kíváncsiság + „nem az enyém” szűrő
- `{szállásnév} – megnéztük, és készítettünk valamit`
- `{város}: a {szállásnév} új honlapja (még nem nyilvános)`
- `{szállásnév}: {N} értékelés, {X} csillag – és nincs honlap` (no_site, 4,0+)
- `Kérdés a {szállásnév} gazdájának`
- Feladó: „Citoviso” vs **személynév** (ADR-0442 már ezt teszi a 14 napos levélben) vs „Ferenc – Citoviso”.
- Első sor (mobilon ~40 karakter látszik): „elkészítettem a {szállásnév} honlapját, csak Ön látja:” — ember írta egy embernek.
- Óra: a mért 8–16 sávban nincs hatás; **este 18–20 és vasárnap este** mérve soha (↩️ ADR-0334) — egy szeleten a motor eldönti. A lead saját aktivitás-órája (1.1) a harmadik változat.

**Kapu 2 — a törzs** (ma: logó, szalagos kép, gomb, nyers URL, navy árdoboz, csapat-aláírás, apróbetű = **marketinglevél**):
- **3.5 🟡 „Sima e-mail” változat:** se logó, se árdoboz, se gomb; 5–7 sor, egy link, egy név. Az ár a LAPON (ott jó helyen). Két alváltozat: képpel és **kép nélkül** (kíváncsiság-rés: kattintani kell, hogy lássa).
- **3.6 🟡 Konkrét jutalék-szám:** `portalProfiles` ár × szobaszám × kimondott feltevés („60 éjszaka/év, 15 %”) → „évi kb. {X} Ft megy a portálnak”. Tényhű, mert a feltevés kimondott; az összeg a fejében marad.
- **3.7 🟡 Nulla-munka ígéret kimondva:** „Önnek semmit nem kell beállítania — a kolléga megcsinálja, Ön jóváhagyja.” Ez a termékünk valódi különbsége, a levélben ma nincs benne.
- **3.8 🟡 Falu-mondat:** „A {város}i szállások közül már {N} megnézte a tervét” — CSAK ha N mért és ≥3.
- **3.9 🟡 Kétlépcsős levél:** „Megmutathatom, mit készítettünk a {szállásnév}-nak? Egy „igen” elég.” Kevesebb azonnali nyitás, de **kért** második üzenet (SMS/WhatsApp jogilag tiszta), és aki igent mond, meleg.
- **3.10 🟡 +2 napos „Re:” levél ugyanabban a szálban** (`In-Reply-To`): 2 sor, „Megkapta? Ha nem jó a cím, kinek küldjem?” — a címzett egy beszélgetést lát, nem két reklámot.
- **3.11 🟡 Weboldal-űrlap az outdated/modern leadeknek:** ahol van saját honlap kapcsolat-űrlappal, az üzenet onnan érkezik a postafiókjába (a saját oldala küldi, nem egy idegen domain → a szűrő átengedi). Jogilag ugyanaz a megkeresés, kézbesítése biztosabb. Nem a fő szegmens (no_site), de a 893 outdated+modern leadhez második út.

---

## 4. CSATORNA: MOBIL — hang / SMS / MMS

A mért legerősebb emelő a második csatorna (36 % vs 17 %, a §0 fenntartásával); az 1 fizető és 4 próbázóból 4 MMS+SMS-en kapta a megkeresést. **Ma a mobil áll:** `mms_daily_cap`=0, 1036 MMS vár a sorban.

**4.1 🟢↩️ MMS+SMS az e-mail NEM-nyitóknak, a +4. napon** (nem egyszerre az e-maillel). A kód él (`sendOutreachPair.ts`), kapcsoló `mms_daily_cap`. Ez a 11-20-i „sms mms nem megy ki” döntést fordítja, de **csak ott, ahol az e-mail már elbukott** — a fizető és 3 próbázó ezen a csatornán jött. Napi 360 MMS/modem a plafon.

**4.2 🔴 GÉPI HÍVÁS — a tulaj ötlete, kidolgozva.**
Szkript (≤ 20 mp, a te hangoddal felvéve vagy helyi TTS): „Üdvözlöm, {Keresztnév}! Elnézést, hogy géppel beszél. Készítettünk egy honlapot a {szállásnév}-nak, ingyen megnézheti. Ha érdekli, nyomjon meg bármilyen gombot vagy mondja: igen — és SMS-ben küldöm a linket. Nem bankkártyás trükk, semmit nem kérünk. Ha nem érdekli, csak tegye le, megértem.”
Miért működhet: a hang és a hívószám **valóságosabb** a levélnél; az önirónia lefegyverez; az **„igen” az ő döntése**, így a következő SMS/WhatsApp **kért üzenet** (a Meta-szabálynak is megfelel); a „tegye le” kimondása leveszi a nyomást. A vendégház-gazda telefonál — ez az ő csatornája.
Technika, nulla ember:
- **SIP-trunk + Asterisk** (VPS vagy Debian): hívás, lejátszás, DTMF beépítve; „igen” felismerése helyi Whisper/Vosk (Win11 RTX 3070 vagy CPU, 3 szavas szókincs). Percdíj ~10–25 Ft, havi szám. A szám **visszahívható**: aki visszahív, automatikusan SMS-link.
- **Második GSM-modem** (SIM7600, USB-audio): valódi mobilszámról, DTMF megy; a SIM800C-t az MMS köti le. Olcsóbb, ~1 hívás/perc.
- **Hívás nélküli változat:** ugyanez SMS-ben: „A {szállásnév} honlapja kész. Válaszoljon IGEN-nel, és küldöm a linket.” (1 szelet, GSM-7.)
⚖️ Egy kör a jogi őrrel, nem újratárgyalás: az emberi beavatkozás nélküli hívórendszert az Eht. 162. § külön, hozzájáruláshoz köti (a Grt. jogos-érdek alapja levélre/SMS-re eldöntött). Irány: a hívás **nem ajánlatot ad, hanem engedélyt kér**, minden további az igen-re épül. Pirosnál az SMS-változat marad.
Mérés: felvette / végighallgatta / igen / letette / visszahívott; csatornajel `?v`.

**4.3 🟢 Viselkedés-üzenet (ADR-0439) vissza és GYORSÍTVA:** 58 ment ki 11-16…18 között → 9 nézés és **1 próba (Móriczka, 3 perccel az SMS után)** — a 4 valós próbából ez az egyetlen, ami egy üzenetünkre indult. Ma 20 perc késleltetés; a fizető 16 percen belül nyitott és 3 perc múlva írt. A 2. látogatás / árnézés után **2–5 percen belül**, amíg a telefonján van.

**4.4 🟡 „Visszahívás-kérés” gomb a lapon → gépi hívás a kolléga nevében.** A fizető pont ezt kérte SMS-ben. A gomb egy időpontot kér, a gép felhívja, lejátssza a 30 mp-es választ a leggyakoribb 8 kérdésre (ADR-0440 kategóriái), és SMS-ben küldi az indító linket. Emberi hívás nincs.

**4.5 🟡 Kísérő SMS újraírva:** ma „látványtervet” mond (ADR-0445 szerint már „működő oldal”), 2 szelet. Egy szelet, keresztnév, a saját aldomain-link.

---

## 5. CSATORNA: GPS / FIZIKAI HELYSZÍN

A lead címe ismert és valódi. Itt **nincs spam-szűrő, nincs platform-szabály**, és a kisszállásadó postaládáját senki nem bombázza.

**5.1 🔴 Képeslap a nyomtatott tervvel + QR.** Belföldi díj 305 Ft + nyomtatás, nyomda-API-val (képeslap-szolgáltató), a mock képe az egyik oldalon, QR + 3 sor a másikon. Hideg listán mért válaszarány 2–4 %. A QR a lapra ÉS egy `wa.me`-linkre is vihet (ő kezdeményez → WhatsApp szabályos). A +30. napon a top-leadeknek (no_site, 4,5+).

**5.2 🔴 „Doboz”:** a legértékesebb 50–100 leadnek A4-es nyomtatott terv + egy mondat + QR, borítékban. 600–900 Ft/db. Egy kézbe fogható honlap-terv a konyhaasztalon egészen más súly, mint egy levél. Mérhető: QR-jel.

**5.3 🔴 Geo-célzott hirdetés a településre** (Facebook/Google, napi pár száz Ft): „{Falu} szállásadóinak készítettünk honlapterveket” — nem a leadnek, a FALUNAK szól, és a falu-hatást indítja. Fizetős, kicsiben. ↩️ a „fizetős eszköz tilos” szabály e-mailre született; itt a tulaj mondja ki, érvényes-e.

**5.4 🟡 Településenkénti ütemezés (falu-kampány).** Egy településen EGY héten minden szállás kapja a levelet, a +7. napon mindenki a 3.8 „a faluból már N megnézte” mondatot. Ma a sorrend szegmens szerinti; településre csoportosítva a hálózati hatás kijön. A kiküldő sorrendjének egy paramétere.

**5.5 🟡 „Mit lát a vendég ma” a lapon:** képernyőkép arról, mit talál a vendég, ha a szállás nevére keres (portál-oldal a jutalékos árral / semmi), mellé a terv. A **láthatóság-termékünk** (Maps/GBP + SEO) a lapon ma nem jelenik meg, pedig a honlap nélküli ezt érti meg legkönnyebben.

**5.6 🟡 Helyi közvetítők egy levéllel (B2B2C):** TDM-szervezetek, Tourinform-irodák, falusi turizmus egyesületek (FATOSZ), önkormányzati hírlevelek. Egy levél egy szervezetnek = több száz tag elérése **szabályos** csatornán (az ő hírlevelükben). Nem nulla-humán az első kör (a szervezet dönt), de a mi oldalunk gépi: egy ajánlat-oldal településenként („{Falu} szállásai — a terveik itt”).

---

## 6. CSATORNA: SOCIAL (Facebook)

Direkt üzenetet cég nem kezdeményezhet (Messenger/Instagram, platform-szabály). Ami marad:
- **6.1 🟡 FB-oldalról plusz cím és szám.** A vendégházak többségének van FB-oldala nyilvános e-maillel/telefonnal — Magellan-bővítés. Nem új csatorna, de **több út ugyanahhoz a leadhez** (a 538 „ellenőrzésen fennakadt” lead egy része innen kapna címet).
- **6.2 🟡 Pszichogram-adat:** aktív-e az oldal, mikor posztol (aktivitás-óra), válaszol-e kommentre (tech-szint).
- **6.3 🔴 Falu-hirdetés** (= 5.3).
- **6.4 ⚖️ Nyilvános érintés** (komment, ajánlás, GBP „Kérdések”): spam, a platform kitilt — **nem javaslom**, csak hogy számba vettük.

---

## 7. A LAP: többszöri megnézés és rendelés (a nézők 91 %-a itt veszik el az ár előtt)

- **7.1 🟡 „Ez az Ön háza — vegye át.”** Regisztráció nélkül szerkeszthető elem a mockon (telefonszám, egy kép, egy mondat), a prospectre mentve. Aki hozzáér, az övének érzi — **és ez már a próba, csak nem úgy hívjuk**. A 2 korábbi próbázó be sem lépett: a belépést kell kiiktatni.
- **7.2 🟡 Jutalék-kalkulátor** a saját portál-árával előtöltve, csúszka éjszaka/év → „ennyit fizet ma, ennyibe kerülünk mi”.
- **7.3 🟡 Visszatérés-ok:** minden látogatás mutasson újat (2.: „elkészült a telefonos nézet / 3. terv”); a viselkedés-üzenet ezt küldi. Ma a 42 óra múlva visszatérő ugyanazt látja.
- **7.4 🟡 Referencia egy sorban:** az élő vevő oldala + egy mondata, engedéllyel.
- **7.5 🟡 Egyérintéses „miért nem?”** 4 emoji (drága / nincs időm / van honlapom / nem bízok) a lap alján és a leiratkozó lapon — a „Mi tartotta vissza?” szövegmezőre 0 válasz jött.
- **7.6 🟡 Határidő:** „A terv {dátum}-ig érhető el” (igaz: 90 napos megőrzés, ADR-0345) — ok a visszatérésre.
- **7.7 🟡 Büszkeség-nyitókép:** a 4,7 csillag és a legjobb vendégmondat a lap tetején az ő sikere; a mi blokkunk utána.

---

## 8. Sorozat — így áll össze (minden lépés leáll bármilyen nyitásra, válaszra, leiratkozásra; hétköznap; leadenként egyszer)

| nap | csatorna | tartalom | állapot |
|---|---|---|---|
| 0 | e-mail | fő levél (a motor változatai, §3) | él |
| +2 | e-mail „Re:” | 2 sor, ugyanabban a szálban (3.10) | 🟡 |
| +4 | **MMS+SMS** | a kép a telefonon (4.1) | 🟢↩️ |
| +7 | **gépi hívás** | igen → SMS-link (4.2) | 🔴⚖️ |
| +14 | e-mail személynévvel | ADR-0442 nem-nyitó levél (100 ment 11-16…18 → 4 nézés, 4 %: a mai alakjában gyenge, a motorba változatként) | 🟢 kapcsoló 0 |
| +30 | képeslap / doboz | nyomtatott terv + QR (5.1/5.2) | 🔴 |
| bármikor | viselkedés-üzenet | 2. látogatás / árnézés után 2–5 perc (4.3) | 🟢 kapcsoló ki |

---

## 9. Javasolt sorrend és a döntést kérő pontok

**Sorrend:** (1) kísérlet-motor + levélnyitás-mérés (§2) → (2) tárgy/feladó/sima-levél változatok a motorba (§3) → (3) sorozat vissza: Re:, viselkedés-üzenet gyorsítva, ADR-0442; +4 napos MMS a tulaj ↩️-jével → (4) gépi hívás: jogi kör + 50 leades SIP-próba → (5) lap: kalkulátor, „vegye át”, visszatérés-ok → (6) képeslap a top-leadeknek, falu-ütemezés.

**Igen/nem a tulajtól:**
1. ↩️ MMS+SMS az e-mail-NEM-nyitóknak a +4. napon? (A 11-20-i „sms mms nem megy ki” ezt zárta; a fizető és 3 próbázó ezen a csatornán jött; 1036 MMS vár a sorban.)
2. ↩️ Esti (18–20) és vasárnap esti küldés egy szeleten, a motor méri?
3. ↩️ Személynév feladónak a FŐ levélben is?
4. 🔴 Gépi hívás: jogi kör után SIP-trunk (percdíj) vagy második modem?
5. 🔴 Képeslap/doboz: 305–900 Ft/db a top-leadekre — igen/nem, havi keret?
6. 🔴 Falu-hirdetés napi pár száz Ft-ért — marad a „fizetős tilos”, vagy itt kivétel?
