# 2026-10-15 — A szállásadó visszatalál a belépéshez (tulaj-lelet, [TESZT] Matróz)

SUB a deploy-koordinátornak (`citfb4ed7ab`), brief: `~/rc-briefs/tenant-login-findability-20261015.md`.

**Lelet (tulaj, éles):** próba → levél → jelszó → admin → ablak bezárva → nem tudta, hol lépjen be újra.
A belépő cím a „Belépési adatai” levél legalján, apró jegyzetben állt; az „Új jelszó” levélben sehol;
a siker-lap 2,5 mp múlva továbbvitt cím nélkül; a felhasznált link lapja csak új linket kínált.

**Javítás (élesre NEM ment — a deploy a koordinátoré):**
1. „Belépési adatai” + „Új jelszó beállítása”: **Belépés: citoviso.com/login** sor a részletek-dobozban a
   Felhasználónév alatt, a szövegben is a jelszó-link előtt (`src/email/loginEmail.ts`).
2. Közös platform-keret (`platformMail`): **minden** szállásadói levél végén „Belépés a szerkesztő felületre:
   citoviso.com/login” (HTML + szöveg, nem magyar olvasónál `?lang=`). Kikapcsolás csak: belépő-levelek (a
   dobozban már ott van) és a fizetés előtti rendelés-levelek (még nincs fiók). Inline tulaj-levelek
   (érdeklődés, vendégvélemény): `ownerLoginLine()`. Egy URL-forrás: `tenantLoginUrl(lang)`.
3. Jelszó-lapok: űrlap megnevezi a későbbi címet; siker-lap felhasználónév + cím doboz, a továbblépés 2,5 → 8 mp
   (különben elolvashatatlan); felhasznált/lejárt link: „Ha a jelszavát már beállította…” + **Belépés** gomb elöl,
   „Új linket kérek” másodiknak.
4. Admin Fiók-kártya: „Belépés címe” mező + „Érdemes elmenteni a könyvjelzők közé.”
5. Élő honlap: a „Tulajdonosi belépés” lábléc-link és a `/admin` → login már létezett. ÚJ: a **szünetelő** oldalon
   (lejárt próba, fagyasztás) is: `/admin`, `/login` → belépés (eddig 503), és a lábléc-link rajta van.
6. Próbázó lead `/p/` linkje: kódból mérve már most a „owned” nézet fut (nincs rendelés-/próba-pirula,
   „Belépés a kezelőfelületre” gomb → login). Dev DB-ben nincs próbázó lead, ezért képernyőkép nem készült.
   Mellékes: ennek a sávnak a szövege beégetett magyar (nem `T()`) — külön javítandó.

**Őr:** `scripts/owner-login-mail-check.mts` (pre-commit, önteszt piros): 18 levél-builder renderelve,
`ownerLogin:false` engedélylista, belépő-levelek sora, inline levelek, jelszó-lapok, szünetelő oldal.
**KB:** `admin-account` „Hol lépek be?” szakasz + képek. ⚠️ A KB-fordítás (`kb-translate.mts`) a deploy kapuja —
12 admin-súgó már eddig is lemaradt.

Képek: `assets/design-refs/_drafts/login-findability/*.png` (gitignore-olt).
