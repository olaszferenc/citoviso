## ADR-0055 — A vevő SZÁMLÁZÁSI IDENTITÁSA a fizetés előtt; a számla sosem fabrikálódik marketing-adatból
- **Dátum:** 2026-08-22 · **Státusz:** ELFOGADVA (①③ implementálva, ②④⑤ nyitva)
- **Kiváltó (tulaj):** „nem kérünk be számlaadatokat a leadtől, hogy magánszemélyként vagy cégként
  veszi igénybe, és hogy hogyan számlázzuk. Ez egy óriási hiba."
- **A lelet igazolva, és rosszabb volt a feltételezettnél.** A megrendelő űrlap NULLA számlázási
  mezőt gyűjtött, az `issueInvoiceFor` pedig marketing-adatból építette a vevőt:
  `name = lead.name` (a Google Maps megjelenítési neve, nem jogi név), `address =` regexszel vágott
  Maps-cím-string, `taxNumber = null` **beégetve** — ez volt az adószám EGYETLEN előfordulása az
  üzleti logikában. Cég vevő tehát adószám nélküli számlát kapott: költségként elszámolhatatlan, a
  NAV Online Számlában nála láthatatlan, garantált sztornó-kérés az első pilot-vevőnél.
- ⛔ **Miért nem derült ki:** a `parseHuAddress` saját kommentje BEISMERTE a rést („The proper fix is
  a structured address collected at checkout"), a mock számla-szolgáltató viszont semmit nem
  validált, ezért a lánc végig zöld volt. Ez a `feedback_mock_path_masks_live_path` minta harmadik
  előfordulása: a mock engedékenyebb volt a produkciónál, tehát elrejtette a produkciós hibát.

### A döntés
1. **A vevő-nyilatkozat az ORDER-en él, immutábilisan** (0029, az `order_intent`-en) — a §A fotó-jog
   mintáját követve a TÉNYT és az ELFOGADOTT SZÖVEGET is rábélyegezzük (§H.22). Ez jogilag az, ami:
   amit a vevő a fizetéskor állított magáról. A későbbi, szerkeszthető `billing_profile` (ismétlődő
   számlázáshoz) ebből származtatható, migráció nélkül.
2. **A bekérés helye: a konfigurátor, a fizetés ELŐTT.** A számla a fizetéskor jár; utólagos
   bekérésnél vagy hibás számlát állítunk ki és javítunk, vagy késünk. A súrlódást az fogja le, hogy
   a mezők a lead adataiból ELŐRE KITÖLTVE érkeznek: a vevő megerősít, nem gépel.
3. **Két adó-autoritás, szándékosan NEM összemosva.** HU adószám → a CHECKSUM az autoritás, offline
   (súlyok 9,7,3,1,9,7,3, mod 10; négy valós adószámon igazolva). EU VAT → a VIES az autoritás.
   ⚠️ Egy magyar **AAM-os** vállalkozó jogosan HIÁNYZIK a VIES-ből, ezért VIES-hiány SOHA nem
   utasíthat el belföldi vevőt. A VIES a cég JOGI NEVÉT is visszaadja — ez váltja ki a „marketingnév
   a számlán" hibát külföldi cégnél.
4. **Fordított adózás CSAK bizonyítékkal.** Áfa tv. 37. § szerint EU-s CÉG vevőnél a teljesítési hely
   a vevő országa, és a magyar AAM ez alól NEM ment fel. De adóterhet igazolatlan állításra átbillenteni
   tilos: `reverse_charge` kizárólag `buyer_type='business'` + közösségi adószám + `vies_status='valid'`
   együttállásnál születhet — **DB CHECK-megszorítás kényszeríti**, nem kódfegyelem. VIES-kiesés
   (`unavailable`) SOHA nem blokkol eladást: AAM-ra esünk vissza és operátor-jelzést hagyunk.
5. **Fogyasztói elállás (45/2014. Korm. r. 29. § (1) a)).** Azonnal élesítünk, tehát a 14 napos
   határidőn BELÜL teljesítünk → magánszemély vevőnél kifejezett hozzájárulás + a jog elvesztésének
   tudomásul vétele KELL. Enélkül a vevő a KÉSZ oldal után 14 napig elállhatna és visszakérhetné a
   pénzt. Cég vevő nem fogyasztó → nála a sor meg sem jelenik.
6. **Nyilatkozat nélkül NINCS tippelés.** 0029 előtti (vagy a kaput megkerülő) order → `failed`
   státuszú számla-sor kimondott indokkal, hogy az operátor kézzel intézze. **A hibás számla rosszabb,
   mint a hiányzó.**
7. **A MOCK szolgáltató ezentúl azt utasítja el, amit a Számlázz.hu is.** Egy mock, ami engedékenyebb
   a produkciónál, produkciós hibát rejt el. Ez a konkrét rés hónapokig ezért élt.

### Ami ebből NEM készült el (a session eredeti célja, nyitva marad)
- **② Barion fizetési adatok tárolása** — a `parseWebhook` ma a `GetPaymentState` teljes válaszából
  KETTŐ mezőt tart meg (`gatewayRef`, `status`). Elveszik: Barion TransactionId, fizető neve/e-mailje,
  funding source, **jutalék**, **elszámolás/kifizetés dátuma**. Az utóbbi kettő nélkül a bankkal nem
  lehet összevezetni: a bankszámlára nem a számla összege érkezik, hanem jutalékkal csökkentett,
  ÖSSZEVONT kifizetés.
- **③ Számlázz.hu import** — az adapternek egyetlen metódusa van (`issueInvoice`). Nincs lekérdezés,
  sztornó, díjbekérő, se a Számlázz.hu felületén kézzel kiállított számlák behúzása. A PDF-kérés
  (`szamlaLetoltes`) és a tárolás (0030) most már megvan, de az import nem.
  ✅ **KORREKCIÓ (2026-08-22):** az adapter NEM validalatlan. 2026-07-21-en teljes A–Z kor ment vegig a
  tulaj Szamlazz.hu **teszt-fiokjaval**: Barion sandbox kartyas fizetes → paid → site live → valos AAM
  teszt-szamla **`OV-2026-2`** EZEN az adapteren. A `szamlazz.ts` fejleceben allo „NOT validated against
  a live account” komment **ELAVULT volt, es engem is felrevezetett** — a rekord visszaolvasasa helyett a
  kommentre epitettem (`feedback_decisions_belong_in_adr` mintaja). A komment javitva.
  Az `INVOICE_PROVIDER` szandekosan marad `mock`, hogy lokal futas ne gyartson veletlenul ujabb bizonylatot.
  ⛔ **Viszont minden 0029 ELOTT kiallitott szamla — `OV-2026-2` is — FABRIKALT vevot hordoz**
  (marketingnev jogi nevkent, regexszel vagott cim, adoszam nelkul), mert a hivo ezt adta at: az adapter
  jo volt, a **bemenete** nem. Ezek a dokumentumok tehat NEM mintak arra, hogy mi a „jo”.
- **④ Bejövő költségszámlák** (Hetzner, Anthropic, Barion-díj, Cloudflare, Brave) — nincs entitás.
- **⑤ Bank + bizonylat-felület** — nincs séma, nincs menüpont. Bank-csatorna eldöntetlen (a tulaj
  automatizálás-barát bankot keres, a MagNet a jelölt).
- ⚠️ **ÁSZF-dokumentum NINCS.** A `config.termsUrl` szándékosan üres: üres URL mellett az elfogadó sor
  meg sem jelenik, mert halott linkre mutató pipa rosszabb a semminél. **Élesítés előtt pótolandó.**
- ⚠️ **Könyvelői jóváhagyás kell** az EU-s ág adókezelésére (közösségi adószám, összesítő nyilatkozat).

- **Visszafordíthatóság:** 🔄 additív séma + kapu; a nyilatkozat-modell egyirányúbb (🚪), mert jogi
  bizonyíték-lánc épül rá.
- **Őr:** `scripts/billing-checkout-check.mts` (33 ellenőrzés, pre-commit, `--self-test` pirosra megy).
