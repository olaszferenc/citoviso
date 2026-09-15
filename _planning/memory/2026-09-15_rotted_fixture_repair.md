# 2026-09-15 — Az elrohadt fixture: a termék háromszor lépett tovább a teszt alatt

**Tulajdonosi utasítás:** „javítsd a `module-config-check` fixture-jét, aztán kösd be azt is".
Ez az ADR-0152 leltárának **utolsó adóssága**.

**ADR:** [ADR-0170](../DECISIONS.md) · **Élesítés NINCS** (§0.3) · **Termék-kód nem változott.**

---

## ① Nem egy hiba volt, hanem négy — egymás mögé rejtve

Az őr 2026-09-15-ig **árva** volt (soha nem futott), ezért a fixture csendben elrohadt. És
mert az első hiba ÖSSZEOMLASZTOTTA a futást, a mögötte lévő ~40 állítás soha nem is jutott
szóhoz — a rothadás rétegesen derült ki, futásról futásra:

| # | rothadás | tünet |
|---|---|---|
| 1 | `source: "booking:xyz"` a sémában előírt `booking:<uuid>` helyett | `invalid input syntax for type uuid` → **a futás halála**, 282. sor |
| 2 | ADR-0062: a foglalási felület KÉT darab lett | 4 bukó állítás a `bookingSlot`-on |
| 3 | telefon-kötelezettség (tulajdonosi rendelet, 2026-08-23) | 4 bukó állítás, majd `TypeError` |
| 4 | átfedés: `conflict` → automatikus `declined` | 1 bukó állítás |

## ② A javítás szabálya: a KÉRDÉST tartjuk meg, nem az elvárás szövegét

Ez volt a munka lényege. Minden ponton ott volt a csábítás, hogy „igazítsuk az elvárást a
kimenethez" — az zöldet adott volna, **vakság árán**.

- **(2) Áthelyezés, nem lazítás.** Az ADR-0062 óta a sávban csak egy keskeny csík áll
  (`variant="cta"` → `#cit-booking`), a teljes widget a záró szekcióban él. Ha egyszerűen
  törlöm a `data-cit-units` / `data-cit-min-nights` elvárást, akkor **sehol nem maradt volna
  ellenőrizve**, hogy az egységek és a szabályok eljutnak a vendég lapjára. Ezért az állítás
  a **kiszállított felületre** költözött (`bookingSlot` + `moduleSections`), és külön
  állítás rögzíti magát a kettéosztást is — hogy a kontraktus ne legyen néma.
- **(3) A megváltozott szabályt felvenni, nem megkerülni.** A telefon-kötelezettségnek eddig
  EGYETLEN tesztje sem volt. A pozitív eset önmagában nem védi: a szabály kivehető lenne a
  kódból, és minden állítás zöld maradna → **két negatív iker** (nincs szám · túl rövid szám).
- **(4) Az alak igazodhat, a szigor nem.** A termék erősebb lett: az átfedő kérést már az
  első elfogadásakor automatikusan elutasítja (`decided_by: "auto"`), tehát a `conflict` ág
  el sem érhető — az a védelem második rétege. Egy állítás helyett **három**: nem lehet
  elfogadott · a RENDSZER utasította el · az éjszaka az ELSŐ vendégé maradt.
- **(1) Valódi entitások.** A naptár-eset ma létező `calendar_link` és `booking_request`
  sorra mutat, így a mérés azt a lekérdezési utat járja be, amit az éles admin-naptár.
  ⚠️ A `2099-09` hónapot a valódi `createBookingRequest()` **helyesen elutasítja** („Ennyire
  előre még nem lehet foglalni") — ott szándékosan közvetlen sor, a scriptben kimondva; a
  kérés-validációt a saját szakasza méri valós dátumokkal.

## ③ Bizonyítva, hogy nem vakult meg

Három visszarontás, mindegyik pontosan a szándékolt állítást buktatja:

| próba | eredmény |
|---|---|
| a telefon-szabály kivéve (`if (false && …)`) | **2 piros** — a két új negatív iker |
| a szabály-attribútumok kivéve a foglalás-szekcióból | **1 piros** — „a szabályok is átmennek" |
| `decided_by: "auto"` → `"owner"` | **1 piros** — „a RENDSZER utasította el" |

Termék-kód minden próba után visszaállítva (mérve: `git diff -- src/` üres).

## ④ Stabilitás és takarítás

- **82 állítás zöld, exit 0, ~11 s**, két egymás utáni futás.
- **Takarít:** a `calendar_link` és `booking_request` sorok a site-tal kaszkádolnak; futás
  után 0 árva. Az egyetlen `_mcfg_check` árva definíció **2026-09-08-i** (egy hetes, nem
  ezekből), és a második futás után sem szaporodott.

## ⑤ Bekötve — és a leltár kiürült

Trigger: `src/moduleConfig.ts` · `src/modules.ts` · `src/tenant/{availability,units,modules,
editor,prices,siteModuleConfig}.ts` · `src/engine/{templateKit,moduleSections,recipe}.ts` ·
`src/booking/requests.ts` · `src/db/schema.ts` + az őr saját fájlja (ADR-0147 ③).

⭐ **Ezzel az ADR-0152 leltára KIÜRÜLT:** nincs több „elrohadt" kivétel, a
`guard-wiring-check` adósság-figyelmeztetése eltűnt.

## ⑥ A tanulság

**Egy soha le nem futó teszt nemcsak hasztalan — aktívan félrevezet.** Itt a termék
HÁROMSZOR lépett tovább alatta (ADR-0062, telefon-rendelet, automatikus átfedés-elutasítás),
és a fixture mindháromszor a régi világot állította. Amikor végre lefutott, minden egyes
pirosnál ott volt a rossz válasz lehetősége: „akkor vegyük ki azt az állítást".

## Módosított fájlok

- `scripts/module-config-check.mts` — valódi `calendar_link`/`booking_request` a naptár-eset
  alá; a foglalás-állítások a kiszállított felületre költöztetve + az ADR-0062 kettéosztás
  kikötve; telefonos vendég-fixture + két negatív iker; az átfedés-állítás háromfelé bontva
- `hooks/pre-commit` — bekötve, diff-scope-olt triggerrel
- `scripts/guard-wiring-check.mts` — az utolsó „elrohadt" kivétel törölve
- `_planning/DECISIONS.md` — ADR-0170
