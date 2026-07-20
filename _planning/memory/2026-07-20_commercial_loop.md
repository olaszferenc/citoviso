# 2026-07-20 — A kereskedelmi kör lokálban zárva (konfigurátor → fizetés → számla → recurring)

## Mit csináltunk
A tölcsér-vég teljes kiépítése és lokál-verifikálása, kulcs nélkül. Lánc:
`mock → kurátor → prospect-konfigurátor (ALL-IN + ár) → order_intent → pay-link → fizetés → webhook
→ site LIVE + lead ACTIVATION → AAM auto-számla → recurring megújítás / nem-fizet → deaktiválás`.

## Fő minta: BUILD BEHIND AN INTERFACE (megismételhető)
Minden external integráció interfész mögött, **mock-adapterrel** a lokál teljes-lánc teszthez; a valós adapter
env-selectorral drop-in, kulcs-cserekor. Két példány:
- **Fizetés:** `src/payment/` — `PaymentGateway` interfész + `MockGateway` + `getGateway()` (env `PAYMENT_GATEWAY`,
  Barion=stub). A mock fizetőoldal UGYANAZT a webhook-utat hajtja, amit az éles gateway → a service/DB változatlan.
- **Számlázás:** `src/invoicing/` — `InvoiceProvider` + `MockInvoiceProvider` + `SzamlazzAgent` (env `INVOICE_PROVIDER`).
Elv: **nem tippelünk éles hívást vakon** — a wire-formátumot élő teszt-fiókkal validáljuk élesítés előtt.

## Kulcs-tények (kutatás + implementáció)
- **Gateway = Barion** (nincs belépő/havi díj, token-recurring, first-party Számlázz). ⚠️ a bázis+modul VÁLTOZÓ összeg
  → nem sima recurring, hanem **MerchantInitiatedPayment (MIT)**, amit a Barion **külön jóváhagy** (átfutási idő).
  **Pilot fizetési stratégia (MIT-független indulás):** per-ciklus **pay-link** (egyszeri fizetés) → nem-fizet → deaktiválás;
  auto-terhelés (MIT) = 2. fázis. 🚪 **NEHEZEN visszafordítható = a gateway + kártya-tokenek** (nem migrálnak).
- **Számlázz.hu Számla Agent (HIVATALOS spec, docs.szamlazz.hu/agent, 2026-07-20):** POST multipart
  `action-xmlagentxmlfile` → `https://www.szamlazz.hu/szamla/`; `xmlszamla/beallitasok(szamlaagentkulcs)/fejlec/vevo/tetelek`;
  `valaszVerzio=2` → `<xmlszamlavalasz><sikeres>/<szamlaszam>/<hibakod>`. **AAM = `<afakulcs>AAM</afakulcs>`** (afaErtek 0,
  netto=brutto). NAV Online Számla adatszolgáltatás AUTOMATIKUS. `SzamlazzAgent` adapter ehhez épült.
- **Adó (HU-first, EV + AAM):** **`vat_rate` PER SZÁMLA** (invoice tábla, 0 most) — a küszöb-átlépés/KFT csak a jövőbeli
  sorok kulcsát billenti, nincs séma-váltás. **AAM-küszöb 2026 = 20M Ft** (a korábbi 18M a 2025-ös volt). A globális
  billing (Paddle/Stripe MoR) PARKOLVA a validációig — ne dönts irreverzibiliset proof előtt (MineREAL).
- **Hoszting:** kemény kritérium = **saját domain auto-aktiválás + auto-TLS ember nélkül** → **Cloudflare for SaaS
  (Custom Hostnames)** + **Hetzner VPS** (a hoszting-verify rate-limitbe futott → tudás-alapú, build-időben fixálandó).

## Aktiválás megjegyzés
A `paid` → `convertLead` (tenant+entitlement+provisioned snapshot) + site→`live`. A **`live` az állapotgép go-live**;
a valós PUBLIKUS hoszting (custom domain+TLS) külön, deferred szelet. A számla best-effort (hiba → `failed` sor, nem
töri az aktiválást). Idempotencia: gateway_ref (payment), részleges unique (1 issued invoice/payment).

## DB (0006/0007) — meglévő gerincre
`payment` (0006), `invoice` (0007). A rendelés a MÁR meglévő `order_intent`-be megy (0003 pilot-instrumentáció, sosem
volt bekötve — most feltöltve). Prospect get-or-create a lead+artifactre (a valós outreach/`/p/<token>` flow későbbi szelet).

## Következő
Külön engedéllyel/kulccsal a tulajnál: Barion-fiók + MIT-jóváhagyás, Számlázz Agent-kulcs → valós adapterek bekapcsolása
(`PAYMENT_GATEWAY=barion`, `INVOICE_PROVIDER=szamlazz`). Vagy hoszting, vagy valós prospect-pilot (outreach-flow).
Placeholder árak: `src/modules.ts` (egy hely). Részletek: `_planning/RESEARCH-2026-07-billing-hosting.md`, `_planning/BACKLOG.md`.
