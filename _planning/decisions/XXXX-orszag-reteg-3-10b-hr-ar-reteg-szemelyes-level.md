## ADR-XXXX — Ország-réteg 3/10b: a horvát ár-réteg (a magyar csomagok egyszeri euró-másolata, .com) és a személyes levél minden országba

**Státusz:** ELFOGADVA (tulaj-döntések 2026-11-22 a koordinátoron át, `cit9b4690e3`; a végleges számokat a tulaj
még látja) · **Épít:** ADR-0443 (pénz-út, saját pénznem), ADR-0360 (végződésenkénti domain), ADR-0461 (HR sor),
ADR-0462 (kísérlet-motor, személyes levél), ADR-0464 (3/10).

### Döntés

① **ÁR-RÉGIÓ = ORSZÁG-RÉTEG.** A horvát réteg (`pricing_config hr`, `module_price_region hr`, `domain_tld hr`,
migráció `0149`, additív) a magyar csomagok és feltételek EGYSZERI másolata euróban — az ÉLŐ magyar ársorból
(a dev DB magyar ársora elavult), 1 € = 373,22 Ft (MNB, 2026-11-20). Indexálás nincs: a két réteg ezután független.
Koordinátori döntés: a csomagár a közvetlen átváltás egészre kerekítve (Alap 7 €, Ajánlott 13 €, Teljes 18 €), a
modulok egész euróra, ami 0 lenne, az 1 €. Mivel a csomagár a kódban alapdíj + modulok összege
(`computeMonthly`), a 13 / 18 € úgy jön ki, hogy a szobák és a vélemények 2 € (a többi modul 1 €, a foglalás 2 €).
Alapdíj 5 €; többnyelvű 13 / 16 / 21 €; éves fizetésnél 2 hónap ingyen; a domain csomag-tartalom, küszöb 5 €,
csomagon kívüli havidíj 3 €, kivásárlás 54 €, vállalás 1 hó. **Saját domain: .com** (nem .hr) — beszerzés 4 899 Ft/év
nettó (Websupport-mérés 2026-10-11), a költség a regisztrátor pénznemében (HUF), plafon 6 200 Ft.
A csomag-összetétel globális (`package_module`), régiónként nem tér el.

② **A személyes levél minden országba** (`experimentCopy.ts`): az árszöveg a lead országának pénznemében (az
összeg a saját jelét viszi, „Ft” nélkül) és a régió CSOMAG-domainjével (`packageDomainTld`: csak ha a régió a
domaint csomag-tartalomnak adja és van ilyen végződés — HR: .com); a magyar mondat bájtra a régi. A személyes
változat saját szövegei és az árszöveg a küldéskor bekerülnek a fordítás-mérésbe (`collectFallbacks` →
`untranslated`): hiánynál a §C-kapu elbuktatja a változatot, és a lefordított kontroll-levél megy — magyar szöveg
soha. Hogy nem-magyar lead kap-e személyes levelet, az a kísérleti rend (`assignVariants`) dolga, nem változott.

③ **Elek (horvát lead → vásárló → admin) nyomán:** a konfigurátor domain-lépése a pénznem szerint („0 Ft” helyett
`fmt(0)`), a saját név mezőjének példája a piac végződésével, a domain-ellenőrzés hibái a vevő nyelvén
(`domainReasonText`); a szerződés-kártya (Ugovori) az ütemet szóval, az árat a rendelés pénznemében, a vállalást
hónapban írja (HU is: „975” helyett „975 Ft”).

④ **Teszt:** a HR elfogadás (`country-hr-e2e`) a valódi réteget méri (csomagárak, .com); a regressziós e2e
(`country-hr-fix-e2e`) a személyes levél árszövegét és fordítás-mérését; a teszt-világ (`hr-world.mts`) az éles
csomag-összetételt és modul-tiltást tükrözi (scratch), és rendereli a személyes levelet (nem küldi). A teszt-jelölő
(`country-ready-fixture`) megtartja a `{helyőrzőket}`.

### Következmény
- A HR nyitásához már csak Bábel (az új feliratok + plurál-alakok) és a tulaj piac-jóváhagyása kell.
- Élesen a `0149` a deployjal kerül be; a piac attól még zárva marad.
