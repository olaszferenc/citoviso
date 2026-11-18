## ADR-0459 — A hideg megkeresés KÜLÖN domainről megy (getcitoviso.com), saját SMTP-vel és DKIM-mel, felfutással és fékkel

**Státusz:** ELFOGADVA (tulaj 2026-11-18: „B szerintem a jobb megoldás” a Websupport-tárhelyre, „Ok menjen” a kódra; brief `email-spam-20261118-125036.md`, session `cit73105eb0`) ·
**Épít:** ADR-0069 (List-Unsubscribe kapcsoló), ADR-0405/0409 (kiküldési sor), ADR-0456 (ország-réteg kiküldés), ADR-0334 (mock-ablak) ·
**Forrás:** `reports/Hideg email kézbesítés nagy volumenben.md` (kutatás, 5 jegyzet) + éles mérés (lent).

### Kiváltó (mérve, éles DB `prospect` × `mock_view`, 24 órás, bot nélküli nézés)

A citoviso.com egyetlen Zoho-postafiókjáról ment minden hideg levél ÉS minden vevői levél (belépés,
számla). 11-09…11-16 délelőtt a Gmail-es címzettek 21–39%-a megnézte a tervet (napi 150–180 Gmail-levél
mellett is). 11-16 délutántól 3/83, 11-17 2/205, 11-18 0/194: a citoviso.com Gmail-hírneve elromlott,
friss Gmail-fiókban minden változat (képes, sima szöveges, új tárgy) spambe ment, ismert címzettnél
Elsődlegesbe. Az okot nem lehet egyetlen tényezőre szűkíteni (ugyanazon a napon ugrott a mennyiség
és ment élesbe a rejtett előnézeti sor is); a tulaj Gmailjében beérkező marketinglevelek (pl.
Palladium) ugyanilyen rejtett sorral mennek, tehát az egymagában nem ok. Ami biztos: a hideg
mennyiség a vevői levelek domainjét égette. Tiltólistán (Spamhaus DBL, SURBL, URIBL) a citoviso.com
NINCS (11-18 mérve).

### Döntés

① **Külön küldő-domain:** `getcitoviso.com` (a tulaj vette 11-18-án; a `.store` párja is), Websupport
Simple tárhellyel (olaszferenc_1, 26458344). Feladó: `Citoviso <ajanlat@getcitoviso.com>` (postafiók
6685620, `countryCheck=false`, hogy a nürnbergi VPS beléphessen). SMTP: `smtp.websupport.hu:587`
STARTTLS. A fő domain (citoviso.com) marad a weboldalé és a vevői leveleké (Zoho).

② **Saját DKIM:** a Websupport „DKIM engedélyezve” kapcsolója NEM ír alá (mérve 11-18: nincs kulcs a
zónában, az aláírás hiányzik). Ezért a kulcs a miénk: selector `cit1`, TXT `cit1._domainkey.getcitoviso.com`
(API-n felvéve), privát kulcs a gépen kívül a repón (`/opt/citoviso/getcitoviso-dkim.pem`, 600), a
nodemailer írja alá (`dkim:{domainName,keySelector,privateKey}`). Mérve: Zoho-fejléc `dkim=pass spf=pass
dmarc=pass`. Friss citoviso@gmail.com: a valódi Viskó-levél az új domainről a BEÉRKEZETTBE ment (11-18 14:49).

③ **A levélben egyetlen citoviso.com sincs.** A terv-link, a leiratkozó és az adatkezelési link a
`COLD_OUTREACH_BASE_URL` alól jön (`/p/<slug>/<token>` útvonalas alak; az ADR-0330 aldomain-link a
platform-hoston marad, a getcitoviso.com-on nincs wildcard-TLS), az aláírás W-sora és a cégsor a
hideg hostot nevezi, a kapcsolat-cím a hideg postafiók. Az edge (nginx `sites-available/getcitoviso`,
Let's Encrypt `getcitoviso.com`) ugyanúgy irányít, mint a citoviso.com blokk — a terv-oldalról
továbblépve (próba, megrendelés) már mehet a citoviso.com.

④ **Sáv a kódban, nem környezeti csere:** `EmailMessage.lane: "cold"` — a levél ÉPÍTŐJE teszi rá
(hideg levél, nem-nyitó utánkövetés, viselkedés-üzenet, eszkaláció), a küldőhely soha. Az SMTP-adapter
a sávhoz a `config.coldOutreach` transzportját és feladóját választja; fél sáv (URL feladó nélkül,
selector kulcsfájl nélkül) hangosan bukik induláskor. Üres config = nincs sáv (dev, tesztek
változatlanok). A próba-kampány és minden vevői levél a platform-postafiókon marad.

⑤ **Felfutás + fék** (`src/outreach/coldRamp.ts`, `outreach-dispatch.mts ramp`): a napi ÖSSZES
(minden ország) kiküldés induló értékről munkanaponként +X%-kal nő a plafonig (javasolt 100 → +30% →
3000; kb. 12 munkanap alatt 2000 fölé). A felfutás a honi (HU) statikus kvótát a maga szintjére
emeli. **Ütemezés:** egy timer-futás csak az aznapi maradék egyenletes részét küldi (maradék / hátralévő
2 perces rések), 3–9 mp szünettel — nincs reggeli löket. **Fék:** naponta egyszer, az első küldés
előtt az előző munkanap e-mailjeinek 24 órás nézési aránya (Gmail-címzettek külön, ha ≥30): <4% →
kapcsoló KI + riasztás (mail+SMS); <10% → a keret befagy a mai szinten + riasztás; ≥15% → a fagyás
old. 30 levél alatt nincs ítélet.

⑥ **Válaszok:** a hideg postafiókot is a válaszgyűjtő olvassa (`COLD_REPLIES_IMAP_URL`, saját
állapotfájl), a tárolás és a párosítás változatlan.

### Ami NEM változik

A List-Unsubscribe fejléc KI marad (tulaj: a levél az Elsődlegesbe menjen; ADR-0069 mérés). Az SMS/MMS
link a platform-hoston marad (a modem-csatornának nincs levél-hírneve). A citoviso.com hírneve magától
áll helyre (szakértői becslés 5–8 hét), amíg onnan hideg levél nem megy — ezt a sáv garantálja.

### Üzemeltetés

Éles `.env`: `COLD_OUTREACH_SMTP_URL`, `COLD_OUTREACH_FROM`, `COLD_OUTREACH_BASE_URL`,
`COLD_OUTREACH_DKIM_SELECTOR=cit1`, `COLD_OUTREACH_DKIM_KEY_FILE`. Websupport-korlát: 300 levél/óra/
postafiók, 2000/óra összesen → napi ~2 700 felett második postafiók kell. Mérőpontok: `outreach-dispatch.mts
status` (ramp: capToday/sentToday/holdCap), Google Postmaster Tools a getcitoviso.com-ra (felvenni),
citoviso@gmail.com ellenőrző fiók.
