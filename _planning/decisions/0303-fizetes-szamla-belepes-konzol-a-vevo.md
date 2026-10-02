## ADR-0303 — Fizetés, számla, belépés, konzol: a vevő visszalépése nem elutasítás, egy ajánlat egy név, a számlacím a vevőé, jelszó nem jár levélben (Elek M2) (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (tulaj, a koordinátoron át: „egyetértek”; kampány-név = A, belépés = B) ·
**Forrás:** Elek élesi teljes tölcsére (2026-10-01): F-2, L-2, F-3, F-1, T-4, T-3, K-1 · **Terv:**
`assets/design-refs/console/elek-m2/` · **Kapcsolódó:** ADR-0088 (ajánlat-réteg), ADR-0023 (tenant-belépés),
ADR-0205 (kedvezmény a számlán), ADR-0291 (a levél-link GET-je nem dönt).

**A leletek (élesen mérve).**
- **F-2:** a Barion „Canceled” (a vevő visszalépett) nálunk `failed` lett, a vevő a „Fizetés elutasítva / A fizetés nem
  sikerült” lapot kapta, és a naplóba egy sor sem került (a sikeres fizetés hatot ír).
- **L-2 / F-3:** ugyanazt a −50%-os eszkalációt a fizetési lap bal oldala „Bemutatkozó ajánlat a levélből”-nek, a jobb
  „Döntés-segítő ajánlat”-nak hívta; a számla a 98%-os kampányt „Üdvözlő kedvezmény”-nek. A nevet három helyen három
  kéz írta, kettő nem nézte az ajánlat fajtáját.
- **F-1:** a számla címe „8360 Keszthely, Ráckevei út 083/2 hrsz. 24393470213” lett: az irányítószám és a város a
  SZÁLLÁSÉ (a lead címéből előtöltve), az utca a vevőé, a végén egy érvényes adószám — az Adószám mező csak a „Cégként”
  ágon létezett.
- **T-3:** a belépő levél nyílt szövegben vitte a jelszót, és „válaszoljon erre a levélre” volt az egyetlen visszaút.
- **K-1:** a konzolon mindkét csomag-igény „submitted” maradt (a fizetett is), a megszakított mellett ott állt a
  „Fizetési kérés küldése ▸”, ami ráadásul a lead LEGÚJABB (fizetett) rendelésére kért volna; a súgó mockot és
  „2. fázis” MIT-et állított.

**Döntés.**
1. **A visszalépés saját állapot.** `WebhookResult.status` = `paid | failed | cancelled`; a Barion „Canceled” →
   `cancelled` (payment-sor is). A vevő semleges „Fizetés megszakítva / Megszakította a fizetést / Nem terheltünk
   semmit. / Folytatom a fizetést” lapot kap; a valódi elutasítás lapja változatlan. Minden pénz nélküli zárás egy
   naplósort ír (fizetés, rendelés, összeg, ok). A próba-fizetőlap „Mégsem fizetek most” gombja is ezt az utat járja.
2. **Az ajánlat neve egy helyen, a fajtából** (`offerLabel`): levél → „Bemutatkozó ajánlat a levélből”, eszkaláció →
   „Döntés-segítő ajánlat”, kampány → „Egyedi ajánlat”, kupon → „Üdvözlő kedvezmény”. A szerver adja a fizetési
   lapnak (mindkét oldal), a számla megjegyzésének és a tulaj-admin nyugtájának.
3. **A számlázási cím a vevőé.** A lead címe nem töltődik elő (az e-mail és az ország igen). A második vevő-típus:
   „Cégként vagy egyéni vállalkozóként”. Adószám a cím/település/név mezőben: a lap rákérdez és átteszi, a szerver
   elutasítja. A név mező mintája „pl. Olasz-Balogh Viktória”.
4. **Jelszó nem jár levélben (B).** A belépő levél egy egyszer használható, 7 napig élő „Jelszó beállítása” linket
   visz; a DB csak a token SHA-256-ját tárolja (`login_token`, 0011 óta erre félretéve), a naplózott levél-másolatban a
   link kitakarva. A link GET-je csak mutat, a POST költ. „Elfelejtett jelszó?” önkiszolgáló (felhasználónév vagy e-mail,
   mindig ugyanaz a válasz, IP-nkénti korlát). A sikeres fizetés lapján 2 órán át azonnal beállítható a jelszó.
   A munkamenet-süti aláírva hordozza a kiállítás idejét; a `tenant_user.password_set_at` (0085) utáni beállítás minden
   korábbi munkamenetet lezár (a Fiók fülön cserélt jelszó is), és egy újrafutó aktiválás nem írja felül a tulaj jelszavát.
5. **A konzol a fizetésekből mondja az állapotot** (fizetve · fizetésre vár · megszakítva · sikertelen · beküldve ·
   lezárva — egy későbbi rendelés fizetve). A fizetés-kérő gomb a saját sorának rendelésére kér; a súgó igaz.

**Visszafordíthatóság.** 🔄 mind olcsó, egy kivétellel: a jelszó-link (4.) után a régi, levélben kiküldött jelszavak
nem jönnek vissza — ez szándékos. A 0085-ös migráció csak oszlopot ad hozzá.

**Elvetett alternatívák.**
- A „Canceled”-t a régi lapon, más szöveggel kezelni — a vevő döntését akkor is hibaként keretezné (piros sáv).
- A szállás címét „jelölve” előtölteni — a mérés szerint a félig jó cím rosszabb az üresnél, mert megerősítettnek látszik.
- Munkamenet-tábla a lezáráshoz — a süti kiállítási ideje + `password_set_at` ugyanazt adja új tábla nélkül.
- A tulaj „mit írt be / mit látott” kérdései: a tulaj teszt-kérdésnek tekintette, nem kellett.

**Őrök.** `payment-outcome-truth-check` · `offer-name-one-source-check` · `billing-taxid-in-address-check` (+ a
`billing-checkout-check` fordított előtöltés-állítása) · `password-link-check` · `order-intent-state-check` — mind piros
önteszttel, a javítás előtti kódon pirosan mérve.
