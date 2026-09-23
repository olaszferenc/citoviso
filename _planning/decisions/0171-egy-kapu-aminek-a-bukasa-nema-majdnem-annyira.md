## ADR-0171 — Egy kapu, aminek a bukása NÉMA, majdnem annyira használhatatlan, mint egy meg sem hívott (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** elfogadva (tulajdonosi utasítás: „vidd végig a 66 elnyomott
kapu javítását") · **Kapcsolódó:** ADR-0152 (a `guard-wiring-check` — ez annak a PÁRJA),
ADR-0052 (a `land.sh` ugyanezt a kapu-sort futtatja), ADR-0147 ③ (piros önteszt minden őrhöz),
ADR-0101 ① (a lelet, amit a néma kapu elrejtett: nincs „a(z)”).

**Kiváltó (mérve 2026-09-14/15, a lead-lap körében).** A `hooks/pre-commit` a kapuk többségét
`>/dev/null`-ra futtatta, a hook pedig `set -e`-vel fut. Egy BUKÓ kapu kimenete ezért
nyomtalanul eltűnt: a napló annyit mutatott, hogy a kapu fejléc-sora, majd **semmi**.

⛔ **Ez nem hamis zöld** — a bukás bukás volt, a commit nem jött létre. Ez **diagnosztizálhatatlan**
bukás, és pont akkor a legdrágább, amikor a legnagyobb a baj. Mérve, mit került: **három
diagnosztikai kört**. Először azt hittem, a harness folyamat-csoport-takarítása öli meg a
commitot; `nohup`-pal indítottam újra, ugyanott szakadt meg; OOM-ot gyanítottam, `dmesg`-et
olvastam (nem volt friss OOM, 12,7 GB szabad); végül `tmux`-ba menekítettem a commitot, és ott
lett látható a `EXIT=1`. Csak ekkor futtattam le a kaput kézzel — és **valódi leletet talált**:
egy „a(z)" a felhasználói szövegben, pont abban a mondatban, amit a nyers `superseded_by:<uuid>`
HELYETT írtam, hogy emberi legyen. A megtalálása órák, a javítása percek voltak.

⚠️ A rossz diagnózist a saját mérőeszközöm is táplálta: a `pgrep -f "git commit -q -F"`
élet-próbám egy 5 óra 51 perces **várakozó shellre** illeszkedett (annak a parancssorában benne
volt a minta), ezért **háromszor jelentettem „fut"-ot egy halott folyamatra**. A néma kapu és a
hazudó élet-próba együtt adta ki azt a képet, hogy „valami megöli a commitot".

**A döntés.**

① **Bukó kapu kimenete SOHA nem nyelhető el.** A kapu stdout-ja fájlba megy (`$GATE_LOG`), és
**csak bukáskor** kerül kiírásra, a kilépési kóddal együtt. A bukó kaput a közvetlenül előtte
álló `[pre-commit] …` sor nevezi meg, tehát a nevet nem kell minden hívásba beírni.

② **A SIKERES futás marad csendes.** A `>/dev/null`-nak volt jogos szándéka: 129 kapu teljes
kimenete olvashatatlanná tenné a naplót. Ezt megtartjuk — csak a bukást nem nyeljük el.
⛔ **A stderr SZÁNDÉKOSAN átfolyik**, ahogy eddig is (a `>/dev/null` sem fogta), így a zöld
futás viselkedése **bitre ugyanaz** marad. Egy „javítás", ami zajosabbá teszi a zöld futást,
azt a szokást neveli ki, hogy senki nem olvassa a naplót.

③ **A hívás alakja UTÓTAG, nem burkoló előtag** (`… >"$GATE_LOG" || gate_failed`). Ez nem
stílus: a `guard-wiring-check` (ADR-0152) a **sor elejére horgonyozva** ismeri fel a bekötést
(`/^\s*(?:npx tsx|node)\s+scripts\/…/`), egy `run_gate `-előtag tehát a kapuk többségét
**„bekötetlennek"** jelentette volna. Mérve igazolva: a felismert halmaz a transzformáció előtt
és után **azonos** (127 és 123 találat a két felismerővel).

④ ⭐ **ŐR TARTJA ÉLETBEN, KÜLÖNBEN VISSZAROHAD:** `scripts/gate-output-check.mts`, két rétegben.
① SZERKEZETI: egyetlen kapu-hívás sem küldheti a stdout-ját a `/dev/null`-ra. ② VISELKEDÉSI: a
**szállított** segédfüggvényt kivágja a hookból és élesben lefuttatja — bukó kapunál a kimenet
megjelenik és a kilépési kód átjön, sikeres kapunál csendes marad, a stderr mindkét esetben
átfolyik. ⛔ A ② azért a **kivágott eredetivel** fut, nem egy újraírt másolattal: egy másolat
azt bizonyítaná, hogy az én elképzelésem működik, nem azt, hogy a hookban lévő kód.
A `guard-wiring-check` azt őrzi, hogy az őr **meghívódik**; ez azt, hogy a **bukása olvasható** —
a kettő együtt zárja a kört.

**A TRANSZFORMÁCIÓ MÓDJA IS DÖNTÉS VOLT.** 79 hívási hely egy olyan fájlban, amit ~25 szál
szerkeszt: ⛔ vak `sed` nem jöhetett szóba (ebben a fájlban egyszer már két IDEGEN szál munkáját
rontotta el). Mért, **fail-closed** szkript futott: a `write` az utolsó utasítás, bármelyik
állítás bukása esetén semmit nem ír ki.

⭐ **És a kiírás előtti utó-feltétel VALÓDI rést fogott meg.** A mintám csak
`npx tsx scripts/*.mts|.mjs`-t ismert, közben két ÚJ kapu **`.ts`** kiterjesztéssel landolt
(`offer-selftest.ts`, `period-switch-selftest.ts`). A „0 elnémított maradhat" feltétel elhasalt,
és a szkript nem írt ki semmit. ⛔ **Ugyanez a vakság az ŐRBEN is benne volt** — a `GATE`-regexe
szintén `.mts|.mjs`-re kötött, tehát „0 elnémított kaput" jelentett volna, miközben kettő néma
marad. Egy szűk felismerő ugyanúgy hamis zöldet ad, mint egy hiányzó állítás; mindkettő
javítva, és a darabszám-állítás **alsó korlátra** váltott (egy beégetett 75-es szám csak annyit
érne el, hogy a javítás holnap nem fut le, mert a fájl közben hízik).

**ÉLES, VÉGPONT-VÉGPONT BIZONYÍTÉK** (nem csak a harness): egy szándékosan bukó próba-kaput
tettem a hook élére, és egy valódi `git commit` ezt írta ki — „⛔ EZ A KAPU ELBUKOTT (kilépési
kód: 4). A kimenete, amit eddig a >/dev/null elnyelt:" + a két sor, amit korábban elnyelt volna.
A próba utána eltávolítva; commit nem jött létre.

**Amit a saját őröm ELSŐ futása fogott meg magán** (mindkettő az én hibám, nem a mechanikáé):
· az osztályozóm **szó szerinti egyezést** várt a redirekt-alakra, és ezért egy HELYES sort
  (`hu-machine-form-check --fast`) jelentett hibásnak — vég-illesztésre váltott.
· a „sikerkor a stderr átfolyik" állítás **üres sztringen mért**, mert az `execFileSync` SIKER
  esetén csak a stdout-ot adja vissza (a stderr csak a hiba-objektumon él) — `spawnSync`-re
  váltott. A mérőeszköz hibája volt, nem a mérendőé.
· a piros önteszt először **csak az ① réteget** buktatta; a ② ág piros kontroll nélkül maradt
  volna, ezért az önteszt most a kiírást is kiüti (ADR-0164: „egy önteszt, ami az első szabály
  után megáll, a többiről semmit nem mond").

**Hatókör-korlát.** A 47 „natúr" kapu (ami eddig is kiírta a kimenetét) változatlan — azok
sosem voltak némák. A `land.sh` ugyanezt a hook-ot futtatja, tehát a javítás a landolási
kapu-sorra is áll, külön változtatás nélkül.

**Visszafordíthatóság:** 🔄 fejlesztői eszköz-szintű; nulla termék-kód, nulla migráció, nulla
adat-mozdulat. A zöld futás megfigyelhető viselkedése változatlan.
