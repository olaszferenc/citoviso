# 2026-09-27 — Kapu-alany leltár: melyik kapu mér a közös dev-DB vak „első során” (ADR-0252)

**Kiváltó:** brief `~/rc-briefs/kapu-sajat-fixture-elv.md` (a `cit873a226d` Webcím-szálból, tulaj: „nyiss új sessiont”). Egy napon három kapu volt piros a tiszta mainen a közös DB sorrendje miatt (photo-normalize · console-contrast · outreach-link-live).

**Hatókör (mérve):** 230 fájl — minden `scripts/*-check.{mts,ts,mjs}`, `scripts/lib/*`, és minden szkript, amit a `hooks/pre-commit` vagy a `scripts/land.sh` név szerint futtat (213, köztük a `.ts` selftestek). Keresett minta: `selectFrom` egy sort véve (`executeTakeFirst*` / `.limit(1)` / `.execute())[0]`) és nyers SQL `limit 1`. Aggregátum (`count`…) kizárva. A sorszámok a `46af4806` (HEAD a session elején) állapotára vonatkoznak.

## (c) vak „első sor” — HIBA · 40 lelet, 22 fájl → 36 javítva, 4 indokolt kivétel
| fájl:sor | mit vett | javítás |
|---|---|---|
| button-weight 80 · console-contrast 212 · console-dark-scan 33 · copy-panel 16 · help-collapse 45 · hero-override-ui 55 · hu-machine-form 533 · internal-ref 411 · mock-card-plan 424 · mock-photo-gate 457 · outreach-link-live 69 · outreach-preview 60 · outreach-send-bar 78 · pattern-badge 46 · scrape-liveness 403 · verdict-dialog-dom 51 | az első operátor (8 helyen `claude-test ?? első`) | `gateOperator` (`claude-test`, ELŐFELTÉTEL) — az operátor `lang`-ja a konzol nyelve |
| button-weight 249 · console-dark-scan 38 · hu-machine-form 535 · internal-ref 414 | a legújabb lead | `gateLeadWithMockAndProspect` |
| console-contrast 217 | az első artefaktum leadje (csendes kihagyás, ha nincs) | `gateLeadWithMockAndProspect` |
| console-dark-scan 39 · help-collapse 382 · hu-machine-form 540 · internal-ref 420 | az első partner | `gatePartnerWithContact` |
| console-dark-scan 40 · internal-ref 419 · outreach-preview 69 · outreach-row-truth 136 | a legújabb/első prospect | `gateDraftableProspect` |
| outreach-row-truth 38 | a legújabb prospect leadje | `gateLeadWithMockAndProspect` |
| consent-style 120 · photo-upload-body 32 · help-collapse 47 · internal-ref 422 | az első tenant-fiók (`claude-test` tenant NINCS — a consent-style mindig az első sort mérte) | `gateTenantUserWithSite` |
| hu-machine-form 550, 553 (`tenantUserQ` változó) | előfizetéses tenant join-nal, különben az első | kimondott `exists(site)` + `exists(subscription)`, különben `gateTenantUserWithSite` |
| configurator-float 75 · lead-page-surface 102 | legújabb artefaktum | **allow**: az id csak a manifest `requestUrl`-jébe kerül, a sort nem olvassa |
| prospect-owned 158, 335 | join-predikátum (vásárolt lead / mockos prospect) + ELŐFELTÉTEL | **allow**: a join a predikátum, hangosan bukik |

## (b) kimondott predikátum a közös DB-ből — elfogadható, HA hangosan bukik · 21 sor
Hangosan bukik (rendben): booking-offer 131 · price-on-request 125 · quote-request 58 · season-year-price 126 · whole-property-choice 58 (élő site artefaktummal, `throw`) · guest-link-host 73 (ELŐFELTÉTEL, exit 1) · offer-selftest 44 · period-switch-selftest 68 (tenant nélküli lead, `throw`) · a 7 `claude-test` operátor-sor (most `gateOperator`).

⛔ **CSENDES KIHAGYÁSSAL — az elvet sérti, NYITOTT:**
- `consent-check.mts:69` — élő site nélkül a ⭐⭐ „tenant-oldal nem kap sávot/Pixelt” állítás szó nélkül kimarad.
- `consent-style-check.mts:123` (élő site) · `:132` (előnézeti token) · `:470` (fizetett payment) — a felület kimarad a listából.
- `consent-style-check.mts:822` — artefaktumos `mock_request`: a dev-DB-ben ma **0 db** → a `/m/<token>` ág MOST SEM mérődik, csak ⚠️ KIMARAD-ot ír. Hangosítás előtt saját fixture kell, különben azonnal piros.
- `hero-override-check.mts:97` — kiajánlott mock nélkül a §I-ág ⚠️-tel kimarad.
- (a gépi osztályozó a `consent-style:822`, `park-doctor:80`, `prospect-owned:191` sorokat kulcsosnak látta, valójában literál/join-predikátumosak; mindháromnál van üzenet, a park-doctor nem kapu.)

## (a) saját fixture / kulcshoz kötött választás · 79 sor
Kulcs-változó a predikátumban (a kapu saját beszúrt sora vagy egy korábban kimondottan választott alany id-je): booking-offer (12) · domain-provision (10) · recurring-mandate (6) · wallet (5) · multilang-resume (4) · programs-editor (4) · contact-edit, mock-photo-gate, price-on-request (3–3) · charge-retry, module-purchase-state, offer-selftest, persist-portal, prospect-owned, season-year-price (2–2) · és 1–1: alert-drill, barion-webhook-ack, booking-price-gate, domain-renewal, lead-mobile, module-config, module-sales, order-paylink, pair-repair, partner-registry, pay-entry, period-switch-selftest, photo-rights-edit, review-flow, scrape-liveness. ⚠️ Gépi osztályozás: a kulcs jelenléte nem bizonyítja, hogy a kulcs saját fixture-ből jön — ezt az író-sáv őre (ADR-0229) a jelölt kapukon méri.

## Mellékleletek (nem ennek az őrnek a tárgya)
- `copy-panel-check.mts:19` — beégetett `LEAD` uuid: egy purge után halott azonosítón mér.
- A két 90 s-os korlát (console-contrast, outreach-link-live): a tulaj döntése. **Javaslat:** az alany most rögzített (`gateLeadWithMockAndProspect`, ma „Artemisz Panzió”) — a korlát visszavétele előtt ezen a leaden mérd a lead-lap networkidle-jét hidegen/melegen; ha ADR-0250 szerint ~12 s / ~3 s, a 90 s levehető 45-re.

## Az őr
`scripts/gate-subject-check.mts` (pre-commit, mindig) + `scripts/lib/gate-subject.mts` (nevesített alanyok). A felismerő első változata vak volt a `mock-photo-gate-check`-re (backtickes regex-literál sablonnak olvasta a fájl végét) — a nyers soros leltárral való keresztellenőrzés fogta meg (38 = 38 a javítás után); a lekérdezés-változó felismerése +2-t adott (hu-machine-form). Mindkettő bekerült az öntesztbe.
