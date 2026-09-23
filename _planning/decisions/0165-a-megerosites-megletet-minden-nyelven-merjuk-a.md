## ADR-0165 — A megerősítés MEGLÉTÉT minden nyelven mérjük; a konzol natív dialógusa marad, de őrzött

**Dátum:** 2026-09-14 · **Státusz:** elfogadva · **Kontextus:** operátor-konzol (megkeresés +
mock-kezelés); az ADR-0150 felmérésében nyitva hagyott tétel lezárása

**A probléma, mérésből.** Az ADR-0150 felmérése a konzol natív dialógusait „szándékosan kívül"
tette, azzal, hogy ott a dialógus visszafordíthatatlan KIKÜLDÉST véd. A tulaj kérésére
megnéztük őket egyesével — és az első mérés két dolgot cáfolt:

1. **Nem 6, hanem 7.** A `main` közben mozgott, és az ADR-0150-ben rögzített darabszám a
   leírás pillanatában már elavult volt. (A saját összefoglaló sor mint hamis premissza —
   ezért a romboló/általánosító állítás előtt ÚJRAMÉRÉS jár, akkor is, ha a saját számunkat
   kapjuk vissza.)
2. **⛔⛔ EGY KÖZÜLÜK MA IS TÖRIK — ADATVESZTÉS-KOCKÁZAT.** A „jóváhagyott mock törlése"
   (`console/views.ts`) `onsubmit="return confirm('…')"`-je a szöveget `jsStr()` NÉLKÜL kapta.
   A MAGYAR forrásban nincs aposztróf — **a fordításban van**: `en` „It **hasn't** been sent
   yet", `it` „**l'operazione** è irreversibile". Mindkét nyelven a kezelő SyntaxError lett,
   tehát a `confirm()` **soha nem futott le**, és a jóváhagyott mock törlése **megerősítés
   nélkül** ment a szerverre. Valódi böngészőben mérve a javítás előtt:
   `hu` dialógus=1 → megállítva · `de` dialógus=1 → megállítva ·
   **`en` dialógus=0, JS-hiba=1 → ELMEGY** · **`it` ugyanaz**.
   Pontosan az a hibaosztály, amiről a `jsStr()` saját docstringje és az ADR-0150 szól.
3. **Egy LAPPANGÓ pár** (`views.ts` „link másolása"): ma csak azért ép, mert egyetlen
   csomagban sincs aposztróf abban a feliratban. A csomagok AI-generáltak
   (`language_pack.status='generated'`), tehát ez **szerencse, nem garancia**.

**A döntések (tulajdonosiak, 2026-09-14).**
① **Escape-fix most, §2b kivétellel** — a felirat szövege és kinézete változatlan, csak a
`esc(jsStr(…))` burkolás kerül rá, ugyanaz a minta, mint a másik hat kezelőben. A kivételt a
tulaj adta, nem a session (a felület-kapu blokkolt, és helyesen).
② **A rendszer-modál a konzolon KÜLÖN KÖR.** A hét dialógus ma visszafordíthatatlan
kiküldést véd; az átszabás valódi tervezői döntés, saját §2b körrel. Most a mért hiba és az
őr megy.
③ **A megerősítés MEGLÉTE mérendő tulajdonság**, nem kód-konvenció: az őr a RENDERELT lapon,
valódi böngészőben, MINDEN nyelvi csomagon méri, hogy a kérdés tényleg lefut-e — plusz egy
**ellenséges ál-csomagon** (`zz`), amely minden feliratba beleteszi az `'`, `"`, `\` hármast.
A ② az, ami a lappangó helyeket fogja meg: ott a mai zöld szerencse, nem garancia.

**Az őr: `scripts/dialog-fires-check.mts`** (pre-commit, `src/console/views.ts` érintésekor).
8 vezérlő × 8 nyelv. Védett vezérlőnél: a kattintás PONTOSAN EGY dialógust vált ki, a
beküldés TÉNYLEG ELINDUL, és elutasításra MEGÁLL. Sima kezelőnél: nincs JS-hiba és a hatás
bekövetkezik. Plusz FEDETTSÉG-állítás nyelvenként.
**Piros önteszt: 9 bukás, MEGNEVEZETT halmazon** — piros `en`, `it`, `zz`; ZÖLD `hu`, `de`,
`hr`, `pl`, `sk`. A kétirányú elvárás a lényeg: a piros ott legyen, ahol a fordítás
aposztrófot tartalmaz, és ott NE, ahol nem — így az önteszt a fordítás TARTALMÁRA mér, nem
arra, hogy „elrontottunk valamit".

**Két csapda, amit maga az őr termelt (és amiért a fentiek így vannak megfogalmazva).**
⛔ **Üresen igaz állítás:** az első változat csak azt mérte, hogy a beküldés „megállt-e" — a
küldő-sáv viszont LETILTJA a gombokat, amíg a levél vége (`#cit-letter-end`) nem járt a
képernyőn, így a kattintás el sem indította a submitot, és a „megállt" ZÖLD lett **nulla
dialógus mellett is**. Ezért van külön állítás arra, hogy a beküldés TÉNYLEG ELINDULT.
⛔ **A szelektor a terméket vádolta:** a lapon három vágólap-gomb van (tárgy · SMS-szöveg ·
levéltörzs); a `.first()` a TÁRGY gombját mérte, ami szándékosan nem kérdez — az őr mind a 8
nyelven „hibát" jelentett egy ép felületre. A cél most `#mailbody`.
⭐ Kimondva, mi marad tudatosan megerősítés nélkül: a **tárgysor** és az **SMS-szöveg**
másolása. A MÁSODIK PÉLDÁNY kockázata a levél szövegéhez tapad, nem a tárgysorhoz.

**Visszafordíthatóság:** 🔄 a javítás két `esc(jsStr(…))` burkolás; az őr külön fájl, a
pre-commit blokk egy `if`. A felület kinézete nem változott.
