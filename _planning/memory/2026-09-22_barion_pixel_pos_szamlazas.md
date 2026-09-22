# 2026-09-22 — A fizetési lánc élesítése: Full Pixel, éles POS, éles számlázás

## Mi történt (a nap három élesítése)

A Barion ügyfélszolgálati szálak lezárása indította: a tulaj kérdése („most mit kell még
csinálnom?") egy ticket-olvasásnak indult, és a teljes fizetési lánc élesítése lett belőle.

### ① Barion Full Pixel — a Starter-verdikt oka javítva

A Barion 2026-09-18-án az elfogadóhelyet **„egyelőre a Starter csomagban"** hagyta jóvá, mert
*„a Full Barion Pixel első két kötelező eseménye (1.1 grantConsent, 1.2 setEncryptedEmail) még
nincsen bekötve"*. **Igazuk volt** — és az őrünk (`barion-pixel-check`, Z1–Z7) közben **ZÖLD**
volt, mert a SAJÁT eseménylistánkat mérte, nem a Barionét. A hiányzó állítás nem piros: láthatatlan.

- Hivatalos kötelező minimum (docs.barion.com, „Mandatory events", Wayback):
  `grantConsent` · `setEncryptedEmail` · `contentView` · `addToCart` · `initiateCheckout` ·
  `initiatePurchase` VAGY `purchase`.
- ⚠️ **Külön bp-csatornán mennek**, ezért nem volt elég a `track`-ág: `bp('consent','grantConsent')`
  és `bp('identity','setEncryptedEmail', <kisbetűs e-mail>)` — a SHA-1-et a `bp.js` számolja.
- Bekötve: `grantConsent` az „Elfogadom" utáni sor **élén** (`cit-consent.js`), `setEncryptedEmail`
  a checkout `buyer_email` mezőjéből (change-figyelő + Fizetek-gomb ág, dedupe-pal).
- Az őr **ZM-kapuja** innentől a Barion listáját járja végig tételesen; önteszt: három szándékos
  törés, mindegyikre NEVESÍTETT piros (halott kontroll = bukás).

### ② Éles deploy + POS

`dcb130b` (tag `prod/20260922-1501`), 31 commit, 1 migráció. Utána a Barion POS élesre:
`api.barion.com` + éles POSKey + `BARION_PAYEE=olasz.ferenc@citoviso.com`. A kulcs a Barion API-n
igazolva (`NotExistingPaymentId` = hitelesítés átment, nem „hibás kulcs").

**A tulaj közben megkapta az ismétlődő fizetés engedélyét** (+0,2% felár; az egyszeri fizetés
díja fix 1,69% lett), és újranyitotta a -001-es észrevételt a Full Pixel felülvizsgálatára
(cél: Advanced, 1,19%).

### ③ Számlázás — a kulcsok fel voltak cserélve (lásd ADR-0206)

A tulaj levette a tesztüzemet az éles fiókról, én átállítottam a prodot `szamlazz`-ra — és a
zárás előtti memória-olvasás fogta meg, hogy a MEMORY.md nyitott kockázata pont erről szólt.
A vezérlőpult képe mutatta meg a valóságot: **három** fiók, és a prod/dev kulcs **fel volt cserélve**.

| Fiók | Szerep | Kulcs |
|---|---|---|
| Olasz Ferenc (CITO) | **prod** | `6prtpw82…` |
| TESZT OLASZ Ferenc (OV) | **dev**, tartós tesztüzem | `zcv8srk7…` |
| Olasz Ferenc (OLASZ), régi | **sehol** | `g3qefnzee…` → denylist |

## Tanulságok

- ⛔⛔ **Az őr a SAJÁT listánkat mérte, nem a külső követelményt** — zölden hallgatott egy valódi
  elutasítási okról. Külső partner követelményét a partner listájához kell kötni, tételesen.
- ⛔⛔ **A kulcs opálos, a fiók-szerep pedig a kódból MÉRHETETLEN.** Két érvényes kulcs ugyanazt a
  hitelesítés-választ adja; a fiókot csak a szolgáltató felülete mondja meg. Ezért lett a védelem
  ujjlenyomat-lista a boot-ponton (ADR-0206), nem „figyelj oda".
- ⛔ **A saját összefoglalóm lett majdnem a hamis premissza:** délután kimondtam, hogy „másik
  e-maillel megy a teszt-fiók" — a Számlázz.hu hibaüzenete cáfolta (az ADÓSZÁM köti a fiókot).
  A helyes út: az ÉLES fiókba belépve „Új számlázó fiókot hozok létre".
- ⭐ **A zárás előtti memória-olvasás fogott meg egy éles hibát.** A MEMORY.md 🔴 blokkja nélkül a
  rossz kulcs élesben maradt volna.

## Módosított fájlok

- `public/assets/runtime/cit-consent.js`, `assets/runtime/cit-configurator.js` — Pixel-események
- `scripts/barion-pixel-check.mts` — Z8/Z9 + ZM-kapu + 3-utas önteszt
- `src/invoicing/keyGuard.ts` (új), `src/invoicing/index.ts`, `src/invoicing/szamlazz.ts`,
  `scripts/invoice-key-guard-check.mts` (új), `hooks/pre-commit`
- `kb/entries/admin-modules/entry.hu.md` — modul-függőségi rend (a deploy KB-őrének lelete)
- `_planning/BARION-APPLICATION.md`, `_planning/DECISIONS.md` (ADR-0206)
- Éles `.env`: POS + `INVOICE_PROVIDER` + kulcs *(backupok: `env-pre-pos-*`, `env-pre-invoice-*`,
  `env-pre-keyfix-*`)*; dev `.env`: teszt-fiók kulcsa

## Nyitott

1. **A -001-es Barion-észrevétel felülvizsgálata** — a tulaj újranyitotta, a válasz az ő oldalukon.
2. **100 Ft-os próbavásárlás** (kupon-alapú, a tulaj saját címére) — a teljes éles kör bizonyítéka:
   terhelés → webhook → élesítés → **valódi** számla. Utána az előfizetést le kell mondani
   (a megújítás listaáron menne).
3. `kb/entries/admin-modules/entry.hu.md:80` — „a együttes" elütés; patch félretéve
   (`assets/design-refs/_drafts/typofix-egyuttes.patch`), a következő KB-körben megy be.
4. A székhely ékezete (`Kunó` vs. `Kuno`) — a 09-21-i jegyzet óta nyitott, éles engedélyt kér.
