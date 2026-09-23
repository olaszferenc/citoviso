## ADR-0173 — A jelzés-szín nem felirat-szín: a döntő gomb legyen olvasható (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** elfogadva (tulajdonosi döntés) · **Kapcsolódó:**
ADR-0021 ① (dizájn-token-doktrína: minden szín a magból), ADR-0145 (a `.con button`
specificitása verte a sáv gombját), ADR-0156 (ugyanez a doboz, a kép nélküli kapu),
03-INVARIANTS §B.17.

**Kiváltó.** Az ADR-0156 körében megmértem a kép-kapu „Vállalom" gombjának felirat-
kontrasztját: **3,91** — a 4,5-ös küszöb alatt. Akkor ezt KIMONDTAM, de nem javítottam,
mert a ház 13 helyén használt gomb-stílusról volt szó, és a szín házon átívelő,
tulajdonosi kérdés. A tulaj kérte a külön kört.

**Mérve (a renderelt konzolon, nem tokenből következtetve).** A kör a bejelentésnél
SOKKAL nagyobb osztályt talált: a ház a JELZÉS-színeket FELIRATNAK is használja, és
világos háttéren egyik sem olvasható.

| token | érték | kontraszt | hol |
|---|---|---|---|
| `--citui-cyan-500` | `#1fb6d6` | **2,41** | **minden link** a konzolon |
| `--citui-info` (= cián) | | **2,15** | `.pill.generated` / `.sent` a SAJÁT tintjén |
| `--citui-warn` | `#d29922` | **2,52** | `.q-mid`, „elavult" jelvény |
| `--citui-ok` | `#2fa96b` | **2,72–3,00** | **„Fizetek ▸"**, **„Jóváhagyás"**, `.q-good`, `.pill.approved` |
| `--citui-bad` | `#e5484d` | **3,35–3,91** | `.con button.bad`, `.pg-head`, `.q-bad`, `.pill.rejected` |
| `--citui-muted` | `#60748b` | 4,36–4,81 | másodlagos szöveg — a küszöb HATÁRÁN |

⛔⛔ **A legrosszabb két érték a döntő gombokon ült:** a vevő „Fizetek ▸" gombja és a
kurátor „Jóváhagyás" gombja **3,00**-n. A gépi „látható-e" próbák közben IGAZAT mondtak —
azok a DOM-ot kérdezik, nem a szemet (ez az `isVisible()`/`elementFromPoint` tilalom
folytatása, harmadszor).

**Tulajdonosi döntés (2026-09-15, 4 állapot × 2 méret képen + kattintható, ÉLŐBEN mérő
vázlaton).**

① **Gomb-stílus: „A — sötétebb felirat".** A HUE marad ott, ahol JELZÉS (keret, háttér,
pötty, ikon); csak a FELIRAT kap sötétebb változatot. Így a „színhang" megmarad, és a
destruktív gomb **nem lesz hangsúlyosabb**, mint ma. ⛔ A kézenfekvő „legyen tömör gomb"
NEM olcsóbb megoldás: mérve a **fehér felirat a mai zöldön szintén 3,00** — tömör gombhoz
is sötétebb árnyalat kellene.

② **Hatókör: a JELENTÉS-VIVŐ színek mind** — ami INFORMÁCIÓT hordoz a színével: a
szemantikus gombok, az állapot-feliratok (`.q-good`/`.q-mid`/jelvények/pillek) és a
linkek. Négy szöveg-token a dizájn-magban: `--citui-ok-ink` · `--citui-bad-ink` ·
`--citui-warn-ink` · `--citui-link-ink`.

③ **Az értékek nem tippeltek.** Minden TÉNYLEGES háttérre megoldva (fehér · felület ·
felület-2 · `ok-soft` · a pill/pg-box színkeverékei), és a legrosszabb eset is
**tartalékkal** megy át (≥5,3). ⚠️ Az első megoldásom 4,51–4,59-et adott — „még éppen
átment", ami a következő érme-feldobás; a tulaj által JÓVÁHAGYOTT árnyalatok viszont
tartalékosak, tehát azokat szállítottuk.

④ **A `--citui-muted` MARAD** (kimondott tulajdonosi döntés): a küszöb határán van, és a
token átütne a tenant-adminra ÉS a vendég-oldalra is. Ez KÜLÖN kör.

⑤ **Az ikon nem felirat.** A cián akcent-pötty (`button.con-ib svg`, `.cp-hl svg`) a ház
kézjegye (ADR-0021 ①) és nem szöveg — marad a márka-ciánon. Az első cserém átírta; a
hatókör-döntés visszavette.

⑥ **A tompítás ÁLLAPOT, nem szín-hiba.** A tiltott/kikapcsolt elem `opacity`-je megmarad
(a ház saját szabálya, hogy a tiltott nézzen ki tiltottnak) — ⛔ de az őr csak akkor
engedi, ha a felirat **tompítás nélkül** átmenne: rossz alapszínt nem lehet `opacity`-vel
„szándékosnak" álcázni.

**Amit a mérés a CSS-en KÍVÜL talált.** A nézetekben **23 BEÉGETETT inline szín** élt
(`style="color:var(--citui-bad)"`), ami megkerülte a CSS-t — egy szabály két példányban.
Ezek nélkül a javítás felerészben zöldet mutatott volna egy pirosra.

**Őr.** `scripts/console-contrast-check.mts` — a RENDERELT konzolt nyitja meg valódi
Chromiumban, **10 útvonalon, 390 ÉS 1280 px-en** (a méret-specifikus lelet önálló lelet,
ADR-0149), és MINDEN szöveget hordozó elemre kiszámolja a kontrasztot **ALFA-KOMPOZITÁLVA**
— a féligáttetsző háttér ÉS az ős-`opacity` is beleszámít. Mérve **4224 elem**.
⛔ **Két szín-alak, két skála:** a `color-mix()` `color(srgb 0..1)` alakban jön vissza, a
többi `rgb() 0..255`-ben; a skálát a SZINTAXIS dönti el. (Ezt a kettőt egyszer már
összemostam, és a tökéletesen olvasható prózát 1,22-vel „bukónak" mondta.)
A verdikt **HÁROM KIMONDOTT csoport**: ① a tulaj által engedett szín (megszámolva) ·
② szándékosan tompított elem, aminek az alapszíne olvasható · ③ minden más = bukás.
⛔ **Amit nem mérünk, azt kiírjuk:** az `<option>` kimarad (a legördülőt a böngésző saját
felülete festi, az elem DOM-háttere átlátszó — mérve), és a gradiens hátterű elem is.
**Önteszt: a nyers színek visszaállításával 702 elem megy pirosra.**

**Visszafordíthatóság:** 🔄 kód-szintű, adat-migráció nélkül. A négy token egy helyen él;
visszaállításuk a régi értékre azonnal visszahozza a régi képet (és az őr pirosát).

**Nyitott.**
- A `--citui-muted` (165 elem, 4,36–4,81) — külön kör, külön döntés.
- A `[data-citui-theme="dark"]` hatókör ezeket a tokeneket NEM írja felül. Ma ártalmatlan
  (mérve: **0 használat** a repóban), de aki bekapcsolja, annak ki kell mérnie.
- A tenant-admin és a vendég-oldal NEM része ennek a körnek — ott a színek más
  hátterekre esnek, és a mérés sem futott rájuk.
