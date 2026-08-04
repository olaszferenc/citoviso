# 2026-08-02 — ÉLES INFRA FELÁLLT: citoviso.com él (ADR-0024 végrehajtva)

## Ami ma történt (időrendben)
1. **Hoszting-döntés (ADR-0024):** Hetzner CX23 + Cloudflare; tárigény-becslés valós mérésből
   (100 tenant ≈ 2–15 GB → belépő VPS elég). Hetzner 2026-06-15-i áremelés: CX23 €5,49 nettó
   (a CPX-vonal 2,4×-ére nőtt — kerülendő). Tenant-domain-API-irány: INWX (.hu-t is tud).
2. **citoviso.com megvéve** (Cloudflare Registrar, tulaj fiókja).
3. **Szerver API-ból:** `citoviso-app-1` (id 158171031), CX23/Debian 13/NBG1, IP 178.104.3.223,
   firewall 22/80/443, napi backup, dedikált SSH-kulcs (`~/.ssh/citoviso_hetzner`).
4. **DNS API-ból:** A @ · CNAME www · A *.citoviso.com → szerver, mind proxyzva.
   ⚠️ CF-token tanulság: az új „Account API tokens" (cfat_) a zóna dns_records-hoz NEM elég —
   a klasszikus User-token „Edit zone DNS" sablon kell (profile/api-tokens).
5. **Bootstrap (tulaj-engedéllyel):** node20+PG17+nginx; app rsync-kel (git ls-files, nincs git a
   szerveren); friss DB 15 migrációval; systemd citoviso-public/:4800 + citoviso-console/:4600
   (kifelé zárva); nginx önaláírt origin-cert (CF Full) → **https://citoviso.com ÉL** (+www+wildcard).

## Kulcs-tények
- Éles .env-ben CSAK app-kulcsok (Anthropic/Google/Barion-test/Számlázz-mock); infra-tokenek
  (HCLOUD, CLOUDFLARE, R2) csak a dev-gép .env-jében.
- Deploy-minta: rsync a dev-gépről (MineREAL-mérce: csak módosított fájl); a szerver nem git-el.
- Email: még mock/outbox a szerveren is; Zoho + SPF/DKIM a következő.

## Nyitott (következő session)
- Tulaj: CF „Always Use HTTPS" kapcsoló + Zoho Mail Lite regisztráció (zoho.eu)
- Én: SPF/DKIM/DMARC rekordok API-ból → SMTP_URL + éles füst-teszt (scripts/email-smoke.ts)
- Döntés: dev↔prod DB-workflow (scrape/kuráció a dev-gépen külön DB-vel fut — egységesítés kell
  a pilot-tölcsérhez: vagy távoli DATABASE_URL a dev-gépről, vagy minden művelet a szerveren)
- Konzol-elérés: SSH-tunnel vs admin-aldomain (operator-login már véd) — tulaj-döntés
- Tenant host-routing: a wildcard ma ugyanazt az oldalt adja; a slug.citoviso.com → tenant-site
  kiszolgálás a következő fejlesztési szelet (public.ts Host-alapú routing)

---

## Kiegészítés (2026-08-03/04) — E-MAIL-INFRA: Zoho Mail Lite + teljes DNS-hitelesítés

**Miért külső küldő (tulaj-vita tisztázva):** a saját szerverről küldött HIDEG levél a friss domain +
friss Hetzner-cloud-IP miatt spam-mappában landolna → a pilot válasz-arány-mérése HAMIS lenne (a
pilot egyetlen terméke ez a mérés). A Zoho szerepe KIZÁRÓLAG a kimenő kézbesíthetőség (bérelt
küldő-reputáció). **A tenant-email (későbbi felár-modul) ettől független**: az normál levelezés
(fogadás+tárolás), saját mail-stackkel (mailcow/Mailu/Stalwart, korlátlan cím, fejenkénti díj nélkül)
külön kis VPS-en megoldható — a Zoho NEM egyirányú ajtó, később a saját fiók is átköltöztethető.

**Beállt (2026-08-03):**
- **Zoho Mail Lite**, €10,80/user/év, 1 user: `olasz.ferenc@citoviso.com` (superadmin) +
  **`info@citoviso.com` INGYENES ALIAS** ugyanarra a postafiókra. Adatközpont: **zoho.com (US)**,
  megújítás 2027-03-08. Alias = ugyanaz a fiók (nincs külön belépés); külön belsős fiók = új user
  (fizetős), több user közti megosztott cím = Csoport (ingyenes).
- **DNS mind API-ból, kézzel semmit** (a Zoho „automatikus" útját szándékosan NEM adtuk meg — nem
  kap Cloudflare-hozzáférést): TXT zoho-verification · MX mx/mx2/mx3.zoho.com (10/20/50) ·
  SPF `v=spf1 include:zoho.com ~all` · **DKIM `zmail._domainkey`** (1024-bit RSA; a képről olvasott
  kulcsot `openssl rsa -pubin` paresével VALIDÁLTAM leolvasás után) · **DMARC** `p=none` +
  rua a saját címre (monitorozó mód — szigorítás a bejáratás után).
- **Bejövő ÉL** (a Zoho dashboard 7 beérkezett levelet mutat).
- **Kliens-beállítás (fizetős csomag → `…pro` hostok!):** IMAP `imappro.zoho.com:993 SSL` ·
  SMTP `smtppro.zoho.com:465 SSL` · user = teljes e-mail-cím. (A zoho.eu hostok NEM jók ehhez a fiókhoz.)

**Hátra az éles füst-tesztig (tulaj, gép elől):**
1. IMAP/SMTP-hozzáférés bekapcsolása (admin: Levelezés beállításai → POP/IMAP)
2. **App-jelszó** (accounts.zoho.com → Biztonság → Alkalmazásjelszavak; a jelszó CSAK létrehozáskor
   látszik egyszer) → utána én: `SMTP_URL=smtps://olasz.ferenc%40citoviso.com:<appjelszó>@smtppro.zoho.com:465`
   + `OUTREACH_FROM` + `EMAIL_PROVIDER=smtp` az ÉLES .env-be → `npx tsx scripts/email-smoke.ts <saját cím>`
3. Kiküldés előtt még: `PRICING_CONFIRMED` + valós árak (modules.ts) — a §C-kapu addig blokkol.

**Feladó-választás (nyitott, nem blokkoló):** hideg megkeresésnél a SZEMÉLYES feladó
(`olasz.ferenc@`) tipikusan jobb válasz-arányt hoz, mint az `info@` — A/B-zhető a pilotban.

---

## Kiegészítés 2. (2026-08-04) — ⭐ AZ ELSŐ VALÓS LEVÉL ELMENT

- **App-jelszó** (Zoho → Biztonság → Alkalmazásjelszavak, „Citoviso") beállítva az ÉLES `.env`-be:
  `EMAIL_PROVIDER=smtp` · `OUTREACH_FROM=olasz.ferenc@citoviso.com` ·
  `SMTP_URL=smtp://olasz.ferenc%40citoviso.com:<appjelszó>@smtppro.zoho.com:587?requireTLS=true`
- **⚠️ HETZNER PORT-BLOKK (fontos, vérrel tanult):** a szerverről a **25-ös ÉS a 465-ös kimenő port
  BLOKKOLT** (új fiók alapbeállítása) — az első próba „Connection timeout"-tal bukott. A **587
  (STARTTLS) NYITVA** → arra állítva működik. Ha valaha saját mail-stack kell, a 25-öst
  kérvényezni kell a Hetznernél.
- **`scripts/email-smoke.ts` ÉLESBEN LEFUTOTT** a szerverről, kétszer is (a tulaj fiók-jelszó-cseréje
  UTÁN is ment → az app-jelszót a jelszó-csere nem érvényteleníti). Küldő-út: KÉSZ.

## NYITOTT (a tulajnál, következő session eleje)
- **IMAP a levelező-kliensbe (Outlook) MÉG NEM MEGY.** Diagnosztizálva (nem tipp): a Zoho IMAP-szerver
  válasza `NO [ALERT] You are yet to enable IMAP for your account`. Az admin-oldali házirend
  (Levelezés beállításai → E-mail szabályzat → Hozzáférési korlátozások) MÁR engedélyezi, de a Zoho
  KÉTLÉPCSŐS: a postafiókban is be kell kapcsolni. Hivatalos doksi szerint a hely a **WEBMAIL**:
  **mail.zoho.com → fogaskerék → Levelezőfiókok (Mail Accounts) → a cím → IMAP szekció → IMAP Access
  pipa → Mentés** (közvetlen: https://mail.zoho.com/zm/#settings/mailaccounts). NEM az admin-konzolban.
  ⚠️ Az app-jelszó JÓ (az SMTP vele megy) — nem kell újragenerálni; az Outlookba is app-jelszó kell.
- **Ez NEM blokkolja a pilotot:** a kiküldés SMTP-n megy (működik), a válaszok a webmailben olvashatók.
  Az IMAP csak kényelmi (Outlook/telefon).
