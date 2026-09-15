# 2026-09-15 — A hatókör-szabály a PROCESSZ-HATÁRON is átér (ADR-0172)

**Kiindulás.** A tulaj kérése: „a `/pay/mock` fizetés-lapot is nézd meg." A lap maga ártalmatlan
(dev-only mock; élesben `PAYMENT_GATEWAY=barion`, `mock_` hivatkozás nem keletkezik — mérve: éles
404). De a KONZOL processzen él, és **az egész processzről hiányzott a szabály.**

## A lelet, élesben mérve (olvasás, §0.4)

Az `/etc/nginx/sites-enabled/citoviso` a `citoviso.com`-ot KÉT processz között osztja fel, és a
hasítás pont a vásárlási úton megy át:

| útvonal | processz | sáv+Pixel (előtte) |
|---|---|---|
| `/`, `/login`, `/adatvedelem`, `/aszf`, tenant-admin | public :4800 | **VAN** |
| **`/configure/…`** (a vásárlás indulása) | konzol :4600 | **NINCS** |
| **`/pay/…`**, köztük a **`/pay/done`** (Barion `RedirectUrl`) | konzol :4600 | **NINCS** |
| `/privacy`, `/p/…`, `/site/…`, `/mock/…` | konzol :4600 | NINCS |

**A vevő teljes fizetési útja a csalásmegelőző jelzés nélkül futott** — miközben a saját kódunk
kommentje kimondja: *„a Barion előírása szerint a Pixelnek a webshop MINDEN oldalán ott kell
lennie."* Ez az ADR-0151 TÜKÖRKÉPE: nem „követés ott, ahol tilos", hanem „nincs követés ott, ahol
kötelező".

**Második lelet:** `citoviso.com/adatvedelem` (8636 B, sáv+Pixel) vs `citoviso.com/privacy`
(8290 B, tiszta) — UGYANAZ a `privacyPage()`, csak más processz adja ki. És épp a `/privacy` az
a cím, amit a **már kiküldött hideg levelek** tartalmaznak.

## Amit szállítottam

1. **Közös modul** (`src/server/consent.ts`): a snippet + a címzett-szabály. Amíg a szabály egy
   szerver-fájl belügye volt, a másik processz nem is tudott róla. A `public.ts` viselkedése
   bájtra változatlan (az őr 269 állítása előtte-utána zöld — ez volt az első kapu).
2. **A konzolon is a CÍMZETT dönt**, egy olvasható listában. A hat kívülről elérhető útvonal NEM
   egy kategória: `/p/`, `/configure/`, `/mock/`, `/site/` a **szállás oldalát** adja ki →
   vendég; `/pay/…`, `/admin/<token>`, jogi lapok → own; minden más **belső operátor-felület** →
   nincs követés, de MÁS okból.
   ⚠️ A `/p/<token>`-ről a vásárlás el tud INDULNI, a lap mégis vendég-lap: a FIZETÉS a `/pay/…`-on
   és a Barion saját lapján történik. Egy süti-sáv a mockon ráadásul arról is hazudna, hogyan fog
   kinézni a kész oldal.
3. **A lapot kiszolgáló processz szolgálja ki azt is, ami nélkül a lap hazudik.** A konzol MÉRTEN
   **303**-at adott a `/assets/runtime/*`-ra → a sáv csupasz lett volna, a Pixel el sem indult
   volna. Élesben ezt az nginx elfedte volna — **de egy proxy-sor nem lehet a jogi megfelelés
   egyetlen lába.**
4. **A `/pay/mock` lap a közös kimenetre került.** `res.end()`-del megkerülte a `send()`-et (a
   no-store fejlécek miatt), tehát a beillesztés pont a fizetés-lapról maradt volna ki.

## A kockázat, amit előre kimondtam — és megmértem

Ha a Pixel odakerül, a sáv is. Az ADR-0145 ④ épp azt mérte ki, hogy a sáv eltakarhatja a gazdalap
vezérlőit; fizetés-lapon ez súlyosabb. Mérve a **valódi** fizetés-lapon (önmagát takarító fixture,
a „Fizetek ▸" + „Elutasítom" bizonyítottan renderelve), 390 és 1280 px-en: a sáv a navy tokenből
fest, az „Elfogadom" a cián tokenből (a `.con button` specificitás-csapda NEM harap — az ADR-0145
mindent `#cit-consent`-hez horgonyzott), és **egyetlen vezérlőt sem takar**.

## Őr

`scripts/consent-style-check.mts` mostantól **mindkét processzt felhúzza**. Új állítások: a konzol
saját lapjain VAN sáv+Pixel (pozitív kontroll, köztük a VALÓDI `/pay/done` a park kifizetett
rendeléséből), a vendég- és operátor-lapjain NINCS, **ugyanaz a jogi dokumentum mindkét processzen
ugyanúgy viselkedik**, és a konzol **maga** szolgálja ki a sáv eszközeit. **397 zöld.**

**Piros önteszt kétszer:** `--self-test` 127 → **178** piros (öt rontás); a valódi javítást
visszarontva **19 bukás, exit 1**, név szerint a konzol fizetés-lapjaival, a processz-eltéréssel
és a 0 bájtos eszközökkel.

## ⛔ Két saját hiba, mérés közben

1. **A takarás-vizsgálatom más kérdésre válaszolt.** BÁRMILYEN takaró elemre pirosat adott, nem
   csak a sávra. Elbukott rajta a fizetés-visszatérő lap egy SOREMELT inline linkje: a kétsoros
   `<a>` befoglaló dobozának középpontja a két sor KÖZÉ esik, ezért az `elementFromPoint` a szülő
   `<p>`-t adta vissza — miközben a sáv **362 px-rel lejjebb** volt. A verdikt mostantól
   „takarja-e A SÁV"; ha más takar, azt kiírjuk (nem nyeljük el), de nem ennek az őrnek az ítélete.
2. **A fixture nem bizonyította a saját útját.** Az első fizetés-lap mérésem „0 vezérlő / 0
   takarva" zöldet adott — a hivatkozásom nem volt hexa (`mock_[0-9a-f-]+`), ezért a route 404-re
   esett. Egy 0-ból-0 nem mérés.

## Módosított fájlok

- `src/server/consent.ts` (ÚJ) · `src/server/public.ts` · `src/console/server.ts`
- `scripts/consent-style-check.mts`
- `assets/design-refs/public-site/consent-bar/README.md` · `_planning/DECISIONS.md`

## Nyitott

- ⚠️ **A javítás csak deploy után ér ki.** Addig az éles fizetési út Pixel nélkül fut. Élesítés a
  tulaj külön, aktuális engedélyével (§0.3) — ez jogi/elfogadóhelyi megfelelés, nem kozmetika.
- A `/m/<token>` ág az őrben továbbra is csak akkor mérődik, ha a park ad hozzá adatot.
- A konzol 404-lapja kívülállónak is megmutatja az operátor-navigációt (`Irányítópult`, `/leads`)
  — külön kör, nem ehhez tartozik.
