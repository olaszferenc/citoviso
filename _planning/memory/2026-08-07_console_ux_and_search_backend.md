# 2026-08-07/08 — Operátor-konzol üzemképessé tétele + keresés-backend rendbetétele

## Kontextus
A tulaj ELSŐ VALÓS tesztje a saját kezével (100 lead Keszthely környékéről). Minden tétel az ő
használat közbeni visszajelzéséből jött — nem terv szerinti fejlesztés.

## 1. Az A–Z lánc önjáróvá tétele (a session eleje)
- **Rendelés → fizetés SZAKADÁS** (`719f215`): a vevő rendelése után csak „24 órán belül felhívjuk"
  jött, a pay-linket OPERÁTOR-gomb adta ki. Most a submit ugyanabban a kérésben kiadja a
  fizetési linket (`requestPayment`) és a konfigurátor a fizetésre irányít.
- **Tenant host-routing** (`d0d086f`, 0017): `site.slug`+`custom_domain`; `<slug>.citoviso.com` a
  LIVE tenant-oldalt szolgálja (a bbox… a Host→site leképezés hiányzott, ezért esett a főoldalra).
- **Fizetés után a vevő MEGKAPJA a belépését** (`282fc2e`): az `issueAndSendTenantLogin` létezett,
  de SEHOL nem hívódott → a vevő nem tudott belépni. Bekötve az `activate()`-be (idempotens,
  best-effort: mail-hiba nem vonja vissza a kifizetett aktiválást).
- **Fizetés utáni képernyő** (`4bc841a`): fejlesztői halandzsa helyett a vevő megkapja az élő
  oldala címét, a felhasználónevét, hogy a jelszó e-mailben ment, és mit szerkeszthet.
- E2E prodon (mock gateway): order 1 · payment paid · tenant 1 · site LIVE · entitlement 2 ·
  invoice issued · lead=activation — kézi lépés nélkül.

## 2. Levél-formátum döntés (tulaj)
A levél **KÉPES lesz mindenképp**; a Gmail Frissítések fülét elfogadjuk. Kép NÉLKÜL is ott maradt
→ nem a kép a bűnös (a `List-Unsubscribe` + HTML-alak a fő jel). Javul: domain-bemelegítés, később
hideg-email-eszköz UGYANAZON a domainen. Feladó személyesítve (`Olasz Ferenc <olasz.ferenc@…>`).
`/p/` link-fix: nginx `citoviso.com/p/` → :4600 (a link addig 404-elt).

## 3. Scrape-terület kezelés (0018 + 0019)
- `/scrape` alatt 3 FÜL: Indítás · Térkép · Területek (nem külön menüpont — egy munkafolyamat).
- **Területek = KÖRÖK** (tulaj-kérés): Nominatim címkereső → középpont, rádiusz-csúszka,
  koncentrikus segédgyűrűk. A bbox SZÁRMAZTATOTT (a források téglalapot kérdeznek), a `run.ts`
  haversine-nel kiszűri a sugáron kívülieket → a terület tényleg kör.
- **Térkép**: minden koordinátás lead színezve (weboldal-állapot szerint) + a területek körei.

## 4. ⚠️ A LEGFONTOSABB: keresés-backend + a döntés-rögzítés kudarca
- A tulaj elkapta: több leadnek VAN jó honlapja, mégis „nincs honlapja".
- **3 külön hiba:** (a) a webes keresés SOHA nem keresett honlapot (csak domaint tippeltünk);
  (b) a portál-lista NAIV SUBSTRING volt → `danubiushotels.com` ⊂ `hotels.com` → a lánc saját
  oldala „portál" lett (javítva: hoszt-címke alapú + katalógus-BEJEGYZÉS felismerés);
  (c) a keresés CSENDBEN nyelte a 403-at → üres találat = „nincs honlap".
- **ÉN HIBÁZTAM:** a Google CSE-re építettem, holott a döntés 2026-07-07/11 óta megvolt
  (Brave; a CSE „entire web" 2027-01-01-ig kivezetve, a Bing API halott) — DE csak
  session-jegyzetben, **nem ADR-ként**. A tulaj joggal reklamált.
- **Javítva:** ADR-0026 a DECISIONS.md-be + visszautalás a jegyzetben; `webSearch.ts` DISZPÉCSER
  (Brave elsődleges → CSE legacy → hangos hiba). Kulcs nélkül no-op, a 0-API guess viszi a farkat.
- **⏱️ Az időzítés VÁLTOZATLAN:** a fizetős search-tail az AUTOMATA KURÁCIÓHOZ kötve (2026-07-11).

## 5. Konzol-UX (mind tulaj-visszajelzésből)
- **Kvalifikáció-BADGE** (ikon+címke, inline SVG): áthúzott földgömb = nincs honlap (fő célpont),
  óra = elavult, pipa = modern; áthúzott = diszkvalifikálva.
- **Lead-oldal**: „Begyűjtött adatok" panel (kontakt/koordináta/források/anyag + honlap-értékelés)
  és „Fotók" panel — a valós Places-fotók IGÉNY SZERINT töltődnek (`/lead/:id/photos`), mert a
  Places-lekérés pénzbe kerül.
- **Diszkvalifikálás** (lead-oldalon, indokkal): kikerül a munkából, de MEGMARAD (újra-scrape sem
  hozza vissza), visszavonható; az aktív lista rejti, külön linkkel nézhető.
- **SZŰRŐ-FIX**: a szerver jól szűrt, de a legördülő nem küldte el a formot → „nem működik".
- **Fejléc-szűrők** (`b826124`): oszloponként kereshető MULTISELECT élő darabszámmal, név-kereső
  datalisttel, „legalább N" a számoszlopokra; egy GET-form → a szűrők kombinálódnak, a rendezés
  megőrzi őket (a `qs()` tömb-kezelése javítva: ismételt paraméter, nem „a,b").
- Konzol-link fix: az ügyfél-belépőn a belső konzol linkje az admin-aldomainre mutat (a :4600
  élesben tűzfalazva → halott link volt).

## Prod-állapot a session végén
Kód: prod == main (`b826124`), 0 kódfájl-eltérés. 19 migráció. console/public/nginx aktív.
`PAYMENT_GATEWAY=mock` (hogy az A–Z kártya nélkül fusson), `INVOICE_PROVIDER=mock`,
`BRAVE_API_KEY` nincs (szándékosan), Chromium + CHROMIUM_PATH kész.
DB: a tulaj 100 valós leadje (Keszthely és környéke).

## Nyitott / következő
- A tulaj végigfuttatja az A–Z-t a saját kezével (mock → jóváhagyás → /p/ → rendelés → fizetés →
  tenant-belépés → szerkesztés).
- Valós árak a /pricing-en + valós e.v.-adatok (feladó) — a §C-kapu addig blokkolja az ár-hirdetést.
- Éles Barion + Számlázz kulcs (tulaj-döntés: a teljes A–Z sandbox-teszt UTÁN).
- Brave-kulcs: az automata kurációhoz kötve (ADR-0026).
- Minőség-ív ADR-0025 hátralévő körei: ④ interlock → ③ ritmus + ⑥ crop (⑤ paletta kész).
