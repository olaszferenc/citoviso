# Fizetés-elmaradás: fagyasztott állapot és visszakapcsolás — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-11, tulajdonosi választás: **A változat — „Teendő-kártya"**, a
vendég-lapon a „nézzen vissza holnap" szöveggel. ·
**Kapcsolódó:** ADR-0080 ⑤⑥ (dunning-létra, freeze ≠ eltűnés), 03-INVARIANTS §B.17
(tényhűség), Elek FK-006a/FK-006b.

`freeze-state-A.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** Ami itt
viselkedés, azt a kódnak produkálnia kell; a kész felületet ehhez mérjük (ui-shot,
mobil 390 + desktop), és a `scripts/frozen-state-check.mts` őr ezt kényszeríti ki.

## Miért létezik

Mérve (2026-09-11, Elek FK-006a/b, ELEK-TESZT park, a renderelt HTML-en számolva):
a `tab=modulok` **egyetlen lapon** egyszerre állította, hogy a honlap **fel van
függesztve**, hogy a tulajnak **„nincs teendője"**, és hogy a honlap **„elérhető
marad"** — miközben **11 modul** azt írta magáról, hogy *„Aktív az oldalán."*, a vendég
pedig 503-at kapott. A fizetendő összeg **sehol** nem szerepelt a lapon; a látható
számok a jövőre szóltak. A visszakapcsolás után a legfrissebb üzenet változatlanul a
*„Honlapja felfüggesztve"* maradt.

**A hiba nem a banner hiánya volt — a banner megvolt. A hiba az, hogy a lap többi része
nem tudott róla.** Ezért a terv nem egy új doboz, hanem egy ÁLLAPOT, amit minden érintett
felirat követ.

## Amit a terv KÖT

1. **Egy képernyő nem állíthat két ellentétes dolgot.** Felfüggesztés alatt a lapon
   SEHOL nem szerepelhet a „nincs teendője", az „elérhető marad", sem az „Aktív az
   oldalán". Gépi kapu: `scripts/frozen-state-check.mts` (negatívan is futtatva).
2. **Teendő-kártya a lap tetején**, piros kerettel és fejléccel: *„A honlapja jelenleg
   NEM elérhető"*.
   - **A tartozás összege a képernyő legnagyobb száma** (`99 900 Ft` mérettel, nem a
     „Következő számla" cella), fölötte a „RENDEZENDŐ TARTOZÁS" címke, alatta az
     időszak, amiért jár.
   - Közvetlenül alatta **egyetlen kitöltött gomb: „Befizetem — {összeg}"**. ⛔ Ez nem
     keveredhet új vásárlás gombjával, és nem kerülhet a lap aljára.
   - **Asztali**: kétoszlopos — balra a magyarázat, jobbra kiemelt mezőben a pénz és a
     gomb. **Mobil**: a pénz és a gomb ELÖL, a magyarázat utána (a tulaj telefonon
     nézi; a döntéshez szükséges rész ne legyen görgetés mögött).
   - Tényközlő felsorolás: mit lát most a vendég · **meddig rendezhető** (T+30 dátum,
     utána az előfizetés lezárul és a honlap lekerül) · hogy a modulok megmaradnak.
3. **Az automatikus kártyaterhelés blokk fagyás alatt igazat mond:** „NEM SIKERÜLT" +
   *„Az automatikus kártyaterhelés elakadt"* — ⛔ a „BEKAPCSOLVA … nincs teendője"
   ebben az állapotban tilos.
4. **A modulok nem állítják magukról, hogy aktívak**, amíg a site `suspended`:
   soronként *„Szünetel — a felfüggesztés alatt a vendégek nem látják."*, „szünetel"
   jelvény, és a lista élén egy mondat, ami kimondja, hogy az előnézet **csak a
   tulajnak** mutatja meg őket.
5. **A vendég emberi lapot kap** (503 + `Retry-After`, `noindex` marad):
   **szállásnév**, település, *„Ez az oldal most átmenetileg nem érhető el. Dolgozunk
   rajta — kérjük, nézzen vissza holnap."*, és a szállás **saját, vendégnek szóló
   elérhetősége** (e-mail / telefon / cím — amelyik megvan; hiányzó mező egyszerűen
   kimarad). ⛔ A lap **NEM árulja el az okot**: díj, tartozás, felfüggesztés szó nem
   szerepelhet rajta — az a szállásadót járatná le a vendége előtt.
   A forrás a szállás SAJÁT site-adata (`mock_artifact.inputs.siteData.contact` +
   `site.edited_site_data`), **nem** a `tenant_legal` számlázási identitás.
6. **A visszakapcsolás legalább olyan hangos, mint a fagyasztás**: a teendő-kártya
   helyén zöld megerősítés áll (*„A honlapja újra elérhető"*, a befizetett összeggel és
   a dátummal, „Megnézem az oldalamat" gombbal), **és**
7. **a felfüggesztés-szál lezárul**: a visszakapcsolásról üzenet keletkezik, ezért a
   legfrissebb üzenet a VISSZATÉRÉS lesz — a „Honlapja felfüggesztve" nem maradhat a
   feed tetején.
8. **A lejárt foglalási kérésről a tulaj értesítést kap**, és a sor nem állít döntést,
   amikor épp a döntés hiánya történt: *„Nem érkezett válasz — a kérés {dátum}-én
   magától lejárt. A vendégnek elküldtük az értesítést."* ⛔ A korábbi „döntés: {dátum}"
   felirat tilos lejárt kérésen.
9. **Minden vevő- és vendég-oldali felirat i18n-csomagból** jön (`T(d, …)` / `tr(…)`),
   a vendég-lap **magázódik**.

## Amit a terv NEM köt

A teendő-kártya alatti panelek (Előfizetés, Az én moduljaim, Üzenetek, Foglalások)
sorrendje és belső elrendezése változatlan marad — a terv csak a feliratokat és az
állapotot köti rajtuk.

## Elvetett változatok (miért)

- **B — „Állapot-sáv minden fülön"**: kevesebb helyet foglal és mindenhol látszik, de a
  riasztás halkabb, és a tartozás a panel belsejébe kerül.
- **C — „Rendezés-kapu"**: a legerősebb (a fiók többi része nincs is a képernyőn, így
  semmi nem mondhat ellent), de a tulajt elzárja attól, amiért belépett.
