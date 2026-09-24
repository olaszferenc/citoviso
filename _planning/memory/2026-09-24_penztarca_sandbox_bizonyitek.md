# 2026-09-24 — Pénztárca: mock-kör + Barion-sandbox bizonyíték (ADR-XXXX)

Brief: `~/rc-briefs/penztarca-sandbox.md`. Előzmény: ADR-0226, `2026-09-24_penztarca_mentett_kartya.md`.

## Feladat 1 — mock-kör (kész, zöld)
`scripts/wallet-tour.mts` — eldobható tenant-fixtúra, a fa saját konzolja + publikus szervere
ideiglenes portokon, **mock átjáró + mock számla + mock levél** (dinamikus import előtt beállítva és
visszamérve; `ELEK_RUN=1` levél-zár). A három út valódi kattintásokkal, 12 ellenőrzőpont × 390/1280 px
kép (`assets/design-refs/_drafts/wallet-tour/`, a tulajnak elküldve): csere → MC ····8810, régi
„cserélve”; elutasítás → `card=fail`, semmi nem változik; Modulok „Másik kártyával” → tételes
megerősítő ablak → mock fizetőlap kártyaválasztóval → Pénztárca: Visa ····4242, 490 Ft-os terhelés
ezen a kártyán, modul él; visszavonás → NINCS MENTETT KÁRTYA, „visszavonva”, „Kártya megadása”.
25/25 állítás zöld, JS-hiba 0.

### Mellékleletek (a tulaj kivételével javítva, §2b exception naplózva)
1. **A „Másolom” gomb halott volt** a fizetés-visszaigazolón és a mock fizetőlapon (élesen is):
   `payCopyScript` `b.textContent=${jsStr(…)}` idézőjel nélkül → SyntaxError, a szkript el sem indult.
   A `jsStr()` csak escape-el, nem idéz. Őr: `paydone-split-check` — minden inline szkript lefordul
   (`vm.Script`), negatív kontrollal; hibás kódon piros, javítotton zöld (mérve).
   ⛔ Tanulság: a meglévő őrök a gomb MARKUPJÁT mérték (jelenlét ≠ működés).
2. **Modulok, 390 px: a ragadós terv-sáv a 186 px-es alsó navigáció ALÁ ragadt** — a fizetés gomb
   y=770/844-en takarva. Javítás: `@media(max-width:899px){.adm-planbar{bottom:calc(var(--citui-admin-bottomnav-h)+…+10px)}}`.
   ⚠️ Első próbám a `@media` blokkba tette a szabályt — a későbbi alapszabály forrás-sorrenden verte,
   semmi nem változott; csak a mérés (elementFromPoint) mutatta meg. A `wallet-tour` ezt méri.
3. Teljes lapos screenshot a fix telefonos navigációt a lap KÖZEPÉRE festi (eltakarta a „Korábbi
   kártyák”-at) → a tour a nézetet a dokumentum magasságára nyújtja (`tallShot`).

## Feladat 2 — Barion-sandbox (kész: MŰKÖDIK; a mondat változott)
`scripts/barion-sandbox-card-probe.mts start|state|mit|reap` (csak `api.test.barion.com`-on fut).
Valódi termék-út, a callback a fő fa konzolján; 100 Ft és 10 Ft: Reservation → Finish(0) → Succeeded
→ token + maszk (Visa ····5559) → **MIT: Succeeded, RecurrenceResult Successful**. Részletek + táblázat:
ADR-XXXX.
**Cáfolat:** a bankkártyás Reservation valódi terhelés, a Finish(0) visszatérítés (doksi: ≤30 nap), a
Barion-gomb „Fizetek: …”. → Tulaj: „Marad a mód, kisebb összeg” → `CARD_VERIFY_AMOUNT_HUF = 10`, igaz
mondat a csere-ablakban, siker-sávban, mock-lapon, Barion-leírásban, súgóban, kontraktus ⑤-ben.
Fixtúrák a callbackek UTÁN takarítva (nincs „Unsuccessful callback” kockázat).

## Módosított fájlok
- `src/payment/service.ts` (10 Ft + leírás), `src/server/adminViews.ts` (csere-ablak + siker-sáv),
  `src/console/views.ts` (mock-lap feliratai + `payCopyScript` idézőjel), `src/tenant/wallet.ts` (komment),
  `src/i18n/catalog.json` (generált), `public/assets/ui/citui-admin.css` (terv-sáv mobilon)
- `scripts/wallet-check.mts`, `scripts/kb-shot.mts`, `scripts/paydone-split-check.mts`,
  új: `scripts/wallet-tour.mts`, `scripts/barion-sandbox-card-probe.mts`
- `kb/entries/admin-wallet/entry.hu.md`, `assets/design-refs/console/wallet/README.md` (⑤)
- `_planning/decisions/XXXX-kartyacsere-barion-sandboxban-igazolva-10-ft.md`, ez a jegyzet, `MEMORY.md`

## Nyitott / következő
1. Élesítés előtt: **éles 3DS** (a sandbox teszt-kártyán nem fut) és a **Barion-tárca díj-fedezete**
   (Reservation-Start fedezet nélkül elutasít) — a legkézenfekvőbb bizonyíték egy éles 10 Ft-os
   kártyacsere a tulaj kártyájával, a 100 Ft-os próbavásárlás után.
2. `finishReservation` a `Transactions[0]`-t zárja — sandboxban jó, de a sorrend nem garantált
   (a díj-tranzakcióknak `POSTransactionId: null`); robusztusabb: a saját POSTransactionId szerinti.
3. Lejáró kártya e-mail (ADR-0226-ból változatlanul nyitva).
