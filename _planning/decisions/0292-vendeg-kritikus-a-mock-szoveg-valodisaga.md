## ADR-0292 — Vendég-kritikus: a mock-szöveg valódisága; véleményből nem lesz ajánlat, a vendég-oldal magáz (2026-10-01)

**Dátum:** 2026-10-01 · **Státusz:** elfogadva (SUB, koordinátor: CIT „élesi teszt” fő session; brief:
`~/rc-briefs/javitas-elek-0930/sz-szoveg-valodisag.md`; Elek élesi leletei SZ-1, SZ-2, SZ-3 MAGAS/KÖZEPES) ·
**Tulajdonosi döntések:** (1) véleményből jövő szolgáltatás = **„B — középút”**; (2) a vendég-oldal **MAGÁZ** —
mindkettő négy valódi lead előtte/utána összevetése alapján (kattintható HTML, mobil + asztal) ·
**Kapcsolódó:** §B.17 (tényhűség), ADR-0106 (vendég-vélemény mint tény- és hangnem-forrás), ADR-0012 / a
marketing-őr (kritika → egy visszacsatolt újragenerálás mintája), ADR-0218 (minta-programajánló — NEM változik).

**A tulaj szava.** „Továbbra is egy robot írja a szövegeket […] Nemcsak a tényhűség, hanem a VALÓDISÁG. Hol írnám
ki ilyet egy honlapra? Főtt reggeli? Nincs is ilyen fogalom.”

**A lelet, mérve — és ami a bejelentésben nem volt pontos.** Elek a Muschel-mock „bérelhető kerékpár / főtt reggeli /
bőséges saját parkoló” sorait forrástalannak írta. Élesen (csak olvasva) megnézve a mock forrás-paneljét: **mindhárom
forrásolt volt**, angol Google-vélemények idézetével — csak TÚLFORDÍTVA:
- „also borrowing us bicycles” (a házigazda kölcsönadta) → „bérelhető kerékpárok” (szívességből szolgáltatás);
- „Cooked breakfast with eggs” → „főtt reggeli” (tükörfordítás, nem létező fogalom);
- „Sufficient parking spaces” → „bőséges saját parkoló” (felfújás + hozzátett „saját”).
A tényhűség-kapu azt nézte, VAN-E idézet; azt nem, hogy az oldal TÖBBET mond-e, mint az idézet. A megszólítás:
ADR nem volt rá; a fix sablon-szöveg 49 helyen magázott és 1 helyen tegezett („várjuk a leveled”), a generált szöveg
pedig hol így, hol úgy („AMIT ITT KAPSZ”).

**Döntés.**
1. **Vendég-kritikus — második AI-szerep** (`src/generator/guestCritic.ts`). Egy igényes magyar szállóvendég és egy
   szerkesztő szemével bírálja a generált szöveget, TÉTELES kifogás-listával (idézet · típus · blokkoló/javítandó ·
   a vendég reakciója · javaslat). Az író (csak szöveg, fotó nélkül) PONTOSAN a kifogásokat javítja. Legfeljebb 2
   javító kör; a **legjobb kritizált kör** megy ki, nem vakon az utolsó (mérve: egy újraírás visszahozta az
   „ingyenesen” szót — a ciklus a jobb előző kört szállította). Blokkoló kifogás a végén → `guestCriticVerdict: flag`
   → a kiküldés-kapu (`mockVerdictGate`) a többi őr-verdikt mellett blokkol (kurátor-tudomásulvétellel küldhető, mint
   a többi). Hiba → `error` → szintén blokkol. Hol fut: `generateEngine` (a marketing-őr újragenerálása UTÁN, hogy
   az ne kerülje meg) és `recopy`. Csak MAGYAR oldalon fut (más nyelvre nincs verdikt — a hiány átmegy).
2. **Determinisztikus iker** (a prompt statisztikus, a szabály nem): megszólítás-keveredés, ismert tükörfordítások és
   AI-nyitások („főtt reggeli”, „X várja a vendégeket / a családokat”), ál-idézet a főcímben, **és a B-szabály ajánlat-
   szava**: „bérelhető / ingyenes / foglalható …” a szállás SAJÁT hirdetése nélkül mindig blokkoló. A gépi lelet nyer,
   ha a modell ugyanazt enyhébben ítéli. A kritikus csak fotóval igazolható tárgy (napozóágy, medence) elleni
   forrás-kifogása kiesik (a kritikus nem lát fotót). A későbbi körökben a kritikus gépi listát kap az újraíró által
   ÚJONNAN behozott szavakról (mérve: „túralehetőség” → „túravezetés”, egy ki nem ajánlott szolgáltatás).
3. **„B — középút” (tulaj):** vendég-véleményből ÁLLANDÓ adottság állítható, a vélemény erejéig, hűen fordítva;
   egyszeri élmény vagy szívesség soha, és véleményből nem lesz ajánlat. (Elvetve: „A — szigorú”, ahol a vélemény
   csak „a vendégek dicsérik…” keretben állhat; „C”, ahol minden véleményes tétel jelölést kap a lapon.)
4. **A vendég-oldal MAGÁZ (tulaj).** A generált szöveg is; a ház T/1-ben („mi”) beszélhet magáról. A sablon egyetlen
   tegező sora javítva („várjuk levelét”); egy őr pásztázza a sablonok vendég-szövegét.

**Mérés (4 valódi lead: Muschel élesről, Mandula, Artemisz, Laguna devből).** A fő hibaosztály (véleményből
szolgáltatás, tükörfordítás, felfújás, tegezés) minden futásban eltűnt, a valódi tények maradtak. Költség leadenként
~0,16–0,25 USD (2–3 kör); egy teljes mock a kritikussal ~0,43 USD (Laguna, bekötött úton mérve). **Ami marad:** a
modell futásonként szór (`temperature` ennél a modellnél tiltott); a „javítandó” szintű apróságok egy része
megmarad; a kritikus nem lát fotót.

**Őr.** `scripts/guest-critic-check.mts` (pre-commit, determinisztikus, AI és DB nélkül): sablon-magázás, a lint
pozitív és negatív kontrolljai, a B-szabály (véleményből bérelhető → piros, saját hirdetésből → zöld), a fotó-szűrő,
a legjobb-kör választás, és a bekötés (mindkét út futtat + perzisztál, a kapu blokkol). Mutációval igazolva: a
sablon visszategezése, a kapu-kulcs törlése, a recopy perzisztálásának törlése, az ajánlat-szabály kiiktatása, az
utolsó kör vak szállítása és a szolgáltatás-szűrő kiiktatása mind pirosra viszi.

**Nem része.** Az editorial-skin magazin-játéka („Szerkesztőség”, „Nyomtatva a világhálón”, drop-cap) és a
minta-programajánló (ADR-0218) sablon-döntés — ezekhez külön terv kell a tulajnak.

**Visszafordíthatóság:** 🔄 — a kritikus egy hívás a két generálási úton; a verdikt-kulcs hiánya átmegy a kapun.
