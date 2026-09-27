## ADR-0251 — Webcím: hiteles elérhetőség + kártyazárolásos fizetés („csak akkor fizet, ha a név már az Öné”)

**Dátum:** 2026-09-27 · **Státusz:** ELFOGADVA (tulaj: „A)” mechanizmus + „A1” megjelenés) ·
**Módosítja:** ADR-0078 ② (sikertelen beszerzés) · **Kontraktus:** `assets/design-refs/console/domain-zarolas/` ·
**Kapcsolódó:** ADR-0071, ADR-0103, ADR-0111, ADR-0226/0228

### Kiváltó ok (tulaj, 2026-09-27)
1. A dev-en a Lidó domain-vásárlása „A fizetést nem sikerült elindítani”-val állt meg. Az ok: a
   `createDomainUpgradeOrder` nem örökölte a deklarált vevőt, így a rendelésnek nem volt országa,
   és a piac-kapu (ADR-0111) megtagadta a fizetési linket. (Külön commit, már a mainen.)
2. „Nagyon nem bizalomgerjesztő, végig azt írjuk, hogy nem tudjuk előre.” Mérve: a DNS/RDAP réteg
   `.hu`-ra soha nem tud „szabad”-ot mondani (az rdap.org nem szolgálja ki a `.hu`-t). A
   lidowellness.hu és a lidowellness.com ott „unknown”, a regisztrátornál „szabad” volt.
3. „Meg kell győznünk a vásárlót, hogy ha nem sikerül regisztrálni, nem terhelünk fel érte semmit.”
   Ma ez nem volt igaz: az ADR-0078 ② szerint a befizetett összeg egy másik névre ment.

### Döntés
① **Hiteles elérhetőség** (`src/domains/availability.ts`). A Webcím fül a regisztrátor (Websupport)
saját, csak-olvasó `validate` válaszát mutatja. Négy állapot: **Szabad** · **Foglalt** (csak amit a
regisztrátor foglaltnak mond) · **Nálunk nem igényelhető** (bármely más elutasítás) · **Nem sikerült
ellenőrizni** (kiesés, 6 mp időkorlát). Csak a „Szabad” kérhető. Websupport-kulcs nélkül a régi
réteg legfeljebb „foglalt”-at mondhat, „szabad”-ot soha. Az Áttekintés friss ellenőrzéssel nyílik,
és a rendelés elküldésekor a szerver még egyszer rákérdez. A lead-konfigurátor (első rendelés)
jelölője NEM változott, az külön kör.

② **Kártyazárolás: Barion `DelayedCapture`, NEM `Reservation`.** Az ADR-0228 kimérte, hogy a
`Reservation` bankkártyánál valódi terhelés (a pénz a mi tárcánkba kerül), a nullás lezárás pedig
akár 30 napos visszatérítés. A jóváhagyott mondat („Ez még nem terhelés: a pénz a számláján marad”)
csak a `DelayedCapture`-rel igaz. A doksi szerint „a vevőt csak a lehíváskor terheljük, addig az
összeg csak a kártyáján blokkolódik”. Folyamat:
`pending → (Authorized) → reserved → regisztráció → Capture(teljes összeg) → paid + számla`,
illetve bukáskor `reserved → released → CancelAuthorization`. A `released` sor a feloldás ELŐTT
íródik, így a késői `Succeeded`/`Canceled` visszahívás sosem fordítja fizetettre. Csak bankkártya
(`FundingSources: ["BankCard"]`, a Barion-egyenleg nem támogatott). Az ablak 7 nap (a magyar
boltoknál 21 lehetne). A `resume-domains` időzítő rendezi a kimaradt lehívást vagy feloldást
(`settleDomainReservations`).

③ **A hűségidő és a számla csak lehívás után indul** (`paid_at` = a lehívás pillanata). Feloldott
zárolásra nincs számla és nincs vállalás.

④ **A felület** az A1 terv szerint: forrás-mondat, „Most zárolunk” sor, háromlépéses garancia,
„Tovább a fizetéshez (zárolás)” gomb. A 3. lépés pénz-állapotos listát mutat (zárolva → megvéve →
terhelve → cím/tanúsítvány; `.hu`-nál „néhány nap”). Bukáskor saját képernyő: „Nem fizetett érte
semmit.”, „Másik név választása”. A levél ugyanezt mondja.

### Mérés (Barion SANDBOX, a valódi `BarionGateway`-kóddal, teszt-kártya 4444 8888 8888 5559)
| ág | a fizetés után | hívás | végállapot |
|---|---|---|---|
| siker | `Authorized`, CardPayment 1 000 | `Payment/Capture(1000)` | `Succeeded`, CardPayment Succeeded 1 000 (+15 Ft díj) |
| bukás | `Authorized`, CardPayment 1 000 | `Payment/CancelAuthorization` | `Canceled`, CardPayment **Reversed**, díj nincs |

A termék-út (rendelés → pay-link → webhook → regisztráció → lehívás/feloldás) a mock átjárón a
`domain-provision-check`-ben fut. A javítás nélküli negatív kontroll piros.

### Pontosítások a jóváhagyott szövegen (igazság > terv)
- A feloldás ideje: „a bankjától függően néhány munkanapon belül” (a „legfeljebb 30 nap” a
  Reservation-visszatérítésre vonatkozott, nem a kártyazárolásra).
- Új, negyedik jelölő: **„Nálunk nem igényelhető”**. Egy nem támogatott végződést „Foglalt”-nak
  nevezni hamis lenne.

### Nyitott (élesítés előtt)
- Éles POS-on a `DelayedCapture` engedélyezettsége (a sandbox elfogadta).
- Ha a kibocsátó bank a lehívás előtt magától feloldja a blokkolást, a név már a miénk, de a díj
  nem jön be. Ezt hangos napló jelzi, a rendezés kézi.
- A dev-en a regisztráció mock: a bukás-ág egy „taken”-t tartalmazó szabad névvel próbálható ki.

### Kiegészítés (2026-09-27, tulaj: „Javítsuk ezeket is”)
- **„Fizetek: …” a Barion-lapon.** A Barion fizetőlapja minden fizetés-típusnál „Fizetek: <összeg>”-et
  ír, ezt a doksi szerint a kereskedő nem tudja átírni. Az Áttekintés a gomb alatt és a súgó is
  kimondja: „A Barion oldalán a gomb felirata „Fizetek: …” — ekkor is csak zároljuk az összeget, és
  csak bankkártyával lehet fizetni.”
- **Barion Wallet / Apple Pay / Google Pay (sandboxban mérve).** `DelayedCapture`-nél a Barion
  magától elrejti az Apple Pay-t és a Google Pay-t (`Immediate`-nél megjelennek). A „Barion Wallet”
  ág megmarad, és e-mail-bejelentkezést kér. A doksi szerint egyenlegből delayed capture nem
  fizethető, a Walletben tárolt kártyával igen, és az ugyanúgy kártyazárolás. Sandbox Barion-fiók
  nélkül ez nem mérhető végig — **a doksi szerint igaz, sandboxban nem mérve**.
- **Lead-konfigurátor (első megrendelés).** A javaslat- és az ellenőrzés-végpont ugyanazt a
  regisztrátor-választ adja (`checkWebcimAvailability`). A jelölők: „Szabad” / „Foglalt” /
  „Nálunk nem igényelhető” (nem választható). Nem ellenőrizhető név esetén marad a mai
  „ellenőrizzük” (választható, a megrendeléskor visszaigazoljuk). Ott a vevő azonnal fizet, a
  zárolásos ígéret NEM vonatkozik rá (ADR-0078 ② él tovább az első rendelésre).
- **Élő végigpróba a dev-en** (Nyugalom Vendégház, sandbox-kártya): Szabad → Áttekintés → Barion →
  Authorized → regisztráció (mock) → Capture → `paid`, számla OV-2026-68. A Barion oldalán
  `Succeeded`, 1 000 Ft.

