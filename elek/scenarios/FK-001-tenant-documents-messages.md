# FK-001 — Tenant-admin: belépés a kapott jelszóval, Dokumentumok és Üzenetek

cél: A vevő a levélben kapott belépővel bejut a saját admin-felületére, megtalálja a számláját a Dokumentumok közt és a rendszer-üzeneteit (belépő, számla-értesítő) az Üzenetek közt.
felület: tenant-admin
kontraktus: kb/entries/admin-documents/entry.hu.md

## Előkészítés

- [ ] A belépő-oldal betölt, a levélben kapott adatokkal a belépés sikerül
  user: anon
  út: /login
  tedd: írd "#username" "${ELEK_TENANT_USER}"
  tedd: írd "#password" "${ELEK_TENANT_PASSWORD}"
  tedd: kattints "Belépés"
  várd: látható "Modulok"
  várd: látható "Dokumentumok"

## Dokumentumok

- [ ] A Dokumentumok fülön ott a kifizetett számla
  út: /admin?tab=dokumentumok
  várd: látható "OV-2026-7"

- [ ] A dokumentum-lista tartalma — ezt látja a vevő a bizonylatairól
  kézi: a számla-sor tartalma (összeg, dátum, letöltés-lehetőség) képről ítélendő

## Üzenetek

- [ ] Az Üzenetek fülön ott a belépő-levél és a számla-értesítő nyoma
  út: /admin?tab=uzenetek
  várd: látható "Belépési adataid"
  várd: látható "Számla"

- [ ] Az üzenet-lista olvashatósága — a vevő innen tudja, mit küldtünk neki
  kézi: az üzenet-sorok (tárgy, dátum, csatorna) képről ítélendők

## Összkép

- [ ] Az admin-felület elrendezése rendezett, a fülek működnek
  kézi: elrendezés-ítélet a képről (asztali nézet)
