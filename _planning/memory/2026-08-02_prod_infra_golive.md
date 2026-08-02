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
