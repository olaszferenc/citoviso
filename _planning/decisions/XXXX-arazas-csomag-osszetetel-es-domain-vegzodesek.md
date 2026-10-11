## ADR-XXXX — Árazás: a csomagok összetétele szerkeszthető, a saját domain csomag-tartalom lehet, végződésenkénti díjjal; kötelező platform-cím; a próba csomagja paraméter

**Dátum:** 2026-10-11 · **Kontextus:** tulaj-döntések egy szálban (domain-ár mérés → pilot-kilépések → árazási folyamat → terv-kör, `assets/design-refs/console/pricing-redesign/`). **Felülírja:** ADR-0109 ③ („NINCS ingyen-ág” → paraméter), ADR-0109 ① (egyetlen átalány-havidíj → végződésenkénti), ADR-0093 ④ (EUR-plafon → végződésenkénti beszerzési plafon), ADR-0103 ④ (HUF→EUR átváltás az őrben), ADR-0342 „minden modullal” (a próba csomagja paraméter). **Megtartja:** ADR-0109 ②⑧ (a küszöb a LISTAÁRON mér, kedvezmény nem számít), ④–⑥ (hűség, kötbér, a domain-díjra kedvezmény nem megy), ADR-0192 (függőségek), ADR-0354 (próbában egy kedvezmény).

### Kiváltó

1. **Mért ár (2026-10-11, Websupport `validate`, élő fiók):** a `.hu` egységesen **1 990 Ft nettó / 2 527 Ft bruttó / év** — hossztól és „értéktől” független (2–40+ karakter, szótári név: azonos ár, csak foglaltság különbözik). `.eu` 2 499 Ft, `.com` 4 899 Ft nettó. Az ADR-0103 „2 599 Ft/év” adata elavult. A végpont az első éves árat adja; a megújítási árat nem.
2. **Pilot-adat (éles, 10-06…10-10, 62 megnyitó):** 5 nyitotta meg a rendelés-panelt, a webcím-kapuig 0 jutott. A tulaj feltevése (az aldomain riaszt el) a mért kilépési pontokból nem igazolható és nem cáfolható; az aldomaint a link (ADR-0330) első másodperctől mutatja.
3. **Tulaj:** „a pilot fő célja minél több előfizető … érdemes lehet kampányjelleggel felajánlani, hogy előfizetés esetén saját domainnevet regisztrálunk”; „a 3 csomaghoz hozzáadható / eltávolítható legyenek a modulok, beleértve a domaint is (de a domain részletei szintén külön paraméter)”; „Ha valamelyik csomagba beleszámít a domain, akkor ne legyen havidíja”; „kötelező legyen a citoviso-s aldomain is … az ÁSZF-ben … nekünk ez a SEO miatt fontos”; „saját maga választ domaint”; az ingyen domain „beállítható legyen”; „ha nincs bedobva egyik csomagba se, akkor összeg”.

### Döntés

**① A csomagok összetétele adat, nem kód.** `package_module` tábla (`module_id` PK, `tier` ∈ alap · ajanlott · teljes): minden modul legfeljebb EGY sorral, a legalacsonyabb csomaggal, amelyben benne van — a magasabbak öröklik. Így az egymásra épülés (tulaj, 2026-09-07) szerkezeti, nem ellenőrzött. Üres tábla = a kódbeli seed (`PRESETS`), a domain nélkül. A `PRESETS`-t olvasó helyek (konfigurátor, `orderPresetId`, konzol, eszkalációs példa) a betöltött összetételt kapják. Mentéskor a szerver elutasítja: ismeretlen modult, a gerincet nem az Alapban, és a kemény függőség (ADR-0192) elszakadását — egy modul nem lehet alacsonyabb csomagban, mint a kemény függősége.

**② A saját domain csomag-tartalom lehet.** A `domain` ál-modul a `package_module`-ban. **Egy modulkészlet akkor „tartalmazza” a domaint, ha lefedi a legkisebb domaint tartalmazó csomag teljes (öröklött + saját, a leállított modulok nélkül) modul-listáját** — így az egyedi összeállítás is jogosult, ha legalább annyit vesz. Ilyenkor a domain havidíja **0**, ha (a) a piacon az „Ingyen domain csomagban” kapcsoló be van kapcsolva (`pricing_config.domain_free_in_package`, alap: KI — a mai viselkedés marad mentésig), és (b) a domain végződésén „csomagban ingyen” jelölés van. Különben a végződés havidíja jár (felár). Ez csomag-TARTALOM, nem kedvezmény: az ADR-0354 „egy kedvezmény” elvével nem ütközik, és a kedvezmény továbbra sem megy rá (ADR-0109 ⑥).

**③ Végződésenkénti adat.** `domain_tld` tábla (piac × végződés): kínáljuk-e, mért nettó beszerzési ár + pénznem + mérés ideje, beszerzési plafon, havidíj csomagon kívül, „csomagban ingyen”. Seed: a mai `custom_domain_monthly` és a 10-11-i mérés (`.hu`, mindkét piacon). **A vevő maga választ nevet ÉS végződést** a kínált végződések közül. Kínálni csak mért árú, plafon alatti végződést lehet. A vétel-őr (ADR-0093 ①b) a regisztrátor élő NETTÓ árát a végződés plafonjával veti össze, azonos pénznemben; eltérő vagy ismeretlen pénznem → nem vesz (fail-closed, ADR-0103 ④ szellemében). A `domain_max_price_eur` és a `custom_domain_monthly` oszlop marad (régi rendelések / visszafelé olvasás), de új döntést nem hoz.

**④ Belépési küszöb: 0 = nincs küszöb.** A `domain_min_package_monthly` 0 értéke mostantól „mindenkinek választható” (eddig a konfigurátor „nem kínálható”-nak olvasta). Küszöb felett vagy csomag-tartalomként választható; a küszöb a listaáron mér (ADR-0109 ⑧). A hűség-padló (ADR-0094) a küszöb; 0 küszöbnél nincs padló.

**⑤ Kötelező platform-cím.** Minden előfizetőnek van egy általa választott vagy jóváhagyott `<név>.citoviso.com` címe, saját domain mellett is; ez nem kapcsolható ki, és az ÁSZF kimondja. (A gyakorlatban eddig is így volt — a slug minden tenantnál él —, most szerződéses ígéret.)

**⑥ A próba csomagja paraméter.** A próba-beállítás új mezője: melyik csomag tartalmát kapja a próbázó (alap: Teljes = a mai „minden modul”). A próba tovább is csak a platform-címen fut (ADR-0342).

**⑦ Az Árazás lap új felülete** a jóváhagyott terv szerint (konzol-keret, összesítő kártyák, „Figyelmet kér”, szakasz-ugrók, panelek, húzásos csomagok, modul-tábla, végződés-tábla, ragadós mentés). A meglévő szakaszok (lead-ajánlatok, próba, kupon) mezői, validációja és POST-mezőnevei változatlanok.

### Megvalósítás (2026-10-11)
- Adat: `migrations/0105_package_module_domain_tld.sql` (`package_module`, `domain_tld`, `pricing_config.domain_free_in_package`; seed: `.hu` mindkét piacon, mért 1 990 Ft, a mostani havidíjjal, „csomagban ingyen” KI).
- Logika: `src/packages.ts` (összetétel, validáció, csomag-tartalom), `src/pricing.ts` (`currentPresets`, `domainMonthlyFee`, `domainFeeForCycle(…, ctx)`, `isDomainEligible(…, pkg)`, `offeredTldOf`, végződés-mentés), `src/domains/costCap.ts` (végződésenkénti plafon; `RegistrarAdapter.getYearlyNetPrice`).
- Pénzút: rendelés-rögzítés, megújulás (`domainFeeForRenewal` → a tenant aktuális moduljaiból), utólagos domain-vétel, konfigurátor (végződésenkénti díj, 0 Ft csomag-tartalomra, javaslatok csak kínált végződéssel).
- Felület: `src/console/pricingPage.ts` + `assets/runtime/cit-pricing-admin.js`; kemény függőség húzáskor vele megy / kivételkor a rá épülő is kikerül; a „nem eladó” jelölés és az ár egy zárványból (ADR-0192 ②).
- ÁSZF 1.5 (§9): végződésenkénti díj, csomag-tartalom, platform-cím. **A szöveg a tulaj jóváhagyására vár.**
- Őr: `scripts/pricing-packages-check.mts` (bekötve). A `module-sales-check` szelektorai az új jelöléshez igazítva (az állítás nem gyengült: `is-stop` + „nem eladó”, a zárványból).

### Nyitva / következő
- **Utólagos, díj nélküli domain-igénylés** egy már élő tenantnak, akinek a csomagja a domaint tartalmazza: a vétel a FIZETETT webhookból indul, így a 0 Ft-os rendelésnek nincs útja a regisztrátorig. Most hangosan elutasítva (`createDomainUpgradeOrder`), kézi intézés. Amíg a kapcsoló KI, ilyen tenant nincs.
- **A próba csomagja:** a mező első mentésétől a próba a csomag tartalmát kapja; addig a régi „minden nem kivezetett modul” szabály él (benne az egyszeri Többnyelvű is — a csomagokba az nem tehető).
- **A vevő oldala** (mock és konfigurátor: „saját .hu címmel”, a domain-sor csomag-tartalomként) külön terv-kör (§2b). Ebben a körben a konfigurátor csak a szabályt követi (0 Ft a csomag-tartalomra, végződés-választó a kínált végződésekből), új felirat nélkül.
- A megújítási ár mérése (a regisztrátor első megújítási számlájából).
- Ország-réteg (a piac-fülek mellé).

### Visszafordíthatóság
🔄 — minden paraméter a konzolon állítható; a kapcsoló KI állása a mai (ADR-0109) viselkedés. A már rögzített rendelések a saját `domain_fee`-jükkel futnak ki.
