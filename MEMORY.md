# MEMORY — Citoviso
Utolsó frissítés: 2026-08-04

## Aktív feladat
**2026-08-02/04 — ⭐⭐ ÉLES INFRA FELÁLLT: citoviso.com ÉL + e-mail-infra hitelesítve (ADR-0024).**
- **ADR-0024 (hoszting-döntés):** **Hetzner Cloud CX23** (2 vCPU/4 GB/40 GB, NBG1, €5,49 nettó/hó) —
  fő kritérium a TELJESKÖRŰ API-vezérlés (A1-elv) + óraalapú skálázás; **Cloudflare** (registrar+DNS+
  később for SaaS); tenant-domain-vásárláshoz **INWX** (.hu-t is tud API-ból; trigger: 1. egyedi-domain
  rendelés). Tárigény-becslés valós mérésből: **100 tenant ≈ 2–15 GB** → nem veszünk előre tárat.
  ⚠️ Hetzner 2026-06-15-i áremelés: a CPX-vonal 2,4×-ére drágult → CX-vonal kell.
- **Szerver + DNS API-ból:** `citoviso-app-1` (158171031), Debian 13, **IP 178.104.3.223**, tűzfal
  (22/80/443), napi backup, dedikált SSH-kulcs. DNS: A @ · CNAME www · **A * (wildcard tenant-aldomain)**
  → proxyzva. ⚠️ CF-token-csapda: az ÚJ „Account API tokens" (cfat_) NEM ad zóna-DNS-jogot — a
  klasszikus **User-token „Edit zone DNS" sablon** kell (dash.cloudflare.com/profile/api-tokens).
- **Bootstrap (tulaj-engedéllyel):** node20 + PG17 (friss DB, 15 migráció) + nginx (önaláírt origin-cert,
  CF Full) + systemd (`citoviso-public` :4800, `citoviso-console` :4600 kifelé ZÁRVA). Deploy = **rsync
  a dev-gépről** (`git ls-files`; nincs git a szerveren). Éles `.env`-ben CSAK app-kulcsok (infra-tokenek
  nem). **https://citoviso.com ÉL** (+www +wildcard).
- **E-mail-infra (2026-08-03):** **Zoho Mail Lite** 1 user `olasz.ferenc@citoviso.com` + **`info@` ingyenes
  ALIAS** (€10,80/év). DNS mind API-ból: verify-TXT · MX · SPF · **DKIM `zmail._domainkey`** (openssl-lel
  validált kulcs) · **DMARC p=none**. Bejövő ÉL. Kliens: `imappro/smtppro.zoho.com` (fizetős → „pro" hostok!).
  **A külső küldő KIZÁRÓLAG a hideg-kézbesíthetőség miatt kell** (friss IP+domain = spam → hamis pilot-mérés);
  a tenant-email felár-modul ettől független, saját mail-stackkel is megoldható.
- **KÖVETKEZŐ (tulaj, gép elől): IMAP bekapcsolás + app-jelszó** → utána én: `SMTP_URL`+`OUTREACH_FROM`+
  `EMAIL_PROVIDER=smtp` az éles .env-be → `scripts/email-smoke.ts` = **első valós küldés**.
  Utána: valós árak + `PRICING_CONFIRMED` (§C-kapu), majd a **teljes A–Z sandbox-teszt**.
- **Nyitott technikai szálak:** dev↔prod DB kettéválás (scrape/kuráció ma a dev-gépen fut, a szerver DB-je
  külön/üres — egységesíteni kell a pilot-tölcsérhez) · konzol-elérés élesben (SSH-tunnel vs admin-aldomain)
  · tenant host-routing (a wildcard ma ugyanazt az oldalt adja, nincs `slug.citoviso.com` → tenant-site) ·
  CF „Always Use HTTPS" kapcsoló. Jegyzet: `_planning/memory/2026-08-02_prod_infra_golive.md`.

---
**2026-08-02 — §A PER-KÉP PROVENANCE A GO-LIVE ÉLEN KÉSZ (`40d48e9`, őr-verifikált).**
- **Photo += `provenance`** (§A.3: owner|guest|portal|places|streetview|generated) + `watermarked`;
  ÚJ `src/engine/photoPolicy.ts`: live-renderből KIZÁRÓLAG places/streetview/vízjeles/ismeretlen esik ki
  (ismeretlen=drop A4 safe default; `/uploads/` prefix = legacy owner); guest/portal az önnyilatkozattal
  élesre megy csere nélkül. Bélyegzés: motor Places-fotó=`places`, tenant-feltöltés=`owner`.
- **Go-live sorrend (őr-jelezte rés fixálva):** `activate()` → §A-policys live render ELŐBB
  (`rerenderTenantSnapshot(tenantId,{as:"live"})`), status-flip CSAK sikeres render után; legacy
  HTML-copy artifact nem auto-élesedik. Tenant-szerkesztő live-státuszú re-renderje is policy-s.
- **⭐ BÓNUSZ BUGFIX:** `toPrivatePreview` létező robots metát noindexre CSERÉL — az engine-renderelt
  provisioned privát előnézet eddig `index,follow` volt (Bonvino bizonyította)! + eddig a live site a
  provisioned NOINDEXES snapshotot szolgálta ki (nem volt go-live re-render) — mindkettő zárva.
- **Remediáció:** GRANDIS pre-policy legacy live sandbox-site → provisioned (0 live site a dev DB-ben).
- E2E (Bonvino): provisioned=demó-fotó+noindex · live=0 Places-URL+owner-fotók+index · tsc tiszta.
- **Őr-jegyzetek (kis nyitottak):** `watermarked` ma halott kód (portal-ingestnél kötelező lesz a
  bélyegzés); az engine-renderelt provisioned előnézetben nincs demo-framing lábléc (noindex+token véd,
  de §A.12-súrlódás — tulajjal eldöntendő, kell-e keret).
- **Temp-screenshot kivizsgálva:** a tulaj 08-01 21:23-as mobil-fotója a 23:22-es szerver-restart
  ELŐTTI régi konzol-UI-t mutatta; a mostani konzol 390px-en Playwrighttal verifikálva RENDBEN
  (tabsor + panelen belüli tábla-görgetés). Kódmódosítás nem kellett.
- **KÖVETKEZŐ: teljes A–Z sandbox-teszt** (scrape→mock→outreach→rendelés→fizetés→számla→élesítés
  egyben) — tulaj-döntés szerint ez előzi a Barion/Számlázz éles kulcsokat. Kozmetika hátra: régió-slug
  a levél hook-mondatában.

---

**2026-08-01 (2. session) — B) OUTREACH KÜLDŐ-PIPELINE KÉSZ (§C-kapu a csőben, E2E-verifikálva).**
- **SMTP-adapter** (`src/email/sender.ts`): nodemailer a stub helyett (`SMTP_URL`+`OUTREACH_FROM` kötelező,
  hangosan bukik); mock/outbox marad a default. `EmailMessage` += `headers`.
- **HTML-sablon** (`src/email/outreachEmail.ts`): a §C-kapuzott SZÖVEGES piszkozat bekezdéseiből renderel
  (egy-forrás → §I-hű), brand-színek, CTA, NINCS tracking-pixel; **RFC 8058 one-click unsubscribe** fejlécek.
- **Pipeline** (`src/outreach/sendBatch.ts` + `scripts/outreach-send.ts`, `npm run outreach:send`): EGYETLEN
  őrzött út (konzol-gomb + batch + CLI konvergál); §C-kapu/státusz/leiratkozás a küldés PILLANATÁBAN újra fut;
  cap 20/futás + 5s pacing; `--dry-run/--limit/--prospect`. Konzol: draft-oldalon „Küldés e-mailben" gomb
  (`POST /prospect/:id/send`), `/p/:token/leiratkozas` POST-tal (one-click).
- **⭐ Jog-provenance-őr FLAG-elt → 3 fix:** (1) **cím-szintű suppression** (`isEmailSuppressed`: bármely valaha
  leiratkozott sor azonos e-maillel = tilos — a token-szintű opt-out Grt.-sértés volt); (2) **atomi created→sent
  claim** küldés előtt (dupla-küldés kizárva, hibán revert); (3) List-Unsubscribe-assert a hideg-úton.
  E2E: FLAG-út/dry/sent/re-send-SKIP/one-click-unsub/suppression mind verifikálva; `tsc` tiszta.
- **Konzol e-mail-előnézet** (`cc0eaa4`): a draft-oldalon élő HTML-iframe = PONTOSAN a kimenő levél
  (`/prospect/:id/email-preview`; FLAG-állapotban is nézhető).
- **⭐ Nagyobb csali (tulaj-kérés, `fe2c64e`):** ① a mock NYITÓKÉPE a levélben (`heroShot.ts`, CID-inline =
  nem open-tracking; §A-szalag a pixelekbe égetve: „ELŐZETES LÁTVÁNYTERV — CITOVISO") ② „már havi X forinttól"
  ár a `modules.ts BASE_PRICE_MONTHLY`-ból (egy ár-forrás) ③ „kipróbálhatja" CTA (fedezett: /p/=konfigurátor).
  **Őr 2. kör → fix:** artifact-verdikt assert küldés előtt (FLAG-es mock képe nem mehet postafiókba) +
  **`PRICING_CONFIRMED` kapcsoló** (placeholder-ár hirdetését a §C-kapu blokkolja). Őr-jelezte MEGLÉVŐ rés
  BACKLOG-ra: `order_intent.price` kliens-küldött → szerver-oldali újraszámítás kell terhelés előtt.
- **Éleshez kell (tulaj):** ⭐ valós árak a `modules.ts`-be + `PRICING_CONFIRMED=true` · küldő-domain SPF/DKIM →
  `SMTP_URL`+`EMAIL_PROVIDER=smtp` · publikus HTTPS → `PUBLIC_BASE_URL` · `OUTREACH_SENDER_*`.
  Kozmetika hátra: régió-slug a hook-mondatban („godollo").
- Session-jegyzet: `_planning/memory/2026-08-01_outreach_send_pipeline.md`.
- **⭐ BELSŐ UI ① KÉSZ (`14f02fb`):** konzol `/scrape` (régió+cap indítás a felületről — a CLI child-processként,
  élő napló, futás-történet; E2E: badacsony cap=5 a felületről → 5 lead perzisztálva) + `/riport` (H1–H5
  hipotézis-tábla küszöbökkel + szegmens-bontás; H1/H5 bázis = TÉNYLEGESEN kiküldött prospectek).
  Fejléc-nav: leadek · scrape · riport.
- **⛔ TULAJ-DÖNTÉS (2026-08-01): Barion+Számlázz ÉLESÍTÉS PARKOLVA** — előtte kötelező egy teljes A–Z
  sandbox-teszt (scrape→mock→outreach→rendelés→fizetés→számla→élesítés egyben); az éles kulcs-beszerzést
  se kezdjük még. (A belső konzol Tailscale-only védelme MEGHALADVA még aznap → operátor-login, lásd lentebb.)
- **Árazás:** belső ár-UI NINCS (ár = `modules.ts`, placeholder + `PRICING_CONFIRMED=false` kapu);
  a hierarchikus GEO-árazás (országfüggő) a BACKLOG-ban rögzített 1. belső modul — pilot UTÁN épül,
  trigger: 2. ország. A pilothoz a tulaj mondja a számokat, kézzel írjuk be.
- **⭐ FELNŐTT KONZOL (`fbced93`, tulaj-kritika nyomán):** operátor-LOGIN (0014 `operator_user` +
  `operatorAuth`, HMAC-cookie külön realm; auth-kapu minden belső route-on, publikus kivétel-lista) —
  publikus hostingon is védett; állandó MENÜ + vezérlőpult (`/`=számok, lead-lista→`/leadek`); a konzol
  inline CSS-e törölve → KINÉZET A DIZÁJN-MAGBÓL (`citui.css` + új `citui-console.css`). Fiók:
  `scripts/operator-user.ts`. Publikus oldalak chrome nélkül.
- **⭐ ANGOL ÚTVONAL-STRUKTÚRA (`650d8db`, tulaj-rendelet):** minden route angolra: `/login /logout /leads
  /report /privacy /p/:token/unsubscribe /admin/{text,contact,photos}` (mindkét szerver); a honlap halott
  `/adatvedelem` linkje javítva (`/privacy` a :4800-on is). Magyar = megjelenítési nyelv. **MULTILANGUAGE-igény
  rögzítve** (tenant-admin + belső konzol is; BACKLOG „Multilanguage / i18n", trigger: 2. nyelv/ország).
- **⭐ ÁR-INTEGRITÁS FIX (`a6122f0`):** order-ár SZERVER-oldalon számolva (kliens-ár csak kijelzés,
  eltérés naplózva, kamu modul kiszűrve) — az őr-jelezte rés zárva.
- **⭐ §A ÖNNYILATKOZAT-FLOW (`6a1b29d`):** 0015 + legal.ts (determinisztikus szöveg) + kötelező
  konfigurátor-checkbox (a címke = a bélyegzett szöveg, egy forrás) + szerver 400-kapu + activate()
  §A-recheck a go-live élen + tenant-admin modul-kártya.
- **⛔ NEM nyitott döntés — VÉGREHAJTÁSI feladat (session-végi tanulság):** a §A fotó-politika 2026-07-13
  óta ELDŐLT (guest/portal = önnyilatkozattal élesíthető; **Places/StreetView SOHA → saját képre csere**,
  ezért van az A2 feltöltés). Tévesen döntésként kérdeztem újra → a tulaj jogosan reklamált.
- **KÖVETKEZŐ SESSION ELSŐ FELADATA (pontosítva — a „csak owner-kép" megfogalmazásom HIBÁS volt,
  a tulaj elkapta):** a MEGLÉVŐ §A.1/b kikényszerítése a go-live élen: per-kép provenance-osztály
  (§A.3) a pipeline-ban + a live-renderből KIZÁRÓLAG a places/streetview/vízjeles esik ki (csere) —
  a **guest/portal a 0015-ös önnyilatkozattal ÉLESRE MEGY, csere nélkül** (owner-kép csak opció, A2).
  Utána: teljes A–Z sandbox-teszt.

---

**2026-08-01 — PILOT-INFRA ÉPÍTÉS: dizájn-mag + publikus honlap + self-serve auto-mock + tenant-belépés/admin.**
- **⭐ ADR-0021 — Citoviso saját felület-világ:** központi **dizájn-mag** (`public/assets/ui/citui.{css,js}`,
  `--citui-*` tokenek + komponensek + styleguide; a brand `assets/brand/`-ból: navy/cián, Inter+Space Grotesk).
  Elkülönítve a motor `--cit-*` skin-tokenjeitől. **Kettős identitás-realm** (control/data plane) + granuláris belső
  RBAC TERV (6 szerepkör: superadmin/operátor/sales/pénzügy/dizájner) — de a belső RBAC a pilotra HALASZTVA.
- **⭐ Publikus honlap** (`public/index.html` + `assets/home/`): **vevő-fókuszú** tartalom (tulaj-visszajelzés:
  NE a technikai hátterünkről szóljon — [[feedback_landing_customer_value_not_tech]]); a lap GERINCE a **minta-igénylés**.
  No-JS reveal-fix (JS nélkül is látszik). A landing a tulaj mintájából újraépítve (nem copy-paste), a magra.
- **⭐⭐ ADR-0022 — self-serve auto-mock:** honlap-űrlap (**Leaflet térkép-pin** = pontos helyszín) → `POST /api/mock-request`
  → egy-vállalkozás feloldás (`resolveOne`: Places pin/locationBias v. név+település) → `generateEngineMock` → ŐR-KAPUK
  (tényhűség/jog/dizájn + A4 konfidencia) → **őr-kapuzott auto** e-mail (magabiztos+PASS→auto; FLAG→needs_review, A2).
  E-mail: **EmailSender interfész + Mock-adapter** (`outbox/`; SMTP éles később). `mock_request` tábla (0010).
- **⭐⭐ ADR-0023 — tenant-belépés + minimál admin** (a pilot kiemelt hiánya: vásárlás után belépés): **felhasználónév +
  jelszó** (mi generáljuk a vállalkozásnévből + megjegyezhető jelszó `kilato-levendula-47`; magic-link ELVETVE — a
  nem-tech tulajnak macerás; e-mail INSTABIL login-kulcs mert mi adunk neki e-mailt). **Kommunikációs e-mail** külön,
  módosítható. scrypt hash + aláírt session-cookie. Admin (dizájn-magon): **A1 szöveg-szerkesztés** + **A2 saját fotó
  feltöltés/csere** (§A: demó kép élesre nem mehet → saját kép váltja; `AssetStore` interfész + LocalAssetStore
  `sites/<tenant>/uploads/`). Re-render mock=live. Táblák: `tenant_user`+`login_token` (0011), `password_hash` (0012),
  `username`+`contact_email` (0013), `site.edited_site_data`.
- **⚙️ ÚJ PUBLIKUS SZERVER:** `src/server/public.ts` (:4800, `PUBLIC_PORT`) — statikus `public/` + `/api/mock-request`
  + `/m/:token` (előnézet, demo-framing) + `/belepes` `/admin` `/admin/{szoveg,kapcsolat,foto,foto/torol}` `/kilepes`
  + `/site/:token` + `/uploads/`. **Folyamatosan fut** (setsid/nohup; leváltotta a python statikust). Böngészőből:
  `http://100.97.188.105:4800/`. (A belső konzol továbbra is `:4600`.)
- **Commitok (mind PUSHOLVA, origin/main szinkron):** `82e7e87` (mag+honlap+auto-mock) · `a5b471b`+`4d2a381` (tenant-auth)
  · `41f3978` (A2 fotó). ADR-0021/0022/0023 a `_planning/DECISIONS.md`-ben.
- **KÖVETKEZŐ (pilot kritikus út):** **B) outreach küldő-pipeline** (~100 hideg megkeresés kiküldése: SMTP-adapter a
  meglévő EmailSender mögé + batch + §C-kapu + HTML-sablon). Opcionális: modul-kezelés az adminban, jogi
  önnyilatkozat-flow az élesítésnél.
- **🔑 KÜLSŐ BLOKKOLÓK (tulaj):** citoviso.com + **publikus hoszting** (outreach-link + Barion-webhook + honlap élesítés
  előfeltétele) · éles Barion + Számlázz kulcs · küldő-domain/postafiók (SPF/DKIM) az e-mail-küldéshez.
- Session-jegyzet: `_planning/memory/2026-08-01_pilot_infra_build.md`.

---

**2026-07-27/30 — PILOT-FELKÉSZÜLÉS: domain-stratégia (ADR-0020) + követett outreach-gerinc + §C-kapus email-piszkozat + pilot-hatókör újradefiniálva.**
- **⭐ ADR-0020 — DOMAIN-stratégia (tulaj-döntés):** alap = `<slug>.citoviso.com` aldomain (olcsóbb út);
  **egyedi domain rajtunk keresztül = min. 24 hó előfizetés-vállalás** (upsell+retenció); a konfigurátor
  rendeléskor 3–5 szabad nevet javasol **valós idejű előzetes csekkel** (`src/domains.ts`: DNS-over-HTTPS+RDAP,
  kulcs nélkül, ~0,5 mp). Konfigurátor „Címe az interneten" lépés + `order_intent` 0008 domain-mezők
  (`domain_type`/`domain_name`/`commitment_months`) + operátor-nézet. SEO canonical = POST-PILOT (tulaj).
- **⭐ KÖVETETT OUTREACH-GERINC (PILOT.md §2.5+§3) KÉSZ:** `/p/<token>` instrumentált link — mock_view
  pageloadonként + esemény-beaconök (scroll-mérföldkő, dwell, panel_open, module_add/remove, preset/period/
  domain, order-submit); prospect-tölcsér `created→sent→opened→engaged→order_intent` (sosem regresszál);
  konzol Megkeresés-panel (link-készítés szegmens-címkével, Kiküldve=H1-bázis); GDPR-lábléc + leiratkozás
  (0009: `sent_at`+`unsubscribed_at`; leiratkozás után NULLA tracking). E2E: curl + Playwright verifikálva.
- **⭐ EMAIL-PISZKOZAT + §C-KAPU:** determinisztikus, valós adatra személyre szabott piszkozat
  (`src/outreach/draft.ts`; rating CSAK az artifact A4-kapuzott SiteData-jából — §I: a levél=amit a mock mutat);
  `outreachCheck.ts` runtime-kapu (C1–C4). **A jog-provenance-őr élesben ítélt: 3 küldés-blokkoló** →
  javítva: `/adatvedelem` GDPR Art.13/14 oldal (adatforrás-megjelöléssel) + kapu-szigorítás (privát/CGNAT-IP,
  nem-HTTPS, placeholder-kontakt = FLAG). Konzol: `/prospect/:id/draft` másolható piszkozat verdikttel (A2 kézi küldés).
- **⭐⭐ PILOT-HATÓKÖR MÓDOSÍTVA (tulaj, 2026-07-30):** a pilot = **TELJES loop éles fizetéssel + automata
  számlázással** (nem csak order-intentig). **Jogi forma ELDŐLT: egyéni vállalkozás** (Mineral-híd okafogyott).
  Fizetés-állás: sandbox-validált, éles NINCS (`BARION_URL=test`, `INVOICE_PROVIDER=mock`) — élesítési
  checklist PILOT.md §7c (kulcsok után env-csere + kis összegű füst-teszt).
- **„MÉG MESSZE AZ INDULÁS" — felület-leltár (PILOT.md §7d):** ① belső UI fixálás (scrape ma csak CLI,
  nincs tölcsér-riport) · ② email HTML-sablon + küldő-pipeline (ma szöveges+kézi) · ③ tenant-admin csak
  read-only → önkiszolgáló szerkesztő kell (§E.12) · ④ **Citoviso alap honlap NINCS** (bizalom-horgony).
  **Elfogadott sorrend: ①honlap(dogfooding a motorral) → ②email → ③belső UI → ④tenant-admin.**
- **Külső előfeltételek (tulaj):** citoviso.com regisztráció · hoszting-döntés (publikus HTTPS = kiküldés-kapu
  ÉS Barion-webhook előfeltétele) · Barion+Számlázz éles fiók (ev.) · ÖVTJ-csekk · küldő-domain/postafiók.
- Commitok: `1b0e3ac` (ADR-0020 domain) · `d70053e` (követett link+instrumentáció) · `b9112ce` (outreach+§C)
  · `0432d96`+`2778a95` (PILOT.md §7b-d). Session-jegyzet: `_planning/memory/2026-07-30_pilot_launch_gearing.md`.
- **KÖVETKEZŐ SESSION ELSŐ TÉMÁJA: a Citoviso alap honlap** (saját motorral generálva, lokálban építhető).

---

**2026-07-24/26 — A MINŐSÉGI KÖR LEZÁRVA: a „wow" a MOTORON belül (ADR-0019) + éles bekötés + finomítás + SEO.**
- **⭐⭐ ADR-0019 — a plafon-döntés eldőlt: MOTOR-ÚT nyert, NINCS HIBRID.** A teherhordó kísérlet (UGYANARRA
  az adatra, `A'`=felokosított motor vs `B`=bespoke) megmutatta: a bespoke előnye NEM sablonozhatatlan, hanem
  (1) szerkesztőségi szöveg + (2) strukturális ízlés + (3) mozgás → mindhárom BEÉPÜLT a motorba, a `mock=live`
  feláldozása nélkül. A tulaj: „wow" → „sokkal jobb". Réteg: `SectionCopy` a receptben + `heroEditorial`/
  `roomsShowcase` variánsok + grounded **copywriter** (`src/engine/copywriter.ts`, a motor 2. AI-lépése, §B.17-hű) +
  keresztmetsző **MOTION_CSS** (`primitives.ts`) + `autoReveal()` (`assets/runtime/cit-runtime.js`: lépcsőzött
  scroll-reveal, hero ken-burns, kép-hover-zoom, kártya-emelés; reduced-motion/no-JS → statikus).
- **⛔⛔ ÚJ INVARIÁNS §I (03-INVARIANTS + [[invariant_no_bait_and_switch_delivery]]):** amit a leadnek megajánlunk
  (outreach-mock) = PONTOSAN azt kapja fizetés után. Bait-and-switch a nulladik ponton ABSZOLÚT TILOS (üzletileg
  öngyilkos + jogilag súlyos: Fttv.). A `mock=live` ezt konstrukció szerint garantálja. Külön §B.17-től: igaz tartalom + HŰ szállítás.
- **ÉLES BEKÖTÉS KÉSZ:** a copywriter+mozgás+editorial variánsok BEKÖTVE a `generateEngineMock`-ba (konzol :4600 +
  CLI is ezt adja, nem csak proof). `resolveGatedPhotos` a valós Google-**ratinget** is visszaadja (ugyanaz az A4-kapu);
  a copy a PERZISZTÁLT receptbe sül → `convertLead` LIVE = mock (round-trip AZONOS ✅).
- **FINOMÍTÁS + SEO (ma):** SVG-csillag a rating-statban (nem ★ glyph — designCheck) · robusztus hero-scrim (világos
  skin) · **GYIK-modul** (új `faq` primitív, natív `<details>`, §B.17 minta-kapu) · **auto-SEO** (`src/engine/seo.ts`,
  §H): meta description + fázis-tudatos robots (mock=noindex, live=index) + OG/Twitter + **Schema.org LodgingBusiness
  JSON-LD** a valós adatból (név/cím/geo/telefon/rating). `SiteData` += `geo`/`rating` strukturált mező.
- **BIZONYÍTÉK (letölthető minták, `:4700/sample-*.html`):** Villa Oliver/Gödöllő (4★/46), Villa Pátzay (4,1★/57),
  Rózsakő ház/Badacsony (5★/12) — mind HIGH-match, valós fotó+rating, 3 külön skin, mozgás+GYIK+SEO. Dizájn-kapu PASS, round-trip AZONOS.
- **A Fortuna-eset (tanulság):** a match-gyanú (név-egyezés 0,17: borozó↔vendégház) helyesen KÖZEPES sáv + kurátor-flag → nem attribuál vakon (A4).
- **Session commitok (mind LOKÁL, push deploy key-re vár):** `8e351fa` (§I invariáns) · `fb4e669` (editorial+mozgás) ·
  `12d46bf` (éles bekötés) · `2d2771b` (finomítás+GYIK+SEO). Eszközök: `scripts/engine-{max-plus,from-lead-plus,generate}.ts`.
- **✅ PUSH KÉSZ (2026-07-26):** a deploy key MŰKÖDIK (SSH `git@github-citoviso`), a `main` szinkronban az originnal.
  A korábbi „deploy key-re vár" jegyzet ELAVULT.
- **KÖVETKEZŐ SESSION ELSŐ TÉMÁJA (tulaj kérése): a SEO CANONICAL + PROVISIONING terv ÁTNÉZÉSE fejlesztés ELŐTT.**
  (A `seo.ts` ma szándékosan kihagyja a `<link rel=canonical>`+`og:url`-t — nincs élő domain mock-időben; a
  provisioning-fázisban injektálandó.) Opcionális: hero-parallax · proof-scriptek dedupe a `generateEngineMock` mögé ·
  VAGY tovább a konverziós szálra (konfigurátor+élő előnézet, ADR-0015).

---

**2026-07-23 — MOTOR VÉGIGÉPÍTVE (ADR-0016 lezárva) + KIT-PASSZOK + MINŐSÉG-ÍV (ADR-0017/0018).**
**2026-07-23 — MOTOR VÉGIGÉPÍTVE (ADR-0016 lezárva) + KIT-PASSZOK + MINŐSÉG-ÍV (ADR-0017/0018).**
- **ADR-0016 KÉSZ, éles-validált:** archetípus-réteg (registry) + `lead→SiteData` mapping + generálás
  motorra (`generateEngine.ts`, perzisztálja recept+SiteData) + `convertLead` motorra (live = perzisztált
  recept determinisztikus re-renderje, `mock=live`). **Motor = alapértelmezett generátor** (konzol+CLI, ADR-0017).
- **Kit-passzok (ADR-0017):** SKIN 2→9 (korpuszból) · PRIMITÍV-VARIÁNS (recept `variant`) · ARCHETÍPUS 3→6.
  ⚠️ runtime bugfix: `cit-modules.css` fallback `:root` → `@layer` (nem írja felül a skint). Planner-QA:
  a planner hangulat-helyesen varál (`engine-qa.ts`, 7 fixtúra).
- **⭐⭐ MINŐSÉG-ÍV (ADR-0018):** a desktop-screenshot megmutatta: a kimenet „template"/„gagyi" volt.
  A tulaj 5 referencia-mockja MENTVE mérceként: `assets/design-refs/reference-quality/` + README kraft-standard.
  Javítások: immerzív hero · sticky nav + gazdag lábléc (`chrome.ts`) · amenity SVG-ikonok (`icons.ts`) ·
  szoba+vélemény MINTA-modulok §B.17 fázis-kapuval (mock: jelölt minta; live: adat híján kiesik) ·
  kép-vezérelt szoba-kártyák + `stats` modul. `scripts/engine-max.ts` = **~80% Silva, nem gagyi.**
- **⚠️ NYITOTT DÖNTÉS (a következő session ELSŐ lépése):** a tulaj szerint még mindig gagyibb a mintáknál.
  Plafon-bizonyíték UGYANARRA az adatra: **A = motor** (`:4700/max-craft.html`, mock=live+szerkeszthető) vs
  **B = bespoke AI-HTML** (`:4700/bespoke-mock.html`, `scripts/bespoke-mock.ts` — igényesebb, egyedi, DE nem
  mock=live/nem szerkeszthető) vs **HIBRID** (bespoke outreach-mock + motor szerkeszthető live — a javaslatom).
  Fontos: a minták ÉS B IS fabrikált adatra épülnek (§B.17 mindkét útra vonatkozik). Részletek + tools:
  `_planning/memory/2026-07-23_engine_quality_bar.md`. Böngészhető nézetek: `:4700` (statikus szerver a `sites/_engine-proof`-on).
- **⚠️ PUSH: 13 commit áll LOKÁLBAN (d27e76b…33817fa), deploy key-re vár.**

---

**2026-07-21 (este) — BARION SANDBOX-KÖR LEZÁRVA + a generáló MOTOR architektúrája (ADR-0016).**
- **Barion sandbox teljes kör ✅** — valós teszt-kártyás (`4444 8888 8888 5559`) fizetés → `GetPaymentState`
  Succeeded → payment PAID (4880 Ft) → site LIVE → lead activation → **valós AAM teszt-számla `OV-2026-2`**
  (Számlázz teszt-fiók). A memória függő POSKey-szála KIPIPÁLVA. Sandbox-tanulság: draft-shop = `ShopIsInDraftState`
  (submittelni kell, auto-approve), az approval `secure→api.test.barion.com` ~2,5 perc alatt propagál; a pay-link
  ~perc alatt `Expired`. `.env`: `PAYMENT_GATEWAY=barion` MARADT, `INVOICE_PROVIDER=mock`-ra visszaállítva.
  Eszközök: `scripts/barion-{smoke,pilot}.ts` + `pilot-inspect.ts`. Részletek: `_planning/memory/2026-07-21_engine_architecture.md`.
- **⭐⭐ ADR-0016 — KOMPOZÍCIÓS MOTOR + recept-absztrakció** (a tulajjal közösen döntve): `adat → [AI-tervező] →
  recept → determinisztikus render(recept+adat+skin) → HTML`; **`mock=live` GARANTÁLT egy motorból**; **WP KIZÁRVA**.
  Réteg-számláló: **1 BACKEND** (fix) + **1 közös MODUL/PRIMITÍV-készlet** (token-témázott, NEM archetípusonként
  újra = 100×N elkerülve) + **N ARCHETÍPUS** (=elrendezés-séma, a „frontend ami változik") + **M SKIN** (ráhúzható).
  Sokszínűség = archetípus × skin × modul-kompozíció (KOMBINATORIKA, nem darabszám). Auto-memória: `project_composition_engine`.
- **Bizonyító szelet ÉPÍTVE** (`src/engine/`, additív — a régi pipeline érintetlen): `recipe/skins/primitives/
  render/planner.ts`. `scripts/engine-prove.ts` = **mock=live skeleton AZONOS ✅**; `scripts/engine-plan.ts` =
  valós Claude-tervező (GRANDIS prémium→`immersive-dark`, Nefelejcs családias→`editorial-warm`, fotó nélkül→nincs gallery).
- **Következő:** ① archetípus-réteg (elrendezés-nyelvtanok: rács/scroll/split) · ② lead→SiteData mapping ·
  ③ `convertLead` átkötése a motorra (mock-HTML-másolás kiváltása) · ④ készlet-bővítés · ⑤ tenant-admin recept-szerkesztő.
  VAGY: valós árak (`src/modules.ts`); hoszting; prospect-pilot.

---

**A KERESKEDELMI KÖR LOKÁLBAN ZÁRVA (2026-07-20).** A teljes tölcsér-vég működik és verifikálva, kulcs nélkül:
```
mock → kurátor → prospect-konfigurátor (ALL-IN + ÁR) → order_intent
  → pay-link (mock↔Barion) → fizetés → webhook → site LIVE + lead ACTIVATION
  → AAM auto-számla (mock↔Számlázz Agent) → recurring megújítás / nem-fizet → deaktiválás
```
Minden external integráció **interfész mögött, mock-adapterrel** (build-behind-an-interface): a valós
Barion (gateway) + Számlázz.hu Számla Agent (számla) **drop-in kulcs-cserekor** (env). NEHEZEN visszafordítható
= a gateway + kártya-tokenek (tudatos Barion-döntés); minden más könnyen cserélhető.
**Következő = external lépés a tulajnál:** Barion-fiók + kulcsok (+ variable-amount MIT-jóváhagyás kérése),
Számlázz Agent-kulcs. Utána a valós adapterek bekapcsolása. Vagy: hoszting (Cloudflare for SaaS + Hetzner),
vagy valós prospect-pilot (outreach/prospect-token flow).
**Parkolt:** pricing-modul (első BELSŐ modul, hierarchikus geo-árazás) → pilot UTÁN; korpusz-bővítés.

### 2026-07-16/20 — KONFIGURÁTOR + A KERESKEDELMI KÖR (slice 1–3) + billing/hoszting-kutatás
- **Prospect-konfigurátor (ADR-0015 impl):** serve-time overlay a `/configure/:artifactId`-n
  (`src/generator/configurator.ts` + `assets/runtime/cit-configurator.{css,js}`). **ALL-IN framing** (tulaj-döntés):
  nincs fogaskerék; a wow vezet, halk pill úszik fel → nyitáskor MINDEN modul ON, onnan trimmel lefelé (ár-horgony).
  **Ergonómia a nem-tech tulajra:** preset-elsődleges (Teljes/Ajánlott/Alap) + „Testre szabom" alatt a 12 kapcsoló;
  **tulaj-nyelvű címkék** (nincs „modul/CTA"); no-risk keret; mobil bottom-sheet. Egy-forrás katalógus `src/modules.ts`.
- **Korpusz-QA:** a `vertical-ribbon-nav` (GRANDIS bal-menü) „fos" volt → **3 gyenge archetípus karanténba**
  (`retired:true` a manifestben, `selectCorpusDesign` kihagyja: egyszeru-2/kozep-2/premium-2). Új eszköz:
  `scripts/corpus-contact-sheet.ts` (27 archetípus egy képen, vizuális triage). GRANDIS regen → immersive-dark (tiszta).
- **Kereskedelmi kör (slice 1–3), mind mock-adapterrel + lokál verifikálva:**
  - **Slice 1 — árazás + rendelés:** bázis + Σ modul havi ár + éves (2 hó ingyen) a konfigurátorban; submit → valós
    **`order_intent`** (a 0003 pilot-instrumentáció feltöltve). Placeholder árak a `modules.ts`-ben (tulaj állítja).
  - **Slice 2 — fizetés:** `src/payment/` gateway-interfész + MockGateway + env-selector (Barion=stub); `payment`
    tábla (0006); pay-link → webhook → **aktiválás** (`convertLead` + site LIVE + lead ACTIVATION); nem-fizet → deaktiválás.
  - **Slice 3 — számla + recurring:** `src/invoicing/` (InvoiceProvider + Mock + **SzamlazzAgent a HIVATALOS XML-spec
    szerint**, `afakulcs=AAM`); `invoice` tábla (0007) — **`vat_rate` PER SZÁMLA** (0 most). `src/payment/billing.ts`
    + `scripts/billing-cycle.ts`: megújítás + grace utáni deaktiválás.
- **Billing/hoszting-kutatás (deep-research, `_planning/RESEARCH-2026-07-billing-hosting.md`):** Gateway = **Barion**
  (nincs belépő/havi díj, token-recurring, first-party Számlázz; ⚠️ változó összeg → MIT külön jóváhagyás). Számla
  Agent AAM-számlát tud, NAV auto. **AAM-küszöb 2026 = 20M Ft** (nem 18M). Hoszting: **Cloudflare for SaaS**
  (auto custom-domain+TLS, kemény kritérium) + **Hetzner VPS** (a hoszting-verify rate-limitbe futott → tudás-alapú).
- Commitok: konfigurátor `392d3ed`/`139e1c0`; korpusz `2f299df`; slice1 `430e860`; kutatás `a7b3808`;
  slice2 `d139469`; pricing-modul jegyzet `e811f72`; slice3 `5372f65`/`5886637`. Minden LOKÁL, push nincs.
- **Nyitott döntések (BACKLOG):** domain-választás (4 javaslat + real-time csekk a checkoutnál, egyéni domain);
  email-modul (10 postafiók, csak saját domain); pricing-modul (geo-hierarchia) → pilot után.

### 2026-07-13/15 — KONVERZIÓS SZÁL: doktrína-alap + provisioning-gerinc + a sales-felismerés
- **Fogalmi alap (commit `50e1d71`):** **ADR-0013** — a `tier` NEM minőség-létra, hanem KARAKTER/REGISZTER
  (illeszkedés); a gyártási minőség konstans-maximum. Következmény: közös, tier-agnosztikus archetípus-pool +
  lágy súly (impl. külön ADR + A/B mögött; a `luxus:1` gond így nem „kevés luxus-szerkezet"). **ADR-0014** —
  **provisioning ≠ élesítés** (3 túlterhelt szó tisztázva: aktiválás/előfizetés/provisioning). Provisioning =
  PRIVÁT előnézet (noindex, token-URL), fizetés ELŐTT is; élesítés = NYILVÁNOS go-live, fizetés-kapus (a tulaj
  „fizet→aktivál" sorrendje áll — nem volt valós ütközés). **Site-állapotgép:** draft→provisioned→live→suspended.
  **§A átírva:** `guest`/`portal` demó-kép ÉLESRE kerülhet a tenant fizetéskori jogi ÖNNYILATKOZATÁVAL
  (rendelkezés + szavatosság + kártalanítás) + csere-lehetőséggel; `places`/`streetview` (Google-jog) + vízjel
  SOHA → csere. `jog-provenance-or` őr-agent §A-mátrixa igazítva.
- **Adat-réteg (commit `8fa6452`):** `migrations/0004_conversion.sql` — `tenant` (első `tenant_id`-hordozó,
  lead_id UNIQUE), `module_entitlement` (05-MODULES, UNIQUE tenant+module), `site` (állapotgép, preview_token,
  source_artifact_id). `lead_lifecycle` CHECK bővítve `disqualified`-dal. **RLS szándékosan MÉG NINCS** (nincs
  vendég-PII, egy-operátoros) → az első vendég-PII táblánál (booking) lép be. §G.18. schema.ts tükör szinkron.
- **Provisioning (commit `8b02674`, pusholva):** `src/conversion/provision.ts` — `convertLead(leadId, artifactId,
  modules[])` idempotens: approved mock → `sites/<tenant_id>/index.html` (noindex injektálva, demo-framing
  MEGTARTVA mert privát preview = még demó-fázis), entitlement upsert (additív), lead→`conversion`. `.gitignore`:
  `sites/`. Élesben verifikálva (Sophia/GRANDIS/Harsona Gödöllő).
- **Konzol-felület (commit `a8f22b5`):** `data.ts` (getConversion/getSiteByToken/getTenantAdminByToken),
  `views.ts` (MODULE_CATALOG 12 modul, convertForm checkboxok, convertedBlock, tenantAdminPage), `server.ts`
  (POST /lead/:id/convert, GET /site/:token, GET /admin/:token). Böngészőből (Tailscale :4600) a POST /convert
  élőben lefutott.
- **⭐⭐ A SZÁL FŐ FELISMERÉSE (commit KÖVETKEZŐ, ADR-0015):** a Harsona-teszt (mind a 12 modul bepipálva)
  megmutatta: az entitlement rögzül, de a Site NEM renderelődik újra a modul-választásból → a tulaj elkapta:
  **„sosem-látott modulért nem áldoz pénzt senki."** IGAZA VAN. Korrekció: **modult csak LÁTHATÓAN adunk el**;
  a **interaktív modul-konfigurátor + élő előnézet a KONVERZIÓ SZÍVE** (BACKLOG-ból előléptetve). Tényhűség
  fázis-határa élesítve (§B.17): adat nélküli modul az ELŐNÉZETBEN minta-állapottal MEGmutatható (jelölve, mint
  a demó-fotó), de az ÉLŐ oldalra SOHA adat-fedezet nélkül. A provisioning-gerinc (táblák + convertLead) marad
  mint kereskedelmi réteg; a konfigurátor rá ül. ⚠️ EZ A COMMIT (ADR-0015 + §B.17 + BACKLOG) még csak lokál.
- **Következő szelet:** a konfigurátor SCOPE-olása (mit renderel újra, hogyan togglel, hol a minta-állapot).

### 2026-07-12 — Őr-agent réteg + ontológia-megszilárdítás (3 guardian-kapu)
- **Koncepció:** nem mesterség-szerinti (frontend/backend) agentek, hanem a projekt INVARIÁNSAIRA horgonyzott
  esemény-triggerelt VERIFIEREK (őrök) — a doktrínát a gép tartja be, nem az én figyelmem. Minta:
  **kontraktus (DOMAIN-invariáns élesítve) → subagent (`.claude/agents/`) → runtime-kapu (ahol van felület) → dev-hook.**
- **Ontológia átvezetve** (`_inbox/20260712` distill-review): 00-GLOSSARY Architektúra-fogalmak (Control/Data plane,
  Iparág×Ország, Site-képlet, hibrid render); 02-ENTITY-MAP iparág-agnosztikus 6-entitásos közös mag (Property→történeti);
  03-INVARIANTS új §G (izoláció/jog/ember-a-hurokban), §H (SEO/lokalizáció). Commit `cef6736`.
- **1. őr — TÉNYHŰSÉG (2 réteg, commit `4d26165`):** §B.17 enforce-olható kontraktussá élesítve. Runtime-kapu
  `src/generator/factCheck.ts` (determinisztikus előszűrő + LLM-verifier, AI-mockra MINDIG fut) bekötve `generate.ts`-be;
  dev-hook `scripts/factcheck-scan.mjs` + `.claude/settings.json` (PostToolUse, minden `mock-*.html`). FLAG→kurátor-sor (§G.20).
  Ugyanebben a commitban az ADR-0012 airiness QA-gate is (generate.ts-ben összefonódott) — lásd lentebb, KÉSZ.

### 2026-07-13 — Levegősség-kontroll (ADR-0012): prompt-budget + render-mért QA-gate
- **Rés:** a reveal-fix után maradt „lágy airiness" — a mockok mobil átlaga ~20% HOLT függőleges sáv
  (szekció-magasság − a tartalom valós kiterjedése). 3 ok: nem-skálázódó mobil-padding, kitöltetlen
  nem-hero `min-height`/`vh`, túl nagy belső al-blokk-rés.
- **Fix (a tulaj választása 3 opcióból): PROMPT-BUDGET + QA-GATE** (NEM vak runtime CSS-felülírás, NEM auto-regen).
  (1) `ADAPT_SYSTEM` 8. szabály: számszerű ritmus — reszponzív `padding-block:clamp()`, nem-hero magasság a
  tartalmat kövesse, belső rés ≤2,5rem, ~85% kitöltés, tier-érzék. (2) `src/generator/qaAiriness.ts` render-alapú
  mérő (tag-agnosztikus sáv-detektálás) → `generateMock`-ba best-effort, nem-blokkoló → `airinessDeadPct` az
  artifactba. CLI: `scripts/qa-airiness.ts <mock> [width]`. ADR-0011-re épül.
- **Éles A/B (Gödöllő):** Nefelejcs (azonos lead) 20,5%→19%; új hármas átlag ~17,6% vs régi ~20%. A budget
  STRUKTURÁLISAN érvényesül (a modell átvette a `clamp()`-et, fent/lent-rés 114→68px, nincs nem-hero min-height);
  a maradék = belső rés + hero-kompozíció (részben legitim lélegzés). Ha küszöb fölött marad → QA-gate célzott regen (A2).
- **Fájlok:** ÚJ `src/generator/qaAiriness.ts`, `scripts/qa-airiness.ts`; MÓD `mockFromCorpus.ts` (8. szabály),
  `generate.ts` (QA-gate), `_planning/DECISIONS.md` (ADR-0012). Commit `4d26165` (a tényhűség-kapuval összefonódva).
- **2. őr — JOG/PROVENANCE (commit `35b6165`):** §A provenance×fázis mátrix + §C outreach 4 eleme, NOW/DEFERRED címkézve.
  Runtime: `provenanceCheck.ts` demo-framing check (az EGYETLEN valós felület ma; konverziós asset-kapu + outreach-küldés
  DEFERRED, mert a pipeline nincs). Subagent `jog-provenance-or.md` (fázis-tudatos).
- **3. őr — DIZÁJN-DOKTRÍNA (commit `35b6165`):** §B dizajn-enforce. `designCheck.ts` determinisztikus (emoji-tilalom
  `\p{Extended_Pictographic}`, 11 `--cit-*` token, booking-horog). Subagent `dizajn-doktrina-or.md` az ítélet-igényű részre.
- **Mind a 3 kapu füst-tesztelve** (pozitív+negatív), `tsc` tiszta. ⚠️ NINCS élő end-to-end generálás-teszt (valós API+DB).
  Új subagent-típusok natív hívhatósága session-újraindítás után. Részletes tudás: `_planning/memory/2026-07-12_guardian_agents.md`.

### 2026-07-12 (este) — Őr-agentek ÉLES PRÓBA + guardian-bug fix + matchConfidence bekötés
- **A fenti nyitott kérdések LEZÁRVA:** mindhárom subagent (`tenyhuseg-or`, `jog-provenance-or`, `dizajn-doktrina-or`)
  **natívan hívható** session-restart után ÉS ítéletet hoz. A grandis mockon mind PASS; a tényhűség-őr megtalálta a
  `leads-godollo.json` igazságforrást és minden HARD tényt strukturált mezőhöz kötött (nem hitte el vakon).
- **Guardian-bug fix (commit `ecce21e`):** `designCheck.ts` emoji-szűrő false-positive-olt a `©`/`®`/`™` jogi jeleken
  (footer-copyright miatt 3 jó mock tévesen FLAG-elt) → `EMOJI_ALLOWLIST` (a `★` szándékosan bukik: dekoratív = SVG).
- **matchConfidence bekötve (commit `408f445`):** eddig csak a kontakt/fotó-hiányos OSM-leadek kaptak konfidenciát;
  a Places-natív leadek (pl. GRANDIS, `sources=[google_places]`) `undefined`-del maradtak → §F.17b nem tudott zárni.
  Fix: Places-natív = self-match (`scoreMatch` táv 0 / név 1 / OSM-korroboráció) → google_places önmagában **0.85 high**,
  +osm **1.00**. ⚠️ A meglévő JSON-artifactek csak a **következő éles scrape-nél** töltődnek (tulaj-döntés: nincs backfill).
- **BREV-IRÁNY halasztva (tulaj-döntés):** a `webSearch()` MA is Google CSE-t hív (kivezetés alatt); a Brave-backend
  NINCS megírva és **nem is íródik, amíg a kurátor nem automata**. `BRAVE_SEARCH_API_KEY` nem kell most.
- **API-kulcs állás:** a re-scrape magját kulcs nem blokkolja — `GOOGLE_MAPS_API_KEY` + `GOOGLE_CSE_ID` +
  `ANTHROPIC_API_KEY` mind kitöltve a `.env`-ben. SMTP/outreach + Brave halasztva; `DATABASE_URL` = beágyazott dev-PG.
- Commitok: `ecce21e`, `5dc79a3` (distiller inbox-archív), `a3438b6` (doksik), `408f445`. Kapcsolódó rés a
  BACKLOG A4-ben: match-konfidencia ma mechanikus (név+táv+OSM), kontextuális/vélemény-korroboráció nélkül.

### 2026-07-11/12 — Runtime-modulok (gallery/map/reviews) + üres-sáv réteges fix + Sissi presence-fix
- **3 új runtime-modul** (ADR-0011 minta, progresszív fejlesztés → JS nélkül is tartalom):
  `gallery` (megosztott lightbox), `map` (kattintásra-betöltő Google-embed facade, GDPR), `reviews`
  (snap-carousel valós kártyákra; kamu tilos → gyakran kimarad). `assets/runtime/` + 2 fixture. Commit `aba5e05`.
- **⚠️ QA üres-sáv — RÉTEGES fix (commit `cd1e1c9`):** (1) `injectRuntime` determinisztikus no-JS háló:
  üres booking-slot → statikus érdeklődés-kártya (mailto); `<noscript>` + `cit-anim` a scroll-reveal
  tartalomra. (2) `cit-runtime.js::initReveal()` — a **reveal MOSTANTÓL RUNTIME-viselkedés** (IntersectionObserver
  a `.reveal`-re). Kiváltó: a `vertical-timeline-scroll`/`vertical-ribbon-nav` archetípusok JS-sel is üres sávosak
  voltak (a per-archetípus IO törékeny; a gated CSS-t az LLM megírta, az observert elhagyta → JS-sel örökre rejtett).
  Valós telefon-teszt fogta el (GRANDIS). Fix után: no-JS 76%→0%, mobil 14/14 reveal felszabadul. Prompt-szabály:
  reveal = PE, saját IO tiltva. (3) Két friss éles mock generálva validálásra (Sissi, GRANDIS).
- **Presence fals negatív — FORDÍTOTT SORREND fix (commit `3eba776`):** Sissi Panzió `no_site` volt, PEDIG van
  saját oldala (`panziosissi.hu`; a domain = típus-szó ELÖL). A `enrichPresence.candidateHosts` most a fordított
  token-sorrendet is próbálja. Élőben verifikálva → `has_own`. GRANDIS NEM hiba volt (`modern`, force-generált teszt-mock).
- **Új tartós tudás:** [[project_hybrid_review_model]] (külső scrape + first-party „oldalon hagyott" vélemény);
  a presence-memória Sissi-tanulság + Brave-időzítés (`_planning/memory/2026-07-07_presence_detection.md`).

### 2026-07-10 — MOCK-MOTOR (két-agent) + modul-UI + Gödöllő-pilot
- **ADR-0009 — archetípus-elsődleges korpusz:** a korpusz tengelye az ARCHETÍPUS (szerkezet), tier a
  partíció; a KÖRNYEZET lefokozva grounding-hintté (nem korpusz-mappa). A 36-metszet (env×tier) modell
  ELDOBVA. Kevesebb dizájn, nagyobb pool/anti-collision, régió-független. Korpusz: `assets/design-refs/corpus/{tier}/{n}.html` + `manifest.json` (27 dizájn, 21 egyedi archetípus).
- **Két agent:** `src/generator/corpus.ts` (agent-1, korpusz-építő, `scripts/build-corpus.ts` — `--tier=`) +
  `src/generator/mockFromCorpus.ts` (agent-2: osztályozás→tier-kiválasztás+anti-collision→grounded).
- **ADR-0010 — modul = FUNKCIÓ-tengely, ADAT nem korpusz-tengely** (nincs archetípus×modul robbanás).
  Katalógus: `_planning/DOMAIN/05-MODULES.md` (Szint 0–1, csak szállás).
- **ADR-0011 — modul-UI: token-kontraktus + hidratáló runtime** (`assets/runtime/cit-modules.css` +
  `cit-runtime.js` + `src/generator/runtime.ts` inline-injektor). Rendszer-költség O(archetípus)+O(modul),
  NEM O(arch×modul). Első interaktív widget: booking/érdeklődés (bar/card), token-témázott. Spec:
  `_planning/DOMAIN/06-UI-CONTRACT.md`. 3 fixture bizonyítja: egy widget, több natív téma.
- **Konzol átkötve az új pipeline-ra** (`generate.ts` régió koordinátából, `server.ts` fire-and-forget +
  auto-frissülő „folyamatban", `views.ts`). Konzol: http://100.97.188.105:4600/ · néző: :8899/
- **Gödöllő-pilot:** 24 hely (cap 40), 13 lead, 10 grounded mock — mind más archetípus, a bor/tó-íz
  groundinggal semlegesítve. Bizonyítja: a korpusz NEM régió-zárt (Balaton-korpusz Gödöllőt is kiszolgál).
  `scripts/build-corpus.ts` `--cap` a scraperben; `poc-corpus-mock.ts <regionId> <n>` régió-szűrővel.

---

**Nulláról tervezés — FÁZIS 1–4 ✅ KÉSZ. Következő: FÁZIS 5 (éles pilot) VAGY a tényleges ÉPÍTÉS.**
Jóváhagyott 6-fázisú roadmap: `_planning/ROADMAP.md`. Alapmodell:
`.../2026-07-04_business_model_understanding.md`. Kimenetek: phase1/2/3/4 doksik. A régi teszt-kód/modell eldobva.
Stack (MVP): Node/TS, Postgres (RLS+JSONB), Playwright, Claude API; build-vs-buy; managed felhő.

### ⭐ Kereszt-metsző alapelvek (minden fázisra — lásd ROADMAP tetején)
- **A1 — Automatizálás-elsőbbség:** minden folyamat besorolandó (Automatizált / Manuális→tenant / Manuális→ház);
  minden manuális pontnál kötelező kérdés: hogyan automatizálható később? Az automatizáció = fő értékajánlat.
- **A2 — Kivétel-alapú, önmagát visszavonó ember a hurokban** (kuráció, pénzügy, support).
- **A3 — Nyelv ≠ korlát; AI-vezérelt kontextus-lokalizáció** (nem hardcoded; Site/admin/outreach). Határ: jog+formátum+pénznem = determinisztikus, ország-szabály.
- **⚠️ A4 — A mock ALAPJA = bizalmi alapkő; TÖBB-RÉTEGŰ ellenőrzés** (provenance + több-jeles párosítás + kereszt-forrás korroboráció + AI-ellenőr + konfidencia-fallback + kuráció + tulaj-megerősítés). „Bizonytalanság → kevesebb, sosem hamis." A provenance/verifikáció a scraper+generátor melletti 3. bizalom-kritikus komponens. Részletek: BACKLOG.

### Fázis 1–2 fő felismerések (röviden)
- ⭐⭐ **3 becsatlakozási pont: KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ** — egy Iparág-definíció = e 3 interfész implementálása; minden más közös (Fázis 2, két iparágon igazolva).
- ⭐ A motor **Iparág × Ország** kétdimenziós: `Site = Tenant + (Iparág-def × Ország-lokalizáció) + Vállalkozás-profil + Modulok`.
- ⭐ **Control plane (mi világunk) vs. Data plane (honlap világa, per-tenant izolált)** — entitlement-vezérelt provisioning (instant modul-aktiválás). Tiered izoláció (RLS+PII-titkosítás), hibrid adatmodell (fix mag+JSONB), hibrid render (statikus+dinamikus szigetek), réteges időtárolás.
- ⭐ **Két moduláris platform:** külső (tenant Site-modulok) + belső (operátor back-office: pénzügy/sales/CRM/bizonylat) — külön RBAC.
- ⭐ **Két kulcs-motor:** scraper/lead-discovery (volumen) + generátor (termék). A **scraper is Iparág × Ország** paraméterezett (platform-regiszter: globális/lokális-nagy/helyi-kicsi + digitális lábnyom-profil; kvalifikáció: nincs/elavult/modern honlap). MVP: szállás + Balaton (teszt).
- ⭐⭐ **A „nincs semmije" lead a LEGÉRTÉKESEBB szegmens** (max hozzáadott érték + konverzió + verseny-mentes). Technikailag legnehezebb (kevés anyag), üzletileg legjobb → a „minimál-adatból varázslatos mock" képesség a fő MOAT. Megoldás standardizáltan: régiós kontextus-scraper + stock/placeholder + AI (lásd BACKLOG).
- ⭐ **Meta-domain jelenlét mindig megmarad** → aggregátor/portál vektor (saját booking-alternatíva; Fázis 6).
- Kötelező **tenant-izoláció**; a vendég nem üzleti aktorunk. Modul-taxonómia + minimum→szofisztikált à la carte lépcső.

## Státusz
- **Alapmodell rögzítve (jóváhagyott):** iparág-AGNOSZTIKUS, AI-üzemeltetett, volumen-alapú
  disztribúciós gép. Elsődleges ígéret = LÁTHATÓSÁG. Horog = előre kész, személyre szabott mock.
  Tölcsér: lead-scrape → mock (előre kész) → multi-csatorna megkeresés → élesítés (= 1. fizetős kapu)
  → moduláris upsell → megszűnéskor inaktiválás.
- **⚠️ A régi `src/` (Property-központú szűk szállás-modell) + DOMAIN `02-ENTITY-MAP` ELDOBVA.**
  Csak teszt-visszaigazolás volt (badacsonyi validáció: 85% nincs saját honlap). Tényleges
  `git rm` az új struktúra scaffoldjakor.
- Git remote: github.com/olaszferenc/citoviso — push továbbra is deploy key-re vár.
- Éles hoszting/deploy: TBD.

## Parkolt ötletek
`_planning/BACKLOG.md` — pl. interaktív mock-konfigurátor + élő próbatér (fizetés előtt); adat-vezérelt lead-priorizálás.

## Következő lépés (folytatás innen)
A tervezés (Fázis 1–4) kész. Két irány közül választ a tulaj:
1. **Fázis 5 — éles pilot:** valós balatoni lead → megkeresés → fizetés → élő oldal; humán-pontok + konverziós arányok mérése.
2. **VAGY a tényleges ÉPÍTÉS megkezdése** a Fázis 4-terv alapján (a mag: scraper + generátor építhető).
Utána Fázis 6 (skálázás + aggregátor-portál + pénzügyi konstrukció + globális piacok/jogi keret). Részletek: `_planning/ROADMAP.md`.

## Nyitott kérdések (szándékosan elhalasztva a folyamat-modellig)
- Pénzügyi séma: előfizetés / egyösszeg / kombináció — képlékeny.
- Visszatérő érték / churn; upsell-időzítés.
- Hotlink-kép üzemeltetési törékenysége (idegen szerver leszedi → kép eltűnik).
- Google Maps kép-kivétel kezelése.
- Kiküldés-előtti belső jóváhagyás részletei.
- Globális enterprise-nyitottak: ki a "user" (tenant vs. végfelhasználó), időtárolás/audit mélysége,
  booking-sync (Booking.com/Airbnb) vs. tiszta direkt-foglalás, i18n-mélység (RTL/CJK, pénznem, jog).

## Előzmények
- 2026-07-07/08 (tervezés+infra szál): **1. INFRA-PILLÉR — tartós adat-réteg leszállítva:** embedded
  Postgres 18 (userspace, `.pgdata`, socket :5433) + Kysely + saját migráció-runner; 6 mag-entitás
  (`migrations/0001`, `src/db/`). **4 planning-doksi:** `PROCESS.md` (réteges, event-driven ügyviteli
  folyamat), `CONTEXT.md` (validációs brief), `PILOT.md` (instrumentált tanuló-pilot a megrendelésig),
  `VISIBILITY.md` (felfedezhetőség-motor + retention). ⭐ Fő felismerések: **iparág-agnosztikus** (a
  szállás csak az ELSŐ vertikum — CLAUDE.md+memória javítva); **láthatóság ≠ honlap** (kell auto
  felfedezhetőség-motor: SEO+Schema.org+GBP fél-automata); **retention = leállítható dinamikus funkció**
  (foglalás=OTA-jutalék-kiváltás), NEM a tartós, odaadott láthatóság; pilot-számlázás **Mineral-híd** +
  fallback. **Következő (build): 2. pillér — motorok átkötése az adat-rétegre + instrumentált preview.**
- 2026-07-07: **Presence-detektálás** (scraper). Feltárt kritikus rés: a „nincs honlap" eddig csak a
  Maps `websiteUri` hiányából jött (nem bizonyíték). Kutatás: Bing Search API halott, Google CSE
  „entire web" kivezetés alatt (2027-ig). Megoldás: guess+geo-verifikált HTTP-proba (0 API). ⚠️ VÉRREL
  TANULT: naiv guess 4/8 hamis pozitív → talált honlap CSAK geo-egyezéssel érvényes (§F invariánsok).
  Leszállítva: `src/scraper/enrichPresence.ts` + run.ts-bekötés + `03-INVARIANTS.md` §F. Következő: Brave.
- 2026-07-04 (session 2): MEGÉRTÉS fázis. A tulaj elmondta az iparág-agnosztikus disztribúciós-gép
  modellt; üzleti-folyamati kérdésekkel közösen tisztáztuk (fő ígéret, mock-mechanika, jogi állás,
  domain, humán-pontok). Alapmodell jóváhagyva és mentve. Régi kód/modell eldobásra jelölve.
- 2026-07-04 (session 1): Repó létrehozva (Node+TS scaffold + doktrínák). Remote/watchdog per-repo
  CIT idle-slot. Badacsony piac-teszt (85% nincs saját honlap) validálta az ötletet. Árazás +
  motor-tanulságok + remote-setup a `_planning/memory/`-ban.
