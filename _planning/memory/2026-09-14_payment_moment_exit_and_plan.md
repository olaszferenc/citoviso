# 2026-09-14 — A fizetés pillanata: a kiút, a három cím, és egy jóváhagyott terv, ami sosem épült meg

**Szál:** `wt/fizetespillanat` (B1 blokk, Elek FK-005a + FK-005b, ~30 lelet)
**Állapot:** a kinézeti rész a **§2b terv-kapunál MEGÁLLVA** (`TERV-KESZ.md` a munkafa gyökerében,
`assets/design-refs/_drafts/` alatt két működő mock + 16 kép). Az apró javítások landolva.
**Élesítés NINCS** (§0.3 — külön, kimondott engedély kell hozzá).

---

## A legfontosabb lelet: a fő-hiba egy MEG NEM ÉPÍTETT, MÁR JÓVÁHAGYOTT TERV

A blokk headline-ja az volt, hogy „nem derül ki, MIT veszek”. Mérve a valós renderelt panelen
(`renderSite → injectRuntime → injectConfigurator`, 390 és 1280 px): a fizetés-lépés szövegére
`mentionsSiteName: false`, `mentionsSectionCount: false` — a képernyőn egyedül „Fizetés / 2/2 lépés”.

**De a 2026-09-11-én jóváhagyott kontraktus ezt már megrajzolta.**
`assets/design-refs/configurator/checkout-fullscreen/plan.html` **215–220. sor**: megnevezett
tétel-blokk (szállásnév + „Citoviso honlap — éves előfizetés…” + listaár + kedvezmény-sor).
A szállított `cit-configurator.js`-ben ennek **nulla nyoma**.

⛔ **Miért nem fogta kapu:** a `contract-drift-check` a README-ben **idézőjelbe tett feliratokat**
őrzi. A tétel-blokk nem volt kötő feliratként kimondva, tehát a kapu nem tévedett — **nem is
kérdezte**. Ugyanaz az osztály, mint [[feedback_a_contract_promise_needs_a_guard]]: az ígéret és a
szállítás között nem volt mérés. **Tanulság: a kontraktus README-jének NEM csak feliratokat kell
kötnie, hanem a terv SZERKEZETI elemeit is** (legyen olyan horgony, amit mérni lehet).

Emiatt a terv-körben az „A” változat **nem javaslat, hanem a már jóváhagyott terv befejezése** — és
ezt a tulajnak ki is mondtuk, hogy ne egy újabb dizájn-kérdésnek olvassa.

---

## Amit javítottam (apró/nem-kinézeti rész, a BRIEF kimondott kivétele alapján, a kapun naplózva)

### ① A sikeres lap egyetlen továbblépése nem volt gomb — és forrás-grep erre VAK

`src/console/views.ts:1804` — `class="btn"`. A `.btn`-nek **nulla szabálya** van mind a négy
konzol-stíluslapon. Renderelve, betöltött CSS-sel mérve: `background-image: none`, `padding: 0px`,
`border-radius: 0px`, 14 px cián — **bájtra ugyanaz, mint a három sorral lejjebb álló mailto-link**.
Egy fizető vevő legfontosabb gombja megkülönböztethetetlen volt a lap leghalkabb elemétől.

⭐ **A saját kódunk 80 sorral feljebb már kimondta** (`payResultPage` bukás-ága, 1735–1737: „`.btn`
has NO rule in the console stylesheet”) — a javítás megszületett, de csak az egyik ágon.
**Osztály:** ha egy hibát komment szintjén felismerünk, azonnal grepelni kell a testvér-ágakra.

### ② Három képernyő beégetett `info@citoviso.com`-ot írt ki — egy nem létező címet

`views.ts` 1738/1764/1806. Ez a literál a **konfigurációban sehol nem szerepel**:
`OUTREACH_SENDER_EMAIL` = `LEGAL_ENTITY_EMAIL` = `olasz.ferenc@citoviso.com`, és a tenant-admin a
konfiguráltat írja ki. **Az elutasított kártyájú vevőt tehát egy olyan címre küldtük, ahonnan nem is
írunk** — pont azon a képernyőn, ahol a legvalószínűbb, hogy ír.

Javítás: `supportEmail` a hívótól (`config.outreachSender.email || config.legalEntity.email`), egy
`helpLine()` mind a három ágra. ⛔ **Fail-closed:** cím hiányában a mondat **elmarad**, nem cserélődik
ki egy hihetőre (§B.17) — és az őr ezt külön fixture-rel méri.

### ③ Az átjáró kétszer mondta ki ugyanazt — és a kettőzés FELE TEHERHORDÓ volt

`payMockPage`: a `paid` ágon „Ez a fizetés rendezve van.” **és** „Ez a fizetés már rendezve van — új
terhelés nem indítható rajta.”; a `failed` ágon „…terhelés nem történt.” kétszer.

⛔⛔ **Mindkettőt töröltem, és a `paid` ág PIROSRA vitte a `module-purchase-state-check`-et.**
Megmérve, miért: **két KÜLÖNBÖZŐ fogyasztó rögzíti a két felet, két KÜLÖNBÖZŐ literállal, ugyanazon
a képernyőn:**

| fogyasztó | követelt szöveg |
|---|---|
| `scripts/module-purchase-state-check.mts:370` | „Ez a fizetés **már** rendezve van” (dupla-terhelés elleni védelem) |
| `elek/scenarios/FK-005b-payment-failure-matrix.md:74` | „Ez a fizetés rendezve van” (**„már” nélkül**) |

**Egyik sztring sem tartalmazza a másikat**, tehát egyetlen mondatba összevonva bármelyik
megfogalmazás eltör egy fogyasztót. Vagyis a „felesleges ismétlés” valójában **két őr metszete**.

**Amit tettem:** a `paid` ág kettőzését **visszaállítottam**, a `failed` ágét (amire nincs
fogyasztó) meghagytam törölve. A saját őröm ③ állítása ezért **nem** egyszeri-említést követel,
hanem **mindkét literált kitűzi** — hogy a következő takarítási kísérlet hangosan és **egy helyen**
bukjon el, ne két könyvtárral odébb. A kommentbe is bekerült, a hivatkozásokkal együtt.

⭐ **Tanulság:** a „kettőzött mondat” a legártatlanabbul kinéző apró javítás — és ez volt az egyetlen
tételem, ami nem volt apró. Előtte grepeltem a fogyasztókat, de **csak a megmaradó** mondatra; a
TÖRÖLTRE nem. [[feedback_label_change_breaks_its_quoters]] fordítottja: nem az átírt felirat
idézőit kell keresni, hanem **a törölt szövegét is**.
⚠️ Mellékes, de idő ment rá: a `module-purchase-state-check.mts`-re a `grep` NÉMÁN semmit nem ad
vissza (a `file` szerint `data`, nem szöveg) — a keresést Pythonnal kellett elvégezni.

### ④ A többnyelvű visszaigazolás tagadta és ígérte az e-mailt — két egymást követő mondatban

„…e-mailt nem küldünk róla külön.” ↔ „A számláját e-mailben küldjük…”. **Az alany hiányzott:** a
*fordítás elkészültéről* nem küldünk külön értesítőt; a számla-levél más üzenet.
⚠️ A nyitó tagmondatot (`A fordítás elindult`) az `elek/scenarios/FK-005b-payment-failure-matrix.md`
**szó szerint idézi** — grepeltem előbb, és változatlanul hagytam
([[feedback_label_change_breaks_its_quoters]]).

### ⑤ A panel-fül csak `aria-label`-t viselt

`cit-configurator.js` — egérrel semmi nem mondta meg, mit csinál. `title` hozzáadva. A *látható*
felirat kérdése kinézeti döntés → a terv-körben maradt.

---

## Az őr: `scripts/pay-exit-truth-check.mts` (31 állítás, pre-commit, piros önteszt)

**Amit szándékosan NEM hisz el:**

- ⛔ **Nem forrás-grep.** Az ① a forrásban láthatatlan: a `class="btn"` gombnak *néz ki* a kódban.
  Az őr a **renderelt, stíluslappal kiszolgált** lapot méri (Playwright + `page.route` a
  `public/assets/**`-ra), és külön állítja, hogy **a stíluslap tényleg betöltött** — enélkül az
  egész kapu vak lenne.
- ⛔ **Nem `getComputedStyle().backgroundColor`-ból számolt kontraszt.** Az első változatom pont
  ezt tette, és **minden elemre, minden lapon egységesen 1-et adott**: a gomb gradienssel van
  festve, tehát a `backgroundColor` átlátszó, és a szonda átlépett rajta a mögötte lévő kártyára.
  Egy ilyen szám zölden igazolt volna egy valódi regressziót. ⭐ Helyette **szerkezeti ÉS
  differenciális** a verdikt: a kiút legyen kifestett, legyen valódi kattintó-felülete, és
  **ne nézzen ki ugyanúgy, mint a mellette álló sima linkek** — pontosan az a tulajdonság, ami
  elromlott. Az önteszt erre `3 azonos megjelenésű` linket jelent.
- ⛔ **A küszöb nem a szállított értékre van húzva.** A kattintó-felület küszöbe 44 px (platform-
  minimum); a helyes gomb 52, a törött link 16. ([[feedback_barely_passing_value_hides_a_dead_rule]])

**⛔⛔ És egy hiba, amit magam csináltam az őrben:** az első öntesztem **zöld sort adott egy
szabályra, amit soha nem próbált ki** — a `gw-failed` visszarontásom nem illeszkedett, így a
„kettőzött mondat” állítás önteszt alatt is zöld maradt. Vagyis az őr azt állította magáról, hogy
tud pirosra menni egy olyan szabályon, amin nem is mérték meg. Javítva: **minden visszarontás
ellenőrzi, hogy tényleg megváltoztatta-e a bemenetet**, és hangosan kilép, ha nem. A ④ szabály
forrásból mér, ezért az önteszt a **forrás-szöveget** rontja vissza. Végeredmény: 13 sértés az
önteszten, mind a négy szabály-csoportból.

Az őr egy korábbi állítása **pirosra ment a HELYES kódon**: függőleges belső margót kért, a
`citui-btn` viszont magassággal old (padY = 0, magasság 52). A mérce a **kattintó-felület** lett.

---

## A terv-kör (megállítva, jóváhagyásra vár)

Két önhordó, **működő** mock a munkafán belül (`assets/design-refs/_drafts/`, gitignore-olt):

- `fizetes-lap.html` — a fizetőoldal **3 változata** (A = a jóváhagyott tétel-blokk befejezése ·
  B = + mi van a csomagban, tételes bontással · C = + a megvett oldal azonosítója).
- `fizetes-atjaro-bukas.html` — az átjáró és a bukás-lap **2 változata** (terelő vs. egyenrangú).

Méret-váltó `@container`-rel, a viewportból indul. Valós szabályok: a `base 3 900 Ft` + a valódi
modul-árlista, `annualTotal = monthlyTotal × (12 − 2)`, a pipa-kapu csak a **képernyőn lévő** sorokat
számolja (cég ágon 0/2). 23 + 20 kattintás-állítás zöld mindkét méreten, 0 JS-hiba.

**Amit a mockok mind a hármban rögzítenek** (nem választás kérdései — mért hibák): a „/hó” felirat
éves előválasztás mellett (a kártya 9 990 Ft-ot írt, a vevő aznap 74 925-öt fizetett, utána
99 900/év — 7,5× és 10×) · a tiltott gomb márka-kék maradt, egyedüli jele `opacity:.6` · az elállási
pipa számítva **azonos** volt a másik kettővel (`[data-c="withdrawal"]`-ra egyetlen CSS-szabály sem
létezik) · nincs kötelezőség-jelölés · a görgetés-jelzés a „Teljes név” mezőre csúszott · mobilon
kétszer állt a „Fizetés” · asztalon az alsó ~28% üres.

### ⛔⛔ Amit a KÉP fogott meg, és a kattintás-teszt NEM

Az első vázlatomban a görgetés-jelzést a **görgetett tartalom végére** tettem (hogy ne takarjon
mezőt). Minden kattintás-állítás zöld volt: az elem létezett, nem volt `hidden`. **A képernyőképen
látszott, hogy soha nem látható** — csak akkor bukkan elő, ha a vevő már legörgetett, azaz pontosan
akkor, amikor már nem kell. Javítva: a zónához rögzítve, a görgőnek fenntartott 40 px hellyel.
**Ez a §2b „nézd meg a saját szemeddel” lépésének a tiszta igazolása.**

Két további saját hiba, amit a mérés fogott: a `.legalwide` blokkot egy **`display:none` felülírás a
`@container` UTÁN** tüntette el (azonos specificitás, később nyer) · a vázlat ezredes-elválasztója
nem-törő szóköz volt, a terméké sima — a mock a **valódi** szabályt tükrözze, ne egy szebbet.

---

## Nyitott

1. **A tulaj döntése:** melyik változat a fizetőoldalon (A/B/C) és az átjárón (A/B); lehet-e a
   tiltott gomb teljesen szürke; C esetén kiírható-e a leendő webcím a fizetés ELŐTT.
2. **Asztali A-n a görgő 13 px-t csordul túl** (B: 125, C: 86) — az „asztalon minden egy nézetben”
   A-n sem teljesül maradéktalanul. Mérve, nem szépítve.
3. **A `contract-drift-check` csak feliratot köt** — a jóváhagyott tervek SZERKEZETI elemeire
   (mint ez a tétel-blokk) nincs kapu. Külön szál.

Kapcsolódó: [[project_checkout_fullscreen]] · [[feedback_approved_draft_is_the_contract]] ·
[[feedback_a_contract_promise_needs_a_guard]] · [[feedback_link_rule_eats_button_label]] ·
[[feedback_recorded_failure_must_not_grade_green]] · [[feedback_label_change_breaks_its_quoters]]
