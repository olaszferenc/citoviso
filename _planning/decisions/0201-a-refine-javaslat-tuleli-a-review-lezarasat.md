## ADR-0201 — A REFINE-javaslat túléli a review lezárását: döntési sor, amit a gép sosem zár le

**Dátum:** 2026-09-22 · **Státusz:** elfogadva · **Horgony:** `04-INDEX` (desztilláló), ADR-0200

### A lelet

A desztilláló háromféle javaslatot ad. A PROMOTE ÚJ tudást tesz hozzá — azt a gép átvezeti. A
**REFINE a MÁR MEGLÉVŐ kanonikus szöveget írná át**, ami a legkockázatosabb művelet, ezért
SOHA nem automatikus: mindig ember dönt.

⛔ **Csakhogy a javaslat nem is VÁRT MEG senkit.** A `distill-apply.mts` `listReviews()`-a
kiszűr minden review-t, aminek a bélyege az `_inbox/applied/`-ban van — **még azelőtt**, hogy a
tartalom-alapú idempotencia lefutna. PROMOTE-nál ez helyes. REFINE-nál végzetes: **a review
lezárása MAGA az a művelet, ami a javaslatot örökre eltemeti.** Mérve 2026-09-19: **23
REFINE-blokk** állt így, elérhetetlenül.

⚠️ És a kód egy kommentben pont az ellenkezőjét ígéri: *„Deliberately NOT gated on the ledger —
if the owner throws the branch away, the proposal must come back, not vanish silently."* Az
ígéret a még PÁROSÍTATLAN review-kra igaz; a lezártakra nem. Egy komment, ami hamisat állít a
mellette álló kódról, rosszabb, mint a hiányzó komment.

⭐ **NEM ELMÉLETI KÁR.** Az egyik eltemetett javaslat (2026-08-02) SZÓ SZERINT kimondta, hogy a
`watermarked` flag halott kód, és hogy a vízjel-detektálás a portál-fotó-ingestnél KÖTELEZŐ.
Hét hétig ült az `applied/`-ban. Ugyanezt a lyukat 2026-09-19-én egy FÜGGETLEN mérésből
fedeztük fel újra (ADR-0200) — a válasz már megvolt, csak elérhetetlen.

### A döntés

**① SZÁRMAZTATOTT SOR, NEM MÁSOLT LISTA.** A sor nem egy fájl, amibe a javaslatok szövegét
bemásoljuk (az két igazságot adna, és elcsúszna a forrástól). A sor SZÁMÍTOTT:
`nyitott = MINDEN REFINE-javaslat (inbox ∪ applied) − amiről EMBER már döntött`.
Az egyetlen új tartós állapot a DÖNTÉS: `_tools/REFINE-DECISIONS.md`, commitolt.

**② A GÉP SOHA NEM ZÁR LE TÉTELT.** Nincs „elavult, ezért kidobom" ág. A lezárás emberi, és
**az indoklás KÖTELEZŐ** — indoklás nélküli lezárás hiba, nem alapértelmezés. A néma elnyelés
pont az a hibaosztály, ami ezt a szerszámot szükségessé tette.

**③ A NYERSANYAG A GITBEN VAN.** A 23 blokk nem veszett el: az `_inbox/applied/*.md`
commitolt. Ami törött volt: semmi nem hozta őket többé elő. A `collectRefineProposals()` a
review LEZÁRÁSÁTÓL FÜGGETLENÜL olvas.

**④ AZ ÉRTESÍTŐ IS SZÓL RÓLUK.** A heti értesítő (ADR előtti munka) eddig csak a review-kat
nézte — vagyis a gyökérok egy réteggel beljebb változatlan maradt: a gép szólt a review-ról és
hallgatott az eldöntetlen javaslatról. A `plan()` mostantól a nyitott REFINE-ra is megszólal,
KÜLÖN megnevezve, és megadja a sor megnyitásának parancsát.

### Két további ÉLES hiba, amit ugyanez a kör tárt fel

**⛔ A jóváhagyható ág nem jött létre — a „kör bezárult" élesben NEM állt.** A 2026-09-20-i cron
létrehozta a `wt/distill20260920` worktree-t, majd a `git commit` ELBUKOTT: a friss worktree-ben
nincs `node_modules` és `.env` (a `git worktree add` csak a KÖVETETT fájlokat hozza), ezért a
pre-commit őrei `ERR_MODULE_NOT_FOUND`-dal elszálltak. Eredmény: *„review megvan, jóváhagyható
ág nincs"* — pont az, amit a szerszám megszüntetni hivatott. **Javítva:** az átvezető kirakja a
`node_modules` / `.env` / `sites` symlinkeket (a watchdog `rc-wt-prepare.sh` mintája), és a
symlink bukása HANGOS. Élesben újrafuttatva: az ág (`wt/distill20260922`) commitolva létrejött.

**⛔ Az ág-felismerő IDEGEN munka-ág törlését ajánlotta.** A `git branch --list "wt/distill*"`
laza globja illeszkedett a `wt/distillnotify` ágra — egy EMBER munka-ágára —, és a szerszám azt
írta ki róla, hogy „nyugodtan törölhető", kész `branch -D` paranccsal. **Javítva:** a minta a
dátum-alakra szűkít (`^wt/distill\d{8}$`); az őr pozitív ÉS negatív példákkal is kitűzi.

### Őr

`scripts/refine-queue-check.mts` — 28 állítás, 14 fixture-mérés, diff-scope-olva. Méri a
TÚLÉLÉST (lezárt review javaslata előjön), hogy a döntés csak a SAJÁT tételét tünteti el, hogy
a puszta betöltés NEM ír a döntés-fájlba, az indoklás kötelezőségét, a fail-closed kapcsolót, a
stabil azonosítót, az értesítő megszólalását nyitott REFINE-ra, és az ág-felismerő szűkítését.
Négy szabotázs, mind elkapva — mindegyiknél BIZONYÍTVA, hogy a csere meg is történt.

⚠️ **Saját hiba, MÁSODSZOR:** az első szabotázs nem pirosra ment, hanem ÖSSZEOMLOTT (a guard
`q1.all[0].id`-t olvasott üres tömbön), a záró összegzés és a takarítás előtt, egyetlen lelet
nélkül — `rc=1`-gyel, tehát „elkapva"-nak látszott. Ugyanez a testvér-őrben már megtörtént és
memóriába is került; **a javítás nem terjedt át magától.** Most mindkettőben ott az
összeomlás-háló.
