# 2026-10-05 — A megkeresés linkje a lead saját aldomainje (ADR-0330)

**Kérés (brief `kik-ld-tt-linj`):** „Nem lehetne valami barátságosabb kinézetű linket küldeni? … nehogy valami vírus legyen."
Élesen mérve a link: `https://citoviso.com/p/vecsey-apartman/63cNoWfy448yNdmeietS2YWf`.
**Tulaj-döntés:** saját aldomain (`vecsey-apartman.citoviso.com`); vásárláskor ha ezt választja, marad, ha mást, törlés.

## Elvégezve
- `lead.preview_label` (migráció 0090, egyedi) + `src/outreach/previewLabel.ts` (kiosztás név → név+város → -2…, feloldás az élő prospectre, elengedés).
- `draft.ts`: élesen a CTA-link `https://<címke>.citoviso.com` (e-mail, SMS, pár-SMS, eszkalációs levél); devben a régi `/p/…`.
- `public.ts`: fenntartott címke hostján `/` = a konzol `/p/<token>` lapja helyben (belső fetch a :4600-ra, noindex); más útvonal mint a citoviso.com-on; ismeretlen címke változatlanul 404.
- Vásárlás: konfigurátor-alapértelmezés = címke; más leadnek foglalt; provisioning után elengedve, ha a slug nem az.
- `?sajat=1` az aldomain-linkre is (`markOwnViewLinks`); őr `scripts/check-preview-label.mts` (pre-commit).
- Dev DB-n a 0090 lefutott; próba: `Üdülő tábor` → `udulo-tabor` → az élő token.

## Nyitott
- ✅ (2026-10-06) Élő próba a fő fán lefutott: `Host: udulo-tabor.citoviso.com` → 200, a lead mockja, `x-robots-tag: noindex`, konfigurátor `subLabel=udulo-tabor`; ismeretlen címke 404; `/assets/…` az aldomainen 200.
- Deploy UTÁN: próba-SMS a tulaj teszt-mobiljára (+36 30 516 1631) — hogyan mutatja a Google Messages az aldomain-link előnézetét.
- Éles: a nagy deployjal megy (migráció 0090); a nginx/Cloudflare wildcard már ma kiszolgálja a `*.citoviso.com`-ot (mérve: TLS ok, 404 lap).
- A már kiküldött linkek tokenesek maradnak (működnek); csak az új üzenetek kapják az aldomaint.
