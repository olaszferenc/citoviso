## ADR-XXXX — A főoldal ára a látogató ORSZÁGÁBÓL jön, a nyelve a böngészőből (ha nincs ársor: Globális)

**Státusz:** ELFOGADVA. Tulaj 2026-11-26, a koordinátoron (`cit9b4690e3`) át: „adott országból böngészve adott ország lista ha van, ha nincs Globális”; kiegészítés: „nyelv = böngésző nyelve, ha van”. Brief `~/rc-briefs/fooldal-ar-orszag-szerint-20261126.md`.
**Épít:** ADR-0443 (pénz-út: `regionPriceGaps`, a `global` csak az anonim főoldal-kijelzés), ADR-0460 (piac-kapu), ADR-0465 (euró ár-réteg), ADR-0437 (ország-sor `pricing_region`).
**Felülírja:** az ADR-0473 ③ pontjának első tételét („minden más nyelv: euró-ársor a `hr` régióból”) és az ① „nincs IP-tipp” kitételét az ÁRRA. A nyelvre az ADR-0473 ① és ⑤ változatlanul áll.

### Kiváltó
A régiót a böngésző nyelve döntötte el: magyar nyelv → `hu`, minden más nyelv → `hr`. Egy német, olasz vagy amerikai látogató is a horvát árat látta, a `global` ársor sehol nem jelent meg.

### Döntés
① **Az ársort a látogató országa adja:** a Cloudflare `CF-IPCountry` fejléce → az ország-sor `pricing_region`-je (`countryConfig`). Fizetős geo-API nincs. Mérve 2026-11-26-án élesen, egy próbakéréssel és csak olvasva: a fejléc megérkezik a public szerverhez (`CF-IPCountry: HU`), az nginx továbbadja.
② **Az ország ársora akkor látszik, ha az ársor megerősített (`pricingConfirmed`) és teljes (`regionPriceGaps` üres).** Különben a `global` jön, ugyanezzel a feltétellel. Ha az sem mutatható, a mai „egyedi ajánlat” blokk jelenik meg, szám nélkül, tipp soha.
③ **A piac-kapu (ADR-0460 ②) NEM feltétel.** A kapu a megkeresést és a rendelést őrzi. Itt egy megerősített, teljes ársor kijelzéséről van szó, és ez pontosan az az ár, amit egy onnan érkező rendelés kapna (`orderRegion.ts`). Ahol nincs ilyen ársor, ott a Globális áll be.
④ **Ismeretlen ország** (nincs sor, `XX`, `T1`, nincs fejléc) → `global`.
⑤ **Nyelvi jel nélküli kérésnél** (kereső-robot, csupasz kliens, nincs `Accept-Language`) marad a mai magyar oldal a magyar ársorral, akárhonnan jön. Így az indexelt magyar oldal megtartja az árait, mert a Googlebot jellemzően US-IP-ről, nyelv nélkül jár.
⑥ **A nyelv a böngészőé** (homepageLang): az első teljesen lefordított nyelv, különben angol. A nyelv és az ár két külön döntés.
⑦ **A magyar oldal** (Szállás.hu, forintos jutalék-kártya, Magyarország-térkép) a magyar böngészős, magyar ársorú látogatóé. Minden más kombináció a nemzetközi oldalt kapja a saját nyelvén. Egy külföldön élő magyar tehát magyarul olvassa a nemzetközi oldalt az ottani árral. A kliens (`home.js`, változatlan) a `LANG === "hu"`-ból állítja a magyar térképet; a magyar nyelvű nemzetközi oldal kliens-nyelve ezért `hu-150` (magyar, Európa — ugyanaz a többes szám és számformátum), így Európa-térképet és országszűrés nélküli keresőt kap.
⑧ **A megtérülés-számoló pénznemfüggetlen:** a `home.js` minden összeget század egységnek olvas, ezért a szerver a 0 tizedesű pénznem (HUF) összegét ×100-zal adja át; a kezdő éjszakai ár pénznemenként van megadva (EUR 85, HUF 32 000). Enélkül forintnál a csomag éves ára százszor kisebbnek látszott.
⑨ **`?region=`** az operátori előnézet marad. A válasz fejléce `Vary: Accept-Language, CF-IPCountry`.
⑩ **A konfigurátor és a rendelés NEM a főoldal régióját kapja, hanem a SZÁLLÁS országáét** (ADR-0443 ④, `orderRegion.ts`). A forrás mindkét helyen ugyanaz: az ország-sor `pricing_region`-je, csak más országra alkalmazva. A főoldalról nincs közvetlen rendelési út: a mintakérés leadet csinál, és a lead országát a térképes tű adja.

### Megvalósítás
- `src/server/homepage.ts`: `homepagePriceRegion`, `homeRegionShowable`, `acceptLanguageTags` (a `homepageLang`-ból kiemelve); `renderHomepage`: `foreign = lang ≠ hu VAGY régió ≠ hu`; `paybackSection`: század-skála; `foreignHomepage`: kliens-nyelv `hu-150`.
- `public/assets/home/home.js`: NEM változik (felület-kapu, §2b) — a két kliens-igazítás szerveroldalon történik.
- `src/server/public.ts`: `Vary` fejléc.
- Őr: `scripts/homepage-price-region-check.mts` (pre-commit, diff-scope-olt), 11 eset, kliens-nyelv és számoló-összeg is.

### Mérés (2026-11-26, dev; az éles ársorok ugyanilyenek)
- HU + magyar böngésző: a régi kód kimenetével bájtra azonos (nyelvi jel nélkül is).
- HR → `hr` EUR · IT → `it` EUR · DE, US, XX, fejléc nélkül → `global` → egyedi ajánlat (a `global` ma nincs megerősítve, és 14 modulár hiányzik belőle) · HU IP + német böngésző → német oldal forinttal · HR IP + magyar böngésző → magyar nemzetközi oldal euróval.
- Playwright, három kombináció: 0 JS-hiba; a számoló forintnál 72 400 HUF/év (előtte 724 HUF).
