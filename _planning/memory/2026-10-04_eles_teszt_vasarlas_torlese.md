# 2026-10-04 — Éles teszt-vásárlás ([TESZT] Muschel Panzió) törlése

Kiindulás: a tulaj a Megkeresés-riportban (30 nap) 1 rendelést és 1 fizetést látott, de számlát nem.
Mérés (élesi olvasás): a „vevő” a saját 2026-10-02-i teszt volt — `[TESZT] Muschel Panzió`, kapcsolat
`olasz.ferenc@citoviso.com`, 2 rendelés 98%-os „Élesi Elek-teszt 2. kör” kampány-kedvezménnyel
(97 Ft initial, 43 Ft upsell), mindkettő fizetve, a számlák KIÁLLÍTVA: CITO-2026-3, CITO-2026-4 (szamlazz, PDF tárolva).

## Elvégezve (tulaj: „vegyük le a kedvezményt! és a két teszt adatait vegyük ki”, választás: teszt-kedvezmények + teljes lánc + partnerek)
- Mentés előtte: `/opt/citoviso/backups/test-purge-muschel-20261004-1333/` (teljes pg_dump, `invoices.json` PDF-ekkel).
- Egy tranzakcióban (ROLLBACK-es próbafuttatás után) törölve: 2 invoice, 2 payment, 2 order_intent,
  5 offer (2×98% lejárt + élő 25% outreach, 50% eszkaláció, 25% kupon), 4 „Olasz-Balogh Viktória” partner,
  1 tenant (cascade: site, AKTÍV subscription, entitlementek…), 1 prospect, 1 lead.
- Az árva `sites/3bef8ec2-…` mappa a mentés mellé költözött (`site-3bef8ec2`), nem törölve.
- Az eredeti scrape-elt „Muschel Panzió” lead (87fa84bb, 2026-08-19) érintetlen.
- Kód nem változott; élesre deploy nem ment.

## Miért sürgős volt
A teszt-tenant előfizetése `active` és kártyás volt: novemberben a kedvezmény nélküli havidíjat terhelte volna.

## Nyitott
- A tulajé: CITO-2026-3 és CITO-2026-4 SZTORNÓ a Számlázz.hu-n (NAV-nál élnek; a kódban nincs sztornó).
- A riport „teszt nem számít” szűrője a `[TESZT]` leadet / a saját címre küldött linket nem szűri ki → javítás javasolva, nem kérve még.
- Szabály: élesi teszt-vásárlás után az előfizetést mindig le kell állítani.
