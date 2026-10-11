# 2026-10-11 — Árazás redesign: csomag × modul húzással, saját domain csomag-tartalomként, végződés-tábla

**Szál:** domain-ár kérdés (brief: `~/rc-briefs/domain-20261011-091552.md`) → pilot-kilépések → árazási folyamat → terv-kör → megvalósítás. Döntés: ADR-0360 (a land osztja ki).

## Mérések
- **Websupport `.hu` ár (élő validate, 10-11):** egységesen 1 990 Ft nettó / 2 527 Ft bruttó / év, hossztól és szótári „értéktől” független (q8/szallas/panzio/vendeghaz.hu foglalt). `.eu` 2 499, `.com` 4 899 nettó. A végpont az első éves árat adja, megújítást nem; a `period` paramétert figyelmen kívül hagyja. Az ADR-0103 „2 599 Ft/év” elavult.
- **Pilot-tölcsér (éles, 10-06…10-10):** 62 megnyitó / 111 megnyitás (81 mobil), medián 45 mp, ~37 a lap aljáig, **5 nyitotta meg a rendelés-panelt, 1 pénztár-lépés, 0 webcím-kapu, 0 kimondott ok.** A „az aldomain riaszt el” feltevés nem igazolható/cáfolható: a kilépés a panel ELŐTT történik; az aldomaint a link (ADR-0330) mutatja.

## Tulaj-döntések (10-11)
- Csomag × modul: aktív modulok pirulái húzással a 3 csomagba, a domain is pirula, részletei külön paraméter.
- Ha a domain egy csomagban van → nincs havidíja; ha egyikben sincs → felár. Az ingyen domain beállítható.
- A vevő maga választ nevet és végződést.
- Kötelező citoviso-aldomain mindenkinek, ÁSZF-ben (SEO).
- Terv: A (oszlopok) → teljes redesign a nyitóoldal + riport nyelvén → **A — egy oldal** (B fülek elvetve).

## Elkészült
- Terv befagyasztva: `assets/design-refs/console/pricing-redesign/` (README köt).
- Adat: `migrations/0105_package_module_domain_tld.sql`; logika: `src/packages.ts`, `src/pricing.ts`, `src/domains/costCap.ts`; pénzút: rendelés, megújulás, utólagos domain-vétel, konfigurátor; próba-csomag (`src/trial/config.ts`, `start.ts`); ÁSZF 1.5 §9 (`src/legal.ts`).
- Felület: `src/console/pricingPage.ts`, `src/console/views.ts`, `assets/runtime/cit-pricing-admin.js`, `public/assets/ui/citui-console.css`.
- Őr: `scripts/pricing-packages-check.mts` (bekötve a `hooks/pre-commit`-be); `module-sales-check` szelektor-igazítás; `kb-check` korpusz + `kb-shot` fixture/célok; súgó `kb/entries/console-pricing/`.
- Ellenőrzés: Playwright 60/60 (asztali+mobil), érintéses húzás automatikus görgetéssel, sötét mód; a felsorolt őrök zöldek; `free-trial-e2e` PASS.

## Nyitott kérdések
- ✅ **ÁSZF 1.5 szövege** — a tulaj 2026-10-11-én jóváhagyta. Élesítéskor: verzióugrás → meglévő ügyfeleknek 15 napos előzetes értesítés.
- Utólagos, díj nélküli domain-igénylés élő tenantnak (fizetés nélküli vétel-út) — következő kör.
- A vevő oldala (mock/konfigurátor „saját .hu címmel” üzenet) — külön §2b terv-kör.
- A Websupport megújítási ára (az első megújítási számlából).
- Semmi nem ment élesre (a nagy deployjal együtt megy).
