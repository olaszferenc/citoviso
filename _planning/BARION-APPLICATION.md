# Barion éles elfogadóhely — igénylési csomag

*Összeállítva: 2026-09-09. Minden adat MÉRVE (az éles `.env`-ből és az élő oldalról
olvasva), nem emlékezetből. A `⚠️` jelölt sorok azok, amiket csak te tudsz megadni.*

> **Miért ez a leltár legfontosabb tétele:** amíg a jóváhagyás nincs meg, a rendszer nem tud
> pénzt beszedni. Minden más blokkoló ez alatt sorakozik.
>
> ✅ **Átfutás — HIVATALOS forrásból (2026-09-15, Playwright-renderrel kiolvasva):**
> *„Ez általában **3–5 munkanapot** szokott igénybe venni a beérkező kérvények számától
> függően."* ([Hogyan válhatok Barion elfogadóhellyé?](https://www.barion.com/hu/ugyfelszolgalat/elfogadohely/elfogadohely-letrehozasa-es-kezelese/hogyan-valhatok-barion-elfogadohellye/))
> Hiánypótláskor visszaküldik, javítás után újra bírálják. *(A korábbi „hetekben mérhető"
> állítás forrás nélküli volt — helyesbítve.)*

---

## 1. Amit az igénylőlapra másolsz

| Mező | Érték |
|---|---|
| Cégforma | Egyéni vállalkozó |
| Név | **Olasz Ferenc e.v.** |
| Székhely | **2100 Gödöllő, Klebelsberg Kunó utca 6.** |
| Nyilvántartási szám | **53483083** |
| Adószám | **69646014-1-33** |
| E-mail | **olasz.ferenc@citoviso.com** |
| Weboldal | **https://citoviso.com** |
| Tevékenység | Weboldal-készítés és -üzemeltetés előfizetéses formában (SaaS), kis- és középvállalkozásoknak |
| Értékesített termék | Havi/éves előfizetés weboldal-szolgáltatásra + opcionális modulok |
| Ár | 3 900 Ft/hó, éves fizetésnél 39 000 Ft/év (2 hónap kedvezmény) |
| Várható tranzakció | Kis összegű, ismétlődő (előfizetés), belföldi |
| ⚠️ Bankszámlaszám | *(te adod meg — ide utal a Barion)* |
| ⚠️ Azonosító okmány | *(személyazonosításhoz kérni fogják)* |

## 2. A weboldal-követelmények — MIND KÉSZ (élesen ellenőrizve)

A bíráló az élő oldalt nyitja meg. Ezek mind elérhetők, **weboldalon és nem letölthető
PDF-ként** (ez kifejezett elvárás):

| Követelmény | Hol | Állapot |
|---|---|---|
| ÁSZF / Vásárlási feltételek | https://citoviso.com/aszf | ✅ 200 |
| Adatkezelési tájékoztató | https://citoviso.com/adatvedelem | ✅ 200 |
| Impresszum (cégadatok) | https://citoviso.com/impresszum | ✅ 200 |
| Elállási tájékoztató | https://citoviso.com/elallas | ✅ 200 |
| Ár feltüntetése | a nyitóoldal „Árazás" szakasza (`#ar`) | ✅ 39 000 Ft/évtől |
| A fizetési szolgáltató megnevezése az ÁSZF-ben | ÁSZF 2. pont | ✅ **ÉLESEN KINT** (2026-09-10) |

## 2b. TELJES BARION-CHECKLIST — kutatás (2026-09-15) × mérés (élő oldal + kód)

*Forrás: a hivatalos barion.com súgó (Playwright-render) + docs.barion.com (Wayback).
A bíráló ezt a listát pipálja; hiánynál: „az elfogadóhelyedet visszaküldjük hiánypótlásra".*

| # | Követelmény (hivatalos) | Nálunk — MÉRVE | Verdikt |
|---|---|---|---|
| 1 | Domain a vállalkozás tulajdona (kártyatársasági szabály; e.v.-nél a tulajdonos magánszemély is OK) | citoviso.com — a tulaj kezeli (Cloudflare); whois-igazolást kérhetnek | ⚠️ tulaj igazolja |
| 2 | **Barion-logósor a főoldalon ÉS a fizetési oldalon**, módosítás nélkül — *„omitting it results in rejecting live shops"* | **NINCS SEHOL.** Főoldal: az egyetlen „barion" találat a Pixel gif-je. Checkout: csak szöveg („a Barion biztonságos oldalán", `adminViews.ts:355`), logó-kép nulla | ⛔ **BUKÓ TÉTEL** |
| 3 | Base Barion Pixel beépítve | ✅ él a főoldalon (`BP-rTpo59JAam-6C`, script+noscript), hatókör-szabállyal (ADR-0145) | ✅ |
| 3b | *(kiegészítés, ADR-0172 — MÁS kérdés, mint a 3.)* A Pixel a **fizetési ÚTON** | ⛔ **2026-09-15-ig élesben NEM volt ott**: a `/configure/…` és a `/pay/…` (köztük a `/pay/done`, a Barion `RedirectUrl`) az nginxen a KONZOL processzre megy, ahol sem sáv, sem Pixel nem került ki. Lokálban javítva (ADR-0172); **élesen deploy után ér ki**. ⚠️ Hivatkozott Barion-forrást a „minden oldalon" követelményre NEM találtam — a 3. tétel verdiktje ezért áll | 🔧 javítva, deploy vár |
| 4 | ÁSZF webes lapként (nem PDF), a vásárlás előfeltétele | ✅ `/aszf` 200, webes; a checkout pipa-kapuja elfogadtatja | ✅ |
| 5 | ÁSZF: üzemeltető neve + **cégjegyzékszám/nyilvántartási szám** + székhely + adószám + e-mail + **telefonszám** | Név ✓, Gödöllő ✓, adószám ✓ — **„nyilvántartási" 0 találat, „telefon" 0 találat** az élő `/aszf`-en | ⛔ két mező pótlandó |
| 6 | ÁSZF: kötelező Barion-példamondat (H-EN-I-1064/2013, „kártya-adatok a kereskedőhöz nem jutnak el") | ✅ mérve: „Barion Payment Zrt." + „H-EN-I-1064/2013" + kártya-adat-mondat kint | ✅ |
| 7 | ÁSZF: teljesítés átlagos ideje | ✅ „a fizetést követően azonnal megkezdi" — kimondott teljesítési szabály | ✅ |
| 8 | ÁSZF: elállás (14 nap) + békéltető testület | ✅ mérve: elállás 2, „14 nap" 1, békéltető 1 találat | ✅ |
| 9 | GDPR-tájékoztató + süti-banner | ✅ `/adatvedelem` 200 + süti-sáv él (ADR-0145 hatókörrel) | ✅ |
| 10 | Valós termék, valós áron, leírással megvásárolható (próbavásárlás!) | Ár kint (`#ar`), DE a vásárlás belépés mögött → teszt-belépő kell (lásd 3b.) | ⚠️ teszt-fiókkal oldható |
| 11 | Kosártartalom (`Items[]`) VALÓDI terméknévvel (Starter/Advanced csomagnál kötelező) | ✅ `barion.ts:85,147`: „Citoviso előfizetés megújítás (éves/havi)", „Citoviso modul-bővítés — időarányos első díj" | ✅ |
| 12 | Tárca-feltöltés banki átutalással (akár 1 Ft) a vállalkozás számlájáról = azonosítás | tulaj-teendő; Turbó (kártyás) feltöltés NEM jó erre | ⚠️ tulaj |
| 13 | Adatlap: URL (https) + kategória + **leírás (20–200 kar.)** | mindhárom ÜRES (3a.) | ⛔ tulaj tölti |

**A zárt rendszer HIVATALOS forgatókönyve — a tulaj kérdésére a válasz:** a belépés mögötti
vásárlás NEM kivétel, a Barion adatlapján külön mező van rá. Szó szerint: *„**Egyéb adatok:**
Ha a weboldalad nem nyilvános, itt add meg azokat az adatokat, amikkel a Barion munkatársai a
jóváhagyás részeként próbavásárlást indíthatnak a webshopodban: **URL, tesztfelhasználó neve
és jelszava**, stb."* Ugyanide való a logó-halasztás indoklása is, ha a Barion-logót csak
jóváhagyás után tennénk ki. (A MotiBro — maga is zárt, bejelentkezéses rendszer — pontosan
így csinálja: teszt-fiókot generál a bírálónak.)

## 2c. ISMÉTLŐDŐ FIZETÉS — külön engedély, külön út (kutatás 2026-09-15)

- **Alapértelmezés a „Nem", és nem önkiszolgáló.** docs.barion.com/Token_payment: *„Premium
  feature — not allowed automatically for every approved shop and should be requested from
  Barion!"* Hibakód is van rá: `RecurringPaymentNotAllowed`.
- **A kérés útja:** Barion tárca → **Ügyfélközpont → jegy nyitása**, indoklással („describe
  why you need this feature"). Nem e-mail, nem a bolt-beállítás. *„Contact our experts well
  in advance"* — tehát MOST érdemes megnyitni, nem a jóváhagyás után.
- **A mi integrációnk típusa helyes:** a kód `RecurrenceType: "MerchantInitiatedPayment"`-et
  használ (`barion.ts:71,134`) — ez a változó összegű MIT, ami a modul-upsell miatt NŐHETŐ
  havidíjhoz kell (a `RecurringPayment` típusnál a terhelés nem lehet nagyobb az elsőnél).
- **A checkout-hozzájárulás a MI felelősségünk:** *„The Barion payment does not indicate in
  any way that the payment is a token payment"* — a kártya-mentésről, a terhelés
  gyakoriságáról és a lemondás módjáról a saját fizetés-lapunknak és ÁSZF-ünknek kell
  kifejezett hozzájárulást kérnie. (A checkout pipa-kapu + „AZ ELŐFIZETÉSE" doboz erre jó
  alap — a jegyben linkelni kell.)
- **Sandbox:** ott a token-fizetés alapból él (*„token payment scenarios are enabled by
  default"*) — ezért működött eddig; éles tokenre NEM vihető át.

## 3. ✅ AZ ÉLESÍTÉS MEGTÖRTÉNT — az oldal bírálat-kész

**2026-09-10:** kiment a teljes állapot (`d9eb7dd`, tag `prod/20260910-1828`) — 77 commit,
9 migráció. A bírálat szempontjából mindkét hiányzó tétel ÉLESEN ellenőrizve:

1. ✅ **Az ÁSZF megnevezi a fizetési szolgáltatót.** Élesen mérve a `citoviso.com/aszf`-en:
   „Barion Payment Zrt." ✓ · „H-EN-I-1064/2013" ✓ · „a bankkártya-adatok a Szolgáltatóhoz nem
   jutnak el" ✓. *(A deploy előtt: NULLA említés.)*
2. ✅ **A térképes túlígéret kikerült.** A nyitóoldal már „megtalálnak a **Google-keresésben**"-t
   ír. Élesen, 390px-en ellenőrizve, 0 JS-hibával.

Mind az öt jogi/ár-oldal 200-as: `/`, `/aszf`, `/adatvedelem`, `/impresszum`, `/elallas`.

> ⚠️ A GATE 1c (tudásbázis-őr) **öt körön át blokkolta** a deployt, és minden körben valódi
> hibát talált — köztük egy néma kód-hibát (a nyitókép-csere megtagadása nem jutott el az
> operátorhoz) és egy korpusz-szintű renderelési hibát (35 súgóból 4 listája volt ép).

**A weboldal-követelmények felől az igénylés beadható — de lásd a 3b. pontot.**

## 3a. ✅ AZ IGÉNYLÉS BE VAN ADVA — és három mező HIÁNYZIK (2026-09-14, a tulaj képernyőképéről)

Az éles `secure.barion.com` üzleti profilon a **„Citoviso" elfogadóhely LÉTEZIK**, státusza
**„Jóváhagyásra vár"**. Publikus azonosító: `af0d98fe-d456-42f8-bc89-6b6a8651d2ad`.
Engedélyezett fizetési módok: bankkártya, Barion egyenleg, átutalás, Apple Pay, Google Pay.

⛔ **Amit ugyanez a lap ÜRESEN mutat — és a bírálat ezen múlhat:**

| Mező | Állapot | Miért baj |
|---|---|---|
| **Elfogadóhely URL-je** | **ÜRES** | A bíráló ezt nyitná meg. Enélkül nincs mit bírálnia — a 2. szakasz összes zöld jogi oldala láthatatlan marad. Ide a `https://citoviso.com` kell. |
| Elfogadóhely kategóriája | ÜRES | Formai hiány, hiánypótlást hívhat |
| Elfogadóhely leírása | ÜRES | Formai hiány; ide való a tevékenység (SaaS-előfizetés weboldal-szolgáltatásra) |

⛔⛔ **„Ismétlődő fizetés engedélyezve: **Nem**"** — ez a legsúlyosabb. A termék ELŐFIZETÉS, és
az ismétlődő terhelés a kód gerince: `barion.ts:67-70` (`InitiateRecurrence` + `RecurrenceId`),
`:133`, és `recurrence_token`-t használ 7 modul (`subscription.ts`, `billing.ts`, `service.ts`,
`gateway.ts`, `subscriptionAdmin.ts`, `public.ts`, `schema.ts`). **Ha ez „Nem" marad, a
jóváhagyás után sem tudunk automatikusan terhelni** — minden hónapban kézi fizetésre kellene
kérni az ügyfelet. Ezt a Barionnál KÜLÖN kell engedélyeztetni, nem jár a jóváhagyással.

## 3b. ⛔ A BÍRÁLÓ NEM TUD NÁLUNK VÁSÁROLNI (mérve 2026-09-14)

A jóváhagyásnak van egy második fele, ami eddig hiányzott ebből a csomagból: a Barion a
formai/tartalmi ellenőrzésen túl **teszt-vásárlást is végez az elfogadóhelyen**, és
bejelentkezés mögötti („zárt") rendszernél ehhez **teszt-belépőt kell adni** — a MotiBro
például kifejezetten létrehoz egy teszt-fiókot a Barionnak erre.

Nálunk a vásárlás MA kizárólag bejelentkezés mögött él. Mérve a kódban:

| Mit mértem | Eredmény |
|---|---|
| A `payUrl`-t kiadó útvonalak | mind `/admin/*`: `public.ts:1885` (előfizetés-rendezés), `:2021` (havi/éves váltás), `:2073` (domain-rendelés) → tenant-fiók + jelszó kell |
| Publikus útvonal-lista | `/`, `/aszf`, `/adatvedelem`, `/impresszum`, `/elallas`, `/login`, `/api/mock-request` — **nincs checkout, nincs kosár, nincs `/elofizetes`** |
| A mock-előnézet (`/m/<token>`) | a `demoFrame.ts` kerete csak demó-lábazat + adatvédelem-link — **nulla megrendelés-CTA** |
| Az önkiszolgáló minta-kérés | `AUTO_MIN_CONFIDENCE = 0.7` (`intake/mockRequest.ts:24`) — az alatt `needs_review`, tehát egy kitalált cégnévvel próbálkozó bíráló jó eséllyel mockot sem kap |

**Következmény:** a bíráló megnyitja a citoviso.com-ot, lát árat és jogi oldalakat (azok
zöldek), de a vásárlást nem tudja végigkattintani. Ezt kezelni kell — teszt-fiókkal a
megjegyzés-rovatban, vagy egy bejelentkezés nélküli megrendelő-úttal.

## 3c. ⚠️ A MA BEÁLLÍTOTT POSKey a SANDBOXÉ — élesen is (mérve 2026-09-14)

| Hely | `BARION_URL` | POSKey | Payee | `INVOICE_PROVIDER` |
|---|---|---|---|---|
| Lokál `.env` | `api.test.barion.com` | `7f43a213…` (36 kar.) | `olaszferenc@gmail.com` | `szamlazz` |
| **Éles** `/opt/citoviso/app/.env` | **`api.test.barion.com`** | **ugyanaz** | **`olaszferenc@gmail.com`** | **`mock`** |

Tehát a meglévő kulcs a **BarionSandbox** teszt-boltjáé, a payee a gmail-es magánfiók — nem
az `olasz.ferenc@citoviso.com`-ra kért éles elfogadóhelyé. **Élesen ma egyetlen valódi forint
sem tudna beérkezni**, és valódi számla sem menne ki (`INVOICE_PROVIDER=mock`). Ez nem hiba,
hanem a várt kiindulás — az éles POSKey a jóváhagyás után jön (④), és az ⑤-tel EGYÜTT áll át.
Egy haszna viszont van: mivel a sandbox be van kötve, a folyamat egy teszt-fiókkal
**végigjárható** a Barion teszt-fizetőoldaláig.

> ❓ **Nyitott, a Bariontól kérdezendő** (hello@barion.com): előfizetéses SaaS-nál, ahol a
> fizetés belépés mögött van és éles POSKey még nincs, mit fogadnak el teszt-vásárlásnak —
> sandbox-út, vagy elég a folyamat a fizetési átirányításig? Ezt nem mértem, ne találgassuk.

## 4. Amit az igénylés VÉGÉN vissza kell adnod a gépnek

A jóváhagyás után a Barion ad egy azonosítót és egy kulcsot:

- **POSKey** (éles bolt kulcsa)
- **Payee** (a bolt e-mail azonosítója)

Ezeket a gép írja be a **prod `.env`**-be, és állítja át:
`PAYMENT_GATEWAY=barion` · `BARION_URL=https://api.barion.com` *(ma: `api.test.barion.com`)*.
⚠️ Ez élesi írás → **külön, kimondott engedély** kell rá (§0.3).

## 5. Ami ugyanebben a körben átáll (ne maradjon félúton)

- `INVOICE_PROVIDER=szamlazz` — ma `mock`, tehát **éles vevő ma nem kapna valódi számlát**.
  Fizetés számla nélkül jogilag nem mehet, tehát a két tétel EGYÜTT él vagy sehogy.
- `alert_email` a live konzol Beállítások lapján — enélkül a riasztások csak SMS-ben mennek.

---

## Ellenőrző lista

- [x] ① Élesítés — **KÉSZ 2026-09-10** (`d9eb7dd`, `prod/20260910-1828`)
- [x] ② Élesi ellenőrzés — **KÉSZ**, mindkét tétel mérve az élő oldalon
- [x] ③ Barion éles bolt igénylés beadva — **KÉSZ**, státusz „Jóváhagyásra vár" (3a.)
- [ ] ③b **Elfogadóhely URL-je kitöltve** (`https://citoviso.com`) — ma ÜRES, a bíráló enélkül nem lát semmit
- [ ] ③c Kategória + leírás (20–200 kar.) kitöltve — ma ÜRES
- [ ] ③d **Ismétlődő fizetés kérelme** — Ügyfélközpont-JEGY indoklással (2c.), ma „Nem"
- [ ] ③e Teszt-belépő az **„Egyéb adatok"** mezőbe (hivatalos út, 2b.) — a vásárlás belépés mögött van
- [ ] ③f **Barion-logósor** a főoldalra + a fizetés-lapra (2b. #2 — kimondott elutasítási ok!)
- [ ] ③g ÁSZF-pótlás: **nyilvántartási szám + telefonszám** (2b. #5)
- [ ] ③h Tárca-feltöltés banki átutalással a vállalkozói számláról (azonosítás, 2b. #12)
- [ ] ④ Jóváhagyás megérkezett → POSKey + Payee átadva a gépnek
- [ ] ⑤ Prod `.env`: `PAYMENT_GATEWAY` + `BARION_URL` + `INVOICE_PROVIDER` átállítva
- [ ] ⑥ Végigvitt éles teszt-tranzakció (fizetés → számla → élő oldal)
