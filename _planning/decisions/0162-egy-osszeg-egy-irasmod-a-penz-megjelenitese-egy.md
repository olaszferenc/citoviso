## ADR-0162 — Egy összeg, egy írásmód: a pénz MEGJELENÍTÉSE egy szabály (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA ·
**Kapcsolódó:** ADR-0144 ② (a dátum ugyanez az ügy, `src/text/day.ts`), ADR-0036/§B.18 (i18n),
ADR-0109 (régió-árazás), ADR-0128 (29 nyelv).

**Kiváltó (mérve, Elek FK-006a ERGONÓMIA-4, újramérve 2026-09-14-én `4535965`-ön).** A hat
dunning-levél nyers `{amount} {currency}` párt interpolált — „A megújulás díja: **99 900
HUF**" —, a számla-levél UGYANARRÓL a terhelésről „**99 900 Ft**"-ot írt. Egy vevő, két
írásmód, ugyanarról a pénzről.

**A mérés szélesebb leletet adott, mint a bejelentés.** A kódban **23 hely** formázott pénzt,
és ugyanaz a 99 900 HUF **öt alakban** jött ki: sima szóközzel · nem törő szóközzel (NBSP) ·
pénznem nélkül · `Intl` pénznem-stílussal · gépi kóddal. A bejelentett „HUF" ezek közül csak
**egy**.

**⛔ A súlyosabb hiba nem a jel volt, hanem a PÉNZNEM.** Öt hely bármit kapott, „Ft"-ot írt:

- a **fizetőoldal** a `generator/configurator.ts`-ből a literális `"Ft"`-ot kapta *pénznemként*,
  és a kliens azt ragasztotta minden összegre — egy EUR-régiós vevő €-ban fizetne, és „Ft"-ot
  olvasna azon a lapon, ahol fizet;
- a **vendég foglalás-előnézete** (`cit-runtime.js`) minden nem-EUR összeget forintnak mondott;
- a tenant-admin három beágyazott scriptje pénznem-paramétert sem ismert.

Ez **nem elméleti**: a dev DB-ben a `pricing_config` két sora él — `hu/HUF` **és**
`global/EUR` (10 EUR/hó).

**A döntés.**

① **A megjelenítésnek EGY definíciója van: `src/text/money.ts`** (`formatMoney` ·
`formatNumber` · `currencySign`). A tárolt alak marad gépi (`amount:number` + `currency`), a
mondat formáz — ugyanaz az elv, mint a dátumnál (ADR-0144 ②). Ezért lett a
`BillingMailBase.amount` **string→number**: egy új levél-építő így nem tud megfeledkezni róla.

② **A formázó nem tud tévedni a pénznemben.** `HUF`→„Ft", `EUR`→„€", **minden más a saját
kódját írja ki** — „Ft"-ot írni egy RON összegre rosszabb, mint kiírni a kódot.

③ **⛔ Magyarul SOHA `Intl.NumberFormat(style:"currency")`.** Két mért csapda: hu-HU az EUR-t
„99 900 EUR"-nak írja (elveszik a €), és **kivételt dob** minden nem-ISO értékre — mi pedig
adunk ilyet (`scraper/types.ts`: a pénznem „úgy, ahogy publikálták": `HUF`, `EUR`, `Ft`, `€`).
Minden ág inkább visszaesik, mint dobjon; hiányzó összeg → **üres string**, sosem „NaN Ft".

④ **A nem-magyar olvasó Intl-t kap** — a német „99.900 HUF"-ot olvas. Ez nem a hiba
visszatérése, hanem az ellenkezője: a „Ft" a magyar **belföldi** jel, és egy olyan olvasónak
kiírni, aki sosem látta, ugyanaz a gépi forma lenne, csak a másik irányba.

⑤ **Elválasztó: SIMA SZÓKÖZ, minden nyelven** (tulajdonosi döntés a mérésből). Mind a **28**
pénz-literál az őrökben és az Elek-forgatókönyvekben U+0020-t vár; a `payment/billing.ts` már
kézzel mosta ki az NBSP-t; SMS-ben az NBSP kiesik a GSM-7-ből (160 → 70 karakter). A
sortörés-védelem **stíluslap-ügy** (`white-space:nowrap`), nem string-ügy.

⑥ **A böngésző-tükör SZÁNDÉKOS második példány.** A fizetőoldal minden kattintásra újraszámol,
tehát a szerver nem adhat kész stringet, a böngésző pedig nem tud TS-t importálni →
`assets/runtime/cit-money.js`. Amitől biztonságos, az nem a fegyelem, hanem a kapu: az őr
lefuttatja mindkettőt és az első eltérő bájtnál bukik.

⑦ **⛔ A SZABÁLY A SCRIPTTEL UTAZIK, NEM A LAPPAL.** Menet közben a tükröt a lap-vázba
(`shell()`) tettem — rendezettebbnek látszott, és hibás volt: a tenant-admin szekciói
**önállóan** is renderelődnek (a saját őreik pontosan így csinálják), és azok a lapok sosem
futtatják a vázat. Mérve: `multilang-tier-check` hétszer `ReferenceError: CitMoney is not
defined`, a modul-szerkesztő élő végösszege pedig **némán 61 500 Ft-ot mutatott 68 400 Ft
helyett** — hiányzó formázó, ROSSZ SZÁM. A forrás újrafuttatása ártalmatlan (tiszta IIFE egy
`var`-ban); a hiányzó függőség nem az.

**Kapu:** `scripts/money-format-check.mts` — **31 állítás, 14 piros önteszt** (két
álpozitív-kontrollal: a hibát IDÉZŐ komment és a szabályt HOZÓ script nem lelet). Öt ág, mert
a hibának öt külön alakja volt: ① paritás (727/727) · ② a szabály · ③ a hét levél EGY alakot ír
· ④ a felületek hozzák a szabályt (és minden lapot építő script párosítja) · ⑤ **drift**: nincs
hatodik formázó. ⭐ **A ⑤ ág a többit tartja igazzá** — és rögtön bizonyított is: **öt további
formázót** talált, amit a kézi leltáram kihagyott (16-ból lett 23), a landolási rebase-nél
pedig egy **hatodikat**, amit egy párhuzamos szál aznap emelt ki (`hufAmount` — ugyanaz az
ösztön, egy szinttel rövidebb), plusz egy új widget-fogyasztót
(`booking-outcome-truth-check.mts`).

**Hatókör:** 23 hívó — 6 dunning-levél · számla-levél · domain-elszámoló · fizetőoldal ·
vendég foglalás-előnézet és szerver-oldali párja · a generált lap árai · tenant-admin (2
szerver + 4 beágyazott script) · operátor-konzol.

**§2b felület-kapu:** tulajdonosi kivétel, naplózva — magyar régióban a jelzett 5 felületen az
egyetlen változás NBSP→szóköz (vizuálisan azonos), elrendezés/szín/szerkezet érintetlen; a
valódi viselkedés-változás a nem-HUF eseteké.

**Visszafordíthatóság:** 🔄 felirat-szintű, adatmigráció nincs. ⚠️ A 6 i18n-katalógus-kulcs
megváltozott (`{amount} {currency}` → `{amount}`), tehát a nem-magyar csomagok ezt a 6 mondatot
újrafordítják a `ensureLanguagePack` első futásán.
