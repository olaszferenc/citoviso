# 2026-08-22 — 🧾 A VEVŐ SZÁMLÁZÁSI IDENTITÁSA: a számla nem fabrikálódik többé (ADR-0055)

## A session eredeti célja ≠ amivel kezdtünk
A tulaj célja a **Barion-fizetési adatok tárolása + Számlázz.hu számla-import + banki
összevezetés + bizonylat-felület** volt. A feltérképezés közben ő maga állította meg a
munkát egy sokkal alapvetőbb hibával:

> „nem kérünk be számlaadatokat a leadtől, hogy magánszemélyként vagy cégként veszi
> igénybe, és hogy hogyan számlázzuk. Ez egy óriási hiba."

Igaza volt, és a kód szerint rosszabb volt, mint gondolta.

## A lelet
A megrendelő űrlap **nulla** számlázási mezőt gyűjtött (`modules`, `billing_period`,
`price`, `domain_*`, `photo_rights_declared` — ennyi). Az `issueInvoiceFor` marketing-
adatból építette a számla vevőjét:

| Számla-mező | Amit beírtunk | Baj |
|---|---|---|
| `name` | `lead.name` | A **Google Maps megjelenítési neve** — nem jogi név |
| `zip`/`city`/`address` | `parseHuAddress(lead.address)` | Regexszel vágott Maps-string |
| `taxNumber` | **`null`, beégetve** | Az adószám EGYETLEN előfordulása a logikában |
| magánszemély/cég | **nem létezett** | — |

**Következmény:** cég vevő adószám nélküli számlát kap → költségként elszámolhatatlan,
a NAV Online Számlában nála láthatatlan → azonnali sztornó-kérés az első pilot-vevőnél.

⛔ **Miért élt hónapokig:** a `parseHuAddress` saját kommentje BEISMERTE a rést („The
proper fix is a structured address collected at checkout"), de a **mock számla-szolgáltató
semmit nem validált**, ezért a lánc végig zöld volt. Harmadik előfordulása annak, hogy a
mock engedékenyebb a produkciónál, és ezzel elrejti a produkciós hibát.

## Amit leszállítottunk
- **0029** — vevő-nyilatkozat az `order_intent`-en, immutábilisan (a §A fotó-jog mintája:
  a tényt ÉS az elfogadott szöveget bélyegezzük rá). **DB CHECK-megszorítások** kényszerítik:
  cég ⇒ adószám; `reverse_charge` ⇒ cég + közösségi adószám + VIES `valid`. Élesen tesztelve:
  mind az 5 rossz beszúrás elutasítva, mind a 3 jó elfogadva.
- **`src/billing/taxId.ts`** — HU checksum offline (9,7,3,1,9,7,3 mod 10), négy valós,
  publikált adószámon igazolva (KBOSS, MOL, OTP, Telekom). VIES REST élesben bekötve
  (`ec.europa.eu/.../ms/{CC}/vat/{n}`), **a cég jogi nevét is visszaadja**.
- **`src/billing/buyer.ts`** — egyetlen validáló, mezőnkénti MAGYAR üzenetekkel (a vevő a
  pénztárcájával a kezében áll; az „érvénytelen adat" eladást veszít).
- **Konfigurátor 3. lépcső** a fizetés előtt, lead-adatból előre kitöltve.
- **`issueInvoiceFor`** a nyilatkozatból épít; `parseHuAddress` **kivezetve a számla-útból**,
  de PREFILLKÉNT megmarad (`src/billing/prefill.ts`).
- **Számlázz-adapter:** `szamlaLetoltes` **true** (a PDF-et eddig meg sem kértük!),
  `adoszam`/`adoszamEU`/`orszag`, fordított adózás. **0030:** a bizonylat maga tárolódik.
- **A mock provider** mostantól elutasítja, amit a Számlázz is elutasítana.

## ⭐ A legfontosabb elvi tanulság: ugyanaz a kód, ellentétes következmény
A `parseHuAddress` regexét **nem töröltük** — átköltöztettük. Számla-forrásként egy téves
tipp **törött, jogilag hibás bizonylat**; checkout-prefillként ugyanaz a téves tipp egy mező,
amit a vevő két másodperc alatt javít. A kód azonos, a hely dönti el, hogy hiba-e.
Ezért a `prefill.ts` fejlécében ez ki van mondva, hogy ne vándoroljon vissza.

## ⛔ MÓDSZERTAN: az őr két valódi hibát talált, amit én nem
Az `scripts/billing-checkout-check.mts` **nem utólagos pipa** volt:
1. **`[hidden]` vs. `display:flex`** — a UA-stíluslap `display:none`-ját felülírta a saját
   osztály-szabályom, tehát a „rejtett" mezők **és maga a számlázási lépés végig látszottak**.
   Kódolvasással ez láthatatlan; a böngésző mondta meg.
2. **A fizetés-gomb y≈1075-re került egy 844px-es képernyőn**, elérhetetlenül — a láb
   szándékosan nem görgethető (`flex:0 0 auto`, a tegnapi ár-munkából), és egy teljes űrlap
   nem fér oda. **Az első verzióm ezt ÁTENGEDTE**, mert a gomb MÉRETÉT mérte (`>=40px`), nem
   azt, hogy meg lehet-e nyomni. A `click({trial:true})` fogta meg. Ráadásul ugyanez a mérés
   egy 250px magas gomb-foltot is zöldnek látott (méret nélküli inline SVG flexben).
   → **Tartomány mérj, ne alsó korlátot; és nyomd meg a gombot, ne csak mérd.**
3. Mellékesen: a szerver **cache-eli** a konfigurátor CSS/JS blokkját (`configuratorBlock()`),
   így `assets/runtime/*` szerkesztés után **kötelező a restart** — háromszor harapott, mire
   leesett (a `reference_dev_servers_watch_mode` álló-szerver-csapdájának testvére).

## Nyitott (a session EREDETI célja — ez maradt hátra)
- **Barion:** a `parseWebhook` a `GetPaymentState` teljes válaszából 2 mezőt tart meg.
  Elveszik: TransactionId, fizető, funding source, **jutalék**, **elszámolás dátuma**.
  ⚠️ Az utóbbi kettő nélkül **a bankkal nem lehet összevezetni**: a számlára nem a számla
  összege érkezik, hanem jutalékkal csökkentett, ÖSSZEVONT kifizetés.
- **Számlázz import:** egyetlen metódus (`issueInvoice`). Nincs lekérdezés/sztornó/díjbekérő,
  se a felületen kézzel kiállított számlák behúzása. ⚠️ **Az adapter soha nem futott éles
  fiókkal** — a tulaj szerint teszt-fiók van beállítva, ELLENŐRIZENDŐ.
- **Bejövő költségszámlák** (Hetzner, Anthropic, Barion-díj, Cloudflare, Brave): nincs entitás.
- **Bank + bizonylat-felület:** nincs séma, nincs menüpont. Bank eldöntetlen (MagNet a jelölt).
- ⚠️ **ÁSZF-dokumentum NINCS** (`config.termsUrl` szándékosan üres → az elfogadó sor meg sem
  jelenik). **Élesítés előtt pótolandó.**
- ⚠️ **Könyvelői jóváhagyás** kell az EU-s ágra (közösségi adószám, összesítő nyilatkozat).

## Fájlok
`migrations/0029_order_billing_identity.sql` · `migrations/0030_invoice_document.sql` ·
`src/billing/{taxId,buyer,prefill}.ts` · `src/legal.ts` · `src/config.ts` · `src/db/schema.ts` ·
`src/console/{data,server}.ts` · `src/generator/configurator.ts` ·
`src/invoicing/{invoice,mock,szamlazz}.ts` · `src/payment/service.ts` ·
`assets/runtime/cit-configurator.{js,css}` · `scripts/billing-checkout-check.mts` · `hooks/pre-commit`

Commit `8f46995` → `origin/main` (IGAZOLTAN FENT). Éles deploy NEM történt.
