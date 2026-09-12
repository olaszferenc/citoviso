# 2026-09-11 — A kiküldés-döntés képernyője: teljes levél, igaz számok, cím-szintű egy-lövés (ADR-0121, ADR-0122)

**Kiváltó:** Elek FK-004 köre (hideg megkeresés kiküldése). Hat lelet, közös nevezővel: a
KÜLDÉS-DÖNTÉS képernyője kevesebbet vagy mást mondott, mint ami történik — és a küldés
visszafordíthatatlan, idegen embernek szól.

## Amit mértem, mielőtt írtam

| Lelet | Mérés |
|---|---|
| ① az előnézet elvágja a levelet | iframe 560px, levél **785px** (asztali) / **1056px** (mobil), görgetősáv nélkül |
| ② a fejléc valótlanul számol | `sentCount ? " · kiküldve"` — EGY kiküldött sortól zöld lett az egész |
| ② a zöld jelvény a rossz soron | a „Kiküldve — mérés indul" **GOMB** (`class="ok"`), és csak a NEM kiküldött soron jelenik meg |
| ③ rekord-szintű egy-lövés | a parkon: 2 prospect-sor, 1 cím, mindkettő küldhető |
| ④ dev gazdagép a linkekben | ÉLESEN mérve rendben (`PUBLIC_BASE_URL=https://citoviso.com`) — de semmi nem kötötte a link hostját az identitáshoz |
| ⑤ nincs cégazonosítás | az aláírás személynév + márkanév; jogi entitás sehol |
| ⑥ személy-ugrálás | „néztük" → „készítettem" → „mi élesítjük"; megszólítás a nyitómondat UTÁN, névtelenül |

## Tulaj-döntések (AskUserQuestion, két kérdés)

1. **„Elöl, NÉVVEL"** — a megszólítás a levél első sora, a lead nevével. Ez az **ADR-0101 ①**
   sorrendjét írja felül; az eredeti indok (az első ~90 karakter a Gmail-előnézet sora) áll, de
   a NÉVVEL ellátott megszólítás nem éget el semmit — pont a név a személyre szabás. → **ADR-0121 ①**
2. **„T/1 — »mi«"** — a levél végig többes szám első személyben. → **ADR-0121 ②**

## Szállítva

- **Előnézet:** a keret a tartalomhoz igazodik; a beégetett magasság nagyvonalú **PADLÓ**, hogy
  JS nélkül is a teljes levél látszódjon. ⚠️ Az első változatom `documentElement.scrollHeight`-ot
  mért, ami a keret viewportjára padlózódik → a fitter a saját farkát kergette volna, az őr pedig
  trivializálódik. A tartalom tinta-kiterjedését mérjük (a `<body>` gyerekeinek alsó éle).
- **Számláló/jelvény:** a fejléc megnevezi a számokat („ebből 1 ment ki"), és csak akkor zöld, ha
  MIND kiment; a gomb felirata felszólítás („Megjelölöm kiküldöttként — mérés indul"), siker-szín
  nélkül. Három KB-bejegyzés felirata együtt mozdult.
- **Cím-szintű egy-lövés (ADR-0122):** előellenőrzés + **címre vett advisory lock alatti claim**
  (a sor-szintű `WHERE email_sent_at IS NULL` két külön soron mindkettőt átengedi) + a küldhető
  LISTA is címenként egy sort kínál + a piszkozat-kártya a KATTINTÁS ELŐTT kimondja
  („a CÍMRE már ment ki"), nem a visszautasító sávban.
- **Link-gazdagép:** `src/outreach/linkHost.ts` + pill a verdikt alatt (pirosan, ha nem a feladó
  domainje) + `scripts/outreach-link-host-check.mts` bármely `.env`-re. **Szándékosan NEM §C-szabály:**
  dev-gépen mindig piros szabályt mindenki megtanul átlépni.
- **Cégazonosítás (ADR-0121 ③):** lábazat-sor a `config.legalEntity`-ből (EGY forrás az
  impresszummal, ADR-0110); üres env → hangos placeholder, amit a §C.2 kidob.

## ⚠️ A nap mellékleletei

1. **A placeholder-heurisztika a VALÓS adószámra sült el.** A `PLACEHOLDER_CONTACT`
   (`000 0000|123-4567|xxx`) a `12345678-1-42` adószámban megtalálta az `1234567`-et, és
   hibátlan feladó-blokkra mondta, hogy hamis elérhetőség. **Ugyanaz a hiba-osztály, mint a
   2026-09-09-i `xXx`-token.** A heurisztika nem attól jó, hogy mennyire érzékeny, hanem attól,
   hogy MIN mér → a hatókör a kapcsolat-blokkra szűkült, negatív eset őrzi a tompulás ellen.
2. **A saját javításom félmunka volt, és a tudásbázis-őr fogta meg.** A cím-szintű szabályt
   megírtam a küldő-úton, de a FELÜLET nem mondta ki előre — halott gombot hagytam egy „nem
   vonható vissza" megerősítés mögött. Az őr további négy rést talált: a képernyő SAJÁT prózája
   még a kivezetett „Kiküldve" gombra küldött (`views.ts` 3 helyen), a riport-KB azt állította,
   hogy csak a kézzel megjelölt küldés számít (a pipeline magától bélyegez), az új
   cégazonosítás-FLAG-hez nem volt vezetés, és a §C-kapu saját tanácsa egy nem létező feliratra
   mutatott („Árak véglegesek" helyett „Az árak véglegesek, élesíthetők"). Mind javítva.

## Őrök (mind negatívan is lefuttatva)

- `scripts/outreach-preview-check.mts` — böngészőben: keret ≥ levél, ÉS a leiratkozó-link és a
  jogalap-sor PIXELBEN látszik (`elementFromPoint`). Önteszt: a régi 560px-es kereten 6/6 piros.
- `scripts/outreach-oneshot-check.mts` — olvasás-only (a dev DB KÖZÖS): címenként egy küldhető sor,
  a predikátum kis- és nagybetűs alakra is fog. Negatív kontroll: kiírja, mit kínálna a RÉGI
  szabály — és ha az adat a hibát ki sem tudja fejezni, azt KIMONDJA, nem zöldet állít.
- `scripts/outreach-link-host-check.mts` — az éles `.env` párosán zöld; önteszt mindkét irányban.
- `outreach-gate-selftest` — két új negatív eset a cégazonosításra.

## Mérés

FK-004 **8/8 gépi zöld** (4 kézi lépés Elekre vár) · a cím-szintű kapu mindkét irányban mérve,
a park utána **bizonyítottan a kiindulási állapotban** · ui-shot 390+1280px, megnézve · kb-check
🟢 35/35 · tsc, i18n-lint, outlook-lint, contract-drift, market-gate mind zöld.

## Nyitva

- A `screen.png` frissült a `console-outreach-draft`/`console-lead`/`console-dashboard` alatt;
  a többi KB-kép a saját ciklusában.
- Az `isEmailSuppressed` továbbra is PONTOS egyezés (a leiratkozás illesztésének lazítása külön,
  jogilag terhelt kérdés) — a küldést a mostani szűkítés lefedi.
- **Élesítés NINCS** (§0.3).
