# 2026-09-21 — A modul-függőségi rend felderítése (ADR-0192)

**Mandátum:** FELDERÍTÉS, nem kód. Tulajdonosi utasítás: *„indíts egy külön sessiont a függőségi
kérdésben, ahol felmérjük hol van ennek relevanciája… Az új sessionnek ez a felderítés az
elsődleges feladata."* Brief: `/home/citoviso/rc-briefs/module-deps-brief.md`.

**Miért előbb a leltár, mint a séma:** a függőségi adat KÖZÖS lista sok fogyasztóval, és a
megfizetett tanulságunk (`feedback_widening_a_shared_list_needs_per_consumer_decision`) szerint a
fogyasztók utólagos megnézése **4-ből 3-nál némán ront**. A leltár határozta meg a séma alakját.

---

## Mi lett belőle

**ADR-0192** (`_planning/DECISIONS.md:11240`) + a tartós domain-tudás a
`_planning/DOMAIN/05-MODULES.md`-ben (a fájl **72 napja** nem mozdult — ezt a `land.sh`
`domain-inbox-freshness` kapuja írta ki, nem én vettem észre).

Hat párhuzamos, egymást nem fedő felderítő ágens dolgozott (ADR-digest · konfigurátor+ALL-IN ·
tenant-admin+előnézet+lemondás · fizetés+számlázás+árazás · konverzió+renderelés+őrök ·
DB-mérés+KB), mind read-only mandátummal.

## A lánc — és ami KIESETT belőle

```
booking ──requires──▶ pricing ──requires──▶ rooms   (rooms: ha 2+ egység, VAGY ha ismeretlen)
```

⛔ **Az `amenities requires rooms` kiesett** — a brief még tartalmazta, a mérés cáfolta. Az
`amenities` **site-szintű adat** (`site_module_config('amenities').config.items`), `rooms` nélkül
hibátlanul renderel, és a KB-szócikk **címe** ezt mondja: *„mit kap a vendég az egész szálláson"*.
A valódi kötés csak a **szobánkénti szerkesztőre** áll, és az **ADR-0074 §5 óta már él**,
művelet-szinten. Katalógus-szintű kötésként a szócikket hazuggá tettük volna — **és a label-drift
őr ezt nem fogta volna meg**, mert a cím nincs félkövér idézetben.

⭐ **A tanulság általánosítva:** a „modul A kell a modul B-hez" mondat HÁROM különböző relációt
takarhat — kiváltás (egy slot, két állapot) · függőség (enélkül nincs értelmes felület) ·
**művelet-kapu** (nem a modul, hanem egy SZERKESZTŐ kér két jogosultságot). A harmadikat a
katalógusba emelni kár.

## ⛔⛔ A hamis pozitív, ami a legtöbbet tanította

Egy felderítő 1 sértő rendelést jelentett (`["pricing","poi","booking"]` — `rooms` nélkül), és
**én ezt továbbadtam a tulajnak tényként**. Egy másik ág cáfolta: az `order_intent.modules`
`kind='upsell'` esetén **DELTA, nem teljes halmaz**, és az érintett tenant már birtokolja a
`rooms`-ot. **Valódi sértés: 0 db.**

A szabály: a függőséget a **beküldött halmaz ∪ a meglévő jogosultságok** unióján kell
kiértékelni. Aki a rendelés-sort önmagában nézi, **minden** upsell-rendelést elutasít, ami nem
véletlenül vesz meg egy már birtokolt modult. Ez lett az őr **4. negatív kontrollja**.

## ⛔⛔ A saját ADR-em egy állítása is hamis volt

„Az `isMultiUnit()`-nak nulla hívója van" — **a `src/`-re igaz, a repóra NEM**: a
`scripts/module-config-check.mts:21` importálja, és a `:290`/`:296` **mindkét polaritását méri**.
Ez jó hír (a predikátum már ma őrzött), de pontosan a `feedback_narrow_recognizer_is_a_false_green`
hibaosztálya. A bevitel előtti ellenőrzésen fogtam meg, az ADR-t helyesbítettem.

**Kétszer egy sessionben** lett hamis premissza a saját összefoglalómból. Mindkétszer egy
felderítő szűk hatókörű állítását vettem át általánosként.

## A leltár — húsz fogyasztó (a tulaj kettőt nevesített, tízet a felderítés talált)

**A hangos leletek, amiket senki nem keresett:**

| Lelet | Hely |
|---|---|
| ⛔⛔ `/api/foglaltsag` az entitlement-kaput **nem kérdezi meg** → ár nélküli lap + **kötelező erejű 84 000 Ft-os ajánlat** a vendégnek, e-mailben is | `src/server/public.ts:670-708`, `src/booking/requests.ts:391-439` |
| ⛔⛔ A megújítás **vakon** kapcsol ki (`where cancel_at_period_end = true`) → a szabály **a fordulónapon, ember nélkül, némán** sérül | `src/payment/subscription.ts:226-236` |
| ⛔⛔ A kliens megerősítő kártya csak a **BEPIPÁLT** checkboxokat ismeri → szerver-oldali hozzávételnél **990 Ft a képernyőn, 2 170 a terhelésen** | `src/server/adminViews.ts:1496,1516` |
| ⛔ `syncEntitlementsToPaid` a **historikus** unióból granteli vissza a máshol kiszűrt modult | `src/tenant/paidEntitlements.ts:107-123` |
| ⛔ A modul-**előnézet ÍR** (`ensureUnits` → INSERT/UPDATE `site_unit`) — ADR-0089 ④ sérül, és az őre **vak rá** (csak a függvénytörzs SZÖVEGÉT nézi) | `src/tenant/units.ts:105-120`, `scripts/module-preview-check.mts:50-70` |
| ⛔ A `module_sales_disabled` kapcsoló **némán érvénytelen presetet** gyárt, és `presetNestingViolations()` zölden áll | `src/modules.ts:246-257` |

**Ami rendben van — igazolva, nem feltételezve:** mindhárom preset, az ALL-IN fallback és három
valódi mock-artifact **érvényes**. Üres sáv egyetlen kombinációban sem keletkezik (korai return
mindenhol) — **a kár nem üres sáv, hanem kontextus nélküli tartalom**. Az operátor **nem** állít
össze halmazt (read-only pill-lista). Egy upsell-tett **egy** rendelést hoz létre N modullal.

## A négy tulajdonosi döntés (AskUserQuestion, 2026-09-21)

1. **A kosár: a kliens BEPIPÁLJA a függőséget és KIMONDJA.** ⭐ Az indok mérés: a terv-sáv és a
   fizetés-megerősítő kártya a bepipált checkboxokon iterál, tehát a **helyes ár magától
   következik** — a „990 a képernyőn, 2 170 a terhelésen" hazugság meg sem születik. Szerver-oldali
   csendes hozzávételnél azt KÜLÖN kellett volna megjavítani.
2. **A lemondás BLOKKOL**, és közös lemondást ajánl. A kaszkád elvetve: ADR-0155 ③ szerint a
   fagyasztott lap hiányzó mezője lemondásnak olvasódik, ezért egy automatikus ELTÁVOLÍTÓ ág a
   megőrző mezőkkel védett adatvesztés-csapdába nyúlna.
3. **Az `amenities` kötés elesik.**
4. **Ismeretlen egységszám → a függőség ÁLL.** ⭐ Nem óvatosság, hanem **összhang**: a mock maga
   **3 szobakártyát MUTAT**, tehát az „ismeretlen = egy egység" feltevés a KÉPERNYŐNEK mondana
   ellent. ⛔ 33 mock-artifactból **0**-ban van valódi szobalista; a prospectnek **szerkezetileg
   nincs** `site_unit` sora. ⛔⛔ A lapon látható szobakártya-szám **HAMIS PROXY**.

## A séma — nincs DB-tábla

`ModuleRequirement { id, when?, strength, why }` a `ModuleDef`-en. Az ár azért él DB-ben, mert az
**operátor szerkeszti**; a függőség **termék-szerkezet**. Precedens: a `supersedes` is kód-oldali,
a lint validálja, és a manifest **már ma szállítja a kliensnek**.
A puszta id-lista azért kevés, mert a leltár hármat követel: **feltétel** (`when`), **indoklás**
(`why` — hat képernyőn, egy forrásból) és **erősség** (`strength`).

## Visszafelé kompatibilitás — mérve

`citoviso_dev`: **0 sértő tenant, 0 valódi sértő rendelés**. Mind az 5 tenant birtokolja a
`rooms`-ot. ⭐ A „2+ egység" verdikt **robusztus a definícióra** (mindkét olvasat ugyanazt a két
site-ot jelöli). ⛔ Az **ÉLES DB-t NEM mértem** — a megvalósítás előtt kell.
A kockázat nem a múltban van, hanem **három sodródásban**: megújítás-sweep · egység-törlés ·
`module_sales_disabled` tranzitív hatása.

## Módosított fájlok

- `_planning/DECISIONS.md` — **ADR-0192** (`51e1815`, helyesbítés: `e338d79`)
- `_planning/DOMAIN/05-MODULES.md` — „Modul-függőségi rend (Szint 2–3 előszoba)" szakasz +
  ⚠️ kimondva, hogy a Szint 0–1 tábla GENERÁTOR-nézet, és mérve **eltér** a `MODULE_CATALOG`-tól
  (`contact_details` **nem létezik**; `email`/`multilang` hiányzik; `newsletter` retired; a
  `booking` sora elavult) — a kód nyer, ellenőrző paranccsal (`e338d79`)

## Nyitott / következő

- **Mindkét utód-szál MÁR ELINDULT** (a tulaj indította, 2026-09-21 17:15, közvetlenül az ADR
  landolása után — `rc-briefs/.started`):
  - **megvalósítás** — `~/rc-briefs/module-deps-impl-brief.md` (`rc-67b3ccea`). Sorrend: séma +
    lint → kliens-oldali bepipálás → blokkoló lemondás **a megújítás-sweeppel együtt** → KB.
  - **sürgős javítás** — `~/rc-briefs/urgent-price-gate-brief.md` (`rc-7de2d55c`, worktree
    `wt/arkapu`): a `/api/foglaltsag` ár-kapu és a kupon-kerekítés (**1 626 a képernyőn / 1 627 a
    terhelésen**; azért nem derült ki, mert a park egyetlen upsellje éves, ott véletlenül
    egybeesik).
  ⚠️ A két szál **ugyanabba a kliens-JS blokkba** nyúl (`src/server/adminViews.ts` ~1490-1560); az
  impl-brief kimondja, hogy az `arkapu` landol előbb, és **az ő szövege a bázis**.
  ⛔ Én magam is majdnem felülírtam a már meglévő impl-briefet egy sajáttal — a `Write` fogta meg
  („File has not been read yet"). Amit nem én hoztam létre, azt előbb nézd meg.
- **Hat további mért hiba** az ADR-0192 ⑧-ban leírva (nem javítva).
- **Nyitott kérdés:** számlázzuk-e a `requires`-sértő modult? A ④.2 döntés után szabályos úton nem
  állhat elő — de a nem-atomi `activateUpsell` még előállíthatja.
