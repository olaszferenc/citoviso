# 2026-08-31 … 09-03 — ADR-0088: listaár + ajánlat-réteg, éves váltás, ismétlődő kártyás megbízás

**Státusz:** LEZÁRVA, LANDOLVA (`057acc0`, `6fb5b48`, `7080fe2`, `7c565ba`, `9735911`,
`2b50854`, `39c58ec`). **ÉLESÍTVE NINCS** (§0.3 — külön engedély kell).

## Miből indult

Tulajdonosi ötlet: „kell egy új réteg az árazási mechanizmusba: **Listaárak**" — az első
mock-megkeresés a listaár −25%-án menjen ki, áthúzva mutatva; mérjük a látogatásokat, és a
3. megnyitásnál (ha nem vásárolt) menjen ki mélyebb kedvezmény; plusz **kupon** az új
előfizetőnek a következő vásárlására. Kérte, hogy előbb gondoljam át és mondjak véleményt.

## Amit a nulladik kör hozott (a vélemény-kör haszna)

- A viselkedés-mérés **már megvolt** (0003: `prospect`/`mock_view`/`mock_event`) — a trigger
  lekérdezés, nem új infrastruktúra. A „mi van már kész" felmérés két szálat is megrövidített.
- Négy nyitott kérdést tettem fel; a tulaj döntött: a kedvezmény az **ADOTT TRANZAKCIÓRA**
  szól; a trigger **szekvenciális** (oldali ajánlat → ha nem vásárol, e-mail); a kupon
  lejárattal és felhasználhatóság-számmal él; **kedvezmény SOSEM halmozódik**.
- Egy félelmemet a tulaj **elvetette** („a leadek nem beszélnek egymással… életszerűtlen") —
  helyesen; a határidő indoka nem védekezés, hanem hogy a lejárat nélküli ajánlat csak egy
  újabb halasztható dolog. A tanulság: a kockázat-érvet is meg kell mérni, nem elég félni.

## Amit építettünk (ADR-0088 ①–⑨)

1. **Listaár = a `pricing_config` árai** — VALÓS, fizethető ár: a publikus honlapon direktben
   rendelő ezt fizeti. Ettől becsületes az áthúzás (§B.17 az árazásra).
2. **`offer` entitás (0045)**: kind (outreach/escalation/coupon/campaign), százalék, hatókör,
   lejárat, `max_uses`/`used_count`, EGYSZERI-séget védő parciális unique indexek. Feloldás:
   **az EGY legnagyobb aktív százalék**, sosem összeadva. `order_intent.offer_id/list_price` →
   a konverzió hordozza, MELYIK ajánlattal zárt (enélkül a kampány hatása mérhetetlen).
3. **Outreach-jogosultság SZÁRMAZTATOTT** a `prospect.sent_at` pecsétből — nem küldőnként
   bekötve. Így a self-serve/direkt út **szerkezetileg** listaáras marad, és minden ÚJ
   küldő-csatorna automatikusan fedve van (feedback_guard_scope_is_the_doctrine tanulsága
   alkalmazva: ne a fájlt tedd a listára, a listát tedd származtatottá).
4. **Eszkaláció**: 3. látogatás vásárlás nélkül → egyszeri, 72 órás −50%; a felületen döntés-
   kártya élő visszaszámlálóval, majd 24h után follow-up levél a napi billing-ticken.
5. **Kupon**: fizetéskor automatikus üdvözlő kupon; érvényesül a multilang egyszeri vételnél
   ÉS a B-opciós modul ELSŐ díján a megújuláskor — de csak azon a soron, az alap listaáron újul.
6. **Éves váltás (§8, 0046 `pending_period`)**: a kifizetett időszakhoz nem nyúlunk, nincs
   arányosítás; a váltás a KÖVETKEZŐ fordulónaptól él. A már kiállított havi számla nem nyeli
   el a váltást (az azutáni fordulótól él — a kártya ezt a dátumot mondja).
7. **Ismétlődő kártyás megbízás (⑨)**: a MÉRÉS azt hozta, hogy a gépezet **ADR-0080 ④ óta
   ÉL** (token + 3DS-trace + MIT-terhelés + díjbekérő fallback) — de a vevőnek soha nem
   mondtuk ki, és nem tudta visszavonni. ÁSZF 1.0→1.1, checkout-hozzájárulás **pecsételve**
   (0047), admin-blokk + **kétlépéses** visszavonás (tulaj kérése: megerősítő ablak a
   hátrányokkal), `revokeAutoCharge` a tokent TÖRLI (nem letiltja).

## Felület-kapuk (§2b) — három kör, mind végigfutva

`design-refs/console/offer-ui` (B: ár-kártya + visszaszámláló) ·
`…/period-switch` (B: megtakarítás-doboz) · `…/mandate-coupon` (B + megerősítő ablak).
Mindháromnál: működő mock → ui-shot 390+desktop → saját szemmel megnézve → tulajnak elküldve
(HTML + mindkét méret képei) → jóváhagyás után `surface-gate approve` → kód → kontraktus-fagyasztás.
⭐ A kaput egyszer **magamtól zártam vissza** (`surface-gate clear`), mert az előző kör
jóváhagyó tokenje még nyitva állt egy MÁSIK felületre — nyitva hagyva az őr nem védett volna.

## Amit a MÉRÉS talált meg, nem a szemem

- ⛔ **Egymásba ágyazott `<form>` = NÉMA bukás.** A megerősítő ablak űrlapja a modul-űrlapon
  belülre került; a böngésző eldobta, és az „Igen, visszavonom" gomb a MODUL-űrlapot küldte:
  a megbízás nem szűnt meg, a felület viszont sikert mutatott. A DB-állapotot is ellenőrző
  élő teszt fogta el. Megoldás a repó saját mintája (külső üres form + `form=` hivatkozás),
  ami a no-JS utat is életben tartja.
- ⛔ **Periódus-vak delta.** Éves számlán a modul-kapcsoló +490 Ft-ot írt volna oda, ahol
  valójában +4 900 Ft a különbség → `data-mult` a számla saját periódusára (§B.17).
- ⛔ **A kupon némán érvényesült**: a szerver beárazta, a tulaj nem tudott róla → nem adott el
  semmit. Most kupon-kártya + áthúzott ár a kirakatban.
- ⛔ **A `configurator-price-check` kapu külső kép-CDN-től bukott** (picsum kiesés → minden
  commit blokkolva). A kapu az ÁR-viselkedést méri, nem a képeket → `domcontentloaded`.

## Szándékos eltérés a jóváhagyott tervtől (kimondva, nem csendben)

A mandátum-mockban volt „Automatikus terhelés bekapcsolása" gomb. **Nem építettem meg:**
a kártyaséma a tárolt hitelesítőt 3DS-kihívott, VEVŐ-INDÍTOTT fizetéshez köti, tehát egy
kattintással nem adható újra megbízás — a gomb hazugság lett volna. Helyette a blokk kimondja,
hogy a következő fizetési link kiegyenlítése adja meg újra. A kontraktus-README rögzíti az okot.

## Őr-körök

- jog/provenance-őr: a hideg levél ár-mondata PASS; a follow-up küldő először **FLAG**
  (hiányzó törzs-szintű feladó-blokk + kimaradt §C-kapu az ÚJ küldő-úton) → javítva → PASS.
- tudásbázis-őr: a KB-szakasz először **FLAG** (feltétel nélküli dátum-ígéret a peremesetre +
  hiányzó screenshot) → javítva (peremeset-mondat + script-generált kép) → PASS.

## Módosított/új fájlok (fő tételek)

`migrations/0045_offer.sql`, `0046_subscription_pending_period.sql`,
`0047_recurring_mandate_consent.sql` · `src/payment/offers.ts` (új),
`service.ts`, `billing.ts`, `subscription.ts` · `src/console/{server,data}.ts` ·
`src/generator/configurator.ts` · `assets/runtime/cit-configurator.{js,css}` ·
`src/server/{adminViews,public}.ts` · `src/tenant/{subscriptionAdmin,multilangOrder}.ts` ·
`src/outreach/{draft,escalationFollowup}.ts` (utóbbi új) · `src/legal.ts` (ÁSZF 1.1 +
`RECURRING_MANDATE_V1`) · `src/ui/icons.ts` · `public/assets/ui/citui-admin.css` ·
`scripts/{offer-selftest,period-switch-selftest,recurring-mandate-check,kb-shot,
configurator-price-check,billing-cycle}` · `kb/entries/admin-{subscription,modules}/` ·
`assets/design-refs/console/{offer-ui,period-switch,mandate-coupon}/`

## Nyitott / következő

1. **③ sandbox-igazolás (a tulajra vár):** egy kártyás sandbox-checkout a 3DS-kihíváson át,
   utána `recurring-mandate-check.mts status <tenant>` → `charge <tenant> --now=<fordulónap>`.
   A `config` futás ZÖLD (Barion + kívülről elérhető visszahívási cím).
2. **Élesítés-kötés:** az ÁSZF 1.1 és a mandátum-felület **EGYÜTT** kell hogy kimenjen — az
   ÁSZF azt ígéri, hogy a megbízás az adminban visszavonható.
3. Kampány-ajánlatok operátori felülete (a `kind='campaign'` ág ma csak adat-szinten él).
