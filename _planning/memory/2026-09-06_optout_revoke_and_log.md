# 2026-09-06 — Leiratkozás-visszavonás operátori gombbal + audit-napló (0053)

**Commit:** `02114f8` (origin/main, igazoltan fent)
**Kontraktus:** `assets/design-refs/console/optout-revoke/` (plan.html + README.md + 2 kép)

## A kiváltó tünet

A tulaj a piszkozat-oldalon piros sávot kapott — *„a címzett korábban leiratkozott
(cím-szintű suppression) — küldés tilos · erre a telefonszámra korábban leiratkoztak
(szám-szintű suppression) — küldés tilos"* — és **egyetlen leadre sem tudott küldeni**.
Szava: „mindenkinél leiratkozott van valamiért".

## A diagnózis — nem hiba volt, hanem a szabály hatóköre

A dev DB-ben **8 prospectből PONTOSAN 1** volt leiratkozva (Pitypang Vendégház, aznap
10:30). Ez az egy sor viszont **mind a hetet** blokkolta, mert a suppression szándékosan
nem a sorra, hanem a **SZEMÉLYRE** szól:

- `isEmailSuppressed()` (`src/outreach/sendBatch.ts`) — *bármely* prospect sor ugyanazzal
  a **címmel** + opt-out → tilt.
- `isPhoneSuppressed()` (`src/outreach/sendOutreachSms.ts`) — végigmegy az összes
  leiratkozott soron, és a `lead.raw.phone`-t **normalizálva** hasonlítja.

A teszt-leadek MIND a tulaj saját `olaszferenc@gmail.com` / `06305161631` adatait
hordozzák → **egy kattintás lezárta az egész teszt-parkot**.

⭐ **A tanulság nem az, hogy a szabály rossz.** Élesben pontosan ez a helyes viselkedés
(az opt-out a személyé, nem a tokené — ezért van így megírva). A hiány a **visszaút**
volt: feloldani csak `psql`-ből lehetett, és a „miért van leiratkozva?" kérdésre a
rendszernek nem volt válasza — a `unsubscribed_at` egy dátum, nem mond nevet és okot.

## Amit építettünk (jóváhagyott B változat)

`migrations/0053_prospect_optout_log.sql` — `prospect_optout_log` (mindkét irány:
önkiszolgáló `unsubscribe` + operátori `resubscribe`).

- **A visszavonás LECSUKVA indul** (`<details>` a lead-lap Megkeresés-panelén). Ez a B
  lényege és az egyetlen dolog, amiben eltér az A-tól (mindig nyitott űrlap): a művelet
  jogilag az érintett kérésén áll, tehát nem sülhet el félrekattintásból.
- **Az indoklás kötelező** — trimmelve <3 karakter elutasítva, **szerver-oldalon is**, nem
  csak a böngésző `required`-jével. Elutasításkor az állapot NEM változik és naplósor SEM
  keletkezik (egy audit-sor egy meg nem történt eseményről később valódi visszavonásnak
  olvasódna).
- **Az actor a bejelentkezett operátor** (`currentOperator`), soha nem űrlapmező — különben
  az audit-nyom önbevallás lenne.
- **A napló mindig látszik a soron** → a mai kérdés a lapról megválaszolható, DB nélkül.
- **Őszinte üres állapot:** a napló a 0053 napjától él; korábbi leiratkozáshoz NEM gyártunk
  visszamenőleges sort, a doboz ezt kimondja (§B.17 — kitalált actor egy audit-naplóban
  rosszabb, mint az üres állapot).
- **A suppression maga ÉRINTETLEN.** A gomb az EGY sort mozgatja, ami az opt-outot hordozza.

Súgó: `kb/entries/console-lead/entry.hu.md` → „Ha a soron »leiratkozott« áll" —
kimondja, hogy egy leiratkozás több sort is némává tehet, és hogy visszavonni CSAK a
címzett saját kérésére szabad.

## Leletek

⛔ **A KÉP NEM MUTATJA MEG A VISELKEDÉST.** A mock 4 ellenőrzése bukott a
végigkattintáskor, miközben a screenshot rendben volt: a `[hidden]` attribútum UA-szabálya
**nulla specificitású**, tehát minden `display:flex/inline-flex` felülírja — a „rejtett"
küldés-gomb és a lezárt űrlap **látszott**. A §2b 2. pontja („a MŰKÖDÉST is ellenőrzöd")
itt fogott valódi hibát, nem formalitásból. (Az éles kód szerver-oldalon fel sem rendereli,
amit nem szabad látni.)

⚠️ **A ui-shot desktop-képe mobil elrendezést mutatott,** mert a méret-váltó alapból
mobilon állt (doktrína: „telefonon induljon mobil módban"). Így a tulaj a döntés felét nem
látta volna. Fix a mockban: a kezdőállapot a **viewportból** jön (`innerWidth >= 900 →
desktop`), a váltó továbbra is felülírja. **Ezt minden jövőbeli mockba be kell tenni.**

⚠️ **Az append-only napló mellé DELTA-alapú teszt kell.** Az e2e először abszolút
sorszámokat várt (`length === 1`) → a második futáson pirosat adott olyanra, ami nem
regresszió. Baseline + delta a helyes forma.

⚠️ **Rossz szonda = hamis piros.** Az első e2e a `sendOutreachMail()`-en át mérte a
cím-szintű suppressiont — de a csatorna-egyszeri őr (`email_sent_at`) ELŐBB fut, és a tulaj
közben ténylegesen kiküldte a próba-prospectet, így „suppression-hiba"-ként jelent meg egy
teljesen helyes állapot. A predikátumot (`isEmailSuppressed`/`isPhoneSuppressed`) KÖZVETLENÜL
kell mérni.

⚠️ **Fabrikált audit-adat takarítása.** A tesztek valódi prospectre írtak kitalált
indoklást („telefonon visszakérte a megkeresést") — zárás előtt törölve. Egy audit-napló
kitalált sorral rosszabb, mint az üres.

⚠️ **HARMADIK migráció-sorszám ütközés:** párhuzamos szálon `0053_domain_fee_on_order.sql`
is született (korábban 2× 0051, 2× 0052). Most nem tört el semmi (a `schema_migrations` a
FÁJLNEVET jegyzi, mindkettő lefutott), de a minta ismétlődik. **Nyitott: sorszám-ütközés-őr
a pre-commitba.**

## Mérés (proof-of-work)

- e2e (`unsubscribe → suppression fog → elutasítás → visszavonás → suppression enged`):
  **20/20 zöld**
- a **szállított** űrlap a **szállított** route-on (efemer konzol + mintelt operátor-session,
  Playwright): **16/16 zöld, 0 JS-hiba** — DB-szinten is ellenőrizve (+1 naplósor,
  `action=resubscribe`, actor = bejelentkezett operátor, `unsubscribed_at` törölve)
- `kb-check --coverage` 🟢 · `i18n-lint` 🟢 · `design-token-lint` 🟢 · `tsc` 🟢 ·
  minden pre-commit kapu 🟢
- ui-shot 390px + desktop mindkét állapotról (leiratkozott / visszavonás után), a tulajnak
  elküldve

## Nyitott

- Migráció-sorszám-ütközés őr (pre-commit) — a minta harmadszor ismétlődött.
- A fő fában commitolatlan változás van, ezért a `:4600` tesztfelület nem frissült
  (a `land.sh` jelezte) — rendezni kell, ha ott akarjuk kipróbálni a gombot.
