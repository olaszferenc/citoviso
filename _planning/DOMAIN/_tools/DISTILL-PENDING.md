# Desztilláló — EMBER-DÖNTÉST IGÉNYLŐ TÉTELEK (20261019T060329Z)

> Ezt a fájlt a `_tools/distill-apply.mts` generálta. Ami itt van, azt a gép **szándékosan NEM vezette át** — mindegyik döntést igényel. A gép csak MEGMÉRTE, hogy az állítás ma is áll-e.

Feldolgozott review-k (5): `20260920T020001Z.md`, `20260927T020001Z.md`, `20261004T020001Z.md`, `20261011T020001Z.md`, `20261019T060001Z.md`

## REFINE — kanonikus szöveg felülírása (a legkockázatosabb művelet)

A gép azt mérte meg, hogy az `OLD:` szöveg **szó szerint megvan-e még** a cél-fájlban:

- **ÉLŐ** — pontosan egyszer megvan → a javaslat ma is érvényes, dönteni kell róla.
- **ÁTFOGALMAZOTT** — a mondat megvan, de a formázása/szövege azóta változott → a javaslat valószínűleg ÉL, csak kézzel kell illeszteni. ⚠️ NEM ejthető gondolkodás nélkül.
- **NEM TALÁLHATÓ** — a szó szerinti idézet sehogy sem jön elő → vagy már átvezették, vagy a szabály eltűnt. ⚠️ Ez nem azonos azzal, hogy „fölösleges” — nézd meg, mielőtt ejted.
- **TÖBBSZÖRÖS / MÉRHETETLEN** — nem egyértelmű vagy nem szó szerinti idézet (`…`), gépileg nem dönthető.

### 🔴 ÉLŐ — ma is szó szerint így áll a fájlban (7)

#### `03-INVARIANTS.md` → §B.17 → „⚠️ Fázis-határ — minta-modul az előnézetben (ADR-0015)" bekezdés
- Review: `_inbox/20260927T020001Z.md` (244. sor) · Forrás: `2026-09-26_mobil_minta_ar_fekvo.md`
- OLD (szó szerint): `Feltétel: **félreérthetetlen minta-jelölés** (pl. „minta — így néz ki, ha lesz X"), a demó-fotókkal azonos demo-framing logika.`
- NEW: `Feltétel: **félreérthetetlen minta-jelölés** (pl. „minta — így néz ki, ha lesz X"), a demó-fotókkal azonos demo-framing logika. ⭐ **A minta-jelölés SZÁMRA is kiterjedhet — kimondott, szűkített tulajdonosi kivétellel (ADR-0239):** a mock foglalás-widgetje `demoPricing()`-gal minta-ÁRAT mutat (egységenként 24/28/32 e Ft/éj), hogy a vendég a FOGLALÁS-utat lássa, ne az árajánlat-módot. A kivétel hatóköre szűk: az ADR-0061 ② „kitalált ár SOHA" **az ÁRTÁBLÁRA áll**, ez kizárólag a widgetre. A jelölés OTT van, ahol a számot OLVASSÁK (ár-doboz címe, alap-sor, összeg-sor, a telefonos 2. lépés összegző
- MIÉRT: a fázis-határ eddig csak a „modul létezik, de nincs adata" esetre szólt; a tulaj 2026-09-26-án SZÁM-ra is kiterjesztette, szűkítve — ezt kimondottan kell rögzíteni, különben a következő szál vagy a tilalmat sérti, vagy a kivételt tágítja.

#### `00-GLOSSARY.md` → Provenance / kép-jogállás
- Review: `_inbox/20261011T020001Z.md` (140. sor) · Forrás: 2026-10-07_foto_behuzas_linkrol.md
- OLD (szó szerint): `- **Provenance / kép-jogállás** — `owner` | `guest` | `portal` | `places` | `streetview` | `generated`; a FÁZISSAL`
- NEW: `- **Provenance / kép-jogállás** — `owner` | `guest` | `portal` | `website` | `places` | `streetview` | `generated` (a `website` = a szállás saját honlapjáról, operátor által megadott linkről olvasott kép, élesítési szabálya a `portal`-éval azonos — ADR-0337); a FÁZISSAL`
- MIÉRT: a §A.3 és a kód (`recipe.ts:84`) már ismeri a `website` osztályt, a glosszárium felsorolása nem.

#### `03-INVARIANTS.md` → §B.17 „Az adathiányos ág NE legyen csendes átengedés” — blokkoló lista
- Review: `_inbox/20261011T020001Z.md` (155. sor) · Forrás: 2026-10-05_ai_orok_kivaltasa_vera.md
- OLD (szó szerint): `a blokkoló lista: `designVerdict`, `demoFraming`, `factVerdict`, `marketVerdict`).`
- NEW: `a blokkoló lista: `designVerdict`, `demoFraming`, `factVerdict`, `marketVerdict`, `guestCriticVerdict`, `reviewVerdict` — `GUARD_VERDICT_KEYS`, `src/outreach/mockVerdictGate.ts`). ⚠️ A hiányzó kulcs általában ÁTMEGY (régi artefaktum), KIVÉVE a `reviewVerdict`-et: a kurátori úton az AI-őrök nem futnak, ezért a hiányzó vagy szövegváltozás miatt elavult (copyHash-eltérés) Vera-ítélet `pending` = tiltás (ADR-0329).`
- MIÉRT: a lista két kulccsal lemaradt, és pont a kurátori út kivétele (hiány = tiltás) a nem nyilvánvaló szabály.

#### `03-INVARIANTS.md` → §H.21b (a)
- Review: `_inbox/20261011T020001Z.md` (161. sor) · Forrás: 2026-10-05_lead_sajat_aldomain_link.md
- OLD (szó szerint): `(a) Feloldatlan platform-aldomain → **404**, SOHA nem eshet át a marketing-landingre`
- NEW: `(a) Feloldatlan platform-aldomain → **404**, SOHA nem eshet át a marketing-landingre (kivétel, ADR-0330: a lead SAJÁT előnézeti címkéje — `lead.preview_label` — a `/`-n a lead élő `/p/<token>` lapját szolgálja ki helyben, `noindex`; ez nem tenant-oldal és nem landing, ismeretlen címke változatlanul 404 — `src/server/public.ts`, `prospectTokenForLabel`)`
- MIÉRT: a §H.21b ma azt állítja, hogy minden nem-tenant aldomain 404, holott a megkeresés linkje 2026-10 óta éppen ilyen aldomain.

#### `01-CALC-MODELS.md` → Unit economics
- Review: `_inbox/20261011T020001Z.md` (167. sor) · Forrás: reference_mock_ai_cost_already_measured.md · feedback_opinion_question_is_not_go.md · 2026-10-09_valos_oldal_eroforras_es_ingyenes_proba.md · 2026-10-05_ai_orok_kivaltasa_vera.md
- OLD (szó szerint): `- **Marginális költség / ügyfél** ≈ néhány € : generálás (gépidő + AI-token, pár cent) + hosting (0,5–2 €/hó megosztott) + domain (~10 €/év, ha adunk).`
- NEW: `- **Marginális költség / ügyfél** ≈ néhány € : generálás + hosting (0,5–2 €/hó megosztott) + domain (~10 €/év, ha adunk). ⚠️ A generálás NEM „pár cent”, és mérve van, nem becsülve: mockonként `mock_artifact.inputs.aiUsage` (lépésenként, `src/ai/usage.ts`). Az AI-út éles átlaga 2026-10-04-én $0,66/mock volt; a kurátori (Poe/Vera) úton ~$0. A költség egysége a LEAD, nem a mock (egy leadre több mock készül), és a teljes leadenkénti költségbe a Places-hívás és a perszóna-session keret-fogyása is beletartozik — „olcsó”-t csak a teljes összeggel szabad állítani. Az élő oldal futó költsége mérve ~0 
- MIÉRT: a „pár cent” mérten két nagyságrenddel alábecsül, és egy vélemény-kérdésnél ebből lett hamis olcsóság-állítás.

#### `01-CALC-MODELS.md` → Saját domain — díj, jogosultság, elköteleződés
- Review: `_inbox/20261019T060001Z.md` (154. sor) · Forrás: 2026-10-11_arazas_redesign_csomag_domain.md, project_trial_hu_domain_free_year_idea.md, 2026-10-13_elek_koordinator_zaras.md, 2026-10-13_domain_csomag_dijsor.md
- OLD (szó szerint): `- **Nincs ingyen-ág** → minden domain-rendelés **befagyasztja a csomag-padlót**`
- NEW: `- **Csomag-tartalom ág (ADR-0360):** a domain a /pricing „Csomagok” panelen pirula; ha a választott csomag tartalmazza (és a végződés „Csomagban ingyen”, \`freeInPackage\`), a névnek **nincs havidíja** — ez csomag-tartalom, nem kedvezmény, így az ADR-0354 „egy kedvezmény” elvével nem ütközik. Kisebb csomagra váltáskor a név díja elindul. Ettől függetlenül minden domain-rendelés **befagyasztja a csomag-padlót**` (a sor folytatása változatlan)
- MIÉRT: a „nincs ingyen-ág” mondat a 10-11-i árazás-redesign óta hamis (`src/pricing.ts` `freeInPackage`, `src/packages.ts` `tierHasDomain`).

#### `01-CALC-MODELS.md` → Saját domain → „A hűség letelte után…”
- Review: `_inbox/20261019T060001Z.md` (160. sor) · Forrás: 2026-10-13_elek_koordinator_zaras.md
- OLD (szó szerint): `- **A hűség letelte után se kötbér, se csomag-padló** — csak a havidíj fut tovább.`
- NEW: `- **A hűség letelte után se kötbér, se csomag-padló** — a NÉV díja tovább fut, amíg a név a honlaphoz tartozik; lemondáskor (végigfizetett hűségidő után) a név vételár nélkül a tulajé (ÁSZF 1.5 §9, \`domainFeeForRenewal\`). ⛔ Hamis mondat: „12 hónap után a név az Öné, a havidíj a honlapért fut” (egy koordinátor ezt javasolta, 2026-10-13).`
- MIÉRT: egy már egyszer elkövetett félreolvasást pinez, ÁSZF-hivatkozással.

### 🟠 MÉRHETETLEN — az OLD nem szó szerinti idézet (4)

#### `03-INVARIANTS.md` → §I.24, második felsorolás-pont (283. sor)
- Review: `_inbox/20260920T020001Z.md` (127. sor) · Forrás: `feedback_outage_recorded_as_permanent_loss.md` + `2026-09-13_dead_photo_liveness.md` (ugyanaznap esti helyesbítés)
- OLD (nyers): —
- NEW: (a review-ban kódblokként — nyisd meg)
- MIÉRT: a kanonikus ontológia egy olyan számot idéz bizonyítékként, amelyet ugyanaznap este a saját sweepünk megcáfolt — a hiteles szabály hiteltelen bizonyítékkal a következő félreértés magja.

#### `02-ENTITY-MAP.md` → „Realizált konverziós & pénzügyi entitás-lánc" → `order_intent` bullet
- Review: `_inbox/20260927T020001Z.md` (232. sor) · Forrás: `2026-09-24_penztarca_mentett_kartya.md`
- OLD (nyers): `kind ∈ initial | upsell | multilang | domain_upgrade | renewal |
- NEW: `kind ∈ initial | upsell | multilang | domain_upgrade | renewal |
- MIÉRT: a kind-lista hetedik értéket kapott (migráció 0076); a mai szöveg alapján egy jövőbeli szál azt hinné, hogy minden `kind` bizonylatot szül.

#### `05-MODULES.md` → „Két invariáns, amit a felderítés fizetett meg" → 1. pont
- Review: `_inbox/20260927T020001Z.md` (250. sor) · Forrás: `2026-09-22_paid_but_partially_empty.md`
- OLD (nyers): `1. **A jogosultság nem elég feltétel.** Mérve: egy fiókban `booking` ÉS `pricing` is aktív, de **0 db
- NEW: `1. **A jogosultság nem elég feltétel — és az adat megléte nem BINÁRIS.** Mérve: egy fiókban
- MIÉRT: a mai megfogalmazás „van adat / nincs adat" kettősséget sugall, és épp a vegyes esetre vak — pontosan azt a §B.17-adathiányos-ág hibaosztályt termeli, amit a §B.17 tilt.

#### `03-INVARIANTS.md` → §F.17e (régió-címke)
- Review: `_inbox/20261011T020001Z.md` (146. sor) · Forrás: 2026-10-04_lirai_nyitoresz.md · 2026-10-04_generator_tenyhuseg_3hiba.md
- OLD (nyers): (két sor):
- NEW: `⚠️ Determinisztikus kapu MA VAN, de szólistás (ADR-0324 kieg.): a nyitórész földrajzi állítása (víz-család, tájnév, égtájas part, öböl) csak a szállás SAJÁT forrásából állhat — a település ismerete nem forrás; a név és a település a bizonyítékból is kivágva (`GEO_CLAIMS`, `src/generator/lyricOpening.ts`; őr `lyric-opening-check` ⑥). Ismert határ: új tájnév addig nem jelez, amíg fel nem kerül a listára. A régió-feloldás ismeretlen leadre `known=false` (a korábbi `badacsony, known=true` fallback hamis tájkontextust adott — `resolveRegion`, `src/generator/generate.ts`), és explicit régió-id is c
- MIÉRT: a kód 2026-10-04 óta determinisztikusan buktatja a forrás nélküli földrajzot, a bejegyzés ennek az ellenkezőjét állítja.

### ⚪ NEM TALÁLHATÓ — a szó szerinti idézet nincs meg (1)

#### `03-INVARIANTS.md` → §A.3 „IDEGEN HIRDETÉS” bekezdés + a vízjel-kör prompt-verziója
- Review: `_inbox/20261019T060001Z.md` (166. sor) · Forrás: 2026-10-14_elek_foglalo_vendeg.md, 2026-10-14_teszt3_javito_szal.md
- OLD (szó szerint): `(\`heroPick.ts\`, prompt-verzió \`v3-watermark\`, KÜLÖN \`watermarked\` mező`
- NEW: `(\`heroPick.ts\`, prompt-verzió ma \`v4-contactbanner\` — a v3 \`v3-watermark\` óta; KÜLÖN \`watermarked\` mező`, és az IDEGEN HIRDETÉS bekezdés végére: `⚠️ Idegen hirdetés a LEFOTÓZOTT portál-molinó is (szállás falán lógó szallas.hu-tábla a tulaj telefonszámával/e-mailjével): reklám ÉS második, ellentmondó elérhetőség a saját oldalon (ADR-0390). A v4 prompt ezt \`ad\`-nak ítéli; a pótlás a v3 ítéletekre: \`scripts/rescore-photo-verdicts.mts --sign-map\`.`
- MIÉRT: a kódban `PROMPT_VERSION = "v4-contactbanner"` (`src/generator/heroPick.ts:56`), a doksi még v3-at mond, és a molinó-eset új kizárási osztály.

## PROMOTE — karanténban (a gép nem merte elhelyezni)

*(nincs)*
## DRIFT / ARCHIVE — változatlanul javaslat

- **DRIFT** (`20260920T020001Z.md`): `recipe.ts` kommentje szerint `places`/`streetview` SOHA nem mehet élesre ↔ `isLiveSafePhoto` nyilatkozat esetén `true`-t ad (00-GLOSSARY „Provenance" alatti figyelmeztetés, `photoPolicy.ts:36–40`).
- **DRIFT** (`20260920T020001Z.md`): Tier „lágy súly, közös pool" szándék ↔ `mockFromCorpus.ts:136` keményen szűr (00-GLOSSARY „Korpusz" alatti NYITOTT rés, a 2026-07-19-i review óta).
- **ARCHIVE** (`20260920T020001Z.md`): `feedback_outage_recorded_as_permanent_loss.md` — tartós magja (kimaradás ≠ lelet · gazdagép-fék · visszagörgethető írás) ekkor teljesen a §F.17f-ben él.
- **ARCHIVE** (`20260920T020001Z.md`): `reference_source_portal_photos_die.md` — ⚠️ **csak a számok helyesbítése UTÁN**; a „mintából ne általánosíts mechanizmusra" tanulság szintén a §F.17f-be került.
- **DRIFT** (`20260927T020001Z.md`): **A polcról levett / nem eladható modult tovább SZÁMLÁZZUK — a lelet ma is ÉLŐ.** A memória
- **DRIFT** (`20260927T020001Z.md`): **A `reference_unsubscribe_get_opts_out` memória ELAVULT — és a MEMORY.md indexében is így áll.**
- **DRIFT** (`20260927T020001Z.md`): **A 01-CALC-MODELS „marginális költség ≈ néhány € / 90 %+ margin" ma nem áll minden modulra.**
- **ARCHIVE** (`20260927T020001Z.md`): `2026-09-24_barion_advanced_approved.md` — az egyetlen tartós tartalma a díjszám (1,39 %) és
- **ARCHIVE** (`20260927T020001Z.md`): `2026-09-21_szamlazz_uj_fiok.md` — a szolgáltató szerkezeti korlátai + a mellékhatás-mentes
- **DRIFT** (`20261011T020001Z.md`): **A „kifejezett leiratkozási kérés” válaszban** — a feedback_outreach_legal_basis_settled.md szerint suppression a leiratkozó-link ÉS a kifejezett kérés („csak a leiratkozás-link/kifejezett kérés az”). A kód szerint a válasz-modulban (`src/replies/*.ts`) nincs leiratkozás/STOP-feldolgozás (grep: 0 találat), és a §C maga is kimondja: „A STOP-válasz feldolgozása továbbra sem létezik.” Egy válaszban kért leiratkozás tehát ma csak akkor hat, ha a kurátor kézzel rögzíti. Döntendő: gépi felismerés (le
- **ARCHIVE** (`20261011T020001Z.md`): `project_pilot_mobile_copy_env_set.md` — lezárt élesi állapot (a sor 2026-10-08-án törölve), ontológiai tartalma nincs; a kód (`pilotCopy.ts`) és a jegyzet `2026-10-05_pilot_mobil_masolat.md` őrzi.
- **ARCHIVE** (`20261011T020001Z.md`): `project_after_deploy_mock_view_backfill.md` — a backfill élesen lefutott (14 sor, 0 maradt); a tartós szabály (nincs nyers UA) a fenti §C-PROMOTE-ba került.
- **ARCHIVE** (`20261011T020001Z.md`): `project_after_deploy_rerender_http_photo_mocks.md` — ✅ kész (24 mock), egyszeri művelet; a tartós elv (rerender a tárolt receptből) a 02 propagáció-PROMOTE-ban él.
- **DRIFT** (`20261019T060001Z.md`): **Saját domain élesen: TLS-lánc hiányzik.** A memória (project_registrar_keys_only_in_dev_env.md, 2026-10-17) szerint az éles `.env`-ben már `REGISTRAR_PROVIDER=websupport` + `DNS_PROVIDER=websupport` van, tehát a vétel élesben valódi és pénzes. TLS-tanúsítványt viszont semmi nem kér (nincs certbot/ACME), ezért egy megvett név `tls_pending`-ben ragadna. Az ontológia szerint az állapotgép `…→tls_pending→live`, a live adapterek pedig „kulcs nélkül dobnak” (03-INVARIANTS §L.30, glosszárium). Ez a k
- **DRIFT** (`20261019T060001Z.md`): **04-INDEX desztilláló-ütemezés.** A 04-INDEX szerint a cron „vasárnap 04:00”. A memória (2026-10-13_riaszto_sms_csendes_ora.md, 2. kör, ADR-0379) szerint a user-crontab `0 8 * * 1` (hétfő 08:00), és szándékosan nem frissítették (a freshness-kapu miatt). A „következő DOMAIN-átvezetéskor javítandó”: a 04-INDEX sorát „hétfő 08:00”-ra, és a `domain-inbox-freshness-check.mts` kommentjét is. A crontabot nem olvastam.
- **ARCHIVE** (`20261019T060001Z.md`): project_reminder_meal_plan_after_pilot.md — kész (ADR-0378), emlékeztetni már nem kell; a számítási mag fent PROMOTE.
- **ARCHIVE** (`20261019T060001Z.md`): project_after_pilot_order_pill_placement.md — kész és élesítve (ADR-0377/0382/0383); a tartós rész a `assets/design-refs/prospect-page/order-pill/README.md` kontraktusban él.
- **ARCHIVE** (`20261019T060001Z.md`): project_ical_sync_feature_branch.md — landolt és élesítve; a tartós gotchák fent PROMOTE (02-ENTITY-MAP).
- **ARCHIVE** (`20261019T060001Z.md`): project_after_deploy_operator_session_relogin.md — a kiléptetés megtörtént (10-12 23:26), a feljegyzés már csak magyarázat.
- **ARCHIVE** (`20261019T060001Z.md`): project_trial_hu_domain_free_year_idea.md — a csomag-tartalom modell kiváltotta; a tartalma a fenti 01-CALC-MODELS REFINE-ban.
