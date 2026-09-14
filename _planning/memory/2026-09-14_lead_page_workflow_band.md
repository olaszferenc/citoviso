# 2026-09-14 — B3 második fele: a lead-LAP terve jóváhagyva ÉS megépülve (ADR-0167)

**Szál:** `wt/leadlistalap` · **Brief:** B3 — operátor lead-lista és lead-lap (Elek FK-003 +
FK-003b, 23 lelet). Ez a jegyzet a **② lead-lap** köréről szól; a ① lista köre a
`2026-09-14_lead_surface_plan_round.md`-ben (ADR-0161). **Élesítés NINCS** (§0.3).

**Tulajdonosi döntés:** „a lead-lap **B** változat nyert, csináld végig ugyanígy" — vagyis a
teljes ciklus: §2b kapu → kontraktus-befagyasztás → megvalósítás → őr → memória → land.

---

## Amit a döntés eldöntött

A lap **adat-lapként** volt megszerkesztve (mezők, számok, kártyák), holott a kurátor
**munkamenetet** vezet rajta. A B változat a fejléc nagy match-száma helyére **hat állomású
munkamenet-sávot** tesz (Begyűjtve · Mock · Jóváhagyva · Kiküldve · Rendelés · Fizetve), az öt
egyforma artefaktum-kártya helyére **összehasonlító táblát**, a hét magyarázat nélküli
fül-számláló helyére **egy mondatot**. Részletek: ADR-0167 és
`assets/design-refs/console/lead-page/README.md` (a KONTRAKTUS, 10 kötött pont).

**Mérve, ami a döntést indokolta:** 595 leadből **109-nek NINCS** match-értéke — azoknál a lap
legfeltűnőbb helyén egy alig látható szürke `–` állt navy alapon · egy leaden **HÁROM** képszám
szólt ugyanarról (12 / 11 / 10), és a bontás `0+11+0` **nem adta ki** a 12-t (a Street View
„igen"-ként szerepelt, de darabként számított) · a „mit használ fel a szöveg" sáv 9-et és 3-at
mondott 18-ból, a maradék **6 tétel sorsáról egy szó sem** · a követett linken **119 esemény**
volt, a gomb mégis azt írta, hogy „mérés indul".

**A kontraktus a mock-fül felvételeit is tartalmazza** (`B-mock-ful-{asztali,mobil}.png`): a két
változat legnagyobb különbsége ott ül, a lap érkezési állapotában viszont nem látszik. A
korábban mért `feedback_mock_omitted_the_broken_half` osztály — a vázlat SZERKEZETE is a terv
része.

**Mérve a kész lapon:** sáv 6 állomás, a következő = „Kiküldve" · megbízhatóság-sor `none` ·
`data-cit-scale` = **12/1/5/18** (12+1+5=18 ✓) · nyers enum: **0** · `kulcs=érték`: **nincs** ·
JS-hiba: **0** mindkét méreten.

---

## ⛔⛔ Amit a KÉPERNYŐKÉP fogott meg, nem a fordító

Két hiba jutott át a `tsc --noEmit` zöldjén, és mindkettőt a §2b 2. lépése (megnézni a lapot)
találta meg:

1. **`latestMock` a deklarációja ELŐTT.** A változó a használata UTÁN született; a fordító
   átengedte, a lap viszont **futásidőben elszállt**: *„Cannot access 'latestMock' before
   initialization"*. Egy üres képernyő, nem egy elcsúszott pixel.
2. **A ragadós fülsor TELJESEN rátakart a fül-mondatra.** A mondat ott volt a lapon, helyes
   szöveggel, a teljes-lapos screenshot is rendben mutatta — mérve viszont a fülsor
   `top=60 … bottom=111`, a mondat `top=59 … bottom=78`: **az operátor soha nem látta volna.**
   Javítás: a fülsor és a mondat **egy ragadós egység** (`.con-ltabs__head`); mérve utána
   60–111 és 111–147, takarás nélkül. Ugyanaz az osztály, mint a
   `reference_fullpage_shot_hides_dead_sticky`.

---

## ⛔⛔ Három rés a SAJÁT őrömben, mind menet közben javítva

Mind a `feedback_guard_greenly_defended_the_bug` osztálya:

- a **sáv**- és a **sávdiagram**-állítások a **DOM-jelenlétet** mérték, nem a **láthatóságot**:
  `display:none`-nal elrejtve **mind zöld maradt**. Most mindkettő geometriát néz
  (`elementFromPoint`, dobozok, 390 px-en az állomások különböző y-a).
- a `decisionNote` mintája **36 karakteres uuid-alakhoz** kötött, a fixture rövid idjével nem
  illeszkedett — vagyis a nyers `superseded_by:…` **átment volna** a kapun. Most az ELŐTAGRA köt.
- a ⑥ (összeadódó sáv) állítás **ÜRES HALMAZON** mért, mert a fixture-ből kimaradt a
  szöveg-panel bemenete. Üres halmazon minden állítás igaz.

Az őr: `scripts/lead-page-plan-check.mts` — 10 szakasz a KIRENDERELT lapon, valódi
stíluslappal; **piros önteszt: 4 állítás bukik** a visszarontott lapon.

---

## ⛔⛔ Az átszervezésem MEGVAKÍTOTT egy párhuzamos szál landolt őrét

Ugyanaznap egy MÁSIK szál (`272ca4c`) is a lead-lapon dolgozott: a TERÜLET jelentését vezette át
a lapra, és őrt is tett rá (`lead-page-area-label-check`). Az az őr **pont azt a nyers
`kulcs=érték` meta-sort mérte** (`.panel .small.mut`), amit az én ⑧ pontom kivezetett.

Mérve az átírásomon: **34 pass / 1 fail** — és a fail nem hiba volt, hanem a VAKSÁG jele:

- `✗ az artefaktum meta-sora MÉRHETŐ és tartalmazza a címke-felet (0 sor)` — nem talált mit mérni
- `✓ a meta-sorból eltűnt a nyers kulcs-fél` — **ÜRESEN IGAZ** (`every()` üres halmazon)

⭐ **Az őrt az önbizonyító ága mentette meg** (`feedback_fixture_must_prove_its_own_path`): ha
nem lett volna „bizonyítsd, hogy a helyes sort olvasod" állítása, az átszervezésem **teljesen
csendben** kikapcsolja a szivárgás-vizsgálatot, és az őr 35/35 zöldet jelent egy MÉRETLEN lapra.

**Sorrend, a doktrína szerint** (piros őrt csak a viselkedés igazolása UTÁN igazítok): előbb
megmértem, hogy a jelentés MEGVAN és erősebb — a terület megnevezett sorként áll („Gyűjtési
terület: Balaton"), a nyers `regionId` pedig a `META_HIDDEN_KEYS` miatt a lapra SE kerül, nem
csak egy sorból hiányzik. Csak ezután vittem át az állítást:
① az OPERÁTOR ÁLTAL LÁTOTT megnevezett soron mér (`.con-recipe dd`), ② a nyers kulcs a lap
TELJES szövegében nem szerepel — `textContent`-tel, nem `innerText`-tel, mert a nyers alak
csukott `<details>`-ben él, és ott lenne vak, ahol a nyers mezők laknak. ③ A piros KONTROLL
injekciója is átkerült az új szerkezetre — a régi helyen hagyva a zöld önteszt „lefedettnek"
mutatott volna egy le sem futó állítást.

**Mérve utána: 35 pass / 0 fail zölden; az önteszt a három átírt állítást mind buktatja** (és a
`regionId=` szivárgást a meta-sorban újra látja).

⚠️ A szelektor-fogyasztókat ezért ÁTFÉSÜLTEM (`grep -rln '<osztály>' scripts/*.mts`): a
`small.mut`-ot rajta kívül a `outreach-row-truth-check` és a `scrape-liveness-check` használja,
de MÁS felületen; a `data-cit-approved`-ot a `mock-state-label-check` (zöld).

## Amit a felirat-változás eltört (mind javítva)

- `kb-check` **azonnal blokkolt**, amint a „Match-konfidencia" feliratot kivettem: a
  `kb/entries/console-lead` cikk idézte. Vele együtt a `console-outreach-draft` és a
  `console-report` is (a gomb felirata) — `feedback_label_change_breaks_its_quoters`.
- `design-token-lint` **három nyers hexet** fogott (`#fbfffd`, `#cfe6f2`, `#9db0c2`), amiket a
  jóváhagyott mockból másoltam át — `color-mix()`-re cserélve tokenen. A mock szabadabb, mint a
  termék: a vázlatból való átvétel NEM mentesít a token-doktrínától.
- ⛔ `hu-machine-form-check` a **saját új szövegemben** talált **„a(z)"-t**: a „Felülírta: a(z)
  {when}-i {tpl} mock." — vagyis pont abban a mondatban, amit a nyers `superseded_by:<uuid>`
  HELYETT írtam, hogy emberi legyen. A zárójeles névelő félkész sablonszövegnek olvasódik, és a
  ragozást a FELHASZNÁLÓRA bízza (ADR-0101 ①). Javítva a `hu.ts` EGY forrásából
  (`huArticleLower` → `{art}` paraméter), **nem beégetett „a"-val**: a `{when}` alakja a
  formázó dolga, és ha az egyszer más alakot ad, a névelőnek magától kell váltania. A
  katalógus újragenerálva (2 sor).

---

## Mellék-leletek — NEM ez a szál okozta, de ez a szál mérte ki

1. ⛔⛔ **A `renewal-date-coherence-check` FIX nevű scratch-adatbázist használt** (javítva és
   landolva már a lista-körben, `0abfba4` — itt a teljesség miatt rögzítve), és
   `DROP DATABASE IF EXISTS`-szel kezdte. Két párhuzamos futásban ez **egy másik szál élő
   próba-adatbázisát törölte**. Mérve: előtte A-futás `rc=1` / B-futás `rc=0` **2 ütközéssel**;
   utána (futásonként egyedi név) **0 hiba, 0 árva adatbázis**. ~16 párhuzamos worktree-nél a
   „fix nevű temp" nem kényelem, hanem romboló művelet.
2. ⛔ **Két IDEGEN őr-trigger LAND-VAK volt** (nyers `git diff --cached`-re épült, ami a
   landolási rebase-ben üres) — a `guard-wiring-check` (ADR-0152) fogta meg, `changed_files`-ra
   cserélve. A repó egészét blokkolták volna.
3. ⚠️ **Elavult ADR-hivatkozás az INDEX-ben:** a `2026-09-14_outreach_sticky_send_bar.md`
   INDEX-sora **ADR-0161**-re mutat, miközben az a döntés **ADR-0160** (a jegyzet maga
   háromszor helyesen 0160-at ír; a 0161 az ÉN lista-döntésem). Egy rossz számra mutató
   hivatkozás nem üres link, hanem egy MÁSIK, valódi döntésre visz, amit az olvasó el fog hinni
   (`feedback_ours_resolution_silently_drops_my_block`). Javítva.
4. ⛔ **A BUKÓ KAPU KIMENETE EL VAN NYOMVA, ezért a bukás NÉMA HALÁLNAK látszik.** Mérve: a
   `hooks/pre-commit` **112 kapujából 66** `>/dev/null`-ra megy, a hook meg `set -e`-vel fut.
   Amikor a `hu-machine-form-check` elbukott, a napló ennyit mondott: a kapu fejléc-sora, majd
   semmi. **Három diagnosztikai körön** hittem azt, hogy a folyamatot megölték (harness-takarítás,
   OOM) — a valóságban egy kapu VALÓDI leletet talált a kódomban. Súlyosság: ez nem hamis zöld
   (a bukás bukás), hanem **diagnosztizálhatatlan** bukás. Javasolt javítás: a kimenetet
   fájlba fogni és **bukáskor kiírni** (`out=$(mktemp); … || { cat "$out"; exit 1; }`) — a
   „sikerkor csendes" szándék így megmarad. ⛔ **Nem nyúltam hozzá:** 66 hívási hely egy forró
   közös fájlban, ~25 párhuzamos szál mellett; a vak mass-edit ebben a fájlban egyszer már két
   idegen szálat rontott el (`feedback_my_fixup_tool_damaged_another_thread`). Tulaj-döntés kell.
5. ⛔ **A `MEMORY.md` TETEJÉN KÉT EGYMÁST CÁFOLÓ BLOKK ÁLLT** (a legutóbbi commit „feloldatlan
   konfliktus"-ként jelezte, itt megmérve): a fizetés-pillanat szála **kétszer** szerepelt —
   a 6–51. sorban a FRISSEBB változat („a tulaj döntött, ADR-0158 megépült"), az 54–86.-ban az
   ELAVULT („**NYITOTT:** a tulaj döntése 4 pontban") —, plusz **két üres fejléc** (egy
   `## Aktív feladat` és egy `## Előző szál` tartalom nélkül). Ez pontosan a
   `feedback_one_rule_two_copies` osztálya, csak a memórián: aki a fájl tetejét olvassa, az
   50 %-ban azt tudja meg, hogy a döntés még nyitott. Feloldva: a frissebb blokk marad, az
   elavult duplikátum és a két üres fejléc törölve. (Nem az én tartalmam — ezért mérve
   igazoltam, hogy a kettő NEM azonos, és a megtartott a későbbi.)
6. ⚠️ **A `land.sh` törli a `_drafts/`-ot** (ADR-0077, azzal a feltevéssel, hogy a vázlat egy
   paranccsal újragenerálható) — a §2b mockok viszont **kézzel írt** fájlok. Kétszer kellett
   visszaállítanom mentésből. Szabály-szintű rés, nem az én hibám: vagy a takarítás kímélje a
   kézi vázlatokat, vagy a kapu kötelezze a befagyasztást a land ELŐTT.

---

## Módosított / létrehozott fájlok

**Kontraktus (új):** `assets/design-refs/console/lead-page/` — `plan.html`, `README.md`,
`B-asztali.png`, `B-mobil.png`, `B-mock-ful-asztali.png`, `B-mock-ful-mobil.png`,
`A-elvetett-asztali.png`, `A-elvetett-mock-ful.png`

**Megvalósítás:** `src/console/views.ts` · `src/console/data.ts` (`surveyedAt`) ·
`src/console/leadFilters.ts` (közös regiszter) · `public/assets/ui/citui-console.css`

**Őr (új):** `scripts/lead-page-plan-check.mts` · bekötve: `hooks/pre-commit`

**Fogyasztók:** `kb/entries/console-lead/entry.hu.md` · `kb/entries/console-outreach-draft/entry.hu.md` ·
`kb/entries/console-report/entry.hu.md`

**Idegen hibák javítása:** `scripts/renewal-date-coherence-check.mts` · két land-vak trigger a
`hooks/pre-commit`-ben

**Döntés:** `_planning/DECISIONS.md` (ADR-0167)

---

## Nyitott kérdések

- Az **irányítópult** „13/14 eladó" piros jelvénye — ugyanaz a hibaosztály (állapot-szín olyat
  állít, ami nem igaz), másik felületen. Nincs terv-köre.
- A **diszkvalifikált lista-nézet** nem mondja meg, MIKOR és KI zárta ki a leadet; a listáról
  nincs visszaminősítés. (ADR-0161-ben is nyitva.)
- A `land.sh` ↔ kézi §2b vázlat ütközése (lásd 5. mellék-lelet) — szabály-szintű döntés kell.
- **A 66 elnyomott kimenetű kapu** (lásd 4. mellék-lelet) — tulaj-döntés kell, mert a javítás
  egy forró közös fájl 66 sorát érinti.
