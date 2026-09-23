## ADR-0070 — Nyelvi őr MINDEN kimenő levélre (a hideg megkeresés a lyuk)

**Dátum:** 2026-08-26 · **Státusz:** ELFOGADVA (tulajdonosi rendelet: *„Minden emailre language
őr kell, hogy mindig megfelelő nyelven menjen ki. Ez kritikus a leadek megszerzésének."*) —
**① KÉSZ** (`a8304ee`, párhuzamos szál — iker-munka, a kánon az övék): a `draft.ts` a közös
listára került, szövegei `T(d.lang, …)` burkolást kaptak, a `DraftInput.lang` KÖTELEZŐ mező
lett, és az őr harmadik vakfoltja (tagkifejezés a `T()` első argumentumában) javítva.
**②③ IS KÉSZ** (ez a szál): a lista SZÁRMAZTATÁSA + a futásidejű kapu + a levezetés 4 új
lelete — részletek lent a Végrehajtás szakaszban. Egy tartalmi finomítás az ①-en: a nyelv
forrása a MOCK nyelve (fallback az ország) — a levél és a linkelt oldal nem mondhat mást.
· **Kapcsolódó:** ADR-0067 (a vevőnek küldött szöveg a vevő nyelvén),
ADR-0036 (ország-kapu), ADR-0063 (többnyelvű modul), 03-INVARIANTS §B.18.

**A mért állapot (2026-08-26).** Az i18n-őr közös fájllistája (`scripts/i18n-sources.mjs`)
14 fájlt fed, köztük a levél-lánc nagy részét:

| fájl | `T()` hívás | őrzött? |
|---|---|---|
| `src/email/invoiceEmail.ts` | 20 | ✅ |
| `src/email/loginEmail.ts` | 12 | ✅ |
| `src/email/mockRequestEmail.ts` | 14 | ✅ |
| `src/email/outreachEmail.ts` | 1 | ✅ |
| **`src/outreach/draft.ts`** | **0** | **⛔ NINCS a listán** |

A `draft.ts` állítja elő a hideg megkeresés **teljes tárgyát és törzsét** — vagyis épp azt a
levelet, amiből a leadek születnek —, és végig beégetett magyar.

**Miért nem robbant eddig.** Egy MÁSIK kapu fedi el: az ADR-0036 ország-kapu FLAG-eli a nem-`hu`
nyelvterületre menő outreachet, tehát ma minden címzett magyar. Ez nem védelem, hanem VÉLETLEN
lefedés — abban a pillanatban, hogy az ország-kapu kinyílik (első külföldi piac), minden lead
magyarul kapja a megkeresést, és egyetlen kapu sem szól.

**Ez a hibaosztály MÁSODSZOR fordul elő.** Az ADR-0067 pontosan ezt állapította meg: „a doktrína
hatóköre = az őr FÁJLLISTÁJA", és akkor került föl az `src/email/*`. A `draft.ts` kimaradt —
tehát a javítás a TÜNETET kezelte (a konkrét fájlokat), nem az OKOT (hogy a lista kézi).

**Döntés.**
1. `src/outreach/draft.ts` (és az SMS-piszkozat) felkerül az `I18N_SOURCES` listára, a szövegei
   `T(d, "…")` burkolást kapnak, a kulcs a magyar forrás-string (§B.18).
2. **A lista ne kézi legyen.** Az őr magától találja meg, mi megy a vevőnek: minden fájl, amely a
   levél-adapterbe (`EmailSender`) vagy a renderelt vevő-oldalra ír, automatikusan hatókörbe kerül
   (import-gráf a `sender.ts`/`buildOutreachEmail` felől), a kézi lista csak KIVÉTELT rögzíthet,
   indoklással. Amíg a lista kézi, ez a hiba harmadszor is meg fog történni.
3. **Az őr azt mérje, ami számít:** ne csak a burkolás meglétét, hanem hogy a lead nyelvén
   ténylegesen VAN kimenet — a `PackStatus`/`missing===0` mintát (ADR-0063) a kimenő levélre is rá
   kell húzni, és hiányzó fordításnál a küldés inkább álljon meg, mint hogy rossz nyelven menjen ki.
4. Piros önteszt kötelező (feedback_guard_must_measure_what_matters): szándékos beégetett
   stringgel buknia kell.

### Végrehajtás (2026-08-26)

**① A lyuk:** `src/outreach/draft.ts` teljes tárgya+törzse+SMS-e `T(d.lang, "…")` alatt; a
`DraftInput.lang` KÖTELEZŐ mező (hívó nem felejtheti el), a nyelv a MOCK nyelve (a levél és a
linkelt oldal nem mondhat mást), fallback az ország. A magyar kimenet bitre változatlan
(próbákkal igazolva); a lengyel draft élőben renderelve helyes.

**② A származtatott hatókör:** `scripts/i18n-scope.mts` — a levél-adapter importálóiból
(seed) + azok közvetlen importjaiból VEZETI LE, mely fájlok termelhetnek vevő-szöveget; ezeknek
vagy az I18N_SOURCES listán, vagy az INDOKOLT kivételek közt kell lenniük. ⚠️ Mérési döntés: a
TELJES import-lezárt 94 fájl volt, 30+ hamis pozitívval (scraper-promptok, őr-verdiktek) — az
eltemetett őr ignorált őr, ezért a hatókör seed+1 mélységű (minden valódi szöveg-építő ott ül,
mérve). Pirosra tesztelve: új magyar-szöveges fájl a levél-útvonalon azonnal bukik.

**A levezetés azonnal 4 további VALÓDI vevő-felületet talált,** amit kézi lista sosem hozott
volna: `demoFrame.ts` (a lead mockján ülő „előzetes terv" keret — most a mock nyelvén szól, és
a §A-kapu STRUKTURÁLIS `data-cit-demo-framing` markerre vált, hogy a fordított keret ne
számítson keretezetlennek), `heroShot.ts` (a levélbe ágyazott kép sávja), `tenant/prices.ts` és
`auth/tenantAuth.ts` (tulaj-hibaüzenetek). Az őr console-szűrője zárójel-egyensúlyos lett (a
többsoros operátor-log hamis pozitív volt).

**③ A futásidejű kapu:** `sendOutreachMail` nem-magyar leadnél a csomag-lefedettséget méri
(`missing > 0` → skipped, hangos okkal) — a fél-lengyel, fél-magyar levél átverésnek olvasódik,
a nem-küldés jobb, mint a rossz nyelvű küldés.

Katalógus: 1390 → 1410 string. Kapuk: i18n-lint + pszeudo + scope + önteszt mind zöld,
pre-commit-be kötve.

**Ára / kockázat.** A `draft.ts` szövege a tulaj hangolási felülete („The owner tunes the wording
HERE"). A burkolás nem teheti nehezebbé a hangolást — a magyar forrás-string marad a kulcs, tehát
a fájl továbbra is olvasható magyarul.
