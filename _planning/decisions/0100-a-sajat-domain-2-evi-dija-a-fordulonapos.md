## ADR-0100 — A saját domain 2+. évi díja: a fordulónapos megújulás TÉTELE (nem külön terhelés)

> ⚠️ **FELÜLÍRVA — ADR-0109 (2026-09-07).** Az ①–② pont (éves díj + évforduló-ablak +
> küszöb-feloldás) MEGSZŰNT: a saját cím HAVI díjas, ezért minden ciklus szedi, és nincs
> mit „melyik ciklusba" sorolni. Ami ÉL belőle: ③ (kedvezmény a domain-díjra sosem megy)
> és ④ (külön számla-tétel). A kód a `domainFeeForRenewal()`-t hívja, a
> `domainFeeForPeriod()` nem létezik többé.

**Dátum:** 2026-09-06 · **Státusz:** ELFOGADVA (tulaj: „de jó hogy észre vetted! javítsuk!") ·
**Kapcsolódó:** ADR-0080 ① (egy fordulónap, egy számla), ADR-0093 ② (küszöbtől ingyen),
ADR-0094 (kötbér-modell, padló), ADR-0071 (registrar auto-renew — az INWX minket évente terhel).

**Kiváltó (mérve, 2026-09-06):** a domain éves díját CSAK az 1. évre terhelte a rendszer
(initial order — az aznapi javítás óta; ill. a tenant-oldali `domain_upgrade`). A 2. évtől
SOHA SENKI: a megújulás-motor (`billing.ts`) kizárólag a modul-listából számol, a
domain-díj egyik ciklusba se folyt bele — miközben a registrar-megújítás a mi költségünk.

### Döntés

**① A domain-év díja NEM külön terhelés.** Annak a fordulónapos megújuló rendelésnek a
tétele, amelynek időszakába (`renewal_period_start ≤ évforduló < renewal_period_end`) a
domain évfordulója (`site.domain_registered_at + k év`) esik. Így él az ADR-0080 ①
(„havonta EGY terhelés, EGY számla, tételekkel"), és NINCS külön dunning-szál — a
nemfizetésre a meglévő lépcső válaszol, mögötte a domain-zálog (ADR-0094 ③).

**② A díj MINDEN megújuláskor újra feloldódik az AKKORI csomag ellen**
(`resolveDomainYearly`): küszöb (ma 8 000 Ft/hó) feletti csomag → 0 Ft, tétel sincs;
alatta → teljes éves díj. Hűségidő alatt a csomag-padló (ADR-0094 ④) garantálja az
ingyenességet; a hűségidő UTÁNI lecsúszás viszont árazódik — pont ez a horog értelme.

**③ Kedvezmény a domain-díjra SOSEM megy.** A kupon/ajánlat a MI szolgáltatásunkat árazza;
a domain átfolyó registrar-költség. (Az induló rendelésen ugyanez a szabály él a mai
javítás óta.)

**④ Tárolás + számla-tétel:** `order_intent.domain_fee` (0053-migráció). A számlán KÜLÖN
tétel jelenik meg („Citoviso saját domain (<név>) — éves díj"), mind a megújuló, mind az
induló rendelésen — az eddigi egysoros számla a díjat némán beolvasztotta volna az
előfizetésbe.

**⑤ Mellék-javítás:** a `kind='domain_upgrade'` számlája eddig „Citoviso előfizetés
(éves, 0 modul)" feliratú tételt kapott — mostantól saját domain-tételt visel.

**Visszafordíthatóság:** 🔄 — additív oszlop + mint-logika + számla-tételezés; a
kifelé menő számlakép változik, de csak pontosabb lesz.

**Impl.:** `migrations/0053_domain_fee_on_order.sql` → `schema.ts` → `billing.ts`
(évforduló-ablak a mintben) → `service.ts` (tétel-bontás + ⑤) → `console/server.ts` +
`data.ts` (induló rendelés `domain_fee`-je) → `scripts/domain-renewal-check.mts` (kapu).
