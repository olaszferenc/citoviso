# KONTRAKTUS — „Kapunyitás” sablon (`gate-opening`)

**Jóváhagyta:** a tulaj, 2026-10-02 (mock-verseny egy valós leaden: Három Huszár Apartments, Köveskál; Claude és
Kimi, 7 mock). A Kimi B változatáról: „A Kimi B verziója eddig mindent visz.”, majd: „Külön sessionbe generáljunk
abból is egy sablont.” A koordináló session briefje hozta (`~/rc-briefs/kapunyitas-sablon.md`).
**Terv:** `plan.html` (az elfogadott, önhordó mock, képei az `img/` alatt) · `terv.md` (a Kimi dizájnterve, B) ·
**Képek:** `terv-mobil.jpg`, `terv-asztali.jpg` (az elfogadott terv első képernyője) ·
**Hatókör:** `src/engine/templates/gateOpening.ts` · `src/engine/skins.ts` · `src/engine/templates.ts`
(a sablon; a `lantern-charcoal` skin; a regisztráció) · Döntés: ADR-XXXX. Precedens: `walk-through` (ADR-0304).

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kész sablont ehhez mérjük.

## KÖT — a kinézet és a szerkezet (a terv szerint)

1. **Paletta és betű:** sötét, meleg szén alap, mézszín „lámpásfény” akcent — az akcent SOSEM szöveg a sötéten
   (gombon fehér felirat, máshol vonal, ikon, kitöltés; a copywriter kiemelt szavai akcent-aláhúzást kapnak).
   Archivo (800/900) + Inter. A skin a mock 11 tokenje változatlanul; a kiemelőszín, mint minden sablonnál, a
   fotókból vett (harmonizálva).
2. **Teljes képernyős hős:** a fotó kitölti a képernyőt, alul sötét átmenet; rajta kis felirat (szalag), a név
   NAGYBETŰS 900-as sorokban, rövid bevezető, két gomb (foglalás + szobák / képek), alatta hajszálvonalas meta-sor
   (cím, értékelés, „görgessen tovább”).
3. **Az emlékezetes mozzanat — a kapunyitás:** betöltéskor a „kapu” két fele `translateX`-szel kinyílik (a résen
   akcent fényvonal), mögötte a hős fotó ülepszik (1,07 → 1), a név sorai maszkból emelkednek; görgetésre a hős
   tartalma elhalványul (`@supports (animation-timeline: view())` mögött).
4. **Számsáv** hajszálvonalakkal (mobil 2×2, asztal 4 oszlop); egy mértékegység nem lóghat egyedül
   (a mock lelete: „éj” magában — a sablonban a „/ egység” és a „Ft-tól” egyben marad).
5. **A ház:** asztalon ragadós bevezető (cím + a szállás leírása + „Megnézem a képeket”) a kiemelések mellett;
   a kiemelések ikonos, vonallal elválasztott sorok, asztalon két oszlopban.
6. **Szobák:** vonalas sorok, asztalon 7/5-ös kép + szöveg, soronként váltakozó oldallal.
7. **Galéria:** asztalon 6 oszlopos mozaik (3+3 · 4+2 · 2+2+2 · 2+4 sorok, az utolsó sor mindig zárt), mobilon 2 oszlop.
8. **Értékelés** hajszálvonalas felekben (forrás-címke akcent-vonással, nagy szám, csillag, darabszám, link);
   **GYIK** plusz-ikonos lenyíló sorokkal; lábléc az akcenttel melegített szénen.
9. **Mozgás-fegyelem:** csak transform/opacity; a betöltési koreográfia egy `<head>`-ben, az első festés ELŐTT tett
   `ko-anim` osztályhoz kötött — JS nélkül, csökkentett mozgásnál és `data-cit-no-motion` alatt nincs kapu, minden
   látszik; a görgetésre belépő elemek a közös mozgás-réteg (ADR-0115) horgai.

## KÖT — ami a RENDSZERBŐL jön, nem a mockból

- **Funkciók:** foglalás/érdeklődés (`bookingSlot` + a `closing` slot közös foglalási szekciója), galéria-nagyítás
  (közös lightbox, galéria-kontraktus: minden fotó a slotban, 11 látszik, a többi az „Összes fotó” gomb mögött),
  szoba-kártya (`roomShell`/`roomHint`/`roomDetails`), értékelés/térkép/házirend/programok a négy slotból
  (`showcase` · `trust` · `practical` · `closing`). A mock saját űrlap-szkriptje csak a viselkedés mintája volt.
- **Telefonos fejléc (ADR-0253, felülírja a mockot):** a mock fejlécében telefonon is ott állt az Ajánlatkérés gomb
  és saját hamburger; a sablonban a közös menü-gomb, a görgetett fejlécben telefonon nincs foglalás-gomb, az alsó
  sáv csak félúton. A mock ragadós ajánlatkérő bevezetője elmarad: a foglalási blokk mellett nincs ragadó foglalás-gomb.
- **Szöveg:** a SiteData-ból és a copywriter-rétegből; minden vevő-oldali felirat `T()`-vel.
- **A kapu adatból, és nem állít semmit:** egyetlen vision-tárgy sem mondja, hogy „kapu” vagy „bejárat”, ezért
  egy fotó sem nevezhető kapunak, és a lap nem sugallhatja, hogy a szálláson kapu van. A kapu két fele a hős fotó
  maga, tompítva (mint egy csukott ajtó alkonyatkor) — kinyílva ugyanarra a fotóra, kivilágítva. Dekoratív
  (`alt=""`, `aria-hidden`), nincs külön letöltés. (A koordinátor elé vitt alternatíva: egy másik kültéri fotó.)
- **Kevés adat:** nincs értékelés és stat → nincs számsáv, nincs értékelés-szakasz és nincs értékelés a meta-sorban;
  élesen szoba nélkül → nincs szoba-szakasz (és a hős második gombja a képekre visz); nincs valódi GYIK → nincs GYIK;
  nincs leírás és kiemelés → nincs „A ház”. Üres doboz sehol.
