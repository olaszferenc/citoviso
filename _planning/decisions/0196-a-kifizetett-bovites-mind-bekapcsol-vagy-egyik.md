## ADR-0196 — A kifizetett bővítés mind bekapcsol vagy egyik sem, és „a pénz megjött" nem „kézbesítve" (2026-09-22)

**Dátum:** 2026-09-22 · **Státusz:** elfogadva (megvalósítva, őrrel) · **Kapcsolódó:**
ADR-0192 ⑧.6/⑧.7/⑧.8 (itt mérték ki a három leletet), ADR-0113 (a bővítés fizetés után él),
ADR-0072 (azt kapja, amiért fizetett), ADR-0080 ③ (a lemondott modul a periódus végéig él),
ADR-0070 (levezetett i18n-hatókör), ADR-0193 (az előző szelet ugyanebből a listából).

**Kiváltó.** Tulajdonosi utasítás: *„vidd a maradék hat hibát is, kezdd a nem-atomi
activateUpsell-lel."*

---

### ① A nem-atomi aktiválás — és az IKER-HIBA, ami miatt a tranzakció önmagában kevés

**A lelet, reprodukálva.** Az `activateUpsell()` modulonként külön utasítással írt, tehát
N külön tranzakcióban. A fixture-ön a második modul beírását DB-szintű triggerrel buktattam el:
**`["gallery"]` maradt hátra**, kifizetve, a másik kettő nélkül — a `booking`-bent-`pricing`-kint
osztály, amit semmi nem vesz észre.

⛔⛔ **A tranzakció ÖNMAGÁBAN egyik némaságot cserélte volna a másikra, és ezt a javítás
közben mértem ki.** A `applyWebhookResult()` a fizetést **a rendezés ELŐTT** állítja `paid`-re,
az első sora viszont:

```ts
if (payment.status === "paid") return { ok: true, activated: false, alreadySettled: true };
```

Vagyis egy **újraküldött webhook meg sem próbálta újra** az aktiválást. Visszagörgetés után a
vevő fizetett, **semmit nem kapott**, és az idempotencia elnyelte a hibát — pontosan a
`feedback_idempotency_made_the_second_charge_worthless` osztály. Atomicitás újrahajtás nélkül
nem javítás lett volna, hanem a hiba áthelyezése.

**A döntés — három rétegben, mert egy sem elég önmagában:**

1. **Atomi aktiválás.** Egy tranzakció: mind vagy semmi. Érvénytelen KIFIZETETT halmaz nem
   keletkezhet.
2. **A `paid` státusz NEM kézbesítési bizonyíték.** Új kérdés, külön függvénnyel:
   `undeliveredUpsellModules()` — a jogosultságok mondják meg, megkapta-e a vevő, amit vett.
   A replay ez alapján **újrarendez**, ahelyett hogy vállat vonna.
3. **Ember a végén.** Ha az újrarendezés sem sikerül, riasztás megy
   (`feedback_auto_retry_needs_heartbeat_and_cap`: ember-riasztás nélküli auto-retry csak egy
   halkabb kiesés).

⚠️ **A ②/③ SZÁNDÉKOSAN csak az `upsell` ágra szól**, és ez a kódban is ki van mondva: azt
mértem. A többi `kind` (initial / renewal / multilang) viselkedése változatlan — a multilang
saját, újrafuttatható életciklus-sort visz, az initial konverzió végig idempotens. Néma
kiterjesztés itt tippelés lett volna.

### ② `renewableModuleIds` — a „mit számlázunk?" második példánya

A függvény inline újraírta a kérdést, a **supersession lába nélkül**: egy kiváltott modul
örökké megújult volna, miközben a lap semmit nem mutat belőle. Ma csak **véletlenül** egyezett
a kanonikus szabállyal — a katalógus egyetlen kiváltása (`enquiry ← booking`) spine ÉS 0 Ft,
így a `!spine` ág véletlenül lefedte. Összevonva az `isBilledModule()`-ra.
**Mérve: mind az 5 dev tenanten 0 eltérés** — a hiba látens volt, és az is marad; csak már
nem tud kinőni. ⛔ A mérés független referenciával ment (a RÉGI inline predikátus
újraírásával), nem a vizsgált függvénnyel.

### ③ A doc-hiba, ami rosszabb a hiányzó kommentnél

A `renderableModules()` fejléce azt írta, hogy árazáshoz is ezt kell használni — a kód ezt
**soha nem tette**. Egy komment, ami olyat ír elő, amit senki nem követ, a következő olvasót
vagy rossz rétegre köti, vagy egy nem létező garanciára. Átírva arra, ami igaz, és
megnevezve a pénz-oldali kanonikus predikátumot.

### ④ AZ ŐR — és amiért DB-szintű hibát injektál

`scripts/upsell-atomicity-check.mts`: eldobható fixture a valódi adatbázison, a hiba egy
**BEFORE INSERT trigger**, ami KIZÁRÓLAG a fixture tenantjára és KIZÁRÓLAG egy megnevezett
modulra dob. ⚠️ A dev-DB közös (~25 párhuzamos szál), ezért a trigger szűkített, egyedi nevű,
és a `finally` mindenképp eldobja. Piros önteszt: **3 bukás** a történeti alakon.

⭐ **A mérés a VALÓDI webhook-úton megy**, nem a `settleUpsellPaid()`-et hívja közvetlenül:
a lyuk nem a rendezésben volt (az mindig működött), hanem a `applyWebhookResult` vállrándításában.
Egy közvetlen hívás olyan utat mért volna, amit a gateway soha nem jár, és **zöld maradt volna
a valódi hibán**.

⚠️ **AMIT A KAPU NEM MÉR, kimondva:** a KIMENŐ riasztást nem süti el, ha valódi címzett van
beállítva — egy commit-kapu nem SMS-ezhet a tulajnak minden commitnál. A kihagyás **hangos**,
megnevezett okkal; a csatornát a ház kézi eszköze méri (`scripts/alert-drill.mts --go`).

### ⑤ KÉT SAJÁT HIBA, MINDKETTŐT EGY KAPU FOGTA MEG

⛔ **Egy egysoros import kitágított egy levezetett hatókört.** A `getEmailSender` behozatala a
`payment/service.ts`-be HÁROM modult rántott be az ADR-0070 i18n-hatókörbe
(`conversion/provision`, `tenant/multilangOrder`, `payment/siteShot`), és az `i18n-scope`
**jogosan** utasította el a commitot. ⭐ Nem a közös listát tágítottam ki három át nem nézett
fogyasztóra (`feedback_widening_a_shared_list_needs_per_consumer_decision`): a riasztás oda
került, ahol a riasztás amúgy is lakik — `console/payLinkAlert.ts`, ugyanaz a hibaosztály egy
lépéssel korábbról („pénz be, semmi ki, és a ház nem tud róla").

⛔ **Az ADR-szám a KOMMENTEKBEN is élt.** A 0194/0195 közben elkelt két párhuzamos szálnak,
miközben négy fájlom már hivatkozott rá — átszámozva, ellenőrzött 0 maradékkal
(`feedback_adr_number_can_collide_at_land`, immár ötödször ugyanez a fal).

### ⑥ AMI MÉG NYITOTT AZ ADR-0192 ⑧-BÓL

- ✅ **LEZÁRVA → ADR-0209 (2026-09-23).** **⑧.4** — a `rooms` bekapcsolása eltüntetheti a fizetett `amenities` szekciót. **Mérve: ma
  egyetlen tenant sincs ilyen állapotban**, de szintetikusan kiváltottam és a szekció valóban
  eltűnt. A dedup maga helyes (ADR-0059 §2). **Tulajdonosi döntés (2026-09-22): a tulajnak
  SZÓLNI kell** a Felszereltség lapon, hogy minden tétele a szobakártyákon van, ezért a külön
  szakasz nem jelenik meg. ⚠️ Ez FELÜLET → §2b terv-kör, külön menetben.
- ✅ **LEZÁRVA → ADR-0213.** **⑧.3** — a mock fizetőoldal upsellnél „éves előfizetés / Ft/év"-et ír egy időarányos
  EGYSZERI díjra, és nulla modulnevet (ADR-0175 ütközés). Nem javítva.
- ✅ **LEZÁRVA → ADR-0213.** **⑧.5** — a modul-előnézet ÍR (`ensureUnits` → `INSERT site_unit`), az ADR-0089 ④ ellenére,
  és az őre vak rá. Nem javítva; a `src/server/modulePreview.ts:5` komment ma is azt állítja,
  hogy „writes nothing".
