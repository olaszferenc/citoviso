## ADR-XXXX — A nyelvi csomag hiánya nem zárja a piacot: a „Bábelre vár” az ÜZENET szintjén él

**Státusz:** ELFOGADVA (koordinátor `cit9b4690e3` 2026-11-26, a tulaj 2026-11-25-i szabálya alapján: hiányzó fordítás
nem blokkolhat, magyar fallback, Bábel utólag) · **Módosítja:** ADR-0460 ② és ③ (a piac-kapu teljességéből a nyelvi
csomag kikerül), ADR-0070 §3 (a nyelvi kapu a levélen, nem a csomagon) · **Épít:** ADR-0456 (megkeresés „Bábelre vár”),
ADR-0412 (csak Bábel fordít) · SUB `cit9d514f15`.

**Mi volt a baj (mérve élesen 2026-11-26 15:50):** a HR piac jóváhagyva, minden más tétel kész, de az éles
`discovery-areas.mts plan` csak a HU-t adta vissza nyitott piacként. Ok: „Nyelvi csomag (Bábel): hr: 4270 / 4293 vevő-oldali
felirat lefordítva — Bábelre vár”. A `countryReadiness` „babel” tétele kapuzó volt, így a `marketGate` ZÁRT. A lánc az
audit (a) óta csak nyitott piacra dolgozik, ezért minden HR lead kiesett a jelöltek közül. Ugyanez a bejövő próbát és a
fizetési linket is zárta. Ez minden landnál megismétlődött, amely új vevő-oldali feliratot hozott. Ráadásul a kiküldők
(`sendBatch`, `sendOutreachSms`, `nonOpenerFollowup`, `trialCampaign`, `behaviorMessage`) a TELJES csomag bármely hiányánál
a nyelv MINDEN levelét tartották, akkor is, ha az a felirat abban a levélben nem szerepelt.

**Döntés:**
1. **A „Nyelvi csomag (Bábel)” tétel NEM kapuzó** (`gating: !okLang`), hiánynál figyelmeztetés (`warn`). Kapuzó csak
   akkor, ha az országnak nincs alapnyelve. A piac így egy új felirat miatt nem zár be: se a láncnak, se a bejövő
   próbának vagy fizetésnek. A vevő-oldali oldalak a hiányzó feliratot magyarul mutatják, amíg Bábel le nem fordítja.
2. **A védelem az üzeneten marad.** Az a konkrét levél, SMS vagy mock, amelynek a SAJÁT szövegében magyar fallback van,
   nem megy ki, hanem okkal vár („Bábelre vár”, TARTVA):
   - hideg levél: `d.draft.untranslated` és a ténylegesen kimenő változat `letter.untranslated`;
   - SMS: `d.sms.untranslated`, a mérés nélküli is TARTVA;
   - nem-nyitó levél: `built.send.untranslated` és a keret `mailFallbacks`;
   - próbakampány: `letter.untranslated` és `mailFallbacks`;
   - viselkedés-üzenet: a §C kapu a `mailFallbacks`/`smsFallbacks`-szel;
   - mock: `mockVerdictGate` `langVerdict`, ez nem nyugtázható;
   - a §C kapu (`outreachCheck`) a mérés nélküli idegen nyelvű levelet is tartja.
3. A teljes csomag mérése (`missingBuyerPackStrings`) a `countryReadiness`-ben marad, a lapon látható %-kal. Küldő út
   ezt nem olvassa: a `country-layer-check` őrzi, hogy egyik küldő út se nézze a teljes csomagot, és mind a saját szövegét mérje.

**Mérés (vak, dev):** lásd `_planning/memory/2026-11-26_piacnyitas_kezi_lepes_nelkul.md`, „Nyelvi csomag” szakasz:
(i) egy új, lefordítatlan felirat után a HR nyitva marad; (ii) az a levél, amelynek saját szövege lefordítatlan, TARTVA,
a többi levél nem.
