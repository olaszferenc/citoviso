# 2026-09-14 — A süti-sáv hatóköre a lap CÍMZETTJE, nem az útvonala (ADR-0151)

**Kiinduló lelet (Elek FK-007 Z5).** A vendég **lemondó** lapjain (`/foglalas/<token>/lemondom`)
ott maradt a Barion-süti-sáv — olyan lapon, ahol nincs kártyás fizetés.

## A hibaosztály: „hol húzódik a határ"

Az ADR-0145 ezt a vendég-oldalra már kimondta, és a `/t/<slug>` dev-ágat a saját-lap jelölő FÖLÉ
emelte. Csakhogy a jelölő egy **BOOLEAN volt, egy SORBAN** — a hatókör tehát attól függött, hogy
egy route a jelölő fölött vagy alatt áll. Ez kétszer dőlt el rosszul ugyanazon a napon.

**Ezért nem a két bejelentett sort javítottam, hanem megmértem a jelölő utáni ÖSSZES HTML-t adó
útvonalat.** A bejelentett kettőn kívül **két további ajtó** adta ki a sávot és a Pixelt:

| útvonal | kinek szól | javítás előtt | után |
|---|---|---|---|
| `GET /foglalas/<token>/lemondom` | vendég | SÁV+PIXEL, 924 B | tiszta, 578 B |
| `POST /foglalas/<token>/lemondom` | vendég | SÁV+PIXEL, 924 B | tiszta, 578 B |
| `GET /site/<preview_token>` | vendég | SÁV+PIXEL | tiszta |
| `GET /m/<token>` (mock-előnézet) | hideg megkeresés címzettje | SÁV+PIXEL, 873 B | tiszta, 527 B |

A `/site/<preview_token>` **ugyanazt a `sites/<tenant>/index.html`-t** adja ki, amit a tenant-host
— a nyers fájlban **0** hivatkozás van a sávra, tehát a kiszolgálás teszi rá. Vagyis a
vendég-oldal **harmadik ajtaja** volt nyitva, miközben a másik kettőt tegnap becsuktuk.

**A határ másik oldala változatlan** (mérve): landing, `/login`, `/login/help`, `/adatvedelem`,
`/aszf`, `/impresszum`, `/elallas`, `/adatfeldolgozas`, `/admin`, és a tulaj levélből nyíló
döntés-lapjai (`/foglalas/<token>/elfogadom|elutasitom`, `/velemeny/<token>/…`) — ezek a mi
ÜGYFELÜNKNEK szólnak, tehát megtartják a sávot.

## A szabály

> A sáv+Pixel a MI webshopunk lapjaira való: ahol a látogató a mi (leendő) ügyfelünk, és ahol a
> mi fizetési utunk futhat. Kimarad minden lap, amelynek CÍMZETTJE a tenant VENDÉGE —
> függetlenül attól, melyik úton szolgáljuk ki.

Ez az ADR-0145 ③ saját logikája: ott azért MARADT a sáv a tenant-adminon, mert a modul-vásárlás
onnan indul. A vendég-lapokon semmi ilyen nincs.

## Megvalósítás

- A boolean `OWN_PAGE` helyén `PAGE_AUDIENCE: "own" | "guest"`; a **nem deklarált** alapértelmezés
  a nem-követés → egy fentebb kilépő új ág sem kaphat véletlenül Pixelt.
- A vendég-útvonalak **egy olvasható listában** (`GUEST_PAGE_ROUTES`), **nevesített mintákkal**,
  amelyeket a route-ok is használnak — a lemondó-minta eddig **két példányban** élt a fájlban.
- **A sáv és a Pixel EGYÜTT mozog** (a brief 1. pontja): mindkettő ugyanabból az egy
  `consentSnippet()`-ből jön, tehát „vegyük ki a sávot, de hagyjuk a Pixelt" szerkezetileg
  lehetetlen. Ezt az őr külön állításként ki is tűzi, hogy az is maradjon.

## Őr (`scripts/consent-style-check.mts`)

A RENDERELT lapon mér, **mindkét irányban**:
- vendég-lapok: nincs kezelő, nincs stíluslap, nincs Pixel,
- saját lapjaink: **VAN** (pozitív kontroll) — egy néma mérőeszköz így nem tud „zölden" hallgatni,
- a tulaj döntés-lapja pozitív kontrollként ki van tűzve, hogy a javítás ne csapjon át
  túlkorrigálásba,
- a sáv és a Pixel együtt mozog.

A POST-ág **nyers HTTP-vel**, mert a `page.goto` csak GET — és az Elek-lelet éppen ott is élt.

**Piros önteszt kétszer.** A beépített `--self-test` 115 → **127** piros. És a VALÓDI szabályt
visszarontva (üres `GUEST_PAGE_ROUTES`) az őr **17 bukással, exit 1-gyel** áll meg, név szerint
megnevezve a `/site/<token>`-t és a lemondó GET/POST lapját.

## ⚠️ Amit az őr NEM tud megmérni — és kimondja

A `/m/<token>`-hez `mock_request` sor + lemezen lévő artefaktum kell; a közös dev-parkban ez most
**0 sor / 3 artefaktum, mind hiányzó fájllal**. Az őr ilyenkor **hangosan kihagyja**, nem „zöld,
mert nem volt dolga". Fixture-t szándékosan NEM gyárt: a park KÖZÖS, és egy minden commitnál
soro(ka)t író őr más szálak méréseit billentené meg. Ezt az ágat kézzel, önmagát takarító
fixture-rel mértem — a park utána igazoltan érintetlen (0 `mock_request`, 3 `mock_artifact`,
a próba-fájl törölve).

## Mellékesen javítva

A befagyasztott terv (`assets/design-refs/public-site/consent-bar/README.md`) `Hatókör:` sora még
a `home.css`-re mutatott, pedig a `#cit-consent` szabályok az ADR-0145 óta a
`public/assets/runtime/cit-consent.css`-ben élnek.

## Módosított fájlok

- `src/server/public.ts` — `PAGE_AUDIENCE` + `GUEST_PAGE_ROUTES` + a route-ok nevesített mintái
- `scripts/consent-style-check.mts` — címzett-hatókör mindkét irányban, POST-ág, önteszt ③
- `assets/design-refs/public-site/consent-bar/README.md` — a kontraktus pontosítva
- `_planning/DECISIONS.md` — ADR-0151

## Nyitott

- A `/m/<token>` ág az őrben csak akkor mérődik, ha a park ad hozzá adatot (ma nem ad).
- A `/pay/mock/<ref>` fizetés-lapot a **konzol** szerver adja ki (`src/console/server.ts`), ahol
  nincs sáv-beillesztés. Élesben a fizetés a Barion saját tárhelyén fut, tehát ez dev-ügy —
  de ha valaha saját fizetés-lapot adunk ki a publikus szerverről, az „own" címzett.
