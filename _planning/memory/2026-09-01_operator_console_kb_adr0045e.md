# 2026-09-01 — ADR-0045/e: az operátor-konzol súgó-rétege (⑤ szelet)

## Mi készült

A §J tudásbázis-doktrína kiterjesztése a belső konzolra — a pilotban a tulaj MAGA az operátor,
és a lead→mock→kuráció→megkeresés→konverzió lánc a rendszer legösszetettebb folyamata.

- **9 `audience: operator` entry** (`kb/entries/console-*`): irányítópult, lead-lista, lead-lap,
  scrape (3 fül egy entry), duplikátumok, riport, árazás, beállítások, outreach-piszkozat
  (+Tevékenység). Mind valós feliratokból, script-generált 390px screenshottal.
- **Audience-bontott őr** (`kb-check.mts`): a label-drift és a coverage a SAJÁT felület
  view-csoportja ellen fut (tenant: adminViews+moduleConfigViews+modulePreview; operator:
  console/views+partnerViews+partnerData) — egy közös korpusz hamis zöldet adna. +9 kötelező
  `console.*` anchor. A kb-scan hook scope-ja követi.
- **Kereshető `/help`** a konzolban (operátor-login mögött, `?topic=` anchort VAGY entry-id-t
  old fel; kép-út `/help/<id>/assets/…` path-fence-szel) + `helpLink()` mind a 13 képernyő-fejlécen.
  A felső modul-sávhoz NEM nyúltam (tulaj-tervezte hub, 2026-08-23) — nyitott kérdés lent.
- **Fordítás-scope:** operator-entry NEM fordul (`ensureKbTranslations` tenant-ra szűr) — a
  konzol ma magyar; a lengyel készlet változatlanul a tenant-entryket méri.
- **kb-shot** konzol-fixture-ökkel bővítve (a view-k tiszta függvények — se szerver, se login).

## A két őr-kör tanulsága (a doktrína élesben vizsgázott)

A `tudasbazis-or` KÉTSZER FLAG-elt, mindkétszer jogosan, és mindkétszer olyat fogott, amit a
gépi kapu elvi okból nem tud:

1. **Hamis viselkedés-állítás:** „a gomb a kész szöveggel nyitja a levelezőt" — valójában az
   Outreach-piszkozat képernyőre visz, ahol a §C-kapu és a rendszer-küldés él. + „összevonásnál
   a fotó nem vész el" — a portál-fotó NEM olvad be (duplicates merge). A label-kapu zöld volt,
   mert a feliratok léteztek — az ÁLLÍTÁS volt hamis.
2. **Kitalált felirat félkövér-de-NEM-idézett formában** („Mobil (SMS/MMS)" ↔ valódi:
   „Mobil-megkeresés"; „Beállítások" kártya ↔ „Rendszer") — a **„…”** jelölés nélküli bold
   kicsúszik a gépi drift-kapu alól. A minta ismert maradjon: gombfelirat CSAK idézett-félkövérrel.

## Rebase 205 commitra — a drift-kapu regressziós tesztként

A szelet 10 napot állt commitolatlanul; közben a konzol hub-redesignt (2026-08-23), teljes T()
i18n-t (ADR-0067) és MMS/SMS párost (ADR-0082/0083) kapott, és egy párhuzamos szál (ADR-0089)
partner/bizonylat KB-entryket tett a fára. A stash-pop 3 fájlban 14 konfliktus; feloldás után a
kb-check PONTOSAN a valódi driftet listázta (a régi dashboard-entry 3 halott felirata + a
hiányzó draft-entry) — a többi 7 entry vizsgázott az új felület alatt. A kapu tehát rebase-kor
regressziós tesztként működik.

⚠️ **Önhiba, tanulságnak:** piros-teszt visszavonásához `git checkout <fájl>`-t futtattam
commitolatlan munkán — az EGÉSZ fájl elveszett (kontextusból újraépítve). Piros-tesztet inverz
seddel vonj vissza, vagy előbb commitolj.

## Módosított / új fájlok

- `_planning/DECISIONS.md` — ADR-0045/e (+ rebase-jegyzet)
- `scripts/kb-check.mts` · `scripts/kb-scan.mjs` · `scripts/kb-shot.mts`
- `src/console/views.ts` (helpLink + 13 horgony + helpPage) · `src/console/server.ts` (/help route)
- `src/i18n/kbPacks.ts` (translatableKbEntries) · `public/assets/ui/citui-console.css` (.con-help/.con-kb-*)
- `kb/entries/console-{dashboard,leads,lead,scrape,duplicates,report,pricing,settings,outreach-draft}/`

## Kétszintű modell + B-terv (2026-09-02)

A tulaj rendelete: TÖBBFAJTA tudásbázis — belső felhasználónak TELJES hozzáférés minden
információhoz; a tenantnak SZŰRT készlet a saját adminján (a belső anyagok — lead-lista,
lead-lap, scrape — tilosak neki). Az audience-mező ezt eleve kódolta; két rés került elő és
zárult be: ① a tenant-oldali kép-út nem nézte az audience-t (URL-találgatással belső screenshot
jött volna) → kerítés; ② a konzol csak operátor-entryket mutatott → mindkét csoport, jelölve.
A §2b TELJES terv-kör lefutott (3 kattintható változat, mobil+desktop, viselkedés-teszt 13/13);
a tulaj a B) Súgóközpontot választotta → kontraktus: `design-refs/console/help-center/`.
Út közben a §2b-kapu kétszer fogott jogosan (felület commitban terv nélkül; friss shot nélküli
approve), és a CSS-konfliktusfeloldásom elveszett `}`-át a desktop-shot mutatta meg.

## Nyitott

- **Súgó-belépő a felső sávban / hub-kártyán:** a modul-sáv tulaj-tervezte — oda menüpontot
  csak tulaj-döntéssel teszünk. Ma az elérés: képernyő-ikonok + /help közvetlen. Javaslat:
  egy „Súgó" sor a „Rendszer" kártya alá.
- **Periodikus KB-frissesség-hurok (tulaj-felvetés, ADR-jelölt):** időzített futás, ami az
  ítélet-szintű driftet (tudasbazis-or), a screenshot-frissességet (kb-shot) és a prod↔repo
  driftet méri és FLAG-el; tartalmat felügyelet nélkül NEM ír (§J.24: a hamis súgó rosszabb a
  hiányzónál). Következő session: ADR + cron.
- A Tevékenység-képernyő a draft-entry horgonyát viseli (egy útmutató fedi a megkeresés-mérés
  párost) — ha a képernyő nő, külön entryt érdemel.
