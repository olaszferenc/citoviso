# 2026-11-26 — A főoldal ára a látogató országából, a nyelve a böngészőből (ADR-0490)

Session `citc00b6cf8`, koordinátor `cit9b4690e3`, brief `~/rc-briefs/fooldal-ar-orszag-szerint-20261126.md`. Élesen NINCS.

## Elvégzett munka
- A régiót eddig a böngésző nyelve döntötte el (minden nem magyar → `hr`). Most a `CF-IPCountry` → az ország-sor ár-régiója dönt, ha az ársor megerősített és teljes; különben a `global`; ha az sem mutatható, egyedi ajánlat, szám nélkül.
- Nyelvi jel nélkül (robot) a mai magyar oldal marad a magyar ársorral, akárhonnan jön a kérés.
- A magyar oldal csak a magyar böngésző + magyar ársor kombinációé; minden más a nemzetközi oldal a böngésző nyelvén (külföldön élő magyar: magyar nyelvű nemzetközi oldal). A kliensnek ilyenkor `hu-150` a nyelve, így Európa-térképet kap (`home.js` változatlan).
- A megtérülés-számoló forintnál százszoros hibát adott volna (két tizedest feltételezett): a szerver a forint-összeget ×100-zal adja át (a kliens század egységet vár), és a kezdő éjszakai ár pénznemenként van megadva.
- `Vary: Accept-Language, CF-IPCountry`.
- A `homepageLang` a koordinátor kiegészítése szerint már eddig is így működött (teljesen lefordított nyelv, különben `en`, fejléc nélkül `hu`), ezt nem kellett módosítani.

## Mérés
- Élesen a `CF-IPCountry` megérkezik a nyilvános szerverhez (próbakérés, loopback-lehallgatás, csak olvasás).
- `scripts/homepage-price-region-check.mts`: 62/62 zöld; a HU-render bájtra a régi kódé.
- Playwright: HR IP + magyar böngésző, HU IP + német böngésző: 0 JS-hiba.

## Módosított fájlok
- `src/server/homepage.ts`, `src/server/public.ts`
- `scripts/homepage-price-region-check.mts` (új), `hooks/pre-commit`
- `_planning/decisions/XXXX-fooldal-ara-a-latogato-orszagabol.md` (új ADR)

## Nyitott
- A `global` ársor kitöltése és megerősítése a /pricing Globális fülén (tulaj): 14 modulár hiányzik (gallery, rooms, amenities, pricing, location, hours, usp, reviews, poi, booking, email, multilang, multilang6, multilang28), és nincs megerősítve. Amíg ez így van, a DE/US/ismeretlen országú látogató egyedi ajánlatot lát, szám nélkül.
- A `resolvePricingRegion` (src/pricing.ts) a nyelvi tippel együtt csak az őrökben él, a főoldal nem használja; nem nyúltam hozzá.
