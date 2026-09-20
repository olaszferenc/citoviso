# 2026-09-20 — A megkeresés linkje a vásárlás után nem árul (ADR-0191)

## A bejelentés

Tulajdonosi dev-teszt: *„a megkapott megkeresést, ha a lead azután is megnyitja, hogy
már vásárolt, akkor újra megveszi magának… ez így nagyon gáz."* Javaslata: vásárlás
után már csak az admin oldala nyíljon meg.

## Amit mértem (a kár MÁS volt, mint amit a bejelentés sugallt)

A `/p/<token>` (`src/console/server.ts`) feltétel nélkül kiszolgálta a mockot, a
konfigurátort és a fizetés-lapot. Három kapu ült a rendelés-úton (jóváhagyott mock,
piac-kapu, fotó-jog), **egyik sem kérdezte meg, hogy a lead már ügyfél-e**.

A reflexem — és a felderítő ágensemé is — az volt, hogy „az aktiválás majd elhasal a
`tenant.lead_id` UNIQUE-on". **Téves.** Végigmérve a MÁSODIK fizetést:

| lépés | eredmény |
|---|---|
| `convertLead` (`provision.ts:196`) | idempotens a `lead_id`-ra → nem hibázik |
| `ensureSubscriptionForOrder` (`subscription.ts:108`) | `onConflict(tenant_id).doNothing()` → a fordulónap NEM tolódik |
| `issueAndSendTenantLogin` (`service.ts:983`) | `existingLogin` ág → nincs új hozzáférés |
| `issueInvoice` (`service.ts:787`) | **valódi számla áll ki** |

Tehát: **fizet, számlát kap, és semmit nem kap** — még hosszabb előfizetést sem. A jó
hír: a tulaj admin-szerkesztései túlélnék (`rerenderTenantSnapshot` az `overrides`-ból
dolgozik) és a jelszava sem íródna felül.

Az érintett lead a tulaj tesztjében az **Aranykagyló 36** volt, amelynek aznap 12:52-kor
már volt `paid` `initial` fizetése — vagyis pontosan a „már fizetett" esetet mérte.

## §2b kör

Két változat (V1 csendes / V2 megerősítő pipás), mindkettő a **VALÓDI** Aranykagyló-mockra
injektálva, mobil+asztali képpel és kattintható HTML-lel. A tulaj: **„már a tiéd sáv +
admin bejelentkezés"** → V2, dátum nélkül (a V1/V2 és a dátum az én javaslatom volt,
kimondva, egysoros visszaváltással).

## Szállítva

- `src/conversion/owned.ts` — **egy predikátum, két hívó** (képernyő + pénz-út).
  Két lába van: tenant VAGY fizetett `initial`. A második a fontosabb: a megakadt
  aktiválású vevő FIZETETT és nincs oldala — pont ő nyitja meg újra a levelet.
- `src/payment/service.ts` — `requestPayment()` megtagadja az `initial` pay-linket.
  **Ez a valódi javítás:** nincs pay-link ⇒ nincs terhelés.
- `src/console/server.ts` — `handleOrderRequest` a rendelés RÖGZÍTÉSE ELŐTT tilt
  (különben `order_intent` + operátori riasztás keletkezne egy nem-problémából), és a
  `/p/:token` GET harmadik keretezési ága.
- `src/console/prospectNotice.ts` — `injectOwnedBanner` + `injectOwnedNotice`.
- `assets/runtime/cit-configurator.js` — `already_owned` ág (régen nyitva hagyott fül).
- `scripts/prospect-owned-check.mts` + pre-commit bekötés.

## Saját hibák, mind a saját mérésem fogta meg

1. **Az állításom a SAJÁT szövegemre illeszkedett:** a „nincs vásárlási hívás" a
   `Megrendel` szóra mért, és a sávom „Megrendelve: …" feliratára ment pirosra egy
   hibátlan lapon → átkötve a konfigurátor valódi horgonyára (`data-cit-configurator`),
   negatív kontrollal.
2. **`position === "static"` hamis piros** az `aurora`-n (`body>*{position:relative}` —
   a sáv relatív lesz, de FOLYAMBAN marad) → geometria + `elementFromPoint`.
3. **A nyers „minden elem a sáv alatt" is hamis piros** volt: a fullbleed `nav.t-nav`
   fixed/top:-10, de görgetés előtt nem látszik → csak a FOLYAMBAN lévő, látható
   tartalomra szűrve.
4. **A §2b méret-váltóm asztali módban csak a helyet töltötte ki**, így a tulaj
   telefonján az asztali elrendezést SOHA nem mutatta volna → 1280 px viewport
   kicsinyítve, igazolva 390 px-en.
5. **`hostOf()` levágta az útvonalat:** „az oldala él: `100.97.188.105:4800`" — olyan
   cím, ahol az oldal nincs (dev `/t/<slug>` út) → `prettyUrl()`.
6. **A belépés-URL-t magam gyártottam** (`siteUrl + "/login"`), pedig az mérve 302-vel
   a kanonikus `TENANT_LOGIN_URL`-re dob → egy meglévő szabály második példánya lett
   volna.
7. **Hamis ADR-hivatkozást írtam** (ADR-0126 helyett ADR-0135) — ellenőrzés után javítva.
8. **Eltörtem egy IDEGEN őrt** (`market-gate-check`): a fixture-je a megújulás-ág miatt
   azonnal tenantot csinált ugyanarra a leadre, így a három `initial` ág „már vásárolt"
   leaden futott, és az őr a piac-kapu helyett az enyémet mérte. A tenant most közvetlenül
   a megújulás-ág előtt születik. **A commit-kapu fogta meg, nem én** — és először némán,
   mert a `git commit | tail` a cső exit-kódját adta vissza (exit 0 egy BUKOTT commitra).

9. **Az őrömnek kimondatlan, munkafa-függő előfeltétele volt** — a `mock_artifact.path`
   puszta fájlnév, a fájl a FŐ FA gyökerében fekszik, tehát munkafában 404. A land ezen
   bukott el; az őr most legyártja és eltakarítja a hiányzó fájlt.
10. **Kétszer nyelte el a hibát a saját parancsom:** a `git commit … | tail` a CSŐ
    exit-kódját adta (exit 0 egy bukott commitra), a land után pedig a záró `echo`-m
    adott 0-t. A kimenet fájlba, és az exit-kódot a valódi parancstól kell kérni.

## Nyitott

- A süti-sáv a már vásárolt lapon is azt írja, hogy *„A biztonságos kártyás fizetéshez
  a fizetési szolgáltatónk (Barion) csalásmegelőző sütiket használna"* — ezen a lapon
  már nincs fizetési út. Nem nyúltam hozzá (consent-szöveg, külön kör).
- A KB nem kapott új entry-t: az `owned` lap a vevőnek szól, nem a tenant-adminnak.
  Ha kell, külön kör.
## Élesítve — 2026-09-20 21:38

`prod/20260920-2138` = `91b856d` (előtte `4a59e13`). 7 commit ment ki, ebből 4 idegen
(fizetés-visszaigazoló ADR-0190, mock-kártyák ADR-0189, doksi) — a tulaj kimondottan
jóváhagyta, hogy a VERZIÓ megy, nem válogatás. Migráció nem volt.

**A deploy-kapu kétszer megállított, mindkétszer jogosan:** a KB-verdikt FLAG-et adott
(először 3, majd további 2 lelet). A négyből kettő az ADR-0189 szál adóssága volt (az a
commit NULLA `kb/` fájlt érintett), a többi az enyém — a harmadik keretezési állapottal
hamissá tettem egy számosság-állítást, majd a javításom csak a `live` alágra volt igaz,
és rosszul írtam le az „előnézet ▸" helyét. A label-drift őr KÉTSZER fogott meg ugyanazon
a mintán: teljes mondatot idéztem félkövéren olyan szövegből, amit a kód két darabból rak
össze — így a súgóban olyan felirat állt volna, ami a képernyőn sosem jelenik meg.

**Élesben igazolva** (nem a deploy zöldjére hagyatkozva): `/p/<token>` → HTTP 200, owned
sáv ott, konfigurátor 0, belépés-gomb ott, **`mock_view` 5 → 5** (tehát a „nem rögzítjük"
igaz élesen is); a predikátum mindkét irányban helyes (2 vásárolt lead → pay-link
megtagadva, kontroll-lead → engedélyezett).

Visszagörgetés: `deploy-prod.sh 4a59e13 --go`.

## Nyitott (élesítés után)
