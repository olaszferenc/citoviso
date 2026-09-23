## ADR-0014 — Konverzió I.: Provisioning ≠ Élesítés + Site-állapotgép + pilot-minimál plane-váltás (privát előnézet)

- **Dátum:** 2026-07-13
- **Kontextus:** a tölcsér konverziós fele (Mock → élő tenant-Site) ma nem létezik. A tervezés közben kiderült,
  hogy a `PROCESS.md` „fizetési sorrend"-ellentmondása (tábla 5–6 „fizet→aktivál" vs. §C flowchart
  „Provision→Oldal ÉL→számla") NEM valós ütközés, hanem **terminológiai túlterhelés**: három szót két
  jelentésben használtunk.
- **Diagnózis — a három túlterhelt szó:** (1) **„aktiválás"** = modul-entitlement aktiválás (technikai) VAGY
  oldal-élesítés (nyilvános go-live); (2) **„előfizetés"** = az előfizetés beállítása (kapu-esemény) VAGY
  steady-state; (3) a döntő: **„provisioning"-ot és „élesítés"-t egyetlen atomi eseménynek vettük** — ezért
  tűnt ütközőnek a tulaj „fizet→nyilvános aktiválás" szabálya.
- **Döntés — a két esemény szétválasztása + állapotgép:**
  1. **Provisioning** = control→data plane technikai kiépítés egy **PRIVÁT** előnézetbe (izolált, per-tenant,
     kitalálhatatlan token-URL, `noindex`). **Fizetés ELŐTT is futtatható** — ez a `PROCESS.md` engedte
     „nem-pénzes preview", cég/fizetés nélkül is valós.
  2. **Élesítés (go-live)** = a **NYILVÁNOS** átbillentés (domain/DNS, indexelhető, felfedezhető). **Ez a
     fizetős kapu** — a tulaj sorrendje („fizet → nyilvános aktiválás") maradéktalanul áll. Nincs disagreement.
  3. **Site-állapotgép:** `draft` → `provisioned` (privát) → `live` (nyilvános, fizetés-kapus) →
     `suspended`/`deactivated`. A `provisioned`↔`live` külön állapot, NEM boolean.
- **Konverziós mellékhaszon:** a privát, VALÓS URL-en élő előnézet („itt a tényleges oldalad — fizess, hogy
  nyilvános legyen") erősebb horog egy statikus mock-képnél; egyben ez a most-építhető szelet (cégre/fizetésre
  NEM gatelt).
- **Pilot-minimál irány (a gépből PONT egy dolog épül):** a **provisioning → privát előnézet** szelet.
  Kiszolgálás **Opció 1** (a ház futtat egy `convertLead`-scriptet → `sites/<tenant_id>/index.html` izolált
  namespace, token-URL, noindex; 🔄🔄🔄 triviálisan visszavonható), **de a DB-alakot Opció 2 szerint** tervezve
  (`tenant` + `module_entitlement` + `site` sorok már az első scriptből) → a plane-határ tudatos, `tenant_id`
  az első pillanattól. **RLS** csak az első vendég-PII táblánál (booking) lép be — addig nincs mit szivárogtatni
  (§G.18). Fizetés + nyilvános élesítés + fotó-kezelés a pilotban kézi ház-lépés (A2).
- **✅ LEZÁRT függőség — demó-kép jogállása élesben (§A átírva, 2026-07-13):** a korábbi „portál/vendég-kép SOHA
  nem élesre" túl merev volt. Új szabály (`INVARIANTS §A.1/b`): `guest`/`portal` demó-kép **élesre kerülhet, HA** a
  tenant a fizetési kapuban **jogi önnyilatkozatot** tesz (rendelkezés a szerzői joggal + **szavatosság +
  kártalanítás**) ÉS volt lehetősége lecserélni (fizetés-előtti testre szabás/előnézet). Indok: a portálra a
  tenant/megbízottja töltötte fel → hihető a szerzősége. ⚠️ `places`/`streetview` (Google jogállás) és vízjeles
  fotó **NEM** önnyilatkozható → csere. A privát `provisioned` előnézet még demó-fázisú (nem nyilvános) → ott a
  demó-kép rendben. A `jog-provenance-or` őr-agent §A-mátrixát ehhez igazítani kell (követő teendő).
- **Elvetett alternatíva:** provisioning = azonnali nyilvános go-live (a flowchart eredeti olvasata) — elvetve,
  mert ütközik a fizetés-kapus élesítéssel és elveszti a privát-preview konverziós horgot.
- **Visszafordíthatóság:** 🔄 · fogalmi rögzítés + vékony, namespace-alapú provisioning (könyvtár-törléssel
  visszavonható); nincs séma-lock (a `tenant`/`site` táblák additívak).
- **Státusz:** ELFOGADVA (fogalmi rész) — az implementáció (`0004_conversion.sql` + `src/conversion/provision.ts`
  + konzol-route-ok) a következő lépés; az asset-jogi rész a §A-revízióra vár.
