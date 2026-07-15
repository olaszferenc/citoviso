# Konverziós szál — pilot-minimál gerinc + a sales-felismerés (2026-07-13/15)

## Kontextus
A tölcsér első fele kész (lead → mock → kurátor → megkeresés); a KONVERZIÓ (mock → élő tenant-Site) nem létezett.
Ez a szál a konverzió pilot-minimál gerincét építette meg — ÉS a végén kiderült a valódi hiányzó darab.

## Fogalmi döntések (ADR)
- **ADR-0013 — tier = KARAKTER/REGISZTER, nem minőség.** A gyártási minőség konstans-maximum (a budget hely is
  kiváló oldalt kap; a „nincs semmije" lead a fő MOAT). A tier a hangnem/illeszkedés dial-je, nem „jobb/rosszabb".
  Következmény: a szerkezet (archetípus) minőség-semleges → közös, tier-agnosztikus pool + lágy súly (impl. külön).
  A mai KEMÉNY `filter(e.tier===t)` a `mockFromCorpus.ts`-ben ennek fényében rossz; a `luxus:1` nem „kevés luxus".
- **ADR-0014 — provisioning ≠ élesítés.** A `PROCESS.md` „fizetési sorrend"-ütközése terminológiai túlterhelés
  volt (aktiválás/előfizetés/provisioning kétértelmű). Provisioning = PRIVÁT előnézet (noindex, token-URL),
  fizetés ELŐTT is futtatható; élesítés = NYILVÁNOS go-live, fizetés-kapus. Site-állapotgép:
  draft→provisioned→live→suspended→deactivated. A tulaj „fizet→nyilvános aktiválás" sorrendje áll.
- **§A átírva (asset-jog):** a demó-kép NEM tilos élesre kategorikusan. `guest`/`portal` kép ÉLESRE kerülhet, HA
  a tenant a fizetési kapuban jogi ÖNNYILATKOZATOT tesz (rendelkezik a szerzői joggal + szavatosság + kártalanítás)
  ÉS volt csere-lehetősége. `places`/`streetview` (Google-jog) + vízjel SOHA → csere. Indok: a portálra a
  tenant/megbízottja töltötte fel → hihető a szerzősége. `jog-provenance-or` őr-agent mátrixa igazítva.

## Épített kód (mind commitolva + pusholva `50e1d71`..`a8f22b5`)
- `migrations/0004_conversion.sql`: `tenant` (lead_id UNIQUE, első `tenant_id`-hordozó), `module_entitlement`
  (UNIQUE tenant+module), `site` (állapotgép + preview_token + source_artifact_id). `disqualified` a lifecycle
  CHECK-be. RLS SZÁNDÉKOSAN még nincs → az első vendég-PII táblánál (booking) lép be (§G.18).
- `src/conversion/provision.ts`: `convertLead` idempotens (tenant/site UNIQUE-ra, entitlement upsert additív).
  approved mock → `sites/<tenant_id>/index.html`, noindex injektálva, demo-framing MEGTARTVA (privát preview =
  még demó-fázis). lead → `conversion`. `.gitignore`: `sites/`.
- Konzol: `data.ts` (getConversion/getSiteByToken/getTenantAdminByToken), `views.ts` (MODULE_CATALOG,
  convertForm, convertedBlock, tenantAdminPage), `server.ts` (POST /convert, GET /site/:token, GET /admin/:token).
  Böngészőből (Tailscale :4600) a POST /convert élőben lefutott (Harsona: 12 modul rögzült).

## ⭐⭐ A szál fő felismerése — ADR-0015 (a commit még csak LOKÁL a záráskor)
A Harsona-teszt megmutatta: az entitlement rögzül, de a Site NEM renderelődik újra a modul-választásból.
A tulaj elkapta a hibás megnyugvást: **„sosem-látott modulért nem áldoz pénzt senki"** — és igaza van, mert a
termék horga = „előre kész mock, amit LÁTNAK". **Korrekció (ADR-0015):** modult csak LÁTHATÓAN adunk el; a
**interaktív modul-konfigurátor + élő előnézet a KONVERZIÓ SZÍVE** (BACKLOG-ból előléptetve). A provisioning-gerinc
(táblák + convertLead) NEM kár — az a kereskedelmi réteg; a konfigurátor rá ül. **Tényhűség fázis-határa (§B.17):**
adat nélküli modul az ELŐNÉZETBEN minta-állapottal MEGmutatható (félreérthetetlenül jelölve, mint a demó-fotó),
de az ÉLŐ oldalra SOHA adat-fedezet nélkül (kamu-tilalom az élő oldalon kőbe vésve).

## Nyitott / következő
- **Következő szelet:** a konfigurátor SCOPE-olása — mit renderel újra, hogyan togglel, hol/hogyan jelöli a
  minta-állapotot, hogyan köti az `entitlement` → látható szekció leképezést (adat-kapuzva).
- A `tier`-impl (közös pool + lágy súly) még hátravan (ADR-0013 → külön ADR + éles A/B a paletta-szivárgásra).
- A dev-DB-ben teszt-adat: Sophia/GRANDIS/Harsona (Gödöllő) konvertálva — legitim, hasznos a konfigurátor-teszthez.
