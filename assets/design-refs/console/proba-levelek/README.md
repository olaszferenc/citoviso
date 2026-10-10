# Ingyenes próba — levelek (T−3, T−1, próbás belépő-levél) — jóváhagyott terv

**Jóváhagyva:** 2026-10-09, tulajdonosi döntés (§2b terv-kapu): „A levelek szövege JÓVÁHAGYVA” —
T−3 e-mail (`t3-*.png`), T−1 e-mail (`t1-*.png`), próbás belépő-levél (`belepo-*.png`).
**Vázlat:** `proba-levelek.html` (levélváltó + Mobil 390px / Asztali váltó); a `level-*.html` a VALÓDI
építőkkel renderelt levél mintaadattal, a PNG-k a tulaj által jóváhagyott képek (a próba-C mockból).
**Megvalósítás:** `src/email/trialEmail.ts` (T−3/T−1) · `src/email/loginEmail.ts` (`trial` ág) ·
`src/email/platformLayout.ts` (`footerReason: "trial"`) · küldés: `src/trial/notices.ts` · ADR-0344 (kiegészítés).

**Hatókör:** `src/email/trialEmail.ts` · `src/email/loginEmail.ts` · `src/email/platformLayout.ts`

> **Kiegészítve / felülírva:** `../proba-c/` (ADR-0354 „C” + ADR-0356, jóváhagyva 2026-10-10). Az ADR-0354 óta
> indult próba EGY kedvezményt visz, a „Próba-kedvezmény”-t (a próba utolsó napjának végéig, az ELSŐ díjra) —
> a lenti 3., 4., 7. pont kupon-szövege csak a C ELŐTT indult (élő kuponos) próbákra érvényes; a C-szöveg a lap alján.

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **A keret a platform-levél** (`../platform-email/`): logó, egy sötétkék gomb, adat-panel, cégadatos lábléc.
2. **T−3 tárgy:** **„Még {n} nap az ingyenes próbából – {site}”**, címsor: **„{n} nap múlva lejár az ingyenes próba”**.
   **T−1 tárgy:** **„Holnap lejár az ingyenes próba – {site}”**. ⛔ A szám a VALÓS hátralévő napok száma
   (Budapest naptári nap), nem a lépcső neve: hétvégére eső lépcső a pénteken megy, és ott a „Holnap” hazugság
   lenne (§B.17). Kiesés utáni, a lejárat napján menő pótlás: „Ma lejár az ingyenes próba”.
3. **Szöveg:** **„{Art} {site} honlapjának ingyenes próbája {until} lejár.”** (a dátum „2026. október 22-én, csütörtökön”
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

## ADR-0354 „C” — a Próba-kedvezmény (`../proba-c/3-levelek-sms.html`, jóváhagyva 2026-10-10)

Forrás: `trialDiscount` (`src/trial/offer.ts`) — `kind: "trial"` = C; `kind: "coupon"` = a C előtti kupon (a fenti szöveg).

10. **T−3 / T−1 / lejárat-napi levél:** **„Ha a próba végéig, {date}-ig megrendeli, {p}% kedvezményt kap — éves fizetésnél az első évre, havinál az első hónapra. Utána a listaár érvényes.”**
    (a dátum „2026. október 23” alakú, félkövér). Adat-panel: **„Próba-kedvezmény”** = **„−{p}%”**, **„Érvényes”** = **„{date}-ig, a próba végéig”**.
11. **CSAK a T−1 levélben** (`../proba-c/4-nevvaltas.html`, ADR-0356): **„Tetszik a cím? Most {host} — megrendeléskor ingyen megváltoztathatja.”**
    — a {host} a honlap mai címe (élő saját domain, különben `<slug>.citoviso.com`); a T−3-ba és az SMS-be nem kerül.
12. **SMS (ékezet nélkül, ≤ 2 szelet, a link sosem rövidül):** T−3 **„Ha addig megrendeli, -{p}% az első díjból: {url}”**,
    T−1 **„Holnapig -{p}% az első díjból: {url}”**, a lejárat napján **„Ma éjfélig -{p}% az első díjból: {url}”**.
    Kedvezmény nélkül változatlanul „Folytatás: {url}”.
13. **Belépő-levél:** adat-panel **„Próba-kedvezmény”** = **„−{p}%, ha {date}-ig megrendeli (évesen az első évre)”**, és a próba-bekezdés végén
    **„Ha a próba végéig megrendeli, a díjból {p}% kedvezményt kap — évesen az első évre, havinál az első hónapra.”**
