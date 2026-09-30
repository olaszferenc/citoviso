## ADR-XXXX — A lead-ajánlatok időzítése és a bemutatkozó kedvezmény a /pricing-on állítható; a levél %-a köt (2026-09-30)

**Dátum:** 2026-09-30 · **Státusz:** elfogadva (SUB, koordinátor: CIT fő session; briefek:
`~/rc-briefs/eszkalacio-idozites-bemutatkozo-allithato-sub.md`, `~/rc-briefs/eszkalacio-idozites-sub-dontes.md`;
a felület §2b-terve jóváhagyva: „A” változat) · **Kapcsolódó:** ADR-0285 (küszöb és % állítható — ezt bővíti),
ADR-0088 §3–4 (a bemutatkozó és az eszkalációs ajánlat), kontraktus: `assets/design-refs/console/escalation-offer-admin/`.

**Kontextus.** Az ADR-0285 „nem hatókör” pontja nyitva hagyta a 72 órás érvényességet, a 24 órás emlékeztetőt és a
−25% bemutatkozó kedvezményt. A tulaj ezeket is az árazási felületen akarja állítani. A bemutatkozó % állíthatósága
egy rejtett hibát hozott felszínre: az `offer` sor (`kind='outreach'`) NEM a kiküldéskor, hanem lustán, az első
megnyitáskor keletkezett, az akkori %-kal. Egy %-állítás után a már kiküldött, de meg nem nyitott levél leadje így a
levélben ígérttől eltérő kedvezményt kapott volna (dev-DB, 2026-09-30: 12 kiküldött prospectből 1).

**Döntés.**
1. **Három új, operátor-állítható paraméter** ugyanabban az `app_setting` `escalation_offer` JSON-ban, migráció
   nélkül: `offerHours` (egész, 24–168), `followupHours` (egész, ≥ 1 és < `offerHours`), `outreachPercent` (egész,
   5–50). A konstansok (72 / 24 / 25) ezután csak alapértékek. Hiányzó kulcs → a saját alapértéke (az ADR-0285-ös
   sor változatlanul érvényes); sérült vagy a szabályt sértő sor → a teljes alapérték.
2. **Mező-közi szabályok az egy `escalationConfigErrors`-ban**, mindkét érintett mezőt jelölve: eszkalációs % >
   `outreachPercent` (a régi `ESCALATION_PERCENT_MIN` konstans megszűnt), és `followupHours` < `offerHours`. A
   százalék-szabály kikapcsolt döntés-segítőnél is él: a tárolt szám visszakapcsoláskor nem lehet érvénytelen.
3. **A levél %-a köt (tulaj-döntés).** Minden küldési út (e-mail batch, SMS, MMS+SMS pár, kézi „kiküldve”
   jelölés) a sikeres küldés UTÁN rögzíti a levélben idézett %-ot a meglévő `offer` táblába (`stampOutreachOffer`,
   `kind='outreach'`). Az `offer_prospect_kind_uq` egyedi index miatt az első rögzítés köt. A draft a prospecthez
   tartozó %-ot idézi (`outreachPercentForProspect`): a rögzítettet, a rögzítés előtti (régi) kiküldésnél a konstanst,
   különben a beállítottat. A lusta ág (`ensureOutreachOffer`) már csak a régi kiküldéseket pótolja, és a
   konstanssal, mert azok a levelek azt idézték.
4. **Az érvényesség a kiadáskor pecsételődik** (`offer.expires_at`), a futó ajánlatot nem érinti. **Az emlékeztető
   késleltetése minden futáskor a configból jön**, ezért a már futó ajánlatokra is hat (tulaj: „rendben így”); a
   felület és a KB kimondja.
5. **Az emlékeztető óraszáma a legkorábbi időpont.** A follow-up a napi billing-futással (`citoviso-billing.timer`,
   07:00) megy, ezért a felület „legkorábban … a napi reggeli küldéskor” formában ígér. Ha a késleltetés után 24 óránál
   kevesebb marad a lejáratig, a mező alatt kimondja, hogy nem minden lead kapja meg.

**Őr:** `scripts/escalation-config-check.mts` (pre-commit; trigger: `offers.ts`, `console/{views,server,data}.ts`,
`outreach/{draft,sendBatch,sendOutreachSms,sendOutreachPair,escalationFollowup}.ts`). Új lábai: ⑥ a konfigurált
érvényesség a lejáratba jut, a konfigurált késleltetés dönti el az esedékességet, a régi sor érvényes, a hibás sor
nem; ⑦ a %-állítás után a még meg nem nyitott levél leadje a levélben ígért %-ot kapja, a régi kiküldés a konstanst,
az új kiküldés az új értéket; ⑧ szerkezeti: minden `sent_at`-ot pecsételő küldési út rögzíti a %-ot is. Mérve: a
`markProspectSent` rögzítését kivéve 3 láb bukik, a konstans órákra visszarontva 2, az SMS-út rögzítését kivéve 1.

**Élesítés:** a nagy deploy utáni kör (külön engedéllyel). Migráció nincs; élesen a sor hiánya = 3 / 50 / 72 / 24 / 25.
Az éles régi, rögzítés nélküli kiküldések a konstans 25%-ot kapják, amit a levelük ígért.

**Visszafordíthatóság:** 🔄 a sor törlése visszaadja az alapértékeket. A rögzített `offer` sorok maradnak, és ez a
helyes: azt tartják, amit a levél ígért.

**Elvetve:** (a) új oszlop a prospecten a levél %-ára: migrációt kért volna, holott a meglévő `offer` sor pontosan ezt
a tényt hordozza; (b) a lusta ág a mindenkori beállítással: ez okozta a hibát; (c) „B” (két kártya) és „C” (idővonal)
változat: a tulaj az „A”-t választotta.

**Nyitott:** ha a rövid (24 óránál kisebb) maradék-ablak gyakori lesz, a follow-up áttehető az óránkénti futásra
(`citoviso-booking-maintenance.timer` mintájára). Ez külön döntés, infra-változás.
