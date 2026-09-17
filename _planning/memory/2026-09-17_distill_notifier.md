# 2026-09-17 — A desztilláló ÉRTESÍTŐJE: a némaság gyökérokának megszüntetése

**Feladat:** a testvér-szál (`2026-09-17_ontology_loop_closed.md`) nyitott ①-es tétele: a
`distill.sh` hook-pontja él, de a `notify.sh` nem létezik. Írjam meg, bizonyítsam, hogy működik —
és hogy akkor is helyesen viselkedik, amikor nem kellene szólnia.

## A MÉRÉS (a bemenetet újraellenőriztem, ahogy a feladat előírta)

- **A hook-pont igazolva:** `distill.sh:151-156` — `NOTIFY="$TOOLS/notify.sh"; if [ -x "$NOTIFY" ]`.
  A fájl nem létezett, tehát a `[ -x ]` mindig hamis volt, és a lépés **némán kimaradt**.
  A `notify.log` (a `_inbox/`-ban, gitignore-olva) sosem keletkezett — most igen.
- **Cron:** `0 4 * * 0`, a **fő fa** `distill.sh`-ját futtatja `citoviso` userként.
- **A predikátum már létezett és exportált:** `readCorpus()` + `judge()` a frissesség-őrből.
  A konjunkció: *párosítatlan* ÉS *érdemi tudást hordoz* (`suggestions > 0 || unparsed`).
  **Nem írtam újra** — egy szabály két példányban két igazság.
- **A konkrét útvonalak megvoltak:** `distill-apply.mts:736-738` képzi (`slug=distill<ÉÉÉÉHHNN>`),
  és már ki is írja a három parancsot. ⚠️ De a kimenetét (`.apply-out.txt`) a `distill.sh:146`
  **törli a notify-hook ELŐTT** — ezért az értesítő nem olvashatja, képeznie kell.

**Csatorna-mérés** (a választás tulajdonosi döntés volt, megkérdeztem):

| Csatorna | Mért állapot | Verdikt |
|---|---|---|
| MMS (`mms-send`) | csak JPEG, root, ~90 mp, közben áll az SMS-relé, ASCII tárgy | ⛔ **képes** csatorna; az üzenet szöveg (útvonalak, parancsok) |
| SMS (`SMS_PROVIDER=gammu`) | ÉLES, `gammu-smsd` aktív, `OWNER_ALERT_PHONE` megvan | ✅ a megszakítás |
| E-mail (`EMAIL_PROVIDER=smtp`) | ÉLES (Zoho) | ✅ a cselekvőképes törzs |

**Tulajdonosi döntés: SMS + e-mail együtt** (a ház `aamAlert.ts` mintája), és **a felhalmozásról
is szóljon** olyan héten, amikor nem született új review.

## SZÁLLÍTVA

- **`_planning/DOMAIN/_tools/notify.sh`** (új, +x) — vékony bash-belépő, mert a hook ezt tudja hívni.
- **`_planning/DOMAIN/_tools/notify.mts`** (új) — a döntés (tiszta függvény), az üzenet és a két nyelő.
- **`scripts/distill-notify-check.mts`** (új) — 57 állítás, 17 fixture-mérés, diff-scope-olva bekötve.
- `distill.sh` — `fire_notify()`; hívás **mindkét** ágon (friss review UTÁN + a felhalmozás korai
  kilépése ELŐTT); a hiányzó notify.sh ága mostantól **hangos**, nem néma.
- `distill-apply.mts` — `branchPaths()` **exportálva** (egy útvonal-forrás, két olvasó) + main-guard.
- `domain-inbox-freshness-check.mts` — main-guard (a modul importálható lett).
- `04-INDEX.md` — a kötelező belépőpont kimondja, hogy a tulaj mostantól értesül.

**A négy tervezési szabály, ahogy megvalósult:**
1. **Csak akkor szól, ha van mit dönteni** — a `judge()` `emptyRuns`-ából származtatva.
2. **Az üzenet cselekvőképes** — a három parancs KONKRÉT útvonallal, és **csak LÉTEZŐ ágat nevez
   meg** (a `git branch --list` a forrás); ha nincs ág, a valódi következő lépést adja.
3. **Fail-closed kapcsoló** — `--mode=send` nélkül nem küld; ismeretlen kapcsoló/érték = exit 2.
   A `--dry` (a `--dry-run` elgépelése) **hibára fut**, nem néma kikapcsolásra.
4. **Hangos dry-run** — ha lenne mit küldeni, de nem `send` módban futunk, azt kimondja.

## BIZONYÍTÁS

**Öt szabotázs, mind elkapva** (visszaállítás bájtazonosan ellenőrizve): elveszett `+x` bit ·
elnémulás valódi döntés-halmazra · zaj üres futásra · hazug (nem létező) útvonal · a `--mode=send`
elvesztése a hookból.

**Végponttól végpontig:** a valódi `distill.sh` felhalmozás-ága lefuttatva (`--mode=send`-del) —
a hook tüzelt, megírta a `notify.log`-ot, és helyesen **néma** maradt. A `liveSink()` relatív
dinamikus importjai feloldódnak (`sendSms` / `getEmailSender` / `getAlertRecipients` = function),
tehát a küldő ág nem importnál hasal el.

**A teszt saját mellékhatása MÉRVE**, nem állítva: PATH-csapda (álnok `sudo`,
`gammu-smsd-inject`, `mms-send`) → üres; `outbox/`, `outbox-sms/` és a gammu kimenő sor
változatlan; statikusan bizonyítva, hogy a küldő modulok **nem** static importtal jönnek.

## ⛔ SAJÁT HIBÁIM

1. **A mérőeszközöm némította el a saját bizonyítékát.** A „hangos dry-run" üzenet stderr-re megy,
   én viszont `execFileSync`-kel mértem, ami **sikeres futásnál csak a stdout-ot adja vissza** →
   az állítás pirosra ment egy **hibátlan** terméken. `spawnSync`-re cseréltem.
2. **⛔⛔ Az őröm ÖSSZEOMLOTT piros helyett.** Az „némuljon el" szabotázsnál kezeletlen ENOENT-tel
   szállt el (a rögzítő-fájl nem jött létre) — **a záró összegzés, a mellékhatás-mérés és a
   takarítás ELŐTT**, így **egyetlen leletet sem írt ki**, csak egy stack trace-t. Az exit-kód 1
   volt, tehát „elkapta" — de ez nem lelet, hanem diagnosztizálhatatlan bukás. Ha nem nézem meg a
   teljes kimenetet, ezt „S2 elkapva"-ként könyveltem volna el. Javítva: összeomlás-háló
   (`uncaughtException`/`unhandledRejection` → nevesített lelet + takarítás + összegzés).
3. **Az útvonal-állításom az ÁG NEVÉT is fájlnak nézte** (`wt/distill…` tartalmaz `/`-t), és a
   fixture-ből hiányzott a `DISTILL-PENDING.md` — a saját őröm ment hamis pirosra.
4. **Kétszer is importálható-nak hittem egy top-level futtató modult.** Mind a frissesség-őr, mind
   a `distill-apply` azonnal futott volna importáláskor és `process.exit`-tel megölte volna a
   hívót — vagyis az értesítő némán elhalt volna. Main-guard mindkettőbe; utána **külön mérve**,
   hogy önállóan futva változatlanul működnek.

## NYITOTT (nem az én hatásköröm — a tulajé a döntés)

- ① A `03-INVARIANTS §A.2` vízjel-kizárás élesben soha nem tüzel: a `watermarked` flaget a
  termelési úton semmi nem állítja `true`-ra.
- ② 12 „ÉLŐ" REFINE vár a `_tools/DISTILL-PENDING.md`-ben.
- ③ **Amit ez a munka NEM bizonyít:** az éles transzportot (valódi SMS/SMTP) egyetlen teszt sem
  futtatta — szándékosan. Az első ÉLES megszólalás a következő vasárnapi cron lesz, olyan héten,
  amikor tényleg áll feldolgozatlan review. Az éles korpusz ma **0 párosítatlan** (a testvér-szál
  mind a 12-t átvezette), ezért az „élesben néma" futás önmagában semmit nem bizonyít — minden
  érdemi állítás fixture-ön fut.
