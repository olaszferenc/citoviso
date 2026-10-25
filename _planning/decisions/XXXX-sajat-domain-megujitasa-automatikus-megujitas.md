## ADR-XXXX — A saját domain megújítása: a regisztrátor kapcsolója a szabály szerint, naponta

**Dátum:** 2026-10-25 · **Státusz:** elfogadva (tulajdonosi döntés, chat: „Leíratkozás napjával kikapcsoljuk a megújítást akkor, ha még minimum 90 nap van a megújításig. Ha kevesebb akkor 1x megújítjuk. Leíratkozásnál átirányítjuk a mi landing oldalunkra.” · „Remélem azt is be lehet állítani, hogy a név átírásának mennyi a költsége (nem kötve hűség időhöz)”) · **Érinti:** ADR-0071, ADR-0080 ⑤, ADR-0094, ADR-0103, ADR-0109, ADR-0400 (6. lépés: megújítás)

### Kontextus
Mérve 2026-10-25 (Websupport `GET /v1/user/3213041/service`): az overseer.hu (az első éles tenant-név, vétel 2026-10-21)
`autoExtend: false`, lejár 2027-10-21 — a kódban semmi nem újította volna meg, nem olvasta a valódi lejáratot, és nem
figyelte. A tenant közben havonta fizeti a domain díját (ADR-0109, `domainFeeForRenewal`), tehát a pénz jön, a név mégis
lejárt volna. A `site.domain_registered_at` valójában helyben számolt lejárat volt (vétel + 1 év), a `registrar_ref` a
rendelés-azonosító, nem a szolgáltatásé. A Websupportnál a megújítás EGYETLEN gépi útja a szolgáltatás `autoExtend`
kapcsolója: `PUT /v1/user/{id}/service/{serviceId}` `{"autoExtend": true}` → a lejárat előtt a kreditből fizet
(rest.websupport.sk/docs/v1.service; kézi „renew” végpont nincs).

### Döntés
1. **A kapcsoló állása a szabály** (`src/domains/domainRenewal.ts`):
   - fizető tenant → **BE**;
   - megszűnt előfizetés (`subscription.status = 'cancelled'`: a tenant lemondása lejárt, vagy 30 nap nem-fizetés) — a
     megszűnés napján: a lejáratig **≥ 90 nap → KI** (nincs több megújítás, a név lejár); **< 90 nap → még EGYSZER
     megújul**, utána KI. Tárolva: `site.domain_renew_end` (ezen a lejáraton túl nem újítunk); visszatérő tenantnál törlődik.
2. **Napi szinkron** (`scripts/domain-renewal-sync.mts`, `citoviso-domain-renewal.timer`, éles, 04:20): minden nálunk lévő
   névre leolvassa a valódi lejáratot és a kapcsolót (`domain_expires_at`, `registrar_service_ref`, `domain_auto_renew`),
   a kapcsolót a szabály szerint állítja, és a talált hibát a sorra írja (`domain_renew_problem`). Nem éles gépen a
   kapcsolóhoz nem nyúl (csak olvas és kiírja, mit tenne).
3. **Riasztás** (`stallWatch.ts`, óránként, levél + SMS): a kapcsoló nem állítható; a fizető tenant neve nincs a fiókban;
   lejárt és nem újult meg; a 30 napon belüli megújításokat a kredit nem fedezi; a szinkron 48 órája nem nézte a nevet.
4. **A megszűnt előfizetés saját címe a nyitóoldalunkra irányít** (`public.ts`, 302 → `https://citoviso.com/`), nem a
   marketing-oldalunkat szolgálja ki a tenant neve alatt.
5. **A név átírásának díja beállítható, a hűségtől függetlenül:** a /pricing meglévő „Kivásárlás” mezője ez lett („Név
   átírása a vevőre”, alap 20 000 Ft) — bármikor ugyanannyi; hűség alatti kilépésnél a kötbér ezen felül jár (ADR-0109 ④).
6. A „megszűnés napja” az előfizetés tényleges megszűnése (`cancelled_at`), nem a lemondás-gomb megnyomása: addig a
   tenant fizetett időszaka fut, a honlap él.

### Nyitva
- Az átírás (a név a tenant nevére, 7. lépés, ADR-0400) folyamata ma sincs gépesítve; a díj beállítható, a művelet kézi.
- Az overseer.hu kapcsolóját az első éles szinkron kapcsolja be (az élesítés a tulaj külön engedélyével).
