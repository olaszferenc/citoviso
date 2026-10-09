# Ingyenes próba — levelek (T−3, T−1, próbás belépő-levél) — jóváhagyott terv

**Jóváhagyva:** 2026-10-09, tulajdonosi döntés (§2b terv-kapu): „A levelek szövege JÓVÁHAGYVA” —
T−3 e-mail (`t3-*.png`), T−1 e-mail (`t1-*.png`), próbás belépő-levél (`belepo-*.png`).
**Vázlat:** `proba-levelek.html` (levélváltó + Mobil 390px / Asztali váltó); a `level-*.html` a VALÓDI
építőkkel renderelt levél mintaadattal, a PNG-k a tulaj által jóváhagyott képek (a próba-C mockból).
**Megvalósítás:** `src/email/trialEmail.ts` (T−3/T−1) · `src/email/loginEmail.ts` (`trial` ág) ·
`src/email/platformLayout.ts` (`footerReason: "trial"`) · küldés: `src/trial/notices.ts` · ADR-0344 (kiegészítés).

**Hatókör:** `src/email/trialEmail.ts` · `src/email/loginEmail.ts` · `src/email/platformLayout.ts`

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **A keret a platform-levél** (`../platform-email/`): logó, egy sötétkék gomb, adat-panel, cégadatos lábléc.
2. **T−3 tárgy:** **„Még {n} nap az ingyenes próbából – {site}”**, címsor: **„{n} nap múlva lejár az ingyenes próba”**.
   **T−1 tárgy:** **„Holnap lejár az ingyenes próba – {site}”**. ⛔ A szám a VALÓS hátralévő napok száma
   (Budapest naptári nap), nem a lépcső neve: hétvégére eső lépcső a pénteken megy, és ott a „Holnap” hazugság
   lenne (§B.17). Kiesés utáni, a lejárat napján menő pótlás: „Ma lejár az ingyenes próba”.
3. **Szöveg:** **„{site} honlapjának ingyenes próbája {until} lejár.”** (a dátum „2026. október 22-én, csütörtökön”
   alakú), majd ha van próba-kupon: **„Ha folytatná, a próbához kapott kedvezménnyel teheti: {percent} az első díjból, {until}-ig.”**
   Kupon nélkül ez a bekezdés és a két kupon-sor elmarad — kedvezményt nem ígérünk, ami nincs.
4. **Adat-panel:** „A próba vége” (2026. okt. 22. (csütörtök)) · „Kedvezmény” · „A kedvezmény érvényes”.
5. **Egyetlen gomb:** **„Folytatom”** → `/p/<token>/folytatas` (ADR-0344 ④). Link nélkül a levél nem megy ki
   (a küldő hangosan bukik), mert gomb nélkül a levél célja veszne el.
6. **Megnyugtató zárás:** **„Ha nem folytatja, nem terhelünk semmit — kártyát nem is kértünk.”** + mi marad meg,
   HATÁRIDŐVEL (ADR-0345, ÁSZF 1.4; tulaj-döntés 2026-10-09): **„A szerkesztő felülete és minden feltöltött adata a próbaidő végétől számított 90 napig megmarad; ha addig fizet, a honlap azonnal visszakapcsol.”**
   ⛔ A korábbi határidő nélküli „…megmarad; ha később fizet…” kivezetve (§B.17).
7. **Próbás belépő-levél:** **„Elindult {art} {site} ingyenes próbája: a honlap él, és minden modul be van kapcsolva.”**
   Az adat-panelben a felhasználónév mellett „A próba vége” és „Kedvezmény, ha folytatja”; a gomb alatt
   **„3 nappal és 1 nappal a vége előtt szólunk.”**; a szünet-mondat határidővel: **„ha nem folytatja, a honlap szünetel, az adatai a próbaidő végétől számított 90 napig megmaradnak.”**. A felhasználónév, a jelszó-gomb és a 7 napos megjegyzés változatlan.
8. **Lábléc próbánál:** **„oldalát a Citovisónál próbálja ki.”** — a rendelő vevőnél változatlanul „…rendelte meg.”
9. **Ablak:** csak hétköznap 9–16 (ADR-0334), az óránkénti tick viszi. **Az SMS SZÁRAZ** (a forma — ékezet, link —
   a tulajnál van): nem megy ki, és sort sem foglal.
