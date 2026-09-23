## ADR-0036 — Automata nyelvi provisioning: a NYELV is paraméter (régió→nyelv→nyelvi csomag), kézi fordítás nélkül

- **Tulaj-döntés (2026-08-18):** ha a scrape olyan régióban fut, ami új nyelvterületet érint, a
  vevő-felületek AUTOMATIKUSAN álljanak elő az adott nyelven — ne kelljen kézzel belenyúlni.
- **Architektúra:**
  1. **Régió → nyelv determinisztikusan:** a régió `country` mezőjéből (0018) ország→nyelv térkép
     (`src/i18n/lang.ts`); a lead a régiójából örökli; a SiteData `lang` mezőben perzisztálódik
     (mock=live: az élő újra-render ugyanazt a nyelvet kapja).
  2. **Nyelvi csomag = egyszeri provisioning nyelvenként:** a felület-stringek KULCSA maga a magyar
     forrás-szöveg (`T(d,"Galéria")`) — nincs kézi kulcs-nevezés; a katalógust build-időben egy
     extractor gyűjti a forrásból (`scripts/extract-i18n.mts` → `src/i18n/catalog.json`). A csomag
     AI-fordítással készül (placeholder-őrzéssel), a `language_pack` táblába perzisztálódik (0021),
     onnantól DETERMINISZTIKUS. Trigger: mock-generáláskor/scrape-induláskor `ensureLanguagePack`.
  3. **Per-lead AI-szövegek** (brief, copywriter): a cél-nyelvet paraméterként kapják — ott nincs
     előre gyártás. A tényhűség-kontraktus nyelvfüggetlen.
  4. **Kliens-oldali felületek** (foglaló-widget, konfigurátor): a szerver a csomagból
     `CIT_I18N`/manifest-térképet injektál; a kliens `tr()` helperrel oldja fel.
  5. **Őr-kapuk:** (a) csomag-guard: teljes katalógus-fedettség + placeholder-épség generáláskor,
     hiány = hangos hiba, nincs néma magyar-fallback élesben; (b) **§C ORSZÁG-KAPU: nem-magyar
     nyelvterületre outreach NEM küldhető** amíg az ország jogi csomagja (jogalap/leiratkozás-szöveg,
     országonkénti szabályozás — pl. lengyel opt-in) tulaj-jóváhagyást nem kap; addig §C-FLAG.
     Mock/oldal/konfigurátor automatikusan mehet az új nyelven; hideg levél nem.
- **Scope-határ (1. szelet):** sablon-felületek + foglaló-widget + konfigurátor + AI-szövegek;
  az outreach-levél/SMS/privacy az ország JOGI csomagjával együtt válik többnyelvűvé (értelmetlen
  jogi lábléc nélkül fordítani); tenant-admin/konzol i18n post-pilot (korábbi rendelet szerint).
- **Visszafordíthatóság:** 🔄 könnyű — additív (lang mező, T()-burkolás, új tábla); hu-ra minden
  változatlanul renderel (a hu csomag maga a forrás).
- **Státusz:** ELFOGADVA (tulaj, 2026-08-18). 1. szelet implementálva ebben a sessionben.
