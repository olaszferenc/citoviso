# 2026-09-27 — A lead-lap ~31 s-os photo-health várakozása: a gazdagép-szünet a cache-találatra is lefutott

## Kérés
Brief `~/rc-briefs/lead-lap-photo-health-lassu.md` (a `cit873a226d` Webcím-szálból, tulaj „G” út): a konzol
`/lead/<id>` lapjának `networkidle`-je ~31 s, a rá váró kapuk a 30 s-os határon billegnek — gyökérok javítása.

## Mérés → ok
- `assessMockPhotos` egy artefaktumra 7,4 s, második futásra IS (21 kép × `HOST_GAP_MS` 350 ms): a szünet a
  cache-találatra is lefutott.
- Mellékleletként: az újrapróba a saját cache-elt bukását olvasta vissza → egy múló 503 = „törött” (téves piros).

## Elvégzett munka
- `src/outreach/mockPhotoHealth.ts`: friss cache-sor → azonnali verdikt; újrapróba `refresh: true`-val.
- `src/console/photoProxy.ts`: `fetchPhoto(url, { refresh })` + in-flight összevonás (egy URL = egy kérés).
- `scripts/mock-photo-gate-check.mts`: 3 új sor (azonos verdikt · nincs szünet · 503→200 újrapróba), negatív
  kontrollal a régi kódon piros.
- ADR-0250.

## Eredmény (lead `de9bcca7…`, fő fa vs. munkafa)
networkidle hideg 31,9 → 11,7 s · meleg 29,1 → 2,7 s · `assessMockPhotos` meleg 7 404 → 7–20 ms.

## Kapuk
Zöld: `mock-photo-gate-check`, `button-weight-check`, `outreach-link-live-check`, `console-contrast-check`.
Piros a FŐ FÁN IS, azonos bukással (nem ez a változás): `copy-panel-check` (`.cp-scale` hiányzik),
`hero-override-ui-check` (`.hp-alt` nem látható).

## Nyitott
- A Webcím-szál 90 s-os időkorlátja a két kapun visszavehető — tulaj dönt (a 90 s még nincs a mainen).
- `copy-panel-check` + `hero-override-ui-check` a mainen is piros — gazdát kell nekik keresni.
