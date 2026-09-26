## ADR-0236 — A logó mindenhol: a jel maga a C („B” elrendezés), egy forrásból

**Dátum:** 2026-09-26 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy) · **Szál:** „Logó: a jel maga a C”

### Kontextus

A jóváhagyott E4 márkajel (2026-09-21, `assets/design-refs/console/brand-mark/README.md`) csak fájlként létezett:
a felületeken NÉGY különböző logó élt egymás mellett — a konzol és a tulaj-admin kézzel rajzolt inline jele
(navy pupilla, amit a tulaj sötéten kifogásolt), a citoviso.com fejlécének gradiens-rajza, és a favikon
2026-07-07-es `mark-gradient.svg`-je (navy ív, beljebb álló play). A tulaj szava: *„végig kell nézni hol van
logo használva és lecserélni mindenhol olyan logóra ahol a C betű a névben maga a logó”*; az elrendezések közül a
**B**-t választotta (2026-09-23): a jel MAGA a C, utána „itoviso”. A levelek (ADR-0225) és a `/pay/*` fejléc
(2026-09-26) már így ment; a C méretét (A: betűméretű · B: ikonméretű) a §2b kör döntötte el.

### Döntés

1. **Elrendezés: „B”, ikonméretű C** (tulaj, 2026-09-26: *„B, admin ikon marad, szállás-honlapoknál maradjon így”*).
   A jel 1,6× a betűméret, a szó függőlegesen középre áll mellette — a `/pay/*` már jóváhagyott aránya
   (34 px jel / 21 px szó). Befagyott terv: `assets/design-refs/console/brand-mark/lockup-b-*.{html,png}`.
2. **Háttér szerint a változat:** sötét felület → `mark-e4-dark` + fehér szó; világos → `mark-e4-light` + navy szó;
   a témás keret (konzol, tulaj-admin) a `data-citui-theme` szerint vált. **A favikon a VILÁGOS változat** (a fül világos).
3. **Tulaj-admin: a jel IKON marad** — mellette a szállás neve áll, nem a „Citoviso” szó, így ott nem lehet C betű.
4. **Szállás-honlapok:** a `<slug>.citoviso.com` fülén saját ikon hiányában a Citoviso-jel marad (most már az E4).
5. **EGY forrás:** `src/ui/brand.ts` — a geometriát NEM rajzolja újra, a két jóváhagyott asset-fájlt olvassa
   (`lockup()`, `markThemed()`, `markSvg()`, `faviconSvg()`, `markDataUri()`); a stílus a dizájn-magban
   (`citui.css` `.citui-lockup`). A citoviso.com statikus `index.html`-jébe a szerver tölti be (`<!--CIT_BRAND-->`
   jelölő, mint az ár). A kivezetett `public/assets/ui/{mark,lockup}-{gradient,mono}.svg` törölve; minden
   `<link rel="icon">` a `/favicon.ico`-ra mutat, ami a `faviconSvg()`-t adja. A statikus stílus-útmutató nem rajzol jelet.
6. **Számla:** `assets/brand/citoviso-logo-szamla.png` újragenerálva „B”-ben (1806×560, fehér). A Számlázz.hu-ba a
   **tulaj tölti fel** kézzel (külső, élesi művelet).
7. **Őr:** `scripts/brand-mark-check.mts` (pre-commit, bármely `src/`/`public/` változásra): ① nincs saját C-ív rajz és
   kivezetett jel-hivatkozás; ② az asset-fájlok a README geometriáját hordozzák, ②b az inline kivágás a teljes rajzot
   tartalmazza; ③ favikon = világos fájl, minden kezelő és link rá mutat; ④ a felületek a közös forrást használják;
   ⑤ böngészőben mérve témánként EGY, a témához illő jel látszik, a szem festett, a szó színe helyes a `.con a`
   link-szabály alatt is. Négy negatív kontroll (mindkét jel látszik · sötétben a világos · festetlen szem · átfestett szó).

### Mért csapdák (a megvalósítás közben)

- A méretező `.citui-mark-themed svg{display:block}` (0,1,1) legyőzte a rejtő `.citui-mark--dark{display:none}`-t:
  a világos adminban MINDKÉT jel látszott („CC”) → elem-minősített szabályok + ⑤ kontroll.
- A konzol `.con a` (0,1,1) / `.con a:hover` (0,2,1) link-szabálya cián-ra festette a szót → dupla osztály + `:hover`.
- A C-ív középpontja NEM a doboz közepe (x≈55,94): a 12..106 kivágás a C bal szélét laposra vágta (az 1806 px-es
  számla-renderen látszott, a kis méretű mockon nem) → `MARK_VIEWBOX = "7.5 12 95 96"` + ②b analitikus próba.

### Nyitva

- A citoviso.com hero-illusztrációja (`.visual-core`, nagy fehér C a cián gömbön, beljebb álló play) nem fejléc-logó,
  a tervkörben nem szerepelt — az őr névvel engedi (`ARC_ALLOW`); E4-re igazítása tulajdonosi kérdés.
