# 2026-09-25 — Árak képernyő: gomb a Szobák szerkesztőhöz (jóváhagyott „B” terv)

## Kiváltó ok (a tulaj szava)
Az Árak képernyő (`/admin?tab=modulok&m=pricing`) egy-egységes tulajnál csak „A szállás egésze”
kártyát mutat. Ha a tulaj NEM a szállás egészét, hanem szobákat akar árazni, előbb a szobákat kell
felvennie — de a képernyőről ide nem vezetett út, csak egy nem kattintható mondat említette a
„Szobák, apartmanok” modult. Kérés: „gombot vagy mittomén mit + súgót is szerkeszteni”.

## Döntés (§2b kapu, két vázlat → tulaj: „B”)
- A vázlat (`_drafts/pricing-rooms-link.html`, önhordó, Mobil/Asztali + Világos/Sötét váltó,
  kattintható linkek): **A** link-sor a jegyzetben (meglévő „Online foglalás ›” minta) vs.
  **B** gomb a jegyzetben. **A tulaj a B-t választotta.**
- Befagyasztva: `assets/design-refs/console/pricing-rooms-link/` (plan.html + README + 2 kép).
  A README köti a két feliratot és a két horgonyt (`data-cit-rooms-link`, `mcfg-note--act`);
  a `contract-drift-check` zöld rajta.
- ⚠️ Tanulság a vázlathoz: a `../../../public/assets/ui/citui.css` relatív hivatkozást a
  Remote-Control megjelenítő NEM tölti be („nem renderel”) → a vázlatba a CSS-t BE KELL ÁGYAZNI
  (önhordó = tényleg egy fájl).

## Megvalósítás
- **Gyökér-szabály, amit a felderítés adott:** a modul-képernyő CSAK aktív modulra nyílik
  (`serveAdmin`, `src/server/public.ts:1165`). Ezért a gomb célja a Szobák modul állapotától függ:
  aktív → „Szobák, apartmanok szerkesztése” → `m=rooms`; nem aktív → „Szobák modul bekapcsolása”
  → Modulok fül. Az állapot `PricingEditorData.roomsActive` (KÖTELEZŐ mező, mint a
  `bookingActive`), ugyanazzal a predikátummal, mint a képernyő-kapu (`modules.modules… m.active`).
- Jegyzet = flex sor `@container`-rel a saját szélességére (az admin oszlop keskenyebb az
  ablaknál): <640 px alatt a gomb a szöveg alá, teljes szélességben.
- Őr: `scripts/pricing-booking-only-check.mts` ⑤ (célpont mindkét állapotban) + ④ böngészőben
  mérve (a gomb a jegyzeten belül, 390 px-en 99% széles); önteszt 7 piros.
- Súgó: `kb/entries/admin-modules-pricing/entry.hu.md` „Több szoba, több ár” szakasz a gomb
  feliratával; `screen.png` újralőve (kb-shot).

## Módosított fájlok
- `src/server/moduleConfigViews.ts` (PricingEditorData.roomsActive, jegyzet-sor + gomb, CSS)
- `src/server/public.ts` (roomsActive a builderben)
- `scripts/kb-shot.mts`, `scripts/pricing-booking-only-check.mts` (fixture + ⑤/④ állítások)
- `kb/entries/admin-modules-pricing/entry.hu.md` + `assets/hu/screen.png`
- `assets/design-refs/console/pricing-rooms-link/{plan.html,README.md,plan-mobile.png,plan-desktop.png}`
- `src/i18n/catalog.json` (2 új kulcs)

## Két idegen kapu, ami a landot blokkolta (mindkettő idő-/tempófüggő, javítva)
- `booking-screen-check`: a hónap utolsó napjaiban a kézi blokk a KÖVETKEZŐ hónapba esik, a naptár
  a mostanit mutatja → 2 csíkos nap a helyes, az őr 3-at várt. Most a jelvény hónap-szabályát követi
  (2 várt, számon kérve, nem kihagyva).
- `room-editor-check` [neg] „halvány képek": a visszarontó `opacity:1` után 80 ms-mal olvasott, de a
  kép 220 ms-os átmenettel halványul → a görbe közepén (mérve 0,48) még „halvány" → a kontroll csak
  LASSÚ gépen (párhuzamos kapuk alatt) ment át, véletlenül; önállóan mindig bukott. Most az átmenetet
  is kikapcsolja és 300 ms-ot vár. Tanulság: átmenetes tulajdonságot a kontroll ne a görbe közepén
  olvasson — a „zöld" a gép tempójától függött.

## Nyitva
- Nem élesítve (a többi 09-23/24-es árazás-szállal együtt megy egy verzióban).
- A KB fordítás-frissesség a deploy kapuja (ADR-0207) — a magyar forrás változott.
