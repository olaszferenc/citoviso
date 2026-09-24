## ADR-XXXX — Tenant-admin újratervezés: „Linear” nyelv, egy akcent, világos/sötét mód (2026-09-24)

**Dátum:** 2026-09-24 · **Státusz:** elfogadva (terv befagyasztva, megvalósítás következik) ·
**Kapcsolódó:** ADR-0021 ① (dizájn-mag, `--citui-*`), ADR-0034/0035 (oldalsáv-menü), ADR-0044
(fotó-sorrend, nyitókép), ADR-0045 §J (súgó-horgonyok), ADR-0198 (feltöltés-elutasítás névvel),
ADR-0220 (súgó-kép frissesség = deploy-kapu), ADR-0065/0066/0076 (terv-jóváhagyási kapu) ·
**Kontraktus:** `assets/design-refs/tenant-admin/admin-linear/`.

**Kiváltó.** A tulaj (2026-09-24, két képernyőképpel): a tenant-admin navigációja és kinézete
„nem szofisztikált”, sehol nincs vissza-út, a Fotók fül „nem képgaléria”, a fájlmező
„1995-ös”. Mérve igaz: a mobil alsó sáv 11 gombot tömött két sorba (186 px), egyetlen lapon
sem volt vissza-gomb vagy útvonal, a Fotók csempénként 5 űrlapot és egy nyers
`<input type=file>`-t mutatott.

### ① A DÖNTÉS (három §2b kör)

1. **Az első kör — a mai admin átrendezése — ELVETVE.** Négy változat (csoportosított oldalsáv,
   fülsor + oldalpanel, ikonsáv + médialista, hub + mozaik) a mai tokenekből: a tulaj szerint
   „vicc”, „nézz utána, mik a trendek, légy drasztikus, mintha nem lenne bázis, csak a logó”.
   ⛔ Tanulság: a „újragondolás” kérésre a meglévő nyelv átrendezése NEM válasz.
2. **A második kör — négy gyökeresen új nyelv** (Linear-monokróm · Bento · Midnight-sötét ·
   Enterprise fa-menü), trend-forrásokkal és a tulaj Dribbble-referenciáival: **a „Linear” lett
   az alap.** Igényelt hozzá: minimalista szín, a Midnight előfizetés-kártyája, a Bento
   nyitókép-mutatója, világos/sötét mód.
3. **A harmadik kör — Linear + a négy elem, két oldalsáv-változat:** **„A” fehér oldalsáv**
   jóváhagyva; a „B” brand-navy elvetve.

### ② Amit a döntés jelent (a kontraktus README-je részletez)

- **Szín csak jelentésre**, EGY akcent (a logó ciánja); árnyék nélküli, hajszálvonalas,
  13 px-es, vékony-ikonos nyelv. A mai ciánpöttyös ikonkészlet az adminban kivezetve.
- **Navigáció:** csoportosított, számlálós, ikonsávvá csukható oldalsáv; minden lapon ← +
  útvonal; mobilon 4 fő pont + Menü (bal fiók). A 11-gombos alsó sáv kivezetve.
- **Áttekintés:** 3 widget (állapot · látogatók 7 nap · üzenetek) + **nyitókép-mutató**
  („Cserélje sajátra”) + teendő-lista; **előfizetés-kártya** a sávban (valós hónap/12).
- **Fotók:** húzza-ide sáv (fájlmező rejtve), rács/lista, hover-műveletek, nagyítás, kijelölés
  + tömeges törlés; a feltöltés szabályai változatlanul a `/admin/photos`-é (ADR-0198).
- **Világos/sötét mód** váltóval, megmaradó választással, „fehér lyuk” nélkül.

### ③ Hatókör, sorrend, kapuk

- Fájlok: `public/assets/ui/citui-admin.css` (csere), `citui.css` (sötét tokenek),
  `src/server/adminViews.ts` (shell, nav, overview, photosCard, UPLOAD_SCRIPT), `src/ui/icons.ts`.
- Sorrend: ① keret + navigáció + téma (minden fül kapja) → ② Áttekintés → ③ Fotók → ④ súgó-képek
  újralövése (ADR-0220 kapu) + KB-szövegek, ahol felirat változott (a „Kiválasztott fotók
  feltöltése” gomb megszűnik → a súgó és az Elek-forgatókönyvek idézeteit grepelni KELL).
- Kapuk: i18n (minden új felirat `T()`), design-token-lint (nyers hex tilos — a mock hexei csak
  a mockban), kb-check + kb-shot frissesség, `admin-linear-check.mts` (a README „Őr” szakasza).

### ④ Amit NEM dönt el

A ⌘K kereső működését (csak a helyét köti); a konzol (operátori) felületét; a többi fül belső
elrendezését (a keretet kapják, saját kört nem).
