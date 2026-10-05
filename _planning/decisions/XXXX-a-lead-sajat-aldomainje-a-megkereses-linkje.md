## ADR-XXXX — A lead SAJÁT aldomainje a megkeresés linkje (`<címke>.citoviso.com`)

- **Kiváltó (tulaj, 2026-10-05):** a kiküldött link — élesen mérve:
  `https://citoviso.com/p/vecsey-apartman/63cNoWfy448yNdmeietS2YWf` — „elijesztheti a leadet: nehogy valami
  vírus legyen". A név (ADR-0082) már benne volt; a 24 jeles, vegyes kis-/nagybetűs token ijeszt.
- **Tulaj-döntés (3 változatból — rövid kód / csak név / saját aldomain):** **saját domain.** „Vásárláskor ha ezt
  a domaint választja a tenant, akkor marad, ha másikat: törlés."
- **Döntés:**
  1. **A link élesen `https://<címke>.citoviso.com`** (`previewLink`, csak platform-hostingon; devben — nincs
     wildcard DNS — marad a `/p/<slug>/<token>`). A címke a LEADEN él (`lead.preview_label`, migráció 0090,
     egyedi): egy leadnek több prospectje lehet, címe egy. Az aldomain mindig az ÉLŐ (legutóbbi nem archivált)
     prospectet nyitja.
  2. **Kiosztás az első draftnál** (`buildDraftForProspect` → `ensurePreviewLabel`, idempotens — a konzol előnézete
     és a kiküldött üzenet ugyanazt mutatja): a név slugja; ütközéskor név + település (a cím „<irsz> <város>,"
     alakjából; nem találgatunk), majd `-2`, `-3`… Foglalt = más lead címkéje, más lead tenantjának slugja, vagy
     fenntartott név (`RESERVED_SLUGS`, átkerült a `domains.ts`-be). Kiosztás után NEM változik (kiküldött címben áll).
  3. **Kiszolgálás:** a public szerver a fenntartott címke hostján a `/`-en a konzol `/p/<token>` lapját adja
     HELYBEN (belső hívás, `x-robots-tag: noindex`); minden más útvonal úgy viselkedik, mint a `citoviso.com`-on —
     az nginx ma is így osztja (`/p/` → konzol, a többi → public), így a lap saját hívásai (`/p/<token>/view`,
     `/request`, `/assets`, `/api`) változatlanok. Élő tenant-site ugyanazon a hoston ELŐBB nyer (0017).
  4. **Vásárlás:** a konfigurátor alapértelmezett aldomainje a lead címkéje; a címke a vevőnek szabad, mindenki
     másnak foglalt (`checkSubdomainAvailable`, `uniqueSiteSlug`). Provisioning után, ha a site slugja NEM a
     címke, a címke **törlődik** (`releasePreviewLabelUnlessKept`) — az aldomain onnan „Ez az oldal még nem
     érhető el.". Egyedi domainnél a site slugja alapból a címke lesz, így az aldomain a slug-host 301-jével
     (ADR-0041) a vevő domainjére visz.
  5. **Változatlan:** a leiratkozó/`why` link a tokenes úton marad (jogi link, az aldomaintől függetlenül élnie
     kell); minden már kiküldött `/p/…` link örökre működik. A `?sajat=1` jelölő (ADR-0327) az aldomain-linkre is
     ráül (`markOwnViewLinks`) — nélküle a tulaj másolata megint a lead látogatásának számítana.
- **Elfogadott ár:** a cím KITALÁLHATÓ (bárki beírhat egy szállásnevet) — a tulaj a barátságosabb linkért
  vállalta; a mock nyilvános adatból épül, noindex, tervként keretezett, a GET semmit nem mér (ADR-0291).
- **Őr:** `scripts/check-preview-label.mts` (pre-commit).
- **Visszafordíthatóság:** 🔄 — a `previewLink` elhagyásával a draft visszaáll a `/p/…` linkre; az oszlop additív.
- **Státusz:** ELFOGADVA (tulaj, 2026-10-05). Nem élesítve (nagy deploy).
