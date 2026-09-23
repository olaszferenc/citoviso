## ADR-0172 — A hatókör-szabály a PROCESSZ-HATÁRON is átér: a vevő fizetési útja Pixel nélkül futott (2026-09-15)

- **Kiváltó:** a tulaj kérése, hogy nézzem meg a `/pay/mock` fizetés-lapot is. A lap maga
  ártalmatlan (dev-only mock; élesben `PAYMENT_GATEWAY=barion`, `mock_` hivatkozás nem keletkezik
  — mérve: éles 404). De a KONZOL processzen él, és az egész processzről hiányzott a szabály.
- **Amit MÉRTEM, élesben (`citoviso.com`, olvasás — §0.4).** Az
  `/etc/nginx/sites-enabled/citoviso` a domaint KÉT processz között osztja fel, és a hasítás
  pont a vásárlási úton megy át:

  | útvonal | processz | sáv+Pixel (javítás előtt) |
  |---|---|---|
  | `/`, `/login`, `/adatvedelem`, `/aszf`, tenant-admin | public :4800 | **VAN** |
  | **`/configure/…`** (a vásárlás indulása) | konzol :4600 | **NINCS** |
  | **`/pay/…`**, köztük a **`/pay/done`** (Barion `RedirectUrl`) | konzol :4600 | **NINCS** |
  | `/privacy`, `/p/…`, `/site/…`, `/mock/…` | konzol :4600 | NINCS |

  Vagyis a vevő **teljes fizetési útja** a csalásmegelőző jelzés nélkül futott, miközben a saját
  kódunk kommentje kimondja: *„a Barion előírása szerint a Pixelnek a webshop MINDEN oldalán ott
  kell lennie."* Ez az ADR-0151 TÜKÖRKÉPE: nem „követés ott, ahol tilos", hanem „nincs követés
  ott, ahol kötelező".
- **Második, mért lelet:** a `citoviso.com/adatvedelem` (8636 B, sáv+Pixel) és a
  `citoviso.com/privacy` (8290 B, tiszta) UGYANAZ a `privacyPage()` — csak más processz adja ki.
  És épp a `/privacy` az a cím, amit a **már kiküldött hideg levelek** tartalmaznak. Egy szabály
  két példányban két igazság.
- **Döntés ① — a snippet és a címzett-szabály KÖZÖS MODULBA kerül** (`src/server/consent.ts`).
  Amíg a szabály egy szerver-fájl belügye volt, a másik processz nem is tudott róla. A `public.ts`
  viselkedése bájtra változatlan maradt (az őr 269 állítása előtte-utána zöld).
- **Döntés ② — a konzolon is a CÍMZETT dönt, egy olvasható listában.** A kívülről elérhető hat
  útvonal NEM egy kategória: `/p/`, `/configure/`, `/mock/`, `/site/` a **szállás oldalát** adja
  ki (artefaktum-fájl, legfeljebb a mi rétegünkkel) → vendég; `/pay/…`, `/admin/<token>` és a
  jogi lapok a **mi vevőnknek** szólnak → own; minden más a **belső operátor-felület** → nincs
  követés, de MÁS okból (a saját munkatársaink követése a csalásmegelőző jelzést is hígítaná).
  ⚠️ A `/p/<token>`-ről a vásárlás el tud indulni, a lap mégis vendég-lap: a FIZETÉS a `/pay/…`-on
  és a Barion saját lapján történik, a Pixel oda kell — egy süti-sáv a mockon ráadásul arról is
  hazudna, hogyan fog kinézni a kész oldal.
- **Döntés ③ — a lapot kiszolgáló processz szolgálja ki azt is, ami nélkül a lap hazudik.**
  A konzol MÉRTEN **303**-at (login-redirect) adott a `/assets/runtime/*`-ra: a fizetés-lapra
  kitett sáv CSUPASZ lett volna, a Pixel el sem indult volna. Élesben ezt az nginx elfedte volna
  (a `/assets/` a public szerverre megy) — de **egy proxy-sor nem lehet a jogi megfelelés egyetlen
  lába**. A statikus ág `ui|runtime`-ra bővült, az auth-kapu ELŐTT.
- **Döntés ④ — a `/pay/mock` lap a KÖZÖS kimeneten megy ki.** Ez a lap `res.end()`-del
  megkerülte a `send()`-et (a no-store fejlécek miatt), tehát a beillesztés pont a fizetés-lapról
  maradt volna ki — ugyanaz a hibaosztály, egy fájllal arrébb. A `send()` kapott egy ötödik,
  fejléc-paramétert; megkerülő ág nem maradt.
- **A kockázat, amit előre kimondtam és MEGMÉRTEM:** ha a Pixel odakerül, a sáv is — és az
  ADR-0145 ④ épp azt mérte ki, hogy a sáv eltakarhatja a gazdalap vezérlőit; fizetés-lapon ez
  súlyosabb. Mérve a VALÓDI fizetés-lapon (önmagát takarító fixture, „Fizetek ▸" + „Elutasítom"
  bizonyítottan renderelve), 390 és 1280 px: a sáv a navy tokenből fest, az „Elfogadom" a cián
  tokenből (a `.con button` specificitás-csapda NEM harap, mert az ADR-0145 mindent
  `#cit-consent`-hez horgonyzott), és **egyetlen vezérlőt sem takar** egyik méreten sem.
- **Őr:** `scripts/consent-style-check.mts` — mostantól MINDKÉT processzt felhúzza és méri.
  Új állítások: a konzol saját lapjain VAN sáv+Pixel (pozitív kontroll, köztük a VALÓDI
  `/pay/done` a park kifizetett rendeléséből), a vendég- és operátor-lapjain NINCS (és a
  felirat a CÍMZETTBŐL származik — egy „vendég-oldal" indoklás egy `/login`-on más kérdésre
  válaszolna), **ugyanaz a jogi dokumentum mindkét processzen ugyanúgy viselkedik**, és a konzol
  **maga** szolgálja ki a sáv eszközeit. **397 zöld.**
  **Piros önteszt kétszer:** a beépített `--self-test` 127 → **178** piros (öt rontás); a valódi
  javítást visszarontva **19 bukás, exit 1**, név szerint a konzol fizetés-lapjaival, a
  processz-eltéréssel és a 0 bájtos eszközökkel.
- ⛔ **Egy saját mérési hiba, menet közben:** a takarás-vizsgálatom BÁRMILYEN takaró elemre
  pirosat adott, és ezzel MÁS KÉRDÉSRE válaszolt, mint a neve. Élesben elbukott rajta a
  fizetés-visszatérő lap egy SOREMELT inline linkje: a kétsoros `<a>` befoglaló dobozának
  középpontja a két sor KÖZÉ esik, ezért az `elementFromPoint` a szülő `<p>`-t adta vissza —
  miközben a sáv 362 px-rel lejjebb volt. A verdikt mostantól „takarja-e A SÁV"; ha más takar,
  azt KIÍRJUK (nem nyeljük el), de nem ennek az őrnek az ítélete.
- ⛔ **És egy fixture-hiba:** az első fizetés-lap mérésem „0 vezérlő / 0 takarva" zöldet adott —
  a hivatkozásom nem volt hexa, ezért a route 404-re esett. Egy 0-ból-0 nem mérés; a fixture
  azóta BIZONYÍTJA a saját útját (a két gomb jelenlétével).
- **Visszafordíthatóság:** 🔄 egy modul-kivonás + két lista + egy regex-bővítés.
- **Státusz:** ELFOGADVA (tulaj választott, 2026-09-15). ⚠️ **ÉLESÍTÉS NINCS** (§0.3) — de ez a
  javítás csak deploy után ér ki, és addig az éles fizetési út Pixel nélkül fut.
- ⚠️ **Sorszám:** a blokk `0170`-ként készült (fetch után ellenőrzött számmal), de a landolásig
  KÉT párhuzamos szál landolta a 0170-et és a 0171-et → **`0172`**. Ötödik nap, hogy a szám a
  land pillanatában csúszik; a közös doksit az `origin/main`-ről ÚJRA ÉPÍTETTEM, és csak a SAJÁT
  blokkom számát írtam át.
- 🔗 **Kapcsolódás:** a `_planning/BARION-APPLICATION.md` #3 tétele („Base Barion Pixel beépítve")
  ✅-t ad — és jól teszi: az a követelmény a base Pixel MEGLÉTÉT kéri, azt pedig a főoldalon
  mérte. Az én leletem MÁS kérdés: a Pixel a fizetési ÚTRÓL hiányzott. A „MINDEN oldalán"
  megfogalmazás a SAJÁT kódunk kommentjéből való, nem hivatkozott Barion-forrásból — ezért itt
  nem állítom, hogy emiatt elutasítanának. A javítás indoka így is áll: egy dokumentum nem
  viselkedhet kétféleképpen attól, melyik processz adja ki, és a csalásmegelőző jelzésnek a
  fizetés közelében van a legtöbb értelme.
