# 2026-08-02 — §A per-kép provenance + fotó-policy a go-live élen

## Mit építettünk (commit `40d48e9`)

A 2026-07-13 óta ELDŐLT §A fotó-politika végrehajtási rése zárva: eddig az `activate()`
csak az önnyilatkozat MEGLÉTÉT nézte, de a live site ugyanazt a Places-fotós (ráadásul
noindexes) provisioned snapshotot szolgálta ki. Mostantól a szabály a kódban él.

### Réteg és fájlok
- `src/engine/recipe.ts` — `Photo` += `provenance` (§A.3 osztályok: owner|guest|portal|
  places|streetview|generated) + `watermarked` flag.
- `src/engine/photoPolicy.ts` (ÚJ) — `isLiveSafePhoto` + `applyLivePhotoPolicy`:
  élesre mehet owner/guest/portal/generated (guest/portal a 0015-ös önnyilatkozat
  fedezetével, csere NÉLKÜL); places/streetview/vízjeles SOHA; ismeretlen provenance =
  drop (A4 „bizonytalanság → kevesebb"), kivéve `/uploads/` prefix = legacy owner-feltöltés.
  Szoba-fotókra is fut; a szoba maga marad (valós adat), csak a nem-megfelelő kép esik ki.
- `src/generator/generateEngine.ts` — a gated Places-fotók `"places"` bélyeget kapnak
  a SiteData-ban (perzisztálódik az artifact inputs-ába).
- `src/tenant/editor.ts` — admin-feltöltés `"owner"` bélyeg; `renderAndPersist` live
  státusznál (v. `asStatus="live"`-nál) policy-t alkalmaz; ÚJ export
  `rerenderTenantSnapshot(tenantId, {as?})`.
- `src/payment/service.ts` — `activate()`: (1) legacy HTML-copy artifact → MEGTAGADVA
  (nem szűrhető strukturáltan; paid+provisioned marad, kurátor rendezi); (2) §A-policys
  live render ELŐBB, a `live` status-flip CSAK sikeres render után (őr-jelezte
  sorrend-rés — hibás render sosem hagyhat demó-fotós live site-ot).
- `src/conversion/provision.ts` — `toPrivatePreview` a LÉTEZŐ robots metát noindexre
  CSERÉLI (eddig skippelte).

### Két rejtett bug, amit közben fogtunk
1. Az engine-renderelt provisioned privát előnézet `index,follow` volt (a seo.ts
   live-fázisú robots metáját a toPrivatePreview nem írta felül) — Bonvino bizonyította.
2. A live site a noindexes provisioned snapshotot szolgálta ki (go-live után nem volt
   re-render) → az „éles" oldal sosem volt indexelhető ÉS demó-fotós maradt.

### Verifikáció
- Egység: 8-fotós vegyes készlet → pontosan owner/guest/portal/legacy-upload marad;
  vízjeles owner is kiesik; üres-fotós live render nem törik (hero degradál).
- E2E (Hotel Bonvino, dev DB): provisioned+demó → places=14+noindex · live-policy →
  places=0 · live+owner-feltöltés → uploads renderel+index · vissza-provisioned → noindex.
- Aktiválási sorrend szimulálva: `as:"live"` render provisioned státuszban működik.
- `jog-provenance-or` őr: fázis-mátrix PASS; 2 jelzett rés (sorrend + GRANDIS-residuum)
  még a sessionben javítva; tsc tiszta.

### Remediáció
GRANDIS (2026-07-21-i Barion sandbox-kör, legacy copy-artifact, 8 Places-URL) live →
provisioned vissza. 0 live site a dev DB-ben.

## Nyitva maradt (kicsi, tulajjal eldöntendő / később)
- `watermarked` ma halott kód: semmi nem állítja true-ra. A portal-ingest építésekor a
  vízjel-detektálás/bélyegzés KÖTELEZŐ, különben a §A.2 csak típusdefiníció.
- Az engine-renderelt provisioned előnézetben NINCS demo-framing lábléc (a legacy másolt
  mockban benne volt). Védelem ma: noindex + kitalálhatatlan token. §A.12-súrlódás:
  kell-e vizuális „előzetes terv" keret a fizetés utáni privát előnézetre? — tulaj-döntés.
- guest/portal provenance-t ma semmi nem állít elő (nincs portal-fotó-ingest) — a policy
  kész rá, az ingest majd bélyegez.

## Temp-screenshot kivizsgálás (mellék-szál)
A tulaj 08-01 21:23-as mobil-screenshotja (konzol lead-lista, egymásra torlódó menü) a
23:22-es szerver-restart ELŐTTI régi UI-t mutatta. A mostani konzol 390px-en Playwright-
tal verifikálva: tabsor egy sorban, tábla a panelen belül görgethető, body nem lóg ki.
Kódmódosítás nem kellett. (QA-hoz ideiglenes `claude-qa` operátor jött létre és törölve.)

## Következő
**Teljes A–Z sandbox-teszt** (scrape→mock→outreach→rendelés→fizetés→számla→élesítés) —
a tulaj döntése szerint ez előzi az éles Barion/Számlázz kulcs-beszerzést. Kozmetika:
régió-slug a levél hook-mondatában („godollo" → „Gödöllő").
