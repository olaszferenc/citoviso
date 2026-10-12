## ADR-0369 — A döntés-segítő ajánlat felső sáv (fátyol nélkül, bezáró ×); a saját cím jelvénye a csomag-kártyán, kizárólag a /pricing-ból

**Dátum:** 2026-10-12 · **Kontextus:** §2b terv-kör (két mock, 2+3 változat), tulaj-döntés az Elek-teszt koordinátoron át: eszkaláció = „A — felső sáv”, saját cím = „B — jelvény + a cím elöl”, kifejezetten dinamikusan. **Felülírja:** az `offer-ui/` kontraktus 4. pontjának ELRENDEZÉSÉT (asztalon középre emelt kártya fátyollal, mobilon alsó kártya). **Lezárja:** az ADR-0360 „Nyitva” pontját („a vevő oldala: saját .hu címmel”). **Megtartja:** ADR-0088 / ADR-0285 (az ajánlat logikája, küszöb, %, lejárat), ADR-0112 (leiratkozottnak nincs nyomás), ADR-0360 ② (mi számít csomag-tartalomnak), ADR-0366 ⑤ (a „Mit tartalmaz?” sor).

### Kiváltó
1. **Eszkaláció (Elek 10-11, mérve):** a 3. visszatérésnél megjelenő −50%/72 órás kártya mobilon a képernyő alsó ~34%-át fedte, benne az „Itt rendelheti meg” / „14 nap ingyen” pirulát és a hős-CTA-t. Bezáró gombja nem volt, csak a halvány „Most még gondolkodom” link. A tulaj kérése: legyen kisebb, ne takarja a rendelés-gombokat, és maradjon jól láthatóan bezárható.
2. **Saját cím:** a mock terv-lapján és a konfigurátor csomag-kártyáin a domain nem látszott csomag-tartalomként (csak a lenyitható „Mit tartalmaz?” listában, ADR-0366 ⑤), így a vevő nem tudta, hogy a csomagja saját címet ad.
3. **A tulaj mai /pricing-állapota (2026-10-12):** a „Saját domain” pirula mind a 3 csomagban, de egyetlen végződésen sincs bejelölve a „Csomagban ingyen”. Az admin csomag-kártyája erre zöld „Saját cím benne (nincs ingyenes végződés)” sort írt, és a tulaj nem értette, mit kell tennie.

### Döntés
**① Az eszkalációs ajánlat egy sor a képernyő tetején**, minden méreten, **fátyol nélkül** (befagyott terv: `assets/design-refs/console/escalation-topbar/`). Tartalma: −N% · cím · „az első havi vagy éves díjból · a megújulás listaáron · még ÓÓ:PP:MM” · gomb · ×. Mobilon rövidebb: „az első díjból” · „még …” · „Megrendelem”. A × (rajzolt kör, legalább 40 px) ugyanazt teszi, mint a régi „Most még gondolkodom”: a sáv eltűnik, az ajánlat él, és a panel ár-kártyájában tovább látszik. A megjelenés feltételei, a lejárat és a mérés (`escalation_*`) változatlanok. A vázlat mérése: a régi kártya a mobil-képernyő 32%-át takarta, a sáv 7%-át.

**② A saját cím a vevő oldalán a /pricing-ból születik, és csak akkor látszik, ha valóban ingyen jár** (befagyott terv: `assets/design-refs/console/package-domain-badge/`). Feltétel: a kapcsoló BE, a pirula egy csomagban van (`DOM.pkgModules`), ÉS van „Csomagban ingyen” végződés. Ilyenkor:
- „+ saját {végződés} cím” jelvény kerül a lefedő csomagok kártyájára és az „Itt rendelheti meg” pirulára;
- ha a választott összeállítás hordozza, a cím-lépés a saját címmel kezd: vezető sor, „Saját domainnév — benne a csomagban”, a névjavaslatok, és csak utána „Most csak a citoviso.com-os cím”;
- a lábléc kiírja: „saját {végződés} cím választható — 0 Ft”.

Minden névjavaslat-sor kiírja a díját az aktuális összeállítással („benne a csomagban” / „+1 200 Ft/hó”). Ha a kapcsoló KI, vagy nincs ingyenes végződés: **nincs jelvény, címke, vezető sor és „benne”** — a tulaj mai állapota pontosan ez. Előre semmi nincs kijelölve: a saját cím 0 Ft-nál is 12 hónap hűségidővel jár.

**③ Az admin csomag-kártyája nem állít olyat, ami a vevőnek nem jár.** A zöld „Saját cím benne (.hu)” csak ingyenes végződés mellett jelenik meg. A pirula ingyenes végződés nélkül figyelmeztető (sárga) sort ad, ami megmondja, hol kell javítani: „…jelöld lent, a Saját domain résznél, a „Csomagban ingyen” oszlopban”. Ugyanezt mondja a „Figyelmet kér” sora. Az összesítő kártya („· saját cím benne”) és az „Így fut:” mondat ugyanígy csak ingyenes végződésnél mondja, hogy benne van.

### Megvalósítás
`assets/runtime/cit-configurator.{js,css}` (`mountEscalationCard`; `freePkgTlds`, `presetCarriesDomain`, `syncDomainLead`), `assets/runtime/cit-pricing-admin.js` (`domInFree`), `src/console/pricingPage.ts`, `public/assets/ui/citui-console.css`, KB: `console-pricing`. A sáv a régi osztályneveket (`.cit-cfg-esccard/-escgo/-esclater`) viszi tovább, így a meglévő őrök tovább fognak.

### Őrök
- `scripts/package-domain-badge-check.mts` (új, bekötve): három piac-állapot (ingyenes / pirula mind a 3-ban ingyenes végződés nélkül / kapcsoló KI) × 390 px és asztali, valódi konfigurátoron, plusz a valódi /pricing lap. 51 állítás. Önteszt: egy jelvény, amely figyelmen kívül hagyja az ingyenes végződést, PIROS (pont a tulaj állapotán).
- `scripts/optout-offer-price-check.mts`: a régi elrendezés állításai (mobilon alul, asztalon fátyol) helyett az új kontraktus: felső sáv, a képernyő legfeljebb 15%-a, nincs fátyol, nem takarja a rendelés-pirulát, a × legalább 40 px.

### Visszafordíthatóság
🔄 könnyű — csak kliens- és felirat-szintű; adat, séma és pénzút nem változott. Élesre a nagy deployjal megy.
