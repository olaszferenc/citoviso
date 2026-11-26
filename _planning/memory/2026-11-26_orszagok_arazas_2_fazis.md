# 2026-11-26 — „Országok / Árazás” 2. fázis: új ország listából, Indulás / Szünetel (SUB cita363cd23)

**Elkészült:**
- `countryCatalog.ts` (a világ országai: pénznem, nyelv, időzóna, hívószám, előtag); a `blankDraft` ebből tölt (az EU-kezdősor kiváltva).
- Választó ablak Barion-jelzéssel; `POST /countries/pick` → saját ár-régió, jóváhagyatlan MNB-javaslattal → előre kitöltött szerkesztő.
- Migráció 0157: `launched_at`, `paused_at`, `paused_by`.
- Indítás doboz: Indulás (jóváhagyás teljesség nélkül), Szünetel, Folytatás.
- Piac-kapu: `&& !paused`. Felderítés: jóváhagyott és nem szüneteltetett ország.
- KB, kép (picker.png), e2e. A F5 levél horvát fordítása Bábelre vár (`scripts/lib/babel-pending-arvaltozas.mts`).

**Nyitott:**
- Ünnepnap-forrás EU-n kívül: ma üres, a teljesség jelzi; a forrás kijelölése a koordinátoré.
- A felderítés-ütemező módosítása a `cit9d514f15` szál fájljában van (`discoveryAreas.ts`).
