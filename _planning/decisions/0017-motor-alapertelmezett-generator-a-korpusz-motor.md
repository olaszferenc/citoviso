## ADR-0017 — Motor = alapértelmezett generátor + a korpusz→motor DESZTILLÁCIÓ metodikája (tengely-passzok)

- **Kiváltó:** az ADR-0016 motor-szeletek készen állnak (archetípus-réteg + lead→SiteData mapping + generálás
  motorra kötve + `convertLead` motorra kötve, mind éles-validált, `mock=live` bizonyítva). Nyitott kérdés: a
  konzol/CLI operátor-folyamat MELYIK utat használja, és HOGYAN bővítjük a motor (ma vékony) dizájn-készletét.
- **Döntés A — a MOTOR az alapértelmezett generátor** (konzol + CLI). Indok: a régi AI-HTML úton készült mock
  **konverzióra másodrendű** (nem `mock=live`, nem szerkeszthető); minden új mock legyen elsőrendű. A régi
  `generateMock` a kódban MARAD (fallback + a meglévő artifactek), de nem az operátori alap. A vékony-kit az
  EGYETLEN hátrány, és záródó rés (lásd metodika). Éles infra nincs → van idő a készletet felhúzni.
  Elvetve: „régi az alap, motor opt-in" (a hedge) — másodrendű mockokat termelne tovább, nincs rá ok.
- **Döntés B — a korpusz→motor desztilláció metodikája: DEKOMPONÁLÁS, nem portolás.** A csapda „1 korpusz-dizájn
  → 1 archetípus" = újra 100×N robbanás + elveszett kombinatorika. Helyette minden korpusz-dizájnt HÁROM
  szétválasztható rétegre bontunk:
  - paletta/tipó/árnyék/radius → **SKIN** (11 `--cit-*` token, tiszta adat, ~0 kockázat);
  - szekció-render (kártya/táblázat/idővonal/tab) → **PRIMITÍV-VARIÁNS** (recept-bővítés: `RecipeSection={kind,variant?}`);
  - oldal-elrendezés (stacked/split/sidebar/scroll/bento) → **ARCHETÍPUS** (`arrange()`).
  Sokféleség = skin × archetípus × primitív-variáns × modul (SZORZÁS, nem darabszám).
- **⚠️ Grounding-korrekció:** a 24 élő korpusz-dizájn 18 „archetípus"-nevének nagy része **NEM oldal-elrendezés,
  hanem szekció-render** (`tabular-ledger`, `story-scroll`, `tabbed-*`) → a gazdagság JAVA a **primitív-variáns +
  skin** tengelyen van, nem az archetípuson. A beruházás mindhárom tengelyre oszlik; a recept `variant`-mezője kell.
- **Eljárás — vízszintes PASSZOK (egy tengely egyszerre), nem dizájnonként** (a passz dedup-ol, nem csatol újra):
  1. SKIN-passz (24 paletta → ~6–10 skin) — legolcsóbb, legnagyobb vizuális nyereség, ELSŐ;
  2. PRIMITÍV-variáns passz (recept `variant` + gyakori szekció-renderek) — itt a valódi gazdagság;
  3. ARCHETÍPUS-passz (18 elrendezés → ~5–7 család: stacked/split/sidebar/scroll/bento).
- **A kapu = a meglévő őr, gépiesen:** minden kinyert darab KÖTELEZŐEN token-only + scoped (`.cit-arch-<id>`) +
  `data-cit-module` horgok + nincs emoji + átmegy a `designCheck`-en. Ami nem tudja betartani → refaktor/elvetés.
  Ez tartja O(tengely)-en a költséget (nem O(N)) és garantálja a `mock=live`-ot. A korpusz-QA szűrő öröklődik
  (retired/gyenge kihagyva — „vertical-ribbon-nav fos" lecke).
- **Ember/AI a hurokban:** kinyerő-agent JAVASOL {skin/archetípus/variáns}; minden javaslat **fordul + átmegy az
  őrökön + vizuális triage** (`corpus-contact-sheet.ts`) MIELŐTT registrybe kerül. Nincs vak tömeg-import.
- **Éles-készenléti léc:** a motor-alap NEM jelenthet vékony-kit kockázatot élesben → explicit küszöb, ami alatt
  nem megyünk élesbe: pl. **≥8 skin × ≥5 archetípus + `designCheck` zöld + contact-sheet vizuális átmegy**.
- **Visszafordíthatóság:** 🔄 — a bekötés (melyik függvényt hívja a konzol) és a kit-bővítés (registry-bejegyzések)
  egyaránt additív és triviálisan visszavonható; az ADR-0016 mag `🚪`-döntése már megvan, ezen belül alacsony kockázat.
- **Státusz:** ELFOGADVA (a tulajjal közösen). Első szeletek: ① motor-bekötés alapként (konzol/CLI) · ② SKIN-passz.
