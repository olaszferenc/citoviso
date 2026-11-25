# 2026-11-25 — Barion EUR: saját sandbox-bolt EUR-tárcával, HR végpróba fizetve végig

Session `cit234c10a1`, koordinátor `cit9b4690e3`, brief `~/rc-briefs/barion-euro-tarca-20261122.md`. Élesen NINCS.

## Mi történt
- 11-22: a közös dev sandbox-bolt EUR-ra `NotExistingCurrency` (400), HUF-ra Prepared. Belépési adat a Barion-fiókhoz nem volt a gépen.
- 11-25: a tulaj az ÉLES fiókban megnyitotta az EUR-számlát. A közös sandbox-bolt (más fiók) továbbra sem fogad EUR-t.
- A koordinátor (b) döntése: saját sandbox-fiók. Regisztráció (Üzleti, elek@citoviso.com), aktiválás az elek@ IMAP-ból,
  „Új pénznem” → EUR, elfogadóhely „Citoviso EUR sandbox” (Szolgáltatás, Starter fix), beküldés jóváhagyásra
  (`POST /Shop/SubmitShopForApproval`, a gomb headless böngészőben nem indította), POSKey a `/ShopSecurity` lapról
  egyenesen a 600-as fájlba. Közvetlen EUR Payment/Start 7 € → Prepared.
- `scripts/lib/hr-world.mts`: `BARION_SANDBOX_ENV_FILE` (külön sandbox-bolt, ugyanaz a sandbox-kerítés); `invoice: "szamlazz-test"`
  (dev .env TESZT Agent-kulcs, a keyGuard dönt; a kerítés átengedi a szamlazz.hu-t és az MNB-t); a friss mock
  `terhatasAt = MOCK_HEROFIX_STAMP` bélyeget kap (a mai generátorral készült — a kapu változatlan, a világ nem függ a faliórától).
- `scripts/hr-vegproba-e2e.mts --barion-pay [--szamlazz-test]`: „alap” csomag (7 €/hó), a horvát Barion-oldal tesztkártyával
  (vevő-cím example.com — a boltgazda e-mailjével a Barion nem enged fizetni), a visszahívás helyben a konzolra.
  Eredmény: paid EUR 700 → számla `OV-2026-97` (Számlázz TESZT, EUR, AAM, MNB 373,40 / 2026-11-25) → bérlő + domain (mock) → aktiváló levél horvátul.
  A sandbox-tárca: EUR €13,80 (két 7 €-s fizetés, −€0,10 díj darabonként).

## Nyitott (nem a fizetésé — átadva a koordinátornak)
- ④/⑤ (6 piros): a 11-24/25-i render-minőségkapu a teszt-világ kép nélküli mockját elutasítja (stock kép a lapon +
  a munkafában nincs `models/clip-vit-b32-vision-q8.onnx`, a `rc-wt-prepare.sh` nem linkeli). A ⑤ „Zanima me” dropped:1
  ennek következménye: a Lavanda levél nem ment ki, így a válasz nem talál elküldött kontaktot (`loadSentContacts`).
- A sandbox-jelszó egyszer egy Playwright-hibaüzenetben a session naplójába került → a jelszó lecserélve, a fájlban az új.

## Fájlok
- scripts/lib/hr-world.mts · scripts/hr-vegproba-e2e.mts · MEMORY.md · ez a jegyzet

## 2. kör (koordinátor: ④/⑤ döntés + order_intent kérdés)
- **order_intent „submitted” + tenant_id NULL fizetés után: szándékos** (K-1, `orderIntentState`; migráció 0036 CHECK:
  `kind='initial'` ⇒ `tenant_id IS NULL`; a riport a bérlőt a leaden át keresi). HU-n ugyanez. Nem módosítottam; a végpróba méri.
- **Teszt-világ fotók:** `scripts/fixtures/hr-world/photos/sweet-1..7.jpg` (Sweet Apartments Makarska dev-lead `45331b54`,
  saját oldal, mind a 7 CLIP-en átmegy). A világ egy 127.0.0.1-es szerveren szolgálja ki, a lead `raw.portalProfiles`
  saját-oldal profilként kapja (a profil-URL is a helyi szerver: a photoQuality „idegen domain” szabálya miatt).
- **Új kiküldési kapuk (11-25):** a minőségi kolléga pass-a és a tulaj jóváhagyása — a világ a valódi rögzítőkkel
  (`recordQaReview`, `recordOwnerApproval`) adja meg; a kapuk változatlanok.
- `~/bin/rc-wt-prepare.sh` (CIT-gépspecifikus) a `models/`-t is symlinkeli; `.gitignore`: `models` (a symlinkre is illik).
  A meglévő munkafákba nem pótoltam.
- Eredmény: `hr-vegproba-e2e` mock 33/33, `--barion-pay --szamlazz-test` 42/42 (számla OV-2026-98: 5,25 € = 7 € −25 % megkeresési
  ajánlat, mert a hideg levél is kiment); `country-hr-fix-e2e`, `nemzetkozi-b-e2e` zöld.
