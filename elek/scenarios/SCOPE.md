# Elek teszt-scope — tulajdonosi döntés: ALL IN (2026-09-04)

A tulaj szava: *„All in: a scrapelt lead mock generálás és kiküldéstől egészen a tenant
vásárlás bővítés lemondás stb."* — a TELJES üzleti hurok Elek hatókörébe tartozik.

## A hurok szakaszai → forgatókönyvek

| FK | Szakasz | Állapot | Előfeltétel |
|---|---|---|---|
| FK-000 | Infra-füst (konzol él, napló kitölthető) | ✅ fut | `elek` operator_user (megvan) |
| FK-003 | Operátor lead-út: lista, szűrők, diszkvalifikált nézet | ✅ fut | scrape-elt leadek (vannak) |
| FK-003b | Lead-lap + mock-generálás állapotai | írásra kész | ⛔ ELEK-TESZT lead (seed kell) |
| FK-004 | Outreach-műhely: draft, kapu-verdiktek, csatorna-állapotok | írásra kész | ELEK-TESZT lead + mock |
| FK-001 | Tenant-admin: Dokumentumok + Üzenetek | írásra kész | ⛔ ELEK-TESZT tenant (seed kell) |
| FK-002 | Modulok-fül: kirakat, előnézet, tervsáv, díj-delta | írásra kész | ELEK-TESZT tenant |
| FK-005 | Vásárlás + bővítés + lemondás (mock-gateway-en) | írásra kész | ELEK-TESZT tenant + elek@citoviso.com |

## Kőbe vésett határok (a charter tiltásai — a scope NEM írja felül őket)

1. **Kiküldés-gomb SOHA.** A lokál `.env` valódi SMTP-t használ; az outreach-út a
   draft-képernyőig és a kapu-verdiktekig tesztelhető („E-mail / SMS megnyitása — küldés ▸"
   megnyitása igen, a tényleges küldés-akció NEM).
2. **Külső fizetés-gateway indítása tilos.** A lokál MOCK-gateway útja viszont a teszt része:
   azon Elek userként végigmehet (vásárlás, bővítés, lemondás) — ez nem külső hívás.
3. **Mock-generálás CSAK ELEK-TESZT leaden.** Valódi scrape-elt lead funnel-adatához (mock,
   sent_at-pecsétek, claimek) Elek nem nyúl — a lista/lap OLVASÁSA szabad. (A generálás
   valós AI-hívás, ~$0.2/mock — mért költség, vállalt.)
4. **A vásárlási út minden e-mail mellékhatása az `elek@citoviso.com` címre menjen** (a
   rendszer valódi levelet küld a vevőnek) — ezért az FK-005 előfeltétele a postafiók.

## Előfeltétel-teendők

- **Tulaj:** `elek@citoviso.com` postafiók a Zoho admin-konzolban (fogadásra; küldeni Elek
  úgysem küld).
- **Fejlesztő-session (tulaj jóváhagyással):** ELEK-TESZT lead seed (szintetikus lead a
  lead-lap/generálás úthoz) + ELEK-TESZT tenant seed (a tenant-admin utakhoz, vevő-email:
  elek@citoviso.com).
