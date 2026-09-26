# Kontraktus: rendelés két lépésben (csomagok és modulok, „Tovább”, majd fizetés módja)

**Jóváhagyva:** tulaj, 2026-09-26, a **B változat** („lábléc + kis váltó”).
**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css`
**Döntés:** ADR-XXXX. Felülírja a `period-toggle-step1` ① és ② pontját (lásd lent).

## Kiváltó hiba (tulaj telefonja, 2026-09-26, Három Huszár Apartments)

„Itt telefonon olyan nagy a megrendelés fizetési rész, hogy semmi nem látszik a modulok,
csomagokból.” A 74vh-s alsó lap pinnelt lábléce volt a hiba. Ebben ült a Havi/Éves kártya-pár, a
MOST FIZETENDŐ kártya, az ÁFA-sor, a következő terhelés és a gomb, és ez majdnem az egész lapot
kitöltötte. A csomag/modul-listából EGY sor látszott.

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Az 1. lépés a csomagoké és moduloké.** A lábléc EGY sor: egy kis Havi | Éves kapcsoló
   (`−{n} hó` jelöléssel, `n = 0` esetén jelölés nélkül), a futó összeg és a **„Tovább”** gomb.
   Mobilon a lista a lap legalább felét kapja (mérve 390×844-en).
   A futó összeg UGYANAZ a szám, mint a 2. lépés kártyájának nagy száma, vagyis amit elsőre
   terhelünk. Ajánlatnál alatta áll: „−{p}% az első díjból · érvényes {d}-ig”.
2. **A „Tovább” után a 2. lépés.** A lista eltűnik, és a lap a pénzügyi döntést mutatja. Mobilon
   a lap 92vh-ig nőhet. Sorrend: „Vissza a csomagokhoz” → a választott csomag neve és
   szekció-száma → **„Milyen gyakran fizet?”** → **a Havi/Éves kártya-pár (a 2. lépés első
   látványa)** → MOST FIZETENDŐ kártya → ÁFA-sor → következő terhelés → §A nyilatkozat. A
   „Tovább a számlázási adatokhoz” gomb pinnelt, alatta görget a terület. Ha van még tartalom
   lejjebb, azt MÉRT jelzés mutatja.
3. **Egy `period` állapot, három kapcsoló.** Az 1. lépés kis kapcsolója, a 2. lépés kártyái és
   a fizetés-lap `period3` kapcsolója ugyanazt az ütemet mutatja, mert egy kezelő hajtja őket.
4. **A fejléc igazat mond minden lépésen.** Az 1. lépésen: „Most nem fizet semmit”. A 2.
   lépésen: **„Fizetés módja”**, „Még nem fizet — a következő lépésben adja meg a számlázási
   adatokat.” A fizetés-lapon a `checkout-fullscreen` ④ szerint.
5. **Mindkét méreten így.** Asztalon ugyanez a két lépés az oldalsávban. Fekvő telefonon a panel
   egy oszlopban görget, a gombok görgetéssel elérhetők, és semmi nem takarja őket.
6. **A fizetés-lap (3. lépés) változatlan.** Onnan a „Vissza a tervhez” a 2. lépésre visz, nem a
   listára.

## Mit ír felül, és mi marad érvényben

- **`period-toggle-step1` ① és ②** („a váltó az 1. lépés láblécében, a nagy kártyák mindig
  látszanak mobilon is”) **FELÜLÍRVA.** A nagy kártyák a 2. lépés elejére kerültek. A szándéka
  (az ár mellett mindig ott a váltás) a kis kapcsolóval megmarad. A ③ forma (kártyák, badge) és
  a ④ árazás érvényes.
- **`period-badge`** minden pontja érvényes, csak a 2. lépésen: jelvény, zöld keret, „áráért”
  sor, forintos megtakarítás.
- **`offer-ui` ①** („ár-kártya a konfigurátor lábában”): a kártya a 2. lépésen van, változatlan
  tartalommal. Az 1. lépés egysoros összege az ajánlatot is kimondja.
- **`pay-gateway-exit`**: nem érinti (az átjáró és a bukás-lap szerveroldali).

## Kötő horgony

- `cit-cfg-s1bar`
- `cit-cfg-ppill`
- `cit-cfg-mini__amt`
- `cit-cfg-s2scroll`
- `cit-cfg-s2top`
- `cit-cfg-recap`
- `cit-cfg-panel--s2`

## Referencia és ellenőrzés

- `plan.html`: a jóváhagyott, kattintható terv. Mindkét változat benne van, a **B** a kötelező.
  Van benne méret-váltó és ajánlat-kapcsoló.
- Képek: `plan-mob-step1.png`, `plan-mob-step2.png`, `plan-desk-step1.png`, `plan-desk-step2.png`.
- Őr: `scripts/order-two-step-check.mts` (390×844 · 844×390 · 1280×800). `elementFromPoint`-tal
  mér, érintetlen görgetésnél. Piros önteszt (`--self-test`) három visszarontásra: a pénzügyi
  blokk visszakerül az 1. lépésre; a lista a 2. lépésen marad; a két lépés összege szétválik.
