# Fizetés, számla, belépés, konzol — jóváhagyott terv (Elek M2, 2026-10-02)

**Jóváhagyta:** a tulaj, a koordinátor („élesi teszt” fő session) útján, 2026-10-02: „egyetértek” a javaslatokkal;
a kampány neve az **A** változat, a belépésnél a **B** változat.

**Hatókör:** `src/console/views.ts` · `src/server/adminViews.ts` · `src/email/loginEmail.ts` · `assets/runtime/cit-configurator.js` · `src/payment/offers.ts` · `src/billing/buyer.ts`

- Terv: `plan.html` (önhordó, kattintható, öt fül, mobil/asztali váltó; a mezők és gombok működnek).
- A terv képei: `plan-<fül>-mobil.png`, `plan-<fül>-asztali.png` (f2 · l2 · f1 · t3 · k1).
- A leszállított felület: `shipped-*.png` (a valódi, exportált nézet-függvényekből renderelve, a valódi stíluslappal).
- Forrás-lelet: Elek élesi jelentése, 2026-10-01 (F-2, L-2, F-3, F-1, T-4, T-3, K-1). ADR: **ADR-XXXX**.

---

## Amit KÖT — elvárt viselkedések, nem stílus-javaslatok

### ① A vevő visszalépése nem elutasítás (F-2)
A Barion „Canceled” állapota (a vevő a fizetőoldalon visszalépett) saját állapot (`cancelled`), és saját lapot kap:
semleges sáv, igaz mondat, „folytatás” gomb. A valódi elutasítás lapja változatlan marad.
Minden pénz nélküli zárás egy naplósort ír.
- **„Fizetés megszakítva”** · **„Megszakította a fizetést”** · **„Nem terheltünk semmit.”** · **„Folytatom a fizetést”**
- A megszakítás-lapon NINCS „elutasítva”, „A fizetés nem sikerült” és „Másik kártyát adok meg”: a kártyával nem volt baj.

### ② Egy ajánlat — egy név (L-2, F-3)
Az ajánlat nevét EGY függvény adja (`offerLabel`) az ajánlat fajtájából. Ezt használja a fizetési lap mindkét oldala,
a számla megjegyzése és a tulaj-admin nyugtája. Saját, kézzel írt nevet egyik felület sem tarthat.
- **„Bemutatkozó ajánlat a levélből”** (a levél ajánlata) · **„Döntés-segítő ajánlat”** (eszkaláció) ·
  **„Egyedi ajánlat”** (kézzel adott kampány; tulaj: A) · az üdvözlő kupon neve változatlan.

### ③ A számlázási cím a vevőé (F-1, T-4)
- A szállás címe (a lead címe) NEM töltődik a számlázási címbe. Az e-mail (a tulaj megkeresési címe) és az ország igen.
- A második vevő-típus gomb: **„Cégként vagy egyéni vállalkozóként”**. Az adószám-mező ezen az ágon jelenik meg.
- Ha a cím-, település- vagy névmezőben érvényes magyar adószám áll, a lap rákérdez, és egy gombnyomással átteszi:
  **„Áthelyezem az Adószám mezőbe”**. A szerver ugyanezt elutasítja: adószám nem kerülhet a számla címébe.
- A név mező mintája: **„pl. Olasz-Balogh Viktória”** (a megszólítás a beírt nevet használja).

### ④ Jelszó nem jár levélben (T-3, B változat)
- A „Belépési adatai” levél a felhasználónevet és egy **„Jelszó beállítása”** gombot visz, jelszót nem.
  A link 7 napig él, egyszer használható. A DB csak a token hash-ét tárolja; a naplózott levél-másolatban a link kitakarva.
- A link GET-je csak megmutatja az űrlapot (levél-szkennerek); kizárólag a jelszó POST-ja költi el.
- A belépő lap **„Elfelejtett jelszó?”** linkje önkiszolgáló: felhasználónév vagy e-mail alapján új linket küld.
  A válasz mindig ugyanaz (**„Ha van ilyen fiók, elküldtük”**), így nem árulja el, kinek van fiókja. A kérés IP-nként korlátozott.
- A lejárt vagy felhasznált link lapja: **„Ez a link már nem érvényes”**, egy gombbal az új link kéréséhez.
- **B:** a sikeres fizetés lapján azonnal beállítható a jelszó (**„Állítsa be most a jelszavát”**,
  **„Beállítom és belépek”**). Csak a fizetés utáni 2 órában, és csak amíg a tulaj még nem állított jelszót.
- Jelszó beállítása (linkkel vagy a Fiók fülön) után a korábban megnyitott munkamenetek véget érnek.
  Egy újrafutó aktiválás sosem írja felül a tulaj saját jelszavát.

### ⑤ A konzol csomag-igény panelje igazat mond (K-1)
- A csomag-igény állapotát a fizetései adják: fizetve · fizetésre vár · megszakítva · sikertelen · beküldve.
- Ha a leadnek egy későbbi, azonos fajtájú rendelése ki van fizetve, a régi, nem fizetett sor
  **„lezárva — egy későbbi rendelés fizetve”**, és nincs mellette fizetés-kérő gomb.
- A „Fizetési kérés küldése ▸” a SAJÁT sorának rendelésére kér fizetést (nem a lead legújabbjára).
- A súgó nem állít mockot és „2. fázis” kártyás terhelést: élesen Barion fut, mentett kártyával.

## Amit a terv SZÁNDÉKOSAN nem köt
- A modulok konzolbeli megnevezése a modul-katalógus címkéje marad (operátori felület).
- A Barion „Expired / Failed / Rejected” állapotok szövege nem változott (valódi elutasítás / lejárat / hiba).

## Ellenőrzés (őrök, mind piros önteszttel)
`scripts/payment-outcome-truth-check.mts` (①) · `scripts/offer-name-one-source-check.mts` (②) ·
`scripts/billing-taxid-in-address-check.mts` + `scripts/billing-checkout-check.mts` (③) ·
`scripts/password-link-check.mts` (④) · `scripts/order-intent-state-check.mts` (⑤)
