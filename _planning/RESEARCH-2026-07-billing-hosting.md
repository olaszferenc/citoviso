# Kutatás — HU billing + hoszting stack a pilothoz (2026-07-20)

> Forrás: deep-research workflow (25 forrás, 25 állítás adverzariálisan ellenőrizve, 0 megdöntve).
> Scope: HU-first, EV + AAM + átalányadó, havi előfizetés (bázis + modul add-on + éves kedvezmény),
> automata kártyás recurring + auto-számla Számlázz.hu-n. Globális/multi-ország ADÓ szándékosan halasztva.

## TL;DR — a legkisebb reverzibilis pilot-stack
**Barion (gateway) + Számlázz.hu Számla Agent (auto-számla, a saját backendünk hívja a Barion-webhookra) +
low-ops hoszting (managed platform VAGY egy Hetzner-VPS + Postgres; tenant statikus oldalak CDN/object storage mögött).**
- **NEHEZEN visszafordítható:** a **gateway + a tárolt kártya-tokenek** — a tokenek NEM migrálnak gateway-k közt,
  váltásnál minden előfizetőtől újra kártya-mandátum kell (súrlódás + churn). Ezt kell tudatosan eldönteni.
- **Könnyen cserélhető:** a hoszting és a számlázó-bekötés (a Számla Agentet a backend hívja; a `vat_rate`-per-számla
  modell provider-független).

## 1) Fizetési gateway — Barion az ajánlott
- **Barion:** nincs belépő/havi díj, Barionon belül ingyen; natív token-alapú recurring/MIT a `/Payment/Start`-tal
  (`RecurrenceType` + `RecurrenceId`/`InitiateRecurrence`); **first-party Számlázz.hu-integráció**. Tranzakciós díj
  ~1,15–1,75% (Starter), opcionális Advanced tier havidíjjal olcsóbb %-ért.
  - **⚠️ Fontos a MI árazásunkra:** a `RecurringPayment` mód csak AZONOS-vagy-kevesebb összeget tűr. A **bázis+modul
    (változó összeg) és az éves-vs-havi eltérő összeg** → **MerchantInitiatedPayment (MIT)** kell, amit a Barion
    külön jóvá kell hagyjon (pilot-csúszás kockázata — előre kérni). [2-1 szavazat, jól alátámasztott mechanika]
- **SimplePay (OTP Mobil):** ugyanígy tud MIT recurring-et (`/v2/doRecurring`, `type=MIT`), OTP-hátterű, DE a
  **tokenek egyszer-használatosak és végesek** (regisztrációnként 1–24/52 db, `maxAmount`+lejárat) → határozatlan
  előfizetéshez a kártyát proaktívan újra kell regisztrálni, mielőtt elfogynak a tokenek. Nagyobb üzemeltetési teher.
- **Stripe:** legjobb DX/API, DE a **HU egyéni vállalkozó jogosultság, HUF/EUR payout, recurring/MIT részletek és a
  Számlázz.hu-párosítás ebben a kutatásban NEM ellenőrzött** → nyitott kérdés (ld. lent).

## 2) Számlázz.hu Számla Agent — megerősítve
- API-first (HTTP POST, XML/JSON), 100% automatizált számla/nyugta (készít/helyesbít/sztornó/előleg), **AAM-számlát tud**,
  aktiválás nélkül (API-kulcs a dashboardból). **NAV Online Számla adatszolgáltatás AUTOMATIKUS** minden kiállításnál
  (AAM-re/B2B-re is vonatkozik) — egyszeri NAV technikai-user beállítás után hands-off.
- **Használat-alapú díj** (sávos, előző havi darabszám, hó 1-jén számlázva; teszt-számla ingyen). Kis volumenen olcsó.
- **Pontosítás:** a Számla Agent egy POST-végpont, amit a MI backendünk hív a fizetés-webhookra — nem maga a webhook-vevő.
  Architektúra: gateway payment-success webhook (Barion IPN) → backend → POST Számla Agent → AAM-számla → NAV auto.

## 3) AAM / adó — KORREKCIÓ
- **A 2026-os AAM-küszöb 20 000 000 Ft** (a briefben szereplő ~18M a 2025-ös érték, 2026-ra ELAVULT). Ütemterv: 22M (2027),
  24M (2028). Göngyölített éves árbevétel méri; 2026-ra 2025-12-31-ig kellett választani (ONYA).
- **Küszöb-átlépés:** már AZT a számlát is **áfásan** kell kiállítani, amellyel átléped a keretet (Áfa tv. §188).
  → **Adatmodell: `vat_rate` PER SZÁMLA** (most 0 = AAM), NEM tenant-szintű flag → átlépés/KFT-váltás **újrafestés nélkül**
  (a határszámla és minden utána nem-nulla kulcsot visz).
- **AAM-záradék a számlán** (Áfa tv. §169 m): „AAM" (alanyi adómentesség) vagy „mentes az adó alól" — a Számla Agent tudja.

## 4) Hoszting — GYENGÉN fedve (a kutatás nem árazta forrásból)
- Reasoned ajánlás: low-ops managed platform (Railway/Render/Fly.io) VAGY egy Hetzner-osztályú VPS + Postgres; tenant
  statikus oldalak CDN/object storage mögött. Könnyen cserélhető (konténerezett Node/TS app).
- **⚠️ HIÁNY:** a kutatás NEM fedte a MI kemény kritériumunkat: **saját domain auto-aktiválás + auto-TLS ember nélkül**
  („Cloudflare for SaaS / Custom Hostnames" v. Caddy on-demand-TLS), ÉS az **email-provisioning API-t** (10 postafiók).
  Konkrét havi költségek sincsenek forrásolva. → **külön kis rátöltés kell** erre a két szögre.

## Nyitott kérdések (a kutatás jelölte)
1. **Stripe** HU-EV jogosultság 2026, HUF payout, recurring/MIT/webhook, díjak, Számlázz.hu-párosítás — ellenőrizetlen.
2. **Hoszting konkrét havi költségek** pilot-léptéken (Hetzner-VPS vs Railway/Render/Fly.io vs CDN/object storage) —
   + a MI auto-custom-domain + email-provisioning kritérium.
3. **Barion** pontos díj-sávok (Starter vs Advanced %, Advanced havidíj) + a **variable-amount MIT külön jóváhagyás** kell-e
   (pilot-csúszás?).
4. **Átalányadó** ró-e a számlázásra az AAM-en túli megkötést; mely árbevételnél trigger a KFT-váltás (→ `vat_rate` standard).

## Reverzibilitás-térkép
- 🚪 **Nehéz:** gateway + kártya-tokenek → **tudatos döntés kell** (ez a Barion-ajánlás lényege).
- 🔄 **Könnyű:** hoszting (konténer), számlázó-bekötés (`vat_rate`-per-számla provider-független).
