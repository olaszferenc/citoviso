# 2026-08-27/28 — Automata egyedi-domain (ADR-0071/0078) + a terv-kapu csatornája (ADR-0076/0077)

**Landolt commitok:** `dd2360e` (motor) → `a01f714` (doktrína + jóváhagyott terv) →
`c615189` (Webcím fül) → `4706451` (értesítő e-mail) → `2c54a7b` (systemd timer).
Élesítés NEM történt (§0.3) — minden lokális.

---

## A kiinduló kérdés

Tulaj: *„Nincs valós ötlet arra, hogy ha egy lead egyedi domain nevet akar, ezt milyen
szolgáltatón keresztül tudjuk megcsinálni. A fő kritérium: zéró emberi interakcióval
működjön. Ami szintén nincs meg: választhasson egyedi domaint akkor is, ha már tenant."*

**Amit a visszaolvasás mutatott:** az IRÁNY rég eldőlt (ADR-0020 stratégia, ADR-0024
INWX + Cloudflare), csak a VÉGREHAJTÓ RÉTEG hiányzott — a vásárlás „A2 kézi ház-lépés"
volt, kód nélkül. A kiszolgálás-oldal viszont KÉSZ volt (`site.custom_domain`,
slug→domain 301, canonical). Két valódi hézag: (1) a vétel automatizmusa, (2) élő tenant
utólag egyáltalán nem tudott domaint venni.

## Amit építettünk

**Motor (ADR-0071).** Fizetés-triggerelt beszerzés: a `handleWebhook` `paid` ága indítja
(nincs jóváhagyó gomb — a vevő választott és fizetett, a vétel maga a megrendelt
szolgáltatás). Adapter-réteg env-kapcsolóval (`REGISTRAR_PROVIDER`, `DNS_PROVIDER`),
lokál alapból mock — a fejlesztés SOHA nem vesz valódi domaint. Idempotens állapotgép
(`pending→…→live`), a `custom_domain` CSAK `live`-nál élesedik. Migráció 0038.

**Felület (ADR-0078, B változat).** Külön „Webcím" fül, 3 lépés. Utólagos vétel:
`order_intent kind='domain_upgrade'` a 0033/0036 mintájára — ugyanaz a tesztelt fizetési
lánc, nem másodpéldány.

**Értesítő + timer.** A felület ígérte („e-mailben jelezzük"), a kód nem teljesítette →
`domainEmail.ts`. A percekig tartó NS/TLS-propagációhoz systemd timer (kétpercenként),
unit-fájlok verziózva (`deploy/systemd/`).

---

## A legfontosabb tanulságok

### 1. A tulaj kérdése hozta ki a lokál-tesztelhetőség két csapdáját
*„Lokálon legyen tesztelhető, ne igényeljünk tényleg honlapot a tesztfolyamat közben."*
- **A 301 csapdája:** a mock „megveszi" a domaint → a slug-hoszt 301-gyel egy NEM LÉTEZŐ
  címre irányított volna, és a lokál teszt-honlap a folyamat közepén meghal. Mock módban
  a régi cím szolgál ki tovább, a felület KIMONDJA a teszt-módot. Mérve: 200 + 27 KB
  tartalom, miközben az állapot már `live`.
- **A demó-tenantnak nem volt `prospect` sora** → EGYETLEN fizetős funkció sem volt
  kipróbálható lokálban (a multilang sem!): a rendelés csendben `null`-t adott. Régi,
  rejtett hiba, amit ez a szál hozott felszínre.

### 2. Az őrök kétszer is dolgoztak — és nem vakon kivételeztem
- A **KB-coverage** blokkolta a commitot: `admin.domain` horgony KB-entry nélkül (ADR-0045).
- Az **import-gráf alapú i18n-őr** (ADR-0070 §2 — épp azért épült, hogy a lista ne legyen
  kézi) elkapta, hogy a `provisionDomain.ts` a levél-closure-be került, és vele az
  `editor.ts` is. MEGNÉZTEM mindkettőt: az egyik csak napló/dobott hiba, a másik SiteData
  forrás-string, amit a string-kulcsú fordítás fed. Indokolt kivétel, leírt okkal.

### 3. Csendes eltérés a jóváhagyott tervtől — magamtól javítva
Az első megvalósításom soronkénti „Ezt kérem" gombot adott, a jóváhagyott B terv viszont
rádiós lista + EGY „Tovább" gomb. **A kontraktus-kép a mérce (§2b 5.)** — a tervre
igazítottam. Pont ez az, amit a kapu meg akar előzni.

### 4. Ígéret ≠ teljesítés (§B.17 magunkra is áll)
A felület és a KB is ígérte az értesítő e-mailt, a domain-ágban NULLA e-mail-kód volt.
Az őr mostantól **az ígéretet és a teljesítését EGYÜTT méri**: ha a felületen ott a
mondat, a küldésnek is lennie kell.

### 5. Technikai indok pontosítása a naplóban
A tulaj úgy döntött, hogy sikertelen beszerzésnél nincs auto-visszautalás, mert szerinte
az „nem barion spec hanem bank". **A Barionnak VAN `Payment/Refund` API-ja** — a döntés
helyes, de az oka más: nem képtelenség, hanem meg-nem-épített funkció (0 refund-ág,
mérve). Rögzítve, mert egy téves technikai indok később rossz döntést alapozna meg.

---

## A terv-jóváhagyási kapu csatornája (ADR-0076/0077)

**Tulaj:** *„Elhagyjuk a Claude dizájnt, de a doktrína marad: kinézet user döntés ami
meghatározza a kódot."*

⚠️ **Önellentmondáson kapott, jogosan.** Korábban a Claude Designt azzal érveltem, hogy a
dizájnok azért mentek félre, mert „nem láttam" a terveket — most meg azt mondtam, nem
használom. A feloldás: **KÉT külön „nem látja" probléma van, és ezeket összemostam.**
① az AI nem látja, amit generál → `ui-shot` + Read, LOKÁLIS, **ez** javította meg a
„90-es évekbeli felületek" bajt; ② a tulaj nem látja a tervet kód előtt → ez a CSATORNA.
A design-app KIZÁRÓLAG a ②-t szolgálta.

**Új szabályok a §2b-ben:**
- MINDIG MŰKÖDŐ MOCK (input-viselkedés, kattintások, állapotváltás) — a viselkedés a
  VALÓDI szabályokat tükrözze, ne szebb hazugságot; a felirata se állítsa magáról, hogy
  „nem működő", ha működik.
- A mock HELYE a munkafán belül (`assets/design-refs/_drafts/`) — a `/tmp` és az
  `assets/Temp` symlink a session munkakönyvtárán KÍVÜL esik → az RC nem tudja megnyitni.
- ⛔ **DESKTOP ÉS MOBIL MINDIG, a SZÁLLÍTÁSNÁL is.** Legyártottam mindkettőt, de csak a
  mobilt küldtem → a tulaj a döntés felét nem látta. A szabály eddig is „desktop ÉS
  mobil"-t mondott — **én sodródtam el tőle**: az ELLENŐRZÉS ki volt mondva, a SZÁLLÍTÁS
  nem. *Meta: az „X-et IS csináld" alakú szabály „X-et csináld"-dá kopik, ha az egyik ág
  kényelmesebb — a kimaradt LÉPÉSNÉL kell kimondani.*
- Takarítás: a `land.sh` törli a `_drafts/`-ot (a tulaj kérte a triggert).

**Az ui-shot kiterjesztve `--tenant`-tal:** a tenant-admin a publikus szerveren él és
belépést kér, ezért eddig NEM volt lelőhető — vagyis a doktrína ① célja azokra a
felületekre teljesíthetetlen volt.

---

## Nyitott / következő

- **Külső függés:** INWX + Cloudflare fiók és kulcsok. Addig a live adapterek őszinte
  stubok (kulcs nélkül a konstruktorban dobnak, nincs néma mock-fallback).
- **Éles telepítés** (szolgáltatás + timer, `WorkingDirectory=/opt/citoviso/app`) külön,
  kimondott engedélyt igényel (§0.3) — NEM történt meg.
- **Meglévő saját domain rákötése** (`own` eset) ma nem önkiszolgáló — a KB ezt őszintén
  kimondja („írjon nekünk").
- Kapu: `scripts/domain-provision-check.mts` — 44/44 zöld, `--self-test` PIROS.
