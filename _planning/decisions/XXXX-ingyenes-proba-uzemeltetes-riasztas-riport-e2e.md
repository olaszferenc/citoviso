## ADR-XXXX — Ingyenes próba üzemeltetése: operátor-riasztások, „Próba” tölcsér-lépcső, ígért aldomain = valódi slug, Modulok-kártya, e2e

**Dátum:** 2026-10-09 · **Státusz:** elfogadva (SUB F; a riasztások köre és a „belépő-levél nem ment ki” riasztás
tulaj-döntés 2026-10-09) · **Előzmény:** ADR-0342 (próba-állapot), ADR-0343 (pirula-pár, `trial.sub`), ADR-0344 (lejárat,
T−3/T−1, folytatás, admin-sáv C2c), ADR-0345 (90 napos megőrzés), ADR-0276 (house alert), ADR-0098 (riasztási címzettek).

### Döntés

1. **Próba-őrszem ÁLLAPOTBÓL, nem eseményből** (`src/trial/watch.ts` `runTrialWatch`, az ÓRÁNKÉNTI tickben —
   `scripts/offer-followup.mts` —, így a napi 07:00-s tick halála is látszik). A meglévő csatornán: `getAlertRecipients()`,
   e-mail (`alertSubject` → `[TESZT] ` nem éles hoston) + ékezet nélküli SMS. Öt állapot:
   ① aktív próba, `trial_until` + 26 óra elmúlt (a lejáratás nem futott) · ② T−3/T−1/p7 figyelmeztetés `failed`, vagy
   1 óránál régebben `claimed` (küldés közben omlott) · ③ 30 percnél régebbi aktív próba, és nincs tenant vagy a site nem
   `live` · ④ a lead `initial` fizetése 30 perce `paid`, de nincs kiállított számla, nincs előfizetés, vagy a próba nem
   `converted` · ⑤ 15 percnél régebbi aktív próba, és nincs `tenant_message kind='credentials'` (a belépő-levél nem ment ki).
2. **Egy eset = egy riasztás:** `free_trial_alert` (0100), unique (próba, fajta, ref); a sort a küldés ELŐTT foglalja.
   Címzett nélkül nem foglal (hangos napló, a következő óra újrapróbál); ha minden csatorna bukik, a foglalás törlődik.
   Egy tickben fajtánként egy összesítő levél + SMS.
3. **„Próba” lépcső a `/report` tölcsérben** mellékágként (a folytató próbázó a Rendelés/Fizetve oszlopban is számít, mert a `/folytatas` `order_intent`-et ír), az Elmélyült és a Rendelés között:
   forrás a `free_trial.started_at` (nem a kliens-esemény), csak kiküldött linkre, a félbemaradt foglalás nem számít, a törölt
   (`purged`) igen. Kártya „Kipróbálja-e?” (próba / kiküldött, alapcél 5%, `report_target` felülírja), oszlop „Próba” és
   „Próba 14 n.”. A `ordered`/`paid` definíciója változatlan.
4. **Az ígért aldomain = a valódi slug** (mérve: NEM egyezett — címke nélküli, foglalt nevű leadnél a lap `…-a`-t ígért, a
   próba `…-a-2`-t kapott). `plannedSiteSlug()` (`src/conversion/provision.ts`) ugyanazt a szabályt futtatja, mint a
   kiépítés (`uniqueSiteSlug`), meglévő site-nál annak slugját adja; ezt olvassa a `/p/:token` és a `/folytatas`.
   Őr: `free-trial-check` ⑩ (a pre-commit a `provision.ts`-re is futtatja).
5. **Lejárt próba „Modulok” kártyája** (a jóváhagyott terv nyitott pontja, `proba-admin-sav` README 8.): a `trial_grant`
   modulok, katalógus-sorrendben; a gerinc „csomag · fizetéskor vissza” (minden csomagban benne van, tehát igaz), a többi
   „csak a próbában volt”. Csak az Áttekintésen, `data-trial-modules`.
6. **E2E** (`scripts/free-trial-e2e.mts`, saját scratch-DB, gyorsított óra, nem pre-commit): indítás → belépő-levél →
   T−3/T−1 → lejárat (503) → folytatás mock-Barionnal → számla + előfizetés → második próba tilos. **Fordulónap = a fizetés
   napja** (mérve: próba 09-18…10-02, fizetés 10-09 → `anchor_date` 10-09, `current_period_end` 11-09).

### Nem változott
A lejárt próbázó lábléce (koordinátori döntés: nem kapja a „próbálja ki” láblécet).

### Nyitott
- ③ és ④ esetére nincs gépi pótló eszköz — a riasztás kimondja, hogy kézi fejlesztői beavatkozás kell.
- A `applyWebhookResult` nem kap órát: éjfél körüli fizetés fordulónapja e2e-ben nem tesztelhető.
