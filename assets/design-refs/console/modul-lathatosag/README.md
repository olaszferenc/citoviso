# KONTRAKTUS — modul láthatósága: „Látható / Nem látható” kapcsoló a Modulok fülön

**Jóváhagyta:** a tulaj, 2026-11-05 („A) legyen”, §2b terv-jóváhagyási kapu) ·
**Változat:** **A — Kapcsoló a listában** ·
**Terv:** `modul-lathatosag.html` (önhordó, kattintható; fent „A · Kapcsoló a listában”; „Mobil 390px / Asztali” váltó) ·
**Képek:** `A-mobil.png`, `A-asztali.png`
**Kiváltó:** tulaj, 2026-11-05: „minden modulnál lehessen: inaktiválni / aktiválni (azaz látható nem látható) NEM CSAK LEIRATKOZÁS!”

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kódot ehhez mérjük.

## KÖT

1. **Minden megvett/próbában kapott oldal-modul sorában kapcsoló** a Modulok fülön: „Látható” / „Nem látható”.
   Ez KÜLÖN van a „Lemondom”-tól: a láthatóság nem érinti az előfizetést, a díjat és a beállításokat.
2. **Nem látható modul:** a vendég oldaláról eltűnik a szakasza és a menüpontja (ugyanaz a vágás, mint
   a meg nem vett modulnál). Az előfizetés és a díj marad, a beállítások megmaradnak, a beállítás-oldala
   az adminban elérhető marad. Visszakapcsolva ugyanúgy jelenik meg.
3. **Az Érdeklődés (gerinc) nem rejthető** — „Mindig látszik”, a kapcsoló tiltott.
4. **Képek rejtve:** a galéria-szakasz megy, a nyitókép MARAD (kép nélküli oldal tilos, §A).
5. **Árak rejtve, Foglalás látható:** a Foglalás látszik, de ÁRAT NEM MUTAT (sem a lapon, sem a naptár-
   widgetben, sem a kérés-levélben) — a vendég ajánlatot kér. A Foglalás sorában ezt egy mondat jelzi:
   „Árat nem mutat, mert az Árak rejtve van.”
6. **Foglalás rejtve:** a helyén az Érdeklődés űrlapja jelenik meg (mint foglalás-modul nélkül).
7. **Visszajelzés kattintás után:** „„<modul>” most nem látszik az oldalán. Az előfizetése és a
   beállításai megmaradnak.” / „„<modul>” újra látszik az oldalán.” Az Árak elrejtésekor, ha a Foglalás
   látszik, a figyelmeztető változat: „… A Foglalás továbbra is látszik, de árat nem mutat: a vendég
   ajánlatot kér.” ⭐ **A visszajelzés A KATTINTOTT SORBAN jelenik meg** (a visszairányítás oda görget),
   nem a fül tetején — ott egy képernyőnyire lenne a megnyomott kapcsolótól.
8. **A sor állapota:** a látható állapotot a kapcsoló felirata mondja („Látható”) — külön címke NINCS
   (modules-quiet-list §3: a lista csak a kivételről szól). Csak a rejtett sor kap szöveget:
   „Rejtve a vendég elől — az előfizetése és a beállításai megmaradnak.” (eltérés a mocktól, szándékos).
9. **A változás azonnal élesedik** a tenant oldalán (újrarenderelés), ahogy a többi modul-beállítás.

## Megvalósítás (ADR-XXXX)

`module_entitlement.hidden_at` + `hidden_by` (migráció 0126; trigger: aktív-váltáskor a rejtés törlődik). A vendég-oldali kérdés („látja-e a vendég?”) egyetlen függvény
(`shownModuleIds` / `tenantShowsModule` / `siteShowsModule`, `src/tenant/modules.ts`); az admin-oldali („birtokolja-e?”) marad `isRenderedModule`.

Végpont: `POST /admin/module-visibility` (külön `adm-visform` űrlap, NEM a kosár-űrlap — a hiányzó jelölőnégyzet ott
lemondást jelentene). Felfüggesztés alatt (ADR-0155) a kapcsoló nem jelenik meg és a POST is elutasított.
Rejtett Foglalás → `renderableModules` a LÁTHATÓ halmazon fut, így az Érdeklődés visszakapja a helyét (KÖT ⑥).
