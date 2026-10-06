# 2026-10-06 — Levelezés Zoho → Websupport: felmérés (elhalasztva)

## Kérés
Tulaj (brief `~/rc-briefs/email-20261004-213851.md`): átköltözhet-e a citoviso.com levelezés
a Zohóról a Websupportra, ahol API-n hatékonyabban lehet e-mail-címeket létrehozni és kezelni.

## Mért tények
- Ma: MX `mx.zoho.com`, SPF `include:zoho.com`, DNS a Cloudflare-en; Zoho Mail Lite, 1 fiók
  (`olasz.ferenc@`). Éles küldés: `OUTREACH_FROM=olasz.ferenc@`, `BOOKING_FROM=foglalas@`, Zoho SMTP.
- A fiók INBOX-ában (IMAP, csak olvasás): `elek@` 142, `info@` 14 levél → alias vagy catch-all;
  `foglalas@`, `hello@`, `segitseg@` 0.
- Websupport postafiók-API (v1, rest.websupport.sk/docs/v1.hosting): CSAK tárhely-szolgáltatás
  alatt; mailbox list/get/create/update/delete. Alias, továbbítás, autoválasz, DKIM végpont NINCS.
- ⚠️ `countryCheck` alapból true, `countries` = SK,CZ,HU,AT — az éles VPS Nürnbergben (DE) van,
  az app SMTP-belépése így elbukna. Létrehozáskor kapcsold ki, vagy add hozzá a DE-t.
- Tárhely: 899 Ft+ÁFA/hó, korlátlan postafiók, 300 levél/óra/fiók, 2000/óra összesen, SPF+DKIM.
- A Citoviso Websupport-fiókban (3213041) ma csak a citoviso.hu domain van, tárhely nincs.

## Javasolt sorrend (ha a tulaj indítja)
1. ★ Tárhely-rendelés · 2. citoviso.com a tárhelyre, postafiókok API-ból (countryCheck!) ·
3. mérés: SMTP a VPS-ről, `foglalas@` feladó, DKIM, port25-verifier, spam-pontszám ·
4. IMAP-másolás Zohóból · 5. ★ Cloudflare MX/SPF/DKIM + ★ éles `SMTP_URL`/`DMARC_IMAP_URL` ·
6. Zoho lemondás ~2 hét párhuzam után. (★ = éles/pénzes, külön engedély.)

## Nyitott kérdések
- Tulaj: „majd legközelebb” — tárhely-rendelés és A) egy fiók + catch-all vagy B) külön fiókok.
- Kézbesíthetőség: a Websupport osztott IP-jének hírneve a hideg megkeresésekhez mérendő az MX-váltás előtt.

## Módosított fájlok
- `MEMORY.md` · `_planning/memory/2026-10-06_levelezes_websupport_felmeres.md` (új)
- Repón kívül: auto-memória `reference_websupport_mailbox_api.md`, `project_mail_move_to_websupport_later.md`
