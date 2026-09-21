# 2026-09-21 — A szoba-kártya és a részletek-felugró: §2b kör, B változat jóváhagyva

**Szál:** `wt/citf049f1fe` · **Kontraktus:** `assets/design-refs/tenant-site/rooms-card/`
(README + `plan.html` + 5 kép, commit `6514d63`) · **Indított szálak:** 4 (lásd lent)

## A kérés (tulaj, két körben)

1. „A szobák modul kinézete legyen kártya típusú és kinyitható… a szoba modulnál alá csak a
   férőhely legyen. Ha rákattint a látogató, akkor ugorjon fel a szoba kártyája a leírással,
   képgalériával, felszereltséggel — ne csak leírás, hanem ikon is. A stílust a mockból kell szedni."
2. A B változat választása után: „**a képen valahogy látszódjon, hogy lehet kattintani** a
   részletekért. És ott is lennie kell galériának úgy, hogy **a nagy kép alatt a kicsik
   kattinthatóan**. Ha a nagy képre katt, **nagyba jöjjön fel**."

## A kiváltó lelet, ami a kérést igazolta

`src/tenant/editor.ts:310` — a leírás ÉS a felszereltség **egyetlen mezőbe** van összefűzve:

```ts
const note = [u.description, u.amenities.join(" · ")].filter(Boolean).join(" · ");
```

A vendég tehát egy mondatban kapja mindkettőt, megkülönböztethetetlenül. A kódban ott a
beismerés is: *„they ride the note line every template already renders — **no template edit**"* —
vagyis a kerülő út azért született, hogy ne kelljen 12 sablonhoz nyúlni.

## ⛔⛔ HÁROMSZOR a KÉP fogta meg, amit a gépi őr ZÖLDEN átengedett

Ez a kör önmagában igazolta a §2b 2. pontját („a képeket Read-del meg is nézed"):

1. **`display:flex` ÜTI a `[hidden]` attribútumot.** Egyetlen fotónál is kifestődött az
   indexkép-sáv (halott vezérlő), miközben az őröm `el.hidden === true`-t mért és zöldet adott.
   → **A KIFESTETT méretet kell mérni** (`getBoundingClientRect` + `getComputedStyle().display`).
   Ugyanaz az osztály, mint a `reference_console_photo_proxy` specificitás-csapdája.
2. **A DOM nem a képernyő.** A B/desktop felugrón a **9 felszereltségből NULLA** látszott
   görgetés nélkül — az őr `<li>`-t számolt, és 9-et jelentett. A kérdés az, hogy *a vendég
   előtt van-e* (`feedback_guard_greenly_defended_the_bug`).
3. **A magasság a STAGE-en ül, nem a galéria burkolóján.** A burkolón `height:260px +
   overflow:hidden` → a **68 px-es indexkép-sáv TELJES EGÉSZÉBEN a doboz alá esett** és
   levágódott. Vagyis a tulaj által kért galéria **nem is létezett** — a kérése fedte fel.

**Mindhárom állításra negatív kontroll fut**, és a javítás előtti állapoton pirosra ment
(mérve 4 · 1 · 1 bukással). A `100cqh` egység szintén hibás volt: `container-type:inline-size`
mellett a blokk-tengelyű cq-egység nem oldódik fel — a panel 141 px-rel túllógott, és a
**Foglalás gombot 106 px-rel kitolta a keretből**.

## ⛔ A contract-drift-check KÉT saját hibámat fogta meg a kontraktuson

1. **Rossz mappa.** Kitaláltam egy `assets/design-refs/public-rooms/`-ot, pedig a publikus
   tenant-felület terveinek helye a **`tenant-site/`** (ott él a `booking-price-clarity`, a
   `legal-footer`, az `enquiry-card`).
2. **Nem létező feliratot kötöttem.** A README `**„Amit ez az egység kínál"**` alakban jelölte
   KÖTŐ feliratnak azt, amit **még meg sem építettünk** — a kapu jogosan bukott.
   ⭐ **A szerkezeti tanulság:** egy kontraktus, ami a megvalósítás ELŐTT születik, nem
   jelölhet meg kötő feliratot; a jelölés a megvalósítás UTOLSÓ lépése, amikor a kapunak már
   van mit ellenőriznie. Ez bekerült a README ⑥ szakaszába, feladatként a megvalósító szálnak.
   ⚠️ Hatókör-sor is került rá: enélkül a kapu az EGÉSZ kódbázisban keres, és egy máshol élő
   felirat hamis zöldet ad — az őr ezt maga mondja ki magáról („⚠️ hatókör nélkül, gyenge").

## A terv — B változat („Két út")

A tulaj a két bemutatott változatból a B-t választotta: a kártyán **marad a Foglalás gomb**
(gyors út), mellette „Részletek" link; a felugró egyhasábos, szimmetrikus poszter.

**A fixture a TERMÉK forrásából épült**, nem kézzel: 4 valós `site_unit`, a site **saját
artdeco skinje** (a `:root` tokenek az élő lapról másolva, nem kitalálva), és a 17 tárolt
felszereltség-címke **mind pontos katalógus-találat** → valódi ikonok.

**Mérés:** 39 állítás zöld, **0 JS-hiba**, mobil ÉS asztali, valós adat ÉS kitöltött minta,
JS-sel ÉS JS nélkül.

⭐ **Két őszinteség-szabály a jelvényen:** hover-**független** (telefonon nincs hover, ott
sosem látszott volna), és **nem ígér galériát, ami nincs** — négy képnél „4 kép", egynél
„Részletek", soha nem „1 kép".

## A modul-függőségi rend (a kör másik fele — átadva)

A tulaj felvetésére (`pricing → rooms`, `booking → rooms + pricing`) mérés indult. Kiderült,
hogy a függőség **ma is létezik, csak deklarálatlanul** (ADR-0074 §5, ADR-0044/c §10), és hogy
a `ModuleDef`-en van `supersedes`, de **nincs `requires`**.

⛔ **Egy agent TÉVEDETT, és jó, hogy ellenőriztem:** azt állította, ár nélkül *nem jöhet létre*
foglalás. A kód (`src/booking/requests.ts:425`, `...(quote ? {…} : {})`) mást mond: a kérés
**létrejön**, csak `quoted_total` nélkül. A tulaj igaza tehát **üzleti, nem technikai** — és
ettől erősebb: ár nélküli foglalásnál a tulajnak kézzel kell minden kérésre árat válaszolnia,
ami a support≈0 elv ellen hat.

A felderítés külön szálba ment (→ **ADR-0192**), és ott a `amenities requires rooms` javaslatom
**megdőlt** (mérve: site-szintű adat, `rooms` nélkül hibátlanul renderel; katalógus-szintű
kötésként a KB-szócikk címét tette volna hazuggá).

## Indított szálak (4)

| Szál | Feladat | Eredmény |
|---|---|---|
| `wt/modulfuggoseg` | a függőségi rend **felderítése** (kód nélkül) | ADR-0192 + `05-MODULES.md` + éles DB mérés |
| `wt/arkapu` | ADR-0192 ⑧ két sürgős hibája | **ADR-0193** landolt; a maradék hatot viszi |
| `wt/modulreq` | ADR-0192 megvalósítása | katalógus + lint + szerver + Modulok fül landolt |
| `wt/szobakartya` | **ez a terv** megvalósítása | most indult a kontraktussal |

⚠️ **Az ütközést előre feloldottam:** a `modulreq` és az `arkapu` ugyanabba a kliens-JS blokkba
nyúlt volna (`adminViews.ts` ~1490-1560) — a sürgős szál landol előbb, a másik a sémával kezd
és rebase-el; konfliktusnál **a sürgős szál szövege a bázis**.

## Nyitott

- 🔴 **A tenant-admin szoba-szerkesztő §2b terv-köre** (kártyás/nyitható, helyben képfeltöltés
  a közös tárba, **borítókép-kijelölés**) — NEM készült el. A borítókép ma a hozzárendelés
  sorrendjéből jön, ami félrevezet.
- 🔴 **„Megvette, de üres":** 4 `pricing`-et fizető tenantból **3-nak nulla `unit_price` sora
  van** → a foglalás náluk ma sem mond árat. A modul-jogosultság és az ADAT megléte két külön
  kérdés; a figyelmeztetés helye eldöntetlen (ADR-0192 ⑨).
- ⚠️ A `sites/<eldorado>/uploads/szobak-terv.html` a dev gépen maradt (a tulaj ezen nézte a
  tervet a `:4800`-on) — törölhető.

## Mellék-tanulság

⛔ **A `land.sh` törli a `_drafts/`-ot** (§2b ⑥, ADR-0077) — és vele ment a terv generátora és a
39 állításos mérő. A `plan.html` önhordó volta mentette meg a helyzetet (a teljes CSS+JS benne
van), de **amit a következő szálnak át akarok adni, azt a land ELŐTT kell kimenteni**.
