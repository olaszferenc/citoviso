# 2026-09-28 — Modulok fül: kosár a 407 px-es összegző sáv helyett (ADR-XXXX)

Brief: `~/rc-briefs/modul-kirakat-osszegzo-sav.md` (a koordinátor-session írta, az éjszakai kör lelete).
A tulaj döntése a koordinátoron át jött: 1. kör → „B, de a kosár csak akkor jelenjen meg, ha valami belekerül;
és a Hozzáadom nem a legegyértelműbb — Kosárba rakom?”; 2. kör → „ez így ok.”

## Mérés (újra, a saját fában — egyezett a brief számaival)
- 390×844 mobil+touch, Éden üdülőház (5 kirakat-modul, −25% kupon, Visa ····5559), 1 modul a kosárban:
  sáv 367–774 = **407 px (48%)**; fejléc 49 px (a brief ~56-ot írt). Belül: kártyaválasztó 184 px, számok 64,
  gombok 72 (egymás alá törve), tételsor 39, keret/térköz 46.
- **Önálló lelet:** fekvőben (844×390) a sáv 36–320 → a tartalomnak NEGATÍV ablak, 0 elérhető gomb; asztalon 267 px (33%).
- **Önálló lelet:** a „−25%” kupon-címke (`z-index:2`) a sáv FÖLÉ rajzolódott.
- ⚠️ Az Elek-park (`harom-huszar-apartments`) már majdnem mindent megvett (1 kirakat-gomb) → a mérés az Éden
  dev-bérlőn ment. ⚠️ `issueTenantLogin` a `contact_email`-t is átírja — a mérő a meglévő címet adta vissza neki.

## Terv-kör (§2b)
- 1. kör: A csukott sáv (10%) · B kosár-gomb (9%, csak jobbra; gombok 100%) · C tömör sáv (26%, fekvőben 47%);
  mock élő lábnyom-kiírással, 3 méret (Mobil/Fekvő/Asztali, `@container`), valódi kupon-szabály inline-olva.
- 2. kör (B2): üres kosárnak nincs lábnyoma; „Kosárba teszem / Kiveszem a kosárból / Kiürítem a kosarat”;
  a „Következő számla” sor a kosárban ÉS a megerősítőn; kártyaválasztó a megerősítőn → jóváhagyva.
- Befagyasztva: `assets/design-refs/console/modules-cart/` (README köti a feliratokat, `contract-drift-check` zöld).

## Megvalósítás
- `src/server/adminViews.ts`: kosár-szerkezet (`#adm-modlay` + `<aside>` hasáb, `#adm-cartpill`, `#adm-cartveil`),
  JS: `has-cart`, pirula-szöveg, `cartOpen/Close`, a kártyaválasztó + „Következő számla ({date}) így” a
  megerősítőn (`fcPaint` követi a választást). Megtartott ID-k: `#adm-plan-apply`, `#adm-plan-paysum`, `#adm-plan-card`.
- `public/assets/ui/citui-admin.css`: telefon = fix kosár-gomb + felcsúszó kosár; asztal ≥900 = tapadó hasáb
  `top:62px`, a kirakat `auto-fill minmax(250px)`; `.adm-shop__card{isolation:isolate}`.
- Mérve (statikus render a fám kódjából, Éden valós adatai): a kosár-gomb SOHA nem takar kirakat-gombot
  (390 / fekvő 844 / 1280); takarás csak a fix fejléc és alsó menü alatt. JS-hiba 0.

## Saját hibáim, menet közben elkapva
- A megerősítőbe tett „Következő számla” sor `adm-fc__line` osztályt kapott → a `coupon-rounding-check` ④
  tételnek számolta (a sorok összege ≠ végösszeg). Javítás: saját `adm-fc__next` osztály — az őr állítása érintetlen.
- A `frozen-state-check` tiltott szava („Hozzáadom”) a csere után ÜRESEN zöldre ment volna → „Kosárba teszem”,
  az önteszt pirosan látja.
- A kinyitott kosár címe sötét volt a sötéten (az admin `h3` színe) → `color:inherit`; a gombsorrend fordított volt.
- Asztalon a nézetablakhoz kötött 3 oszlop a hasáb mellett 211 px-es kártyákat adott → `auto-fill`.

## A feliratot idéző fogyasztók (egyenként)
KB: admin-modules · admin-modules-pricing · admin-modules-rooms · admin-modules-settings · admin-wallet ·
őrök: frozen-state-check · wallet-check (⑧ új helyén) · wallet-tour · forgatókönyv: FK-012 (mostantól EGY fizetés a
kosárból) · kontraktusok: modules-tab ④ · wallet ⑧ · modules-billing · pricing-rooms-link (utaló sor).
A régi befagyasztott HTML-tervek (`modules-tab.html` stb.) szándékosan érintetlenek — történeti döntések.

## Nyitott
- A kosár-gomb telefonon a „Megnézem az oldalamon” gomb jobb szélét egyes görgetési helyzetekben érintheti
  (a kirakat-gombot nem) — a jóváhagyott terv ugyanígy mutatja; ha zavar, a kártya-lábléc jobb margója megoldja.
- Élesítés: a nagy deployjal (2026-09-25-i tulajdonosi döntés).
