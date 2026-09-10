# Barion éles elfogadóhely — igénylési csomag

*Összeállítva: 2026-09-09. Minden adat MÉRVE (az éles `.env`-ből és az élő oldalról
olvasva), nem emlékezetből. A `⚠️` jelölt sorok azok, amiket csak te tudsz megadni.*

> **Miért ez a leltár legfontosabb tétele:** a Barion-jóváhagyás átfutása hetekben mérhető,
> és amíg nincs meg, a rendszer nem tud pénzt beszedni. Minden más blokkoló ez alatt sorakozik.

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

**AZ IGÉNYLÉS MOST BEADHATÓ.**

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
- [ ] ③ Barion éles bolt igénylés beadva *(1. és 2. szakasz adataival)*
- [ ] ④ Jóváhagyás megérkezett → POSKey + Payee átadva a gépnek
- [ ] ⑤ Prod `.env`: `PAYMENT_GATEWAY` + `BARION_URL` + `INVOICE_PROVIDER` átállítva
- [ ] ⑥ Végigvitt éles teszt-tranzakció (fizetés → számla → élő oldal)
