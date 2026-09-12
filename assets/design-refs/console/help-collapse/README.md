# Súgó — összecsukható csoportok (JÓVÁHAGYOTT terv, 2026-09-12)

**Hatókör:** `src/console/views.ts` · `src/server/adminViews.ts` · `public/assets/ui/citui-console.css` · `public/assets/ui/citui-admin.css`

Változat: **A — Harmonika, több csoport nyitható**. A tulaj három működő vázlatból választott
(A / B / C, mobil + asztali képpel); a viselkedésekből a **„Mindet kinyitom / becsukom" gombpárt**
kérte. Kontraktus-fájl: `approved-A.html` (kattintható, valós adattal).

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **ALAPÁLLAPOT: minden csoport CSUKVA.** A 9 csoportcím így egy telefon-képernyőre fér — ez az
   egész változtatás oka (a 35 cikkes fal miatt egy IT-kezdő nem tudott tájékozódni).
2. **TÖBB csoport lehet nyitva egyszerre.** Nem exkluzív harmonika (az a B változat volt): két
   témát össze lehet vetni.
3. **A csoport-fejléc mutatja a DARABSZÁMOT**, és a tenant-csoportokon ott marad az „ügyfél is
   látja" jelölés.
4. **„Mindet kinyitom”** és **„Mindet becsukom”** gombpár a lista fölött — aki át akarja futni
   az egészet, ne koppintson kilencszer.
5. **A KERESÉS EREDMÉNYE LÁTSZIK.** Aktív keresésnél a találatot tartalmazó csoportok NYITVA
   renderelődnek, a találat nélküliek eltűnnek. ⛔ Enélkül a lap „N találat"-ot írna, és közben
   csukott fejléceket mutatna — a felület a saját állításának mondana ellent.
   ⚠️ Ez SZERVER-oldalon dől el (a `?q=` a konzolon és a tenant-adminon is GET-keresés), nem
   kliens-oldali kinyitogatással: így JS nélkül is igaz marad.
6. **JS NÉLKÜL IS HASZNÁLHATÓ.** A csoport `<details>/<summary>`, tehát a nyitás/csukás natív —
   a súgó a no-JS keresésével együtt működik. A „Mindet kinyitom/becsukom" a JS-es ráadás; ha
   nincs JS, a gombpár nem jelenik meg (nem halott gombként marad ott).
7. **UGYANEZ A TENANT-ADMIN Súgó fülén** (`?tab=sugo`) — ott 19 cikk állt ugyanabban a falban.

## Amit a terv NEM köt

- A nyitott cikk csoportjának nyitva tartása: a tulaj ezt NEM kérte (felajánlva, nem választva).
- Állapot megjegyzése lapváltás után (nincs sütizés/localStorage).

## Őr

`scripts/help-collapse-check.mts` — a RENDERELT `/help` és `/admin?tab=sugo` lapot kattintja
végig (alapállapot, nyitás, több nyitva, keresés-láthatóság, no-JS ág), negatív önteszttel.
