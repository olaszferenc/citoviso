## ADR-0352 — A próba-kupon a kiírt nap VÉGÉIG él; a törlés a 90. megőrzött nap UTÁNI napon jön

**Dátum:** 2026-10-10 · **Kontextus:** IT B1-HATAR + B1-PURGE (`~/wt/citf604e298/_it/parts/b.md`). Módosítja: ADR-0342 (kupon lejárata), ADR-0345 ① („a törlés napja = a kupon lejáratának napja”).

**A hiba**
- A kupon lejárata `trial_until + N nap` PILLANATRA volt pontos (pl. 2027-01-27 09:20), a belépő-levél, az admin szünetel-blokkja és a törlés-figyelmeztető viszont „**2027. jan. 27-ig**”-et ír. Aznap 09:21-kor már teljes ár (§B.17).
- A törlés (`purgeDay` = próba vége + 90) a 90. nap 07:00-kor futott: a kupont a tenanttal együtt törölte, miközben a figyelmeztető levél ugyanarra a napra még kedvezményt kínált, és az ÁSZF 1.4 „90 napig megmarad” ígérete az utolsó napon délelőtt már nem állt.

**Döntés**
1. **A kupon a kiírt Budapest-nap végéig érvényes:** `expires_at = budapestDayEnd(próba utolsó napja + N)` (23:59:59.999 Budapest; `src/text/budapestTime.ts`). Minden kiírás (`budapestIsoDay(expires_at)`) változatlanul ugyanazt a napot mutatja.
2. **A törlés napja = a próba utolsó napja + 91** (`purgeDay`): a 90 megőrzött nap teljes egészében megvan, a 90 napos kupon utolsó napja is. A figyelmeztetés 7 nappal a (most egy nappal későbbi) törlés előtt megy; a levél a tényleges törlési napot írja.
3. A közvetlen vevő üdvözlő kuponja (`src/payment/offers.ts`) NEM változik ebben a körben (nem a próba-tölcsér; a kiírása külön vizsgálandó).
4. A próba saját lejárata (`trial_until`, pillanat-alapú) nem változik: a próba vége napra van kiírva, a lejáratás a napi ticken fut.

**Őr:** `scripts/free-trial-check.mts` ⑤ (a kupon a nap végéig, a törlés a kupon-nap után), `scripts/free-trial-retention-check.mts` ① (a 90. nap egész nap megőrzött; a régi kóddal piros).
