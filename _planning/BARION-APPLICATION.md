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
| A fizetési szolgáltató megnevezése az ÁSZF-ben | ÁSZF 2. pont | ⏳ **javítva, élesítésre vár** |

## 3. ⛔ AMI MÉG NINCS KINT — élesítés kell hozzá

Két dolog javítva van a kódban, de az **élő oldal még a régit mutatja** (a mai köteg nincs
élesítve). A bíráló ezeket látná:

1. **Az ÁSZF nem nevezi meg a fizetési szolgáltatót.** Mérve az élesen: **0 említés**.
   A jóváhagyás kifejezett feltétele, hogy az ÁSZF kimondja: a bankkártyás fizetést a
   Barion biztosítja, és közölje a felügyeleti engedélyszámot (H-EN-I-1064/2013).
   *Javítva `d5936e1`-ben, őrrel — de élesen még nincs kint.*
2. **A nyitóoldal túlígér:** „Megtalálhatóság a Google-ön **és a térképen**". A térképes
   jelenlét ADR-0107 óta külön fizetős modul. *Javítva ma — de élesen még kint van.*

> **Ezért a helyes sorrend: ① élesítés → ② igénylés.** Fordítva a bírálat egy hiányos
> ÁSZF-et és egy túlígérő nyitóoldalt lát, és a kör kétszer fut le.

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

- [ ] ① Élesítés (a köteg, benne az ÁSZF- és a nyitóoldal-javítás)
- [ ] ② Élesi ellenőrzés: a `/aszf` tartalmazza a szolgáltató nevét és az engedélyszámot
- [ ] ③ Barion éles bolt igénylés beadva *(1. és 2. szakasz adataival)*
- [ ] ④ Jóváhagyás megérkezett → POSKey + Payee átadva a gépnek
- [ ] ⑤ Prod `.env`: `PAYMENT_GATEWAY` + `BARION_URL` + `INVOICE_PROVIDER` átállítva
- [ ] ⑥ Végigvitt éles teszt-tranzakció (fizetés → számla → élő oldal)
