# Próba „C” — egy kedvezmény, egy határidő + névváltás (jóváhagyott terv)

**Jóváhagyva:** 2026-10-10, tulajdonosi döntés (§2b terv-kapu), a koordináló sessionön át.
Döntések: 1 = A (a határidő az ár-sorban, szalag NINCS) · 2 = „Folytatom” · 3 = A (a próba-levélből
érkezőnek nincs felugró kártya, a % az űrlapon egy sorban) · 4 = OK (minden szöveg-javaslat; a
kampány-levélben gombpár, a kampány-SMS a %-os változat) · 5 = A (a régi cím örökre átirányít — a
háttér ADR-0356, 2026-10-10 óta él).
**Döntések háttere:** ADR-0354 („C” kedvezmény-elv), ADR-0356 (névváltás a próba végén).
**Vázlatok:** `1-vasarlas.html` · `2-belepesi-pontok.html` · `3-levelek-sms.html` · `4-nevvaltas.html`
(mindegyikben méret-váltó), képek: `shots/`. A vázlatok kapcsolói közül a fenti változatok
kötnek; a többi (B-szalag, „Megtartom”, felugró kártya B, régi cím B) elvetve.
**Hatókör:** `assets/runtime/cit-configurator.js` · `src/console/server.ts` · `src/server/adminViews.ts` · `src/email/trialEmail.ts` · `src/email/loginEmail.ts` · `src/email/trialCampaignEmail.ts`
**Őrök:** `scripts/proba-c-checkout-check.mts` (folytatás + terv-lap, böngészőben) ·
`scripts/free-trial-expiry-check.mts` (admin sáv, Modulok fül, lejárt blokk, levelek, SMS) ·
`scripts/trial-campaign-check.mts` (kampány-levél, -SMS) · `scripts/slug-rename-check.mts` (névváltás háttér).
Bővíti: `../proba-admin-sav/`, `../proba-levelek/`, `../proba-torles-level/`, `../proba-visszamenoleges-level/`.

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **Egy név:** a próba kedvezménye minden felületen **„Próba-kedvezmény”** (a próbázó folytatás-oldala
   a szerver-oldali ajánlat-nevet erre cseréli; eddig „Bemutatkozó ajánlat…” / „Döntés-segítő ajánlat”).
   Egy forrás: `trialDiscount()` (`src/trial/offer.ts`) — a levelek, az SMS, az admin sáv és a
   folytatás ugyanazt az EGY kedvezményt és határidőt mondja. Régi (C előtti) kuponos próba a régi szövegét tartja.
2. **Vásárlás (1, A):** a próbázó folytatás-oldalán (`/p/<token>/folytatas`) az éves az alapértelmezett és
   „ajánlott” jelzést kap; a kedvezmény és a határidő az ár-sorban áll („… az első évre · a próba végéig,
   <nap>-ig”, havinál **„csak az első hónapra”**); szalag nincs, és a folytatáson döntés-segítő kártya sem
   ugrik fel (a rögzített próba-ajánlat lehet eszkalációs eredetű). Éves fizetésnél a megtakarítás
   összeadva (12 havi listaár → 2 hónap ingyen → próba-kedvezmény → **„Megtakarítás az első évben”**);
   havinál őszinte egy sor + **„Évesre váltok”** (ugyanaz a periódus-állapot). A 2. lépés kártyája a
   határidőt és az „első díj” jelentését mondja; a következő terhelés sora: a fizetett időszak a próba
   vége után indul (ADR-0354 ⓐ, `subscription.ts`), a hátralévő ingyen napok megmaradnak. A 2. lépés
   jegyzete nem ígér belépőt (a próbázónak már van). Lejárt próbánál: listaár, a „szünetel” sor elöl,
   a fejléc „mit kapcsoljunk vissza”.
3. **Admin (2):** a sáv gombja „Folytatom”, mondata „Ha a próba végéig megrendeli, −X% az első díjból.”;
   a Modulok fülön próba alatt nincs sor-ár és egyedi vétel, helyette **„Modulok a próbában”** kártya és
   **„Folytatom — csomag és modulok”** gomb ugyanarra a folytatás-oldalra; a lejárt blokkból a kedvezmény-doboz
   kikerül (részletek: `../proba-admin-sav/README.md` 10–11.).
4. **Terv-lap (3, A):** a próba-levélből (`forras=proba`) érkezőnek nincs döntés-segítő kártya; a
   próba-űrlap alsó sora egy mondat: „−X% az első díjból, ha a próba végéig megrendeli (a próba
   indításától N nap). Egy kedvezmény, utána a listaár érvényes.” A levél „Kipróbálom…” gombja
   (`proba=nyit`) nyitott űrlappal hozza a lapot. Paraméter nélkül a kártya változatlan.
5. **Levelek, SMS (4):** a `3-levelek-sms.html` javaslatai szó szerint (belépő-levél, T−3/T−1, SMS-ek,
   90 napos levél: a kedvezmény-mondat helyén „Ha folytatná, a Folytatom gombbal most is megteheti; a honlap
   a fizetés után azonnal visszakapcsol.”); a kampány-levél gombpárja **„Kipróbálom {days} napig ingyen”** +
   **„Megnézem a tervemet”**; a kampány-SMS a %-os változat (ha a lead-nek van élő ajánlata; 2 szegmensen
   túl a %-mentes, jóváhagyott szövegre esik vissza). A T−1 levélben: „Tetszik a cím? Most {host} —
   megrendeléskor ingyen megváltoztathatja.” (a T−3-ba és az SMS-be nem kerül).
6. **Névváltás (4/5):** a folytatás 1. lépésében a mai cím **„Ingyen megváltoztatható”** jelzéssel;
   **„Megváltoztatom a címet”** → új cím mező a valódi szabállyal (`checkSubdomainAvailable`: a saját régi
   név szabad, másé foglalt) → **„Ezt választom”** / **„Marad a mostani”**. A beírt név csak
   jelölt: a rendelés a „Ezt választom”-mal rögzített címet viszi. A választás után a régi cím sorsa:
   örökre átirányít, senki más nem kaphatja; **„A honlap tartalma, a foglalások és a belépés nem változik.”**;
   **„Az új cím a megrendeléskor él.”** (lejártnál: a fizetés után). Lejárt próba admin-blokkjában: „Tetszik a cím? …”.

## Eltérések a vázlattól (szándékosak)

- A vázlat 2. lépése (fizetési űrlap egy lapon) helyett a meglévő három lépés marad (csomag → gyakoriság +
  ár-kártya → számlázás); a terv TARTALMA (ár-sor, megtakarítás, kártya, jegyzet, terhelés-sor) ott ül.
- A böngésző-keret előnézete (4a jobb oldala) nem épült meg: díszítés volt, a cím a blokk tetején látszik.
- Lejárt sor: „Az ingyenes próba {nap}-ig tartott, a honlap szünetel. …” (a „-án/-én” rag számfüggő).
- A Modulok listában a „Beállítás” link megmaradt (nélküle a próbázó nem tudná a modulokat beállítani).
