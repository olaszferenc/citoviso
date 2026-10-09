# Ingyenes próba — admin próba-sáv (A) + lejárt próba — jóváhagyott terv

**Jóváhagyva:** 2026-10-09, tulajdonosi döntés (§2b terv-kapu): az admin-sáv „A” változata
(vékony sáv minden fülön), képek: `a-A-10nap-*.png`, `a-A-3nap-*.png`, `a-A-lejart-*.png`, `a-fizetve-*.png`.
**Vázlat:** `proba-C.html` (a próba-C mock: állapotváltó 10 nap / 3 nap / lejárt / fizetve + Mobil 390px / Asztali váltó).
**Megvalósítás:** `src/trial/admin.ts` (`trialAdminState`) · `src/server/adminViews.ts` (`trialStrip`, `trialLapsedBlock`,
`trialModulesCard`, `AdminOpts.trial`) · `public/assets/ui/citui-admin.css` (`.adm-trial*`, `.adm-trial-mods*`) · betöltés: `src/server/public.ts` · ADR-0344 (C2c).

**Hatókör:** `src/server/adminViews.ts` · `src/trial/admin.ts` · `public/assets/ui/citui-admin.css`

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **Aktív próba = sáv MINDEN fülön**, a lap tetején (a fejléc előtt), nem zárható be: a dátum az egy dolog, amit
   a tulaj nem veszíthet szem elől. Tartalma: hátralévő napok + a próba utolsó napja (rövid nap + hét napja),
   haladás-csík, egyetlen gomb.
2. **A szám a VALÓS hátralévő Budapest-naptári napok száma** (`trialDaysLeft`). 2+ nap: „Ingyenes próba: még {n} nap”;
   1 nap: „holnap jár le”; 0 nap: **„Ma jár le az ingyenes próba.”** Ha a próba vége elmúlt, de a napi lejáratás (07:00)
   még nem futott: **„Az ingyenes próba lejárt.”** (a mockban nem szerepelt; a „ma” rossz napon hazugság lenne, §B.17).
3. **Figyelmeztető tónus** 3 nappal a vége előtt (`TRIAL_WARN_DAYS = 3`) — sárga sáv (`adm-trial--warn`).
4. **Kedvezmény-mondat csak élő kuponnal** (`liveTrialCoupon` — ugyanaz a szabály, mint a T−3/T−1 levélé):
   „Ha folytatja, {percent}% kedvezményt kap az első díjból.” Kupon nélkül a mondat elmarad — nem ígérünk olyat,
   amit a pénztár nem adna.
5. **Egyetlen gomb:** **„Folytatom”** → `/p/<token>/folytatas` (ADR-0344 ④).
6. **Mobilon** (≤520px konténer) a haladás-csík eltűnik, a gomb teljes szélességű.
7. **Lejárt próba (lapsed):** a honlap szünetel, az admin él. A próbának nincs előfizetés-sora, ezért az előfizetéses
   fagyott-blokk nem jelenik meg (mérve 2026-10-09: az admin lejárt próbánál SEMMIT nem mondott) — helyette ugyanaz
   a piros blokk (`adm-frz`), de tartozás nélkül: cím „A honlapja szünetel — a próba {date} lejárt”, a próba-kupon
   %-a, gomb **„Folytatom — fizetés”**, **„Mi maradt meg”** lista, és **„Mit lát közben a látogató:”** sor.
   Az Áttekintésen teljes, a többi fülön kompakt (a „Mi maradt meg” nélkül). Az Állapot-csempe és az oldalsáv
   állapot-szava **„Szünetel”** (nem „Felfüggesztve” — a site `suspended`, de tartozás nincs; koordinátor, 2026-10-09).
   **A megőrzésnek határideje van (ADR-0345, ÁSZF 1.4):** a lista alatt a törlés NAPJA áll (próba vége + 90 nap,
   `purgeDay`; ha a 'p7' figyelmeztetés már kiment, a tényleges nap: `effectivePurgeDay`), és hogy előtte levelet
   küldünk: **„Ha nem folytatja, ezeket {date} véglegesen töröljük — előtte levélben szólunk.”** — a levél után:
   **„Ha nem folytatja, ezeket {date} véglegesen töröljük — erről levelet is küldtünk.”** ⛔ A korábbi „A szünet
   addig tart, amíg nem folytatja.” határidő nélküli ígéret volt (§B.17) — kivezetve (2026-10-09, koordinátor).
8. **Lejárt próba — „Modulok” kártya** (csak az Áttekintésen, a szünetel-blokk UTÁN; a kompakt füleken, aktív és
   fizetett próbánál nincs): cím „Modulok”, megjegyzés **„Szünet alatt csak olvasható. Fizetéskor a választott csomag
   kapcsol vissza; amit csak kipróbált, azt a Modulok fülön később is hozzáadhatja.”**, soronként a próba ADTA modulok
   (`module_entitlement.trial_grant` — pontosan amit a lejáratás kikapcsolt; kivezetett modul nélkül, katalógus-sorrendben,
   a Modulok fül tenant-nevével). A gerinc (katalógus `spine`, minden csomagban benne van) címkéje
   **„csomag · fizetéskor vissza”**, minden más próba-modulé **„csak a próbában volt”**, mindkettő halvány címke.
   Fizetett modul nem szerepel (azt nem a próba adta). Próba-modul nélkül nincs kártya.
9. **Fizetett próba (converted):** nincs sáv és nincs blokk — onnan az előfizetés beszél.

## Kötő horgony
- `data-trial-strip`
- `adm-trial--warn`
- `adm-trial__meter`
- `data-trial-lapsed`
- `data-trial-go`
- `TRIAL_WARN_DAYS`
- `data-trial-modules`

## NEM köt (nyitott)

- Nincs nyitott tétel. (A mock „Modulok” kártyája 2026-10-09 óta bekötve — lásd 8.)
