# A belső operátor-felület = a teljes vállalatirányítási (ügyviteli) rendszer MAGJA

Dátum: 2026-07-08 · Forrás: tulaj (explicit korrekció, session közben) · Státusz: RÖGZÍTETT ALAPELV

## A tény (amit rögzítünk)

A most építendő **belső operátor-konzol NEM egy egyszerű „kurátori nézet"**. Ez a
**teljes, moduláris vállalatirányítási (ügyviteli) rendszer alapja/magja** — erre húzzuk rá
idővel a teljes ügyviteli folyamatot:

- **CRM** (lead → prospect → ügyfél életciklus, kapcsolat-történet)
- **Sales** (pipeline, megkeresés, ajánlat, konverzió)
- **Pénzügy + számlázás + bizonylat-kezelés** (a Mineral-híd után saját)
- **Support**, és minden további belső modul
- **Szerepkör-szintű RBAC** (kurátor / pénzügy / sales / support / admin külön)

Ugyanaz a „**modulárisan bővül, nincs egyedi fejlesztés**" filozófia, mint a tenant-oldali
Site-modulokon → **két moduláris platform** (külső Site-modulok + belső back-office),
külön RBAC-cal. „**A control plane maga is egy termék.**" (Megerősíti: BACKLOG:131, phase3.)

## Miért fontos ezt MOST rögzíteni (a stack-döntés miatt)

A pilot-konzol könnyen úgy néz ki, mint „lista + 2 gomb" → csábít egy eldobható, hand-rolled
megoldásra. **Ez hiba.** Ha a felület egy növekvő ERP magja, a stacket a **hosszú távú,
moduláris, RBAC-képes, adat-nehéz ügyviteli rendszerre** kell választani, NEM a pilot
látszatára. A pilot lead-pipeline + kuráció nézete = ennek az ERP-nek az **ELSŐ modulja**,
egy skálázható alapon — nem külön, később eldobandó darab.

## Következmény a stack-döntésre (irányadó, nem véglegesített)

- ❌ Tiszta hand-rolled Node `http` eldobható konzol — KIZÁRVA hosszú távon.
- ✅ Olyan alap kell, ami támogatja: tiszta **modul-határok**, első osztályú **auth + RBAC**,
  adat-nehéz admin-UI (táblák/űrlapok/szűrők), managed-felő deploy, kis csapatos karbantarthatóság.
- A prospect-preview + tenant-admin **ugyanerre** az alapra ülhet (vagy tudatosan külön) — de
  a belső ERP a meghatározó a keret-választásban.

## Kapcsolódó

- `_planning/BACKLOG.md` §„Belső moduláris back-office (operátor-platform)" — ez most
  parkolt ötletből **alapozó architektúra-elvvé** emelve.
- `_planning/CONTEXT.md` §9 (két moduláris platform, RBAC) + §10 (walking skeleton csonka:
  belső web-felület).
- Nyitott: a konkrét stack-választás (full-stack keret vs. moduláris backend + admin-UI).
