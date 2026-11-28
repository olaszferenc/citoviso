# 07 — KONVERZIÓS MECHANIZMUSFA (élő dokumentum, ADR-XXXX)

> A megkeresés → vevő út EGYETLEN közös modellje. Minden konverziós ötlet, mérés és kísérlet ehhez a fához
> kötődik: ami nem köthető egy csomópontjához, azt nem csináljuk. Kiinduló vázlat: a tulaj kézi skicce
> (2026-11-28). Nézet: https://claude.ai/artifact/D2eKBbP8L9a5Z8D4LUQnwS (a forrás EZ a fájl, a nézet ebből készül).

## A. Szerkezet (doktrína — a tulaj fogadta el, 2026-11-28)

Négyféle csomópont, egy fában:

| fajta | mit mond | szabály |
|---|---|---|
| **Állapot** | hol tart a lead | a gerinc; mindegyikhez arány az előző állapotból |
| **Ok** | miért nem lép tovább | két állapot közé, az átmenetre kerül; jelölve: **igazolt** (válasz/mérés a forrás) vagy **feltevés** |
| **Mérés** | honnan tudjuk | minden állapothoz és okhoz: **mérve** · **részben** (közvetett / alulszámol) · **vakfolt** |
| **Kar** | mivel javítható | CSAK ok alá kerülhet; a hatását a szülő-állapot arányán mérjük, előtte–utána számmal |

- ⛔ Ötlet (kar) csak úgy kerül be, hogy megmondjuk, melyik okra hat, és melyik arányon látszik.
- ⛔ Feltevésből „igazolt” csak forrással lesz (válasz-idézet, mérés, kísérlet-eredmény + dátum).
- Hatókör: egyelőre CSAK az e-mailes megkeresés (tulaj 11-28). A többi csatorna (SMS, MMS, Messenger) később
  saját gerinc-szakasszal csatlakozik az 5-ös állapotnál.
- Mérés-definíciók: a riport (`src/console/reportData.ts` fejléce) az igazság; ez a fájl nem definiál újra.

## B. A gerinc

| # | állapot | mérés | forrás |
|---|---|---|---|
| 0 | Kiválasztott lead (működik, nincs jó honlapja, a cím a gazdáé) | vakfolt (csak válaszból) | `outreach_reply`, `prospect_feedback` |
| 1 | Kiküldve | mérve | `prospect.email_sent_at` |
| 2 | Megérkezett a beérkezők közé | vakfolt | — (visszapattanó ma eldobva: `src/replies/imap.ts` `notAReply`) |
| 3 | Észrevette | vakfolt | — |
| 4 | Megnyitotta a levelet | részben (Gmail pontos, más alulszámol) | `email_open` kind=open, own=false, ≥60 mp |
| 5 | Megnyitotta a tervet | mérve | `mock_view` (open_via=email) |
| 6 | Végignézte | mérve | `mock_event` scroll / section_seen |
| 7 | Ajánlathoz nyúlt | mérve | `mock_event` trial_open · plan_view_click · pkg_open · panel_open · checkout_step |
| 8 | Próba / rendelés | mérve | `free_trial` (tenant_id), `order_intent.submitted_at` |
| 9 | Fizetett | mérve | `payment.status='paid'` |
| 10 | Megmaradt | mérve, ha lesz vevő | `subscription` |
| ↳ | Oldalkijárat minden szinten: válaszol · leiratkozik | mérve | `outreach_reply`, `prospect.unsubscribed_at` |

## C. Okok és karok átmenetenként (első vázlat — vitára, a tulajjal töltjük fel)

**0 → 1 (rossz kiválasztás)**
- Ok · igazolt — Nem működik már (8 válasz + 5 leiratkozási ok, 11-09…27). Kar: csak friss működési jellel küldünk.
- Ok · igazolt — Van honlapja (9 + 5). Kar: a válaszban talált honlapcím a saját-honlap kapu igazság-mintájába.
- Ok · igazolt — A cím nem a gazdáé (4 + 1). Kar: a kontakt-egyezés pontosságának mérése.

**1 → 2 (nem érkezik meg)**
- Ok · feltevés — Halott cím (vakfolt). Kar: visszapattanó rögzítése, domainenként, halott címre többé nem.
- Ok · igazolt — Spam (11-16…18 ablak; azóta vakfolt). Kar: napi 3–5 saját próbacím, a gép nézi a mappát.

**2 → 3 (nem veszi észre)**
- Ok · feltevés — Elsüllyed (közvetett: a tervnyitás 40%-a 1 órán, 80%-a 1 napon belül). Kar: kiküldési óra.
- Ok · feltevés — Nem olvasott postafiók (régi freemail, citromail). Kar: nyitás domainenként.

**3 → 4 (észreveszi, nem nyitja)**
- Ok · feltevés — A feladó / tárgy nem érdekes. Kar: tárgy- és feladó-A/B (ADR-0462 motor, ma csak control).
- Ok · feltevés — Az előnézet alapján spamnek hiszi (nincs előnézeti sor). Kar: saját előnézeti sor, A/B.

**4 → 5 (megnyitja, nem kattint)**
- Ok · igazolt — Nem az ő szállása (4 válasz).
- Ok · igazolt — Spamnek / átverésnek hiszi (3 válasz + 1 „distrust”). Kar: mondat arról, honnan az adat.
- Ok · feltevés — Nem ad jó ígéretet: minek honlap · nem foglalkozok vele · a kép rossz · ár?? · átverés ·
  nem kértem, nem dőlök be (tulaj skicce). Kar: első mondat és ársor A/B; kép nélküli személyes változat.
- Ok · feltevés — Most nincs ideje. Kar: második levél a nyitó-nem-kattintónak (ma nincs ilyen).

**5 → 6 (rögtön kilép)**
- Ok · igazolt — Rossz nyitókép (javító levél ügye, ADR-0508). Kar: render-kapu szabályok; kilépés képfajtánként.
- Ok · feltevés — Nem ismeri fel a saját szállását.

**6 → 7 (végignézi, nem nyúl az ajánlathoz) — a legnagyobb esés**
- Ok · igazolt — Most nem aktuális („érdekel, de költözöm”, `not_now`). Kar: a visszatérőkre reagáló üzenet (ma KI).
- Ok · feltevés — Az ár. · Nem érti az ajánlatot / a teendőt. · Nem hiszi, hogy megéri.
  Kar: egy kérdés az árak alatt / kilépéskor (4 gomb, mint a leiratkozási kérdőív); ajánlat-változatok A/B-ben.

**7 → 8** — Ok · feltevés — A próba-űrlap (13 megnyitás → 1 indítás). Kar: mezőnkénti mérés, kevesebb mező.
**8 → 9** — Ok · feltevés — A próba után nem rendel / a fizetésnél elakad.
**9 → 10** — nincs még adat.

## D. Aktív feladatok (mi melyik csomóponton dolgozik)

| csomópont | kar | ki | mióta | szülő-arány előtte |
|---|---|---|---|---|
| — | (a tulajjal választjuk ki az elsőt) | | | |

## E. Mérési napló (újabb elöl; minden sor: dátum · kohorsz · számok · forrás)

- **2026-11-28** · e-mailes első kör, 2026-11-09…27, 1797 kiküldés, [TESZT] nélkül:
  1 kiküldve 1797 (napi 130–380 11-13…20, 0 11-24/25, 60 11-27; HU keret 100) ·
  4 levélnyitás Gmail ~49% (11-23 óta mérve), egyéb alulszámol ·
  5 tervnyitás 339 (a kiküldés 19%-a, a Gmailes nyitók 38%-a) ·
  6 a 351 tervnyitóból 15% negyedéig sem görget, 67% félig, 76% az árakig ·
  7 ~25 (7%) ajánlathoz nyúlt (próba-ablak 13, ajánlat-kattintás 13, csomag 8) · 45 visszatérő másik napon ·
  8 próba 1, fizetési lépés 2, rendelés 0 · 9 fizetett 0 ·
  oldalkijárat: válasz 44 lead (2,4%, ebből 6 érdeklődő), leiratkozás 22 (1,2%).
  Heti tervnyitás / kiküldés (Gmail): 10-26 48% · 11-02 40% · 11-09 32% · 11-16 20% · 11-23 15%.
  (éles SQL, csak olvasás; koordinátor `cit96bd8170`-utód)
