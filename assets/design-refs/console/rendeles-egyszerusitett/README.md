# Kontraktus: egyszerűsített rendelés — három lépés, egy képernyőn egy döntés (A változat)

**Jóváhagyva:** tulaj, 2026-10-19, **„A”** (lépésenként).
**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css` · `src/generator/configurator.ts`
**Döntés:** ADR-0395.

A `plan.html` a jóváhagyott, működő vázlat. Felül váltható a méret és a „/pricing szimuláció — domain a csomagban”. A képek a döntéskori állapotot rögzítik.

**Ez a terv KÖT: elvárt viselkedés, nem stílus-javaslat.** A vázlat feliratait a megvalósítás ott vette át szó szerint, ahol új elem született. Ahol a panel már meglévő, más terv által kötött elemét használja (csomag-kártya, fizetés-lap), ott annak a felirata maradt; ezeket az eltéréseket lent tételesen felsoroljuk.

## Kiváltó ok (éles mérés és végigkattintás, 2026-10-19)

- A pilotban 63 valódi lead nyitotta meg a mockot, 51 mobilon. A rendelési panelt 5-en nyitották meg, kb. 1 percig. Fizetés nem volt.
- Telefonon (390 px) a régi panel 1. lépése egyszerre kérte a csomagot, a 11 szekció-kapcsolót és a webcímet. Ez kb. 1 700 px tartalom volt egy kb. 320 px-es ablakban, a webcím a legalján, 10 sornyi domain-névvel.
- A számlázásnál két görgetés volt egymásban.
- A tulaj szava: „túl bonyolult”, „ne legyenek sorhegyek a doménnevekkel”.

## Amit a terv KÖT

### 1. Három lépés, egy képernyőn egy döntés

- A sorrend: csomag → cím → fizetés.
- A fejlécben háromszakaszos haladásjelző áll, alatta **„{n}. / 3 — {step}”** (Csomag · Cím · Fizetés).
- A cím-lépésen vissza-nyíl van a fejlécben. A fizetés-lapon a meglévő „Vissza a tervhez” a cím-lépésre visz.
- Fejléc-címek: **„Válasszon csomagot”**, **„Az oldal címe”**, a fizetésen „Fizetés”. A próba folytatásán (`/folytatas`) az 1. lépés címe marad „Az Ön honlapja — folytatás”.
- **Telefonon a panel minden lépésen TELJES KÉPERNYŐS**: nem alsó lap, és nem kerül a süti-sáv alá. Asztali gépen jobb oldali sáv.

### 2. Lábléc az 1. és a 2. lépésen

- Egyetlen sor: az összeg (ajánlatnál előtte áthúzva a listaár, alatta az ajánlat-sor) és a „Tovább” gomb.
- A Havi/Éves váltó NINCS itt; csak a fizetés-lapon van.
- Nyitott panel mellett a döntés-segítő ajánlat felső sávja nem látszik, semmit nem takar ki. Az ajánlat a lábléc soraként ott marad.
- **Módosítás 2026-10-21 (tulaj):** a végösszeg a sáv legnagyobb, félkövér eleme (22 px), az egység („/ év” · „/ hó”) hozzátapadva, kisebb; az áthúzott listaár kisebb és halvány előtte (keskeny telefonon saját sorba eshet); az ajánlat-sor alatta, elválasztva. A sor szerkezete (összeg + ajánlat-sor + „Tovább”), a feliratok és a Havi/Éves viselkedés változatlan — a tulaj panasza: „alig látható, hogy mennyibe kerül a cucc a végén, teljesen egybeolvad”.

### 3. Az 1. lépés: csomag

- A három csomag-kártya marad, kártyánként „Mit tartalmaz?” lenyitóval.
- Az ingyen cím jelvénye a `package-domain-badge` szerint jelenik meg.
- A szekció-kapcsolók listája a **„Testre szabom”** mögött van, és **alapból CSUKVA** van.

### 4. A 2. lépés: cím — EGYETLEN felajánlott név, nincs lista

**A felajánlott név**
- Ha a csomag hordozza, a vezető sor: **„A csomagjához saját {tld} cím jár. Ezt a szabad nevet foglaltuk le Önnek:”**. A név nagy betűvel áll, alatta „szabad” és **„benne a csomagban · 0 Ft”**. Előre ki van jelölve.
- Ha a csomag NEM hordozza, a vezető sor: **„Saját címet is kérhet az oldalához. Ez a név szabad:”**. Ugyanez a kártya a végződés havidíjával („+{díj}/hó”) és egy **„Kérem a saját címet”** jelölőnégyzettel jelenik meg, alapból üresen.
- Ha a csomag a küszöb alatt van, a kártya nem jelenik meg; a vezető sor kimondja a feltételt.
- A felajánlott név a regisztrátor szerint SZABAD (a `/domains` első `free` találata; csomag-tartalomnál az ingyenes végződés előnyt kap). Foglalt nevet nem ajánlunk.
- Ha nincs szabad találat, rögtön a beviteli mező nyílik.

**Felülírás**
- **„Másik nevet szeretnék”** egyetlen mezőt nyit „Ellenőrzés” gombbal. A normalizálás és a hibaüzenetek a szerveréi (`normalizeCustomDomain`, „Ezt a végződést nem kínáljuk. Választható: …”).
- Foglalt névre EGY szabad alternatíva jön, egy kattintással átvehető: **„{name} foglalt. Ez szabad:”** + a név.
- Szerkesztés vagy névkeresés közben a „Tovább” tiltott.

**A citoviso-s cím**
- Nem választható lehetőség, hanem fix sor.
- Saját névvel: **„Mindig megmarad a citoviso-s cím is: {host} — a saját címre irányít.”**
- Saját név nélkül: **„Az oldala ezen a címen érhető el: {host}”**.
- A címke a választott név első tagja. Foglalt címkénél „<címke>-szallas”, végül a mostani cím. A szerver a rendeléskor újra ellenőrzi.
- A próba folytatásán, saját név nélkül, a meglévő egyszeri ingyenes névváltás marad (`proba-c`).

**Feltételek**
- A **„Feltételek”** link kis ablakot nyit: **„A saját cím feltételei”**. Benne: díj, hűségidő, mi lesz utána, korábbi lemondás (a megváltási árral), csomag-tartalomnál a kisebb csomag díja.
- Minden értéket a MA beállított /pricing-ből vesz, a megváltási árat a `domain.buyoutPrice` manifest-mezőből.
- A panelen magán nincs hűségidő- vagy vételár-mondat.

### 5. A 3. lépés: fizetés, egy képernyőn

- A meglévő fizetés-lap (`checkout-fullscreen`, `checkout-item-block`) a sorrendjével marad, két változással.
- A tétel-doboz új sora a cím: „Cím” + a saját név vagy a citoviso-s cím.
- A §A fotó-nyilatkozat a jóváhagyások ELSŐ sora lett: négy pipa, ugyanazzal a számlálóval.
- **Telefonon a fizetés-lap EGY oszlopban görget**, mindig. Az összesítő, az ÁFA-sor és a következő terhelés a tétel-doboz alá kerül, nem egy második rögzített blokkba.
- Asztali gépen a jobb oldali oszlop változatlan.

### 6. Egy állapot

- Csomag, cím és ütem egy állapotból számol.
- A beküldés mezői (`domain_type`, `domain_name`, `platform_label`) változatlanok.
- A szerver a beküldéskor ugyanazt az árat számolja (ADR-0366).
- A mérési események megmaradnak. A cím-lépés a riportban a régi 2. lépés helyén áll („choose”); új esemény: `domain_terms_open`.

## Mit ír felül

| korábbi kontraktus | mi dől meg |
|---|---|
| `order-two-step` (ADR-0240) | a két lépés (csomag + modul → fizetés módja) és az 1. lépés kis Havi/Éves váltója; most három lépés, és az ütem a fizetés-lapon van |
| `period-toggle-step1`, `period-switch`, `period-badge` | a váltó az 1. lépésen és a 2. lépés nagy kártyái; most a fizetés-lap `period3` váltója az egyetlen |
| `order-step2-note` | a „Tovább a számlázási adatokhoz” lépés és alatta a mondat; a cím-lépés után a „Tovább” egyenesen a fizetés-lapra visz |
| `escalation-topbar` (ADR-0369) | a felső sáv nyitott panel mellett is látszott; most a panel nyitásakor eltűnik |
| `package-domain-badge` §3, §5, §6 | vezető sor + rádió-pár + névlista, és „semmi nincs előre kijelölve”; most egyetlen, csomag-tartalomnál előre kijelölt név és fix citoviso-sor |
| `domain-monthly` | a küszöb alatti meghívó-kártya (haladásjelzővel); most a vezető sor mondja ki a feltételt |
| `checkout-fullscreen` (ADR-0247 fold) | a telefonos fizetés-lap mérés alapján hajtott össze; most mindig egy oszlop |

**Ami marad:**
- az árszámítás (ADR-0100/0109/0366);
- a kedvezmény sosem vonatkozik a domain-díjra;
- a próba-pirula;
- a domain-beszerzés lánca (ADR-0381/0394).
