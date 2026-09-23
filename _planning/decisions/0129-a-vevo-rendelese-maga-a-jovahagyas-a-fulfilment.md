## ADR-0129 — A vevő rendelése maga a jóváhagyás: a fulfilment-kapu nem tagadhatja meg a fizetni akarót (2026-09-13)

**Dátum:** 2026-09-13 · **Státusz:** elfogadva (tulajdonosi döntés) · **Kapcsolódó:**
ADR-0095 (kurátori kapu), ADR-0111 (piac-kapu), ADR-0113 (a kapu az íráson),
03-INVARIANTS §B.17 (tényhűség).

**Kontextus.** Tulajdonosi bejelentés: a konfigurátor végén a vevő ezt kapta — „Rögzítettük a
választását (7 szekció). A fizetési linket e-mailben elküldjük" —, és a folyamat ott megállt.
A kérdés jogos volt: *miért nem vásárolhat, ha már odáig eljutott?*

**Mérve.** A „fizetési linkes" út nem terv, hanem a BUKÁS-ÁG: a rendes út a `payUrl`-re
irányít (`cit-configurator.js`). A `payUrl` azért hiányzott, mert a `requestPayment`
fulfilment-kapuja (ADR-0095, `payment/service.ts`) csak `approved` mockra ad linket — a leadé
`generated` volt. Az adatbázisban **3 beküldött `initial` rendelés ült egyetlen `payment` sor
nélkül**, és a beígért e-mailt **egyetlen kódsor sem küldi ki**: a jóváhagyás (`curateArtifact`)
nem ad ki linket a várakozó rendelésre, pay-link-levél pedig nem létezik. A ház jelzése egy
`console.warn` volt a szerver stdout-jában.

**Döntés.**

1. **A vevő rendelése MAGA a jóváhagyás.** A kurátori kapu azt őrzi, hogy *mit küldünk ki*.
   Mire a vevő a konfigurátorban a számlázási adatait begépeli és a fizetés-gombot megnyomja,
   ez a szerep betelt: a saját szemével látta azt a mockot, és pont azt kérte. A beküldés
   ezért `generated` → `approved` emelést végez, **a meglévő `curateArtifact` úton**
   (`decided_by='buyer_order'`, `notes='buyer_order:<orderId>'`), hogy a „egy leaden egy
   jóváhagyott mock" invariáns ne kapjon második, eltérő példányt.
2. **A `rejected` státusz ÉRINTETLEN.** Az a kurátor kimondott nemje a TARTALOMRA (pl. §B.17
   ténysértés). Egy visszautasított mockot élesíteni annyi lenne, mint a hibát a mockból a
   vevő éles honlapjára emelni. Ez az ág továbbra is megtagadja a pay-linket.
3. **Néma zsákutca nincs.** Ha bármely okból (visszautasított mock, átjáró-hiba, lezárt piac)
   nem születik pay-link, a szerver **azonnal riasztja az operátort** (`console/payLinkAlert.ts`
   — e-mail + SMS a `/settings` címzettjeire; címzett hiányában hangos hiba, nem csendes
   kihagyás), a vevő képernyője pedig **azt mondja, ami igaz**: a rendelést megkaptuk, a
   kártyát nem terheltük, és egy kollégánk felveszi vele a kapcsolatot. Az „e-mailben küldjük a
   linket" mondat addig nem térhet vissza, amíg nincs kód, ami tényleg elküldi (§B.17).

**Miért nem a másik irány.** Felmerült, hogy a kapu maradjon, és a bukás-ág „csak" legyen
őszinte + automatikusan utánküldő. Ez a vevőt várakoztatja egy olyan ellenőrzésre, amit ő már
elvégzett helyettünk azzal, hogy fizetni akar. A kapu eredeti célja — hogy gyenge mock ne
menjen ki — a KIKÜLDÉSNÉL teljesül, nem a pénztárnál.

**Őr.** `scripts/order-paylink-check.mts` — 14 állítás: a pozitív ág (pay-link, státusz-emelés,
audit-sor, payment-sor), a negatív ág (`rejected` → nincs link, nincs emelés, nincs payment),
a huzalozás (a promóció a `requestPayment` ELŐTT fut, a link nélküli ág riaszt) és a felirat
tényhűsége. Az önteszt **két külön követelményt** mér: ① a promóciót kihagyva vissza kell
jönnie a régi zsákutcának (különben az őr nem a javítást méri), ② a hazug szövegnek el kell
tűnnie a futtatóból. ⚠️ A huzalozás-ellenőrzés **kommentek nélküli forráson** mér: az első
változat a magyarázó kommentből olvasta ki a `requestPayment(` szót, és egy helyes sorrendet
mutatott pirosnak.

**Visszafordíthatóság:** 🔄 kód-szintű, adat-migráció nélkül. A `buyer_order` audit-sorokból
bármikor kilistázható, mely mockokat emelt jóvá vevői rendelés — a kurátor utólag is
felülbírálhatja őket.
