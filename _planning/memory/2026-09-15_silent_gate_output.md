# 2026-09-15 — A néma kapu-bukás javítása (ADR-0171)

**Szál:** `wt/leadlistalap` · **Tulajdonosi utasítás:** „vidd végig a 66 elnyomott kapu
javítását". **Élesítés NINCS** (§0.3 — ez fejlesztői eszköz, nem termék-kód).

Ez a lead-lap köréből (ADR-0167) kibukó mellék-lelet önálló javítása. A leletet a tulajnak
jelentettem, ő pedig kérte a végigvitelt.

---

## A hiba, és mennyibe került

A `hooks/pre-commit` a kapuk többségét `>/dev/null`-ra futtatta, a hook pedig `set -e`-vel fut.
Egy BUKÓ kapu kimenete ezért **nyomtalanul eltűnt**: a napló annyit mutatott, hogy a kapu
fejléc-sora, majd semmi.

⛔ **Ez nem hamis zöld** — a bukás bukás volt, a commit nem jött létre. Ez
**diagnosztizálhatatlan** bukás, és pont akkor a legdrágább, amikor a legnagyobb a baj.

**Mérve, mit került: három diagnosztikai kört.**
1. Azt hittem, a harness folyamat-csoport-takarítása öli meg a commitot → `nohup`-pal
   újraindítottam, **ugyanott** szakadt meg.
2. OOM-ot gyanítottam → `dmesg` (nem volt friss OOM; 12,7 GB szabad memória).
3. `tmux`-ba menekítettem a commitot, és **ott** lett látható az `EXIT=1`.

Csak ekkor futtattam le a kaput kézzel — és **valódi leletet talált**: egy „a(z)" a felhasználói
szövegben (ADR-0101 ①), pont abban a mondatban, amit a nyers `superseded_by:<uuid>` HELYETT
írtam, hogy emberi legyen. **A megtalálása órák, a javítása percek voltak.**

⚠️ A rossz diagnózist a **saját mérőeszközöm** is táplálta: a `pgrep -f "git commit -q -F"`
élet-próbám egy **5 óra 51 perces várakozó shellre** illeszkedett (annak a parancssorában benne
volt a minta), ezért **háromszor jelentettem „fut"-ot egy halott folyamatra**. A néma kapu és a
hazudó élet-próba együtt adta ki azt a képet, hogy „valami megöli a commitot".

---

## Amit szállítottam

**A mechanika** (`hooks/pre-commit`): a kapu stdout-ja `$GATE_LOG`-ba megy, és **csak bukáskor**
kerül kiírásra, a kilépési kóddal. **79 hívási hely** átírva.

- ⭐ **A stderr SZÁNDÉKOSAN átfolyik**, ahogy eddig is (a `>/dev/null` sem fogta): a zöld futás
  viselkedése **bitre ugyanaz** marad. A `>/dev/null`-nak volt jogos szándéka — 129 kapu teljes
  kimenete olvashatatlanná tenné a naplót. Egy „javítás", ami zajosabbá teszi a zöld futást, azt
  a szokást neveli ki, hogy senki nem olvassa a naplót.
- ⭐ **A hívás alakja UTÓTAG, nem burkoló előtag** (`… >"$GATE_LOG" || gate_failed`). Ez nem
  stílus: a `guard-wiring-check` (ADR-0152) a **sor elejére horgonyozva** ismeri fel a bekötést,
  egy `run_gate `-előtag tehát a kapuk többségét **„bekötetlennek"** jelentette volna. Mérve
  igazolva: a felismert halmaz a transzformáció előtt és után **azonos** (127 és 123 találat).
- A bukó kaput a közvetlenül előtte álló `[pre-commit] …` sor nevezi meg, ezért a nevet nem kell
  minden hívásba beírni.

**Az őr** (`scripts/gate-output-check.mts`, bekötve, 13 pass / 0 fail, **3 piros önteszt**):
① SZERKEZETI — egyetlen kapu-hívás sem küldheti a stdout-ját a `/dev/null`-ra; ② VISELKEDÉSI —
a **szállított** segédfüggvényt kivágja a hookból és élesben lefuttatja (bukáskor megjelenik +
a kód átjön; sikerkor csendes; a stderr mindkét esetben átfolyik). ⛔ A ② a **kivágott
eredetivel** fut, nem másolattal: egy másolat azt bizonyítaná, hogy az ÉN elképzelésem működik,
nem azt, hogy a hookban lévő kód.

**ÉLES, VÉGPONT-VÉGPONT BIZONYÍTÉK** (nem csak a harness): szándékosan bukó próba-kaput tettem a
hook élére, és egy VALÓDI `git commit` ezt írta ki:

```
[pre-commit] IDEIGLENES PRÓBA-KAPU (mindjárt törlöm)…

⛔ EZ A KAPU ELBUKOTT (kilépési kód: 4). A kimenete, amit eddig a >/dev/null elnyelt:
──────────────────────────────────────────────────────────────────────
EZ A SOR EDDIG ELTUNT A /dev/null-BAN
  reszletek: 3 sertes a 42. sorban
──────────────────────────────────────────────────────────────────────
```

A próba utána eltávolítva; commit nem jött létre (`rc=1`, a HEAD nem mozdult).

---

## ⭐ A transzformáció módja is döntés volt — és az utó-feltétel valódi rést fogott

79 hívási hely egy olyan fájlban, amit ~25 szál szerkeszt. ⛔ Vak `sed` nem jöhetett szóba:
ebben a fájlban egyszer már két IDEGEN szál munkáját rontotta el
(`feedback_my_fixup_tool_damaged_another_thread`). Mért, **fail-closed** szkript futott — a
`write` az utolsó utasítás, bármelyik állítás bukásakor semmit nem ír ki.

**És pont ez fogta meg a rést:** a mintám csak `npx tsx scripts/*.mts|.mjs`-t ismert, közben két
ÚJ kapu **`.ts`** kiterjesztéssel landolt (`offer-selftest.ts`, `period-switch-selftest.ts`). A
„0 elnémított maradhat" utó-feltétel elhasalt, és a szkript nem írt ki semmit.
⛔⛔ **Ugyanez a vakság az ŐRBEN is benne volt** — a `GATE`-regexe szintén `.mts|.mjs`-re kötött,
tehát „0 elnémított kaput" jelentett volna, miközben kettő néma marad. **Egy szűk felismerő
ugyanúgy hamis zöldet ad, mint egy hiányzó állítás.** Mindkettő javítva.

⚠️ A darabszám-állítás **alsó korlátra** váltott a beégetett 75-ről: ez a fájl óránként hízik
(a mérés alatt 73 → 75 → 79 lett), és egy fix szám csak annyit érne el, hogy a javítás holnap
nem fut le. A biztonságot az alsó korlát + a kiírás előtti utó-feltételek adják.

## ⛔ Amit a saját őröm ELSŐ futása fogott meg MAGÁN

Mind a három az én hibám volt, nem a mechanikáé:

- az osztályozóm **szó szerinti egyezést** várt a redirekt-alakra, és ezért egy HELYES sort
  (`hu-machine-form-check --fast`) jelentett hibásnak → vég-illesztésre váltott.
- a „sikerkor a stderr átfolyik" állítás **ÜRES sztringen mért**, mert az `execFileSync` SIKER
  esetén csak a stdout-ot adja vissza (a stderr csak a hiba-objektumon él) → `spawnSync`.
  **A mérőeszköz hibája volt, nem a mérendőé** — és pirosra ment egy hibátlan mechanikán.
- a piros önteszt először **csak az ① réteget** buktatta; a ② ág piros kontroll nélkül maradt
  volna, ezért az önteszt most a kiírást is kiüti (ADR-0164: „egy önteszt, ami az első szabály
  után megáll, a többiről semmit nem mond"). Most 3 bukás, mindkét rétegen.

---

## Módosított / létrehozott fájlok

- `hooks/pre-commit` — segédfüggvény (`GATE_LOG` + `trap` + `gate_failed`), 79 hívás átírva,
  az új őr bekötve
- `scripts/gate-output-check.mts` — **új** őr, két réteg, 3 piros önteszt
- `_planning/DECISIONS.md` — ADR-0171
- `MEMORY.md`, `_planning/memory/INDEX.md`, ez a jegyzet

## Nyitott kérdések

- A `guard-wiring-check` **két őrt ma pirosnak jelent** az `origin/main`-en (adósság, nem az én
  szálam): `module-config-check` (elrohadt fixture — `source: "booking:xyz"`, a mai kód UUID-t
  olvas) és `lead-page-surface-check`, ami **TERMÉK-hiba**: aurora/mobilon a lebegő pirula a
  „Szabad időpontok megtekintése" CTA **23 %-át takarja**. Ez utóbbi a vevő-oldali lapon van.
- 47 „natúr" kapu változatlan (azok eddig is kiírták a kimenetüket) — nem voltak némák.
