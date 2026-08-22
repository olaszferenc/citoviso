# 2026-08-21 — E-MAIL HITELESÍTÉS: DKIM MEGJAVÍTVA + DMARC-FIGYELŐ ŐR

## Kiváltó
A tulaj egy Google DMARC aggregate-jelentést kapott (`noreply-dmarc-support@google.com`)
és megkérdezte, kell-e vele foglalkozni.

## Amit a jelentés mondott
5 levél 2 hét alatt, mind a Zoho kimenő IP-jéről (136.143.188.x), `disposition: none`:

| | SPF | DKIM |
|---|---|---|
| minden rekord | pass | **fail** |

Idegen forrás NEM volt — spoofing nem történt. A nyers XML-ben az `auth_results` blokkban
**egyáltalán nem volt `<dkim>` elem** → a levél alá sem lett írva (nem „elromlott az igazolás").
Ez a megkülönböztetés vitte a diagnózist a helyes irányba.

## A gyökérok — EGYETLEN ELGÉPELT KARAKTER
A Cloudflare-ben lévő `zmail._domainkey.citoviso.com` TXT-rekord base64 kulcsának
**50. karaktere nagy `I` volt a kis `l` helyett**. 216 karakterből 1 eltérés.

> **A felismerés kulcsa:** két külön generált RSA-kulcs MINDEN karakterében különbözne.
> Egyetlen eltérés csak transzkripciós hiba lehet — a böngésző-fontban a nagy `I` és a
> kis `l` glifje azonos. A rekord felvitelekor valaki „szemre" másolta.

Emiatt a Zoho `Ellenőrzés`-e sosem ment át → a selector `Ellenőrizetlen` maradt →
**a Zoho nem írta alá a kimenő leveleket** ("DKIM cannot be enabled — no verified default
selector present").

⚠️ `openssl` NEM dönti el, melyik változat az igazi: mindkettő érvényes 1024 bites RSA-ként
dekódolódik. Az eldöntő a Zoho `Ellenőrzés` gombja (ingyenes, nem destruktív orákulum).

## A javítás
1. Cloudflare API `PATCH` az EGY rekordra (tulaj explicit engedélyével — deploy-doktrína §0).
   Backup: `_planning/backups/dkim-txt-20260821-194751.json`.
2. Terjedés visszamérve 3 resolverről (8.8.8.8 / 1.1.1.1 / 9.9.9.9) — bitre azonos.
3. Zoho admin → Tartományok → citoviso.com → E-mail konfiguráció → DKIM →
   `Ellenőrzés` (átment) → `Állapot` bekapcsolva.

## Eredmény — függetlenül igazolva
`check-auth@verifier.port25.com`-nak küldött valódi levél válasz-riportja:

```
SPF check:    pass
iprev check:  pass
DKIM check:   pass   (matches From: olasz.ferenc@citoviso.com)
dmarc=pass    header.from=<olasz.ferenc@citoviso.com>
DKIM-Signature: v=1; a=rsa-sha256; s=zmail; d=citoviso.com; ...
```

A `DKIM-Signature` fejléc korábban EGYÁLTALÁN NEM létezett.

## Új őr: `scripts/dmarc-report.mts` (`npm run dmarc:check`)
- **NULLA új függőség** (a repó szikár, 12 dep): IMAP a beépített `node:tls`-en (literál-tudatos
  olvasóval), ZIP-kicsomagolás `zlib.inflateRaw`-val, XML minimál extraktorral.
- **Azt méri, ami SZÁMÍT:** nem azt, hogy „jött-e jelentés" (kényelmes proxy), hanem a
  **forrásonkénti hitelesítési verdiktet**. Se SPF, se DKIM → `FAIL` + **exit 1** (cron-riasztás).
  Csak az egyik → `WARN` (a DMARC ma átmegy, de a TOVÁBBÍTOTT levél elhasal: az SPF nem éli túl
  a forwardot, a DKIM igen).
- **PIROSRA is futtatva, nem csak zöldre** (lásd [[feedback_guard_must_measure_what_matters]]):
  `--selftest` mind a 4 osztályozásra (a `fail+fail → FAIL` ág bizonyítottan fog);
  rossz jelszó → exit 2; hiányzó config → exit 2. Hibás kapcsolat SOSEM hazudik „OK"-ot.
- Hitelesítés: `DMARC_IMAP_URL` (lokál `.env`), vagy `SMTP_URL`-ből származtatva.

## Buktató, ami egy órát elvitt (⚠️ NE ESS BELE ÚJRA)
A küldő-konfiguráció **NEM a lokális `.env`-ben van**, hanem az ÉLES szerveren:
`/opt/citoviso/app/.env` (`EMAIL_PROVIDER=smtp`, `SMTP_URL=…@smtppro.zoho.com:587`, `OUTREACH_FROM`).
Lokálban végig `mock` (az `outbox/`-ba ír) — és ez MARADJON is így, hogy lokál futtatás sose
küldjön valódi levelet. Ezért tettem a lokál `.env`-be CSAK `DMARC_IMAP_URL`-t (olvasás),
nem az `SMTP_URL`+`EMAIL_PROVIDER=smtp` párost.

Én a lokál `.env`-eket grepeltem, nem találtam semmit, és ebből tévesen azt állítottam, hogy
„nincs mail-config sehol" — pedig a tulaj már küldött élesben levelet. **Ha valami hiányzónak
tűnik, előbb nézd meg a prod `.env`-et.** Részletes infra: [[reference_citoviso_mail_infra]].

Zoho fiók-típus: fizetős „Mail Lite" org → a **`pro`** hostok kellenek
(`smtppro.zoho.com:587`, `imappro.zoho.com:993`), app-specifikus jelszóval.

## Módosított / létrehozott fájlok
- `scripts/dmarc-report.mts` (ÚJ)
- `package.json` (+`dmarc:check`)
- `_planning/backups/dkim-txt-20260821-194751.json` (ÚJ, DNS-backup)
- Cloudflare DNS: `zmail._domainkey.citoviso.com` TXT (éles, engedéllyel)
- Zoho admin: DKIM selector ellenőrizve + engedélyezve
- Lokál `.env`: `DMARC_IMAP_URL` (nem gitelt)

## Nyitott / következő lépések
1. **SPF `~all` → `-all`** (softfail helyett határozott állítás) — 1 DNS-rekord, engedéllyel.
2. **DMARC `p=none` → `p=quarantine`** pár nap tiszta jelentés után (ma csak FIGYEL, nem VÉD).
3. **Domain-bemelegítés:** a `citoviso.com` reputációja ~0 (összesen 5 levél ment róla).
   Egy „teszt" tárgyú, üres törzsű levél a tulaj Gmailjébe SPAMBE esett — ez a javítás ELŐTT,
   aláíratlanul ment ki. Az outreach-pipeline élesítése előtt a bemelegítés kötelező házi.
4. `dmarc:check` cronba (napi), hogy magától riasszon.
5. ⚠️ A csatolt Gmail-connector a SPAM mappa TARTALMÁT nem adja vissza (a címkét látja) —
   spambe esett levelet ne azon próbálj diagnosztizálni; a port25-hurok viszont ember nélkül záródik.
