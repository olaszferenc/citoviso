## ADR-0024 — Pilot-infra: Hetzner Cloud (CX23) + Cloudflare (registrar/DNS/for SaaS) + INWX (tenant-domain-API, később)

- **Kiváltó (2026-08-02, tulaj):** a pilot-indulás külső blokkolóinak feloldása — hoszting-döntés + citoviso.com.
  Fő kritérium (tulaj, A1-elv): **skálázható ÉS teljeskörűen API-vezérelhető** infra (minél kevesebb emberi
  interakció); tárat NEM előre veszünk, hanem igény szerint.
- **Tárigény-becslés (valós mérésből):** tenant-oldal HTML ~40 KB; domináns tétel a tulaj-fotó (nyersen 2–6 MB/kép,
  cap 24) → worst ~150 MB/tenant, kép-átméretezéssel ~10 MB/tenant. **100 tenant ≈ 2–15 GB** — a belépő VPS
  beépített tárja (40 GB) bőven fedezi; külön tárvásárlás nem kell. (Backlog: kép-átméretezés a feltöltésnél.)
- **Hoszting: Hetzner Cloud CX23** (2 vCPU / 4 GB / 40 GB NVMe / 20 TB forgalom, NBG1) — **€5,49/hó nettó**
  (~€7 bruttó; a 2026-06-15-i Hetzner-áremelés utáni ár; a CPX-vonal 2,4–2,5×-ösére drágult → kerüljük).
  Indok: teljes REST API + Terraform (provisioning/resize/volume/snapshot/backup/firewall mind programból);
  óraalapú számlázás; CX33-ra (8 GB/80 GB, €8,49) API-ból percek alatt átméretezhető; Volume €0,044/GB/hó
  utólag. EU (német) adatközpont, GDPR OK. **Primary IPv4 kell** (IPv6-only szerverről a GitHub elérhetetlen).
  Elvetve: magyar szolgáltatók (nincs teljeskörű API), DO/Vultr (~2× ár), PaaS (drágább, kevesebb kontroll).
- **Domain + DNS: Cloudflare.** citoviso.com a Cloudflare Registrarnál **MEGVÉVE (2026-08-02)** (önköltségi ár,
  ~11–12 $/év). DNS + wildcard `*.citoviso.com` (korlátlan aldomain-tenant ingyen) + **Cloudflare for SaaS** a
  későbbi egyedi ügyfél-domainekhez (automata TLS; első 100 custom hostname ingyen, utána $0,10/hó/db —
  beépíthető az egyedi-domain upsell árba). Minden API-ból (DNS-rekordok, custom hostnames).
- **Tenant-domain-vásárlás (ADR-0020 nyitott tétele LEZÁRVA): INWX** (német ICANN-regisztrátor) — teljes
  purchase-API (JSON-RPC), 2200+ TLD **köztük .hu valós idejű regisztrációval** (a legtöbb API-s regisztrátor
  .hu-t nem tud), reseller-ár belépő nélkül. Flow: konfigurátor-csekk (domains.ts) → INWX-API vétel → NS a
  Cloudflare-re → for SaaS TLS. **NEM pilot-blokkoló**: integráció-trigger = az első egyedi-domain rendelés
  (addig A2 kézi). citoviso.hu (védelem) szintén INWX v. magyar regisztrátor.
- **Postafiók-irány (tulaj-megkötés: Google KIZÁRVA):** Zoho Mail Lite (~1 $/fő/hó, saját domain + SMTP/IMAP +
  DKIM; a free csomag SMTP nélkül NEM elég). Alternatíva: Migadu/Fastmail. Beszerzés a domain-DNS beállítása után.
- **Pilot-infra összköltség: ~€7-8/hó bruttó** (CX23 + 20% backup + Cloudflare free + Zoho ~1$).
- **Visszafordíthatóság:** 🔄 könnyű — statikus kimenet + Node + Postgres hordozható; a Cloudflare-réteg és a
  regisztrátor külön-külön cserélhető. Egyirányú elem nincs.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-02). citoviso.com megvéve; Hetzner-fiók regisztráció alatt.
  Következő: Hetzner projekt + API-token → szerver-provisioning API-ból → DNS → Zoho + SPF/DKIM → email-füst-teszt.
