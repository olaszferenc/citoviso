## ADR-0151 — A süti-sáv hatóköre nem útvonal-kérdés, hanem a lap CÍMZETTJÉÉ (2026-09-14)

- **Kiváltó (Elek FK-007 Z5):** a vendég **lemondó** lapjain (`/foglalas/<token>/lemondom`)
  ott volt a Barion-süti-sáv — olyan lapon, ahol nincs kártyás fizetés. Az **ADR-0145** ezt a
  vendég-oldalra már kimondta, de a javítás a TÜNETET vitte el: a `/t/<slug>` dev-ágat a
  saját-lap jelölő FÖLÉ emelte. A jelölő viszont **egy SORBAN** dőlt el, tehát minden alatta
  élő vendég-lap ugyanúgy megkapta.
- **Amit mértem (a jelölő utáni ÖSSZES HTML-t adó útvonal, nem csak a bejelentett kettő):**
  a bejelentett két soron kívül **két további ajtó** adta ki a sávot és a Pixelt —
  a `/site/<preview_token>` (**ugyanaz a `sites/<tenant>/index.html`**, amit a tenant-host ad
  ki; a nyers fájlban 0 hivatkozás, tehát a kiszolgálás teszi rá) és a `/m/<token>`
  mock-előnézet (a szállás-oldal bemutató-változata, **hideg megkeresés** címzettjének).
  Mérve, javítás előtt/után: `/site/` SÁV+PIXEL → tiszta · `/m/` 873 → 527 bájt, tiszta ·
  lemondó GET és POST 924 → 578 bájt, tiszta. A saját lapjaink (landing, `/login`,
  `/adatvedelem`, `/aszf`, `/impresszum`, `/elallas`, `/adatfeldolgozas`, `/admin`)
  **változatlanul** megkapják.
- **Döntés ① — a határ a CÍMZETT, nem az útvonal és nem egy sor pozíciója.** A sáv+Pixel a MI
  webshopunk lapjaira való: ahol a látogató a mi (leendő) ügyfelünk, és ahol a mi fizetési utunk
  futhat. Kimarad minden lap, amelynek címzettje a tenant VENDÉGE — **függetlenül attól, melyik
  úton szolgáljuk ki**. Ez ADR-0145 ③ saját logikája: ott azért MARADT a sáv a tenant-adminon,
  mert a modul-vásárlás onnan indul; a vendég-lapokon semmi ilyen nincs.
- **Döntés ② — a címzett KIMONDOTT tény a válaszon, a határ pedig EGY olvasható lista.**
  A boolean `OWN_PAGE` helyén `PAGE_AUDIENCE: "own" | "guest"` áll, az alapértelmezés (nem
  deklarált) pedig a **nem-követés** — így egy fentebb kilépő új ág sem kaphat véletlenül Pixelt.
  A vendég-útvonalak `GUEST_PAGE_ROUTES` néven, **nevesített mintákkal**; a route-ok ugyanezeket
  használják, tehát a lemondó-minta nem él többé két példányban (egy szabály két példányban két
  igazság).
- **Döntés ③ — a tulaj döntés-lapjai a határ MÁSIK oldalán maradnak.** A levélből nyíló
  `/foglalas/<token>/elfogadom|elutasitom` és `/velemeny/<token>/…` címzettje a mi ÜGYFELÜNK,
  nem a vendég — ezek megtartják a sávot. Ezt az őr **pozitív kontrollként** ki is tűzi, hogy a
  javítás ne csapjon át túlkorrigálásba.
- **Miért a mock-előnézet is vendég-lap:** a `/m/<token>` a generált szállás-oldalt mutatja
  (a befagyasztott terv szó szerinti alanyát), a címzett pedig egy hideg megkeresés
  címzettje, aki semmit nem kért tőlünk; vásárlás onnan nem indul (az a tenant-adminból megy).
- **Őr:** `scripts/consent-style-check.mts` — a RENDERELT lapon, **mindkét irányban**: a
  vendég-lapokon nincs kezelő/stíluslap/Pixel, a sajátjainkon VAN (pozitív kontroll — egy néma
  mérőeszköz így nem tud „zölden" hallgatni), és **a sáv+Pixel EGYÜTT mozog** (ugyanabból az egy
  `consentSnippet()`-ből jönnek, tehát „sáv nélkül Pixel" szerkezetileg lehetetlen — ez az
  állítás őrzi, hogy az is maradjon). A POST-ág nyers HTTP-vel, mert a `page.goto` csak GET.
  **Piros önteszt kétszer:** a beépített `--self-test` 115 → **127** pirosat ad; és a VALÓDI
  szabályt visszarontva (üres `GUEST_PAGE_ROUTES`) az őr **17 bukással, exit 1-gyel** áll meg,
  név szerint megnevezve a `/site/<token>`-t és a lemondó GET/POST lapját.
- ⚠️ **Amit az őr NEM tud megmérni, és ezt KIMONDJA:** a `/m/<token>`-hez `mock_request` sor +
  lemezen lévő artefaktum kell, a közös dev-parkban ez most 0 (mérve: 0 sor / 3 artefaktum,
  mind hiányzó fájllal). Az őr ilyenkor **hangosan kihagyja**, nem „zöld, mert nem volt dolga".
  Fixture-t szándékosan NEM gyárt: a park KÖZÖS, és egy minden commitnál soro(ka)t író őr más
  szálak méréseit billentené meg. A javítást ezen az ágon kézzel, önmagát takarító fixture-rel
  mértem (a park utána igazoltan érintetlen: 0 `mock_request`, 3 `mock_artifact`).
- **A befagyasztott terv frissült:** `assets/design-refs/public-site/consent-bar/README.md` —
  a „csak a saját oldalunkon" pont mostantól kimondja, hogy a „saját" a CÍMZETTRŐL szól; és
  javítva a `Hatókör:` sor, amely még a `home.css`-re mutatott, pedig a szabályok az
  ADR-0145 óta a `cit-consent.css`-ben élnek.
- **Visszafordíthatóság:** 🔄 egy szimbólum típusa + egy háromelemű lista.
- **Státusz:** ELFOGADVA (2026-09-14). Élesítés NINCS (§0.3).
- ⚠️ **Sorszám:** a blokk `0150`-ként készült (`git fetch` után ellenőrzött számmal), de
  landoláskor egy párhuzamos szál landolta a `0150`-et (`eb68eb8`) → **`0151`**. Ez a NEGYEDIK
  nap, amikor a szám a land pillanatában csúszik: a közös doksit az `origin/main`-ről ÚJRA
  ÉPÍTETTEM, és csak a SAJÁT blokkom számát írtam át (fájl-széles csere már írt át idegen ADR-t).
