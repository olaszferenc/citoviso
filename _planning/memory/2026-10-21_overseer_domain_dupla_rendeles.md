# 2026-10-21 — Éles eset: overseer.hu — a webhook és az időzítő kétszer vette a domaint, a tulaj hamis „elkelt” levelet kapott

## Mi történt (éles napló + DB, helyi idő)
- 15:47 a tulaj a Rebeka-tesztpróbából (lead f37c9116, tenant b4c07a37) megrendelt: 55 Ft/hó, saját cím `overseer.hu` csomag-tartalomként (0 Ft).
- 15:54:42 fizetés OK (Barion token elmentve), site `teszt-rebeka-panzio` → `overseer`, számla CITO-2026-6 kiment.
- 15:54:52 a fizetési webhook (`citoviso-public`, pid 3172588) elindította a `domain_provisioning` sort → `registering`.
- UGYANEKKOR a 2 percenként futó `citoviso-domain-resume` timer (pid 3195448) felvette ugyanazt a sort (a `resumePendingDomainProvisionings` a `registering`-et is újrafuttatja, `runDomainProvisioning` zár nélkül újra vásárol).
- Egyik ág: Websupport rendelés 22790832 + kreditből fizetés OK → `registered` → `dns_pending` (15:55:03). A tulaj mint fiók-gazda megkapta a Websupport 30264784-es díjbekérőt (ez a rendelés bizonylata, nem fizetetlenség).
- Másik ág: `POST /order` → HTTP 500 „[OrderAddError] Duplicate order, found overseer.hu (43) in order 22790832” → a catch `failed`-et írt, és 15:55:00 KIMENT a tulajnak „A választott webcím időközben elkelt” (tenant_message e7ce4af8) + house-alert levél + SMS („domain-regisztráció NEM sikerült”).
- 3 mp-vel később a nyertes ág `dns_pending`-re írta a sort; a hibaszöveg a soron maradt. Azóta 2 percenként `dns_pending` (helyes: a .hu Nyilvántartó megerősítő levelére vár, ami `olasz.ferenc@citoviso.com`-ra jön, KÉZI kattintás — tulaj-rendelet 2026-09-09; 16:40-ig nem érkezett).
- Belépés: NEM hiba. A fizetés utáni oldal (`/pay/done`) kiírja a felhasználónevet és a `citoviso.com/login` linket („Belépek és szerkesztem”), a számla-levél vége is, az élő oldal lábléce is; a hitelesítő levél a próba indulásakor (09:56) ment ki. Az első jelentésemben ezt tévesen „nincs link”-nek mondtam — a tulajnak kijavítva.

## Javítás (ebben a fában)
- `src/domains/provisionDomain.ts`: a vásárlás-lépés ATOMI claim (`update … set status='registering' where status='pending' or (registering ∧ registrar_ref null ∧ 15 percnél régebbi) returning id`); vesztes → `registering`-et ad vissza, nem vásárol. A regisztrátor „Duplicate order” válasza SOHA nem `failed` és nem tulaj-levél: ha másik futás lezárta → annak állapota; ha senki (megszakadt futás) → a rendelés-azonosító a sorra, egy operátor-riasztás (`domain-duplicate-order`), `registering` marad, a claim nem vásárolja újra. `registered`/`dns_pending` lépés törli a hibaszöveget.
- `src/domains/registrar/mock.ts`: teszt-horgok (`delayMs`, `refuseDuplicateOrders`, `resetOrders`).
- `scripts/domain-order-single-flight-check.mts`: ÚJ-K2 ① (időzítő a futó vásárlás alatt → 1 vásárlás, nem failed, nincs „elkelt” levél) és ② (megszakadt futás → rendelés-azonosító a soron, 1 riasztás, nincs újravásárlás).

## Nyitott
- A .hu Nyilvántartó megerősítő levele → a tulaj kattint; utána NS/TLS magától, levél „él”.
- A hamis „elkelt” levél nem visszavonható; a tulaj tud róla.
- Élesítés: a tulaj külön engedélyével, a nagy deployjal vagy előbb — tulaj dönt.
