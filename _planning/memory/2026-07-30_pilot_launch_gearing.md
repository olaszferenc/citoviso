# 2026-07-27/30 — Pilot-felkészülés: domain-stratégia + outreach-gerinc + hatókör-újradefiniálás

## Mit csináltunk

### ADR-0020 — Domain-stratégia (tulaj-döntés, 2026-07-27)
A SEO canonical/provisioning terv átnézése helyett a tulaj a domain-kérdést döntötte el (a canonical
POST-PILOT): **alap = `<slug>.citoviso.com` aldomain** (olcsóbb, nulla súrlódás); **egyedi domain rajtunk
keresztül = minimum 24 hónap előfizetés-vállalás** (upsell + retenció-horog); rendeléskor **3–5 szabad,
jól hangzó javaslat** valós idejű előzetes elérhetőség-csekkel.
- `src/domains.ts`: slug/aldomain + javaslat-generálás (HU-first .hu → .com/.eu; típusszó-szűrés) +
  **réteges csekk: DNS-over-HTTPS (dns.google) → RDAP (rdap.org)**, kulcs nélkül, ~0,5 mp / 5 név.
  Verdikt őszintén „előzetes" (`taken|probably_free|unknown`); hiteles csekk+regisztráció = registrar-API réteg (hátra).
- Konfigurátor „Címe az interneten" lépés (aldomain default „az árban"; saját domain → javaslat-lista
  zöld/piros badge-ekkel, ár+elköteleződés az összegzőben) · `order_intent` 0008: `domain_type`
  (citoviso_sub|citoviso_registered|own) + `domain_name` + `commitment_months` · operátor-nézet mutatja.
- NYITOTT: a citoviso.com tényleges regisztrációja (tulaj); registrar-API (.hu=ISZT); `site`-oldali
  domain-mezők az élesítés-szelettel.

### Követett outreach-link + instrumentáció (PILOT.md §2.5+§3) — a mérő-gerinc
A 0003-as táblák (prospect/mock_view/mock_event) eddig ÍRATLANOK voltak; most él a teljes kör:
- `/p/<token>` route: pageloadonként új mock_view (visszatérés=új session), konfigurátor track-configgal,
  GDPR-lábléc (tájékoztató+leiratkozás). `POST /p/:token/event` beacon; `POST /p/:token/request` a token
  prospectjéhez köti az ordert; leiratkozás után SEMMILYEN tracking (0009: `unsubscribed_at`).
- Esemény-készlet: open (szerver) + scroll-mérföldkövek + dwell(15s heartbeat, cap 10 perc) + panel_open +
  module_add/remove + preset/period/domain_select/domain_pick + order_intent_submitted. sendBeacon,
  hiba sosem töri az oldalt.
- Prospect-tölcsér: `created→sent(operátor gomb=H1-bázis, 0009 sent_at)→opened→engaged→order_intent`,
  státusz sosem regresszál. Konzol lead-oldalon Megkeresés-panel (link-készítés szegmens+email űrlappal,
  link-másolás, számlálók). Szegmens auto: lead.qualification→(nincs_honlap|elavult|van_labnyom|0_labnyom).

### Email-piszkozat + §C-kapu + jog-őr ítélet
- `src/outreach/draft.ts`: determinisztikus, szegmens-hookos, §A demo-framinges piszkozat; §E.11
  jutalék-horog; **rating KIZÁRÓLAG az artifact perzisztált (A4-kapuzott) SiteData-jából** — §I: a levél
  pontosan azt állítja, amit a linkelt mock mutat. Feladó-identitás env-ből (`OUTREACH_SENDER_*`),
  kitöltetlenül látható placeholder → a kapu fogja.
- `outreachCheck.ts` (§C Enforce NOW): C1 leiratkozó-link · C2 feladó+jogalap+tájékoztató-link ·
  C3 lead-név-személyre-szabás · C4 félrevezetés-tilalom+terv-keretezés. Konzol `/prospect/:id/draft`:
  PASS/FLAG verdikt + másolható tárgy/szöveg (A2 kézi küldés).
- **⭐ jog-provenance-őr ÉLES ítélete: FLAG, 3 küldés-blokkolóval** — (1) Tailscale-IP link-bázis =
  halott link a címzettnek; (2) kitöltetlen/kamu feladó; (3) nemlétező adatkezelési tájékoztatóra
  hivatkozás. Javítás: **`/adatvedelem` GDPR Art. 13/14 oldal** (determinisztikus jogi szöveg §H.22,
  Art. 14 adatforrás-megjelöléssel, NAIH) levélből+/p/ láblécből linkelve; **kapu-szigorítás**:
  privát/CGNAT-IP (100.64–127.x=Tailscale), nem-HTTPS, placeholder-kontakt = FLAG. PASS-út publikus
  HTTPS bázissal unit-verifikálva. Tanulság: az őr-agent minta élesben működik — a determinisztikus
  kapu réseit az ítélet-igényű ellenőrzés fogta meg.

### Pilot-hatókör újradefiniálva (tulaj, 2026-07-30) — PILOT.md §1/§5/§7b-d
- **Pilot = TELJES loop éles fizetéssel + automata számlázással** (order-intent-szűkítés hatályon kívül).
- **Jogi forma: egyéni vállalkozás** — Mineral-híd+TEÁOR okafogyott; ÖVTJ-csekk a tulajnál.
- Fizetés-állás tisztázva (tulaj-megerősítés): sandbox-validált, éles NINCS (`BARION_URL=test`,
  `INVOICE_PROVIDER=mock`) → §7c élesítési checklist (éles fiókok ev.-re, env-csere, MIT-jóváhagyás,
  webhook publikus URL-en v. polling-fallback, kis összegű füst-teszt).
- **§7d felület-leltár** („még messze az indulás" — tulaj): ① belső UI fixálás (scrape CLI→felület,
  tölcsér-riport) ② email HTML-sablon+küldő-pipeline ③ tenant-admin read-only→szerkesztő (§E.12)
  ④ **Citoviso alap honlap NINCS** (bizalom-horgony; dogfooding a motorral).
  **Elfogadott sorrend: ①→②→③→④.**

## Commitok
`1b0e3ac` ADR-0020 domain-választás · `d70053e` követett link+instrumentáció · `b9112ce` outreach+§C+adatvédelem
· `0432d96` §7c fizetés-checklist · `2778a95` §1/§5/§7d hatókör+leltár · (+ ez a jegyzet).

## Nyitott / következő
- **KÖVETKEZŐ SESSION ELSŐ TÉMÁJA: Citoviso alap honlap** — saját motorral generálva (dogfooding),
  lokálban építhető; publikálás a hoszting-döntéssel.
- Külső (tulaj): citoviso.com regisztráció · hoszting-döntés (publikus HTTPS = §C-kapu ÉS Barion-webhook
  előfeltétel) · Barion+Számlázz éles fiók (ev.) · ÖVTJ-csekk · küldő-domain/postafiók (SPF/DKIM/DMARC).
- Kiküldés-előtti szöveg-kapu a tulajjal (PILOT.md §7b): email-szöveg + /p/ szövegek + /adatvedelem
  (megőrzési idő!) + VALÓS ÁRAK a `src/modules.ts`-ben.
- Kapcsolódó: [[project_pilot_full_loop_scope]] · [[project_domain_strategy]] ·
  [[project_conversion_pilot_and_sales_visibility]] · [[project_guardian_agents_gate]].
