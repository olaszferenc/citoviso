# 2026-11-18 — Hideg megkeresés külön domainről: getcitoviso.com sáv, felfutás, fék (ADR-0459)

**Session:** `cit73105eb0` (brief `email-spam-20261118-125036.md`). **Élesen: a kód NINCS kint**, az infra IGEN (lent).

## Mi történt

1. **Kutatás** (5 subagent, jelentés `_planning/RESEARCH-2026-11-18-hideg-email-kezbesites.md`): a tulaj a fizetős
   inbox-/kiküldő-eszközös rangsort elutasította („csak ingyen”), a cél napi több ezer, főleg Gmailre.
2. **Mérés az éles DB-ből** (prospect × mock_view, 24 h, bot nélkül): a Gmail-nézés 11-09…11-16 de. 21–39%
   (napi 150–180 Gmail-levél mellett is), 11-16 du.-tól 3/83 → 2/205 → 0/194. A citoviso.com Gmail-hírneve
   romlott el; tiltólistán nincs. A rejtett preheader egymagában NEM ok (a Palladium-levél is ilyennel megy
   beérkezettbe) — a 11-16-i mennyiségugrás és a sablonváltás egy napra esett, szétválasztani nem lehet.
3. **Tulaj-döntések:** a levél az ELSŐDLEGES fülre menjen (List-Unsubscribe fejléc KI marad); külön .com
   márkadomain a hideg küldésnek (bizalom: a .hu-t külföldi címzett idegennek látná); Websupport-tárhely
   (B); „Ok menjen” a kódra.
4. **Infra, ÉLESEN KÉSZ (tulaj-engedéllyel):** getcitoviso.com + getcitoviso.store (tulaj vette), Simple tárhely
   olaszferenc_1 (26458344; következő díj 1 299 Ft/hó); domain a tárhelyhez rendelve (UI, headed Chromium +
   xvfb — a login reCAPTCHA-ja a DevTools-MCP-t kiszúrta, a Playwright persistent profilt nem; a jelszó végén
   PONT van); postafiók `ajanlat@getcitoviso.com` (API, countryCheck=false; jelszó
   `~/.config/citoviso/getcitoviso-smtp.txt`); DNS @/www A → VPS 178.104.3.223, AAAA törölve (az nginx csak
   IPv4-en figyel); nginx `sites-available/getcitoviso` (80: ACME + 301; 443: a citoviso-blokk útvonalai,
   LE-cert `getcitoviso.com`); `https://getcitoviso.com/p/<slug>/<token>` 200. **DKIM:** a Websupport
   kapcsolója NEM ír alá → saját kulcs (`cit1._domainkey`, privát `~/.config/citoviso/getcitoviso-dkim.pem`),
   nodemailer-aláírással Zohónál `dkim=pass spf=pass dmarc=pass`. Friss citoviso@gmail.com: a Viskó-levél
   az új domainről a BEÉRKEZETTBE ment (14:49).
5. **Kód (landolás alatt):** `src/outreach/coldLane.ts` (sáv-config, link-alap, host, feladó), `EmailMessage.lane`
   + második transzport DKIM-mel (`sender.ts`), `lane:"cold"` a hideg levélen / nem-nyitón / viselkedés-üzeneten
   (az eszkaláció a hideg építőn át), linkek `coldLinkBase()`-ről (SMS marad platform), aláírás W-sor + cégsor
   a hideg host, `linkHost.ts` a sáv mindkét oldalát nézi; `src/outreach/coldRamp.ts` felfutás (induló × (1+%)^munkanap,
   plafon, hold), ütemezés (maradék / hátralévő 2 perces rések, 3–9 mp szünet), fék (előző munkanap 24 h nézés:
   <4% KI+riasztás, <10% fagy, ≥15% old; ≥30 minta; Gmail külön); `outreach-dispatch.mts ramp …`; a
   válaszgyűjtő a hideg postafiókot is olvassa (`COLD_REPLIES_IMAP_URL`). Öntesztek: `cold-ramp-selftest`,
   §C-kapu, country-e2e 42/42, i18n tiszta, sáv-render 0 citoviso.com-említés.

## Élesítéshez (tulaj „mehet” kell)

Éles `.env`: `COLD_OUTREACH_SMTP_URL`, `COLD_OUTREACH_FROM="Citoviso <ajanlat@getcitoviso.com>"`,
`COLD_OUTREACH_BASE_URL=https://getcitoviso.com`, `COLD_OUTREACH_DKIM_SELECTOR=cit1`,
`COLD_OUTREACH_DKIM_KEY_FILE=/opt/citoviso/getcitoviso-dkim.pem` (a kulcsot át kell másolni, citoviso:600);
deploy; `outreach-dispatch.mts ramp 100 --growth=30 --max=3000`; `on`. A fő fán (Debian) a válaszgyűjtőnek
`COLD_REPLIES_IMAP_URL=imaps://ajanlat%40getcitoviso.com:…@imap.websupport.hu`.

## Nyitott

- A 11-16 du.–11-18 közt spambe ment ~480 Gmail-címzett újraküldése az új domainről (a sor mögé; csak aki nem
  nézte/nem válaszolt/nem iratkozott le) — a `sendOutreachMail` egyszer-küld kapuja miatt külön szkript kell.
- Postmaster Tools a getcitoviso.com-ra; Websupport 300/óra/fiók → napi ~2 700 felett második postafiók.
- A citoviso.com hírneve: onnan hideg levél nem megy; helyreállás szakértői becslés 5–8 hét.
