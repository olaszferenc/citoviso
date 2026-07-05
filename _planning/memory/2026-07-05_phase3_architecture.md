# Fázis 3 — Architektúra (enterprise-réteg) — ✅ KÉSZ

Dátum: 2026-07-05
Típus: tervezés (Fázis 3, lásd `_planning/ROADMAP.md`)
Cél: az absztrakt magot megvalósítható architektúra-döntésekké fordítani; a legelső üzenet enterprise-
követelményeinek (security, skálázhatóság, időtárolás, i18n) becsatolása. Altitude: döntési pont + ajánlás.

---

## 3a — Adat- & izolációs architektúra

### ⭐ Alaptengely: két külön adat-világ (Control plane vs. Data plane)
- **Control plane („a MI világunk"):** leadek, tenantok, **entitlement (előfizetés/jogosultság)**, megvett modulok,
  iparág-definíciók, ország-lokalizációk, outreach, számlázás, a mi analytics-ünk, **mock-gyártás**. A miénk, központi.
- **Data plane („a honlap világa", per tenant):** Site-tartalom (profil, kínálat), runtime tranzakció (elérhetőség,
  foglalás), **vendég-PII**, tenant-belső statisztika. A tenanté, **izolált**.
- **Mock→Site = plane-váltás:** a mock a control plane-ben készül (még lead); konverziókor kiépül a data plane-be (provisioning).

### Döntés 1 — Tenant-izoláció: rétegzett („tiered")
A szándék (vendég-adat elkülönül, „hozzá se érünk") tartandó, de a fizikai „külön DB / tenant" nem skálázik 100k+-ra.
- **Alap: közös séma + sorszintű védelem (RLS)** — minden sor `tenant_id`-hez kötve, a DB tiltja a keresztezést. Skálázik.
- **Vendég-PII: per-tenant titkosítás** — bug esetén is olvashatatlan → erősebb, mint a puszta külön-DB.
- **Opció (prémium/nagy tenant): külön izoláció** (saját séma/DB) — eladható „enterprise" jegy.

### Döntés 2 — Rugalmasság: hibrid (fix mag + definíció-vezérelt JSON)
- **6 mag-entitás fix, típusos oszlopokkal** a közös mezőkre (név, ár, dátum, `tenant_id`, státusz — indexelt).
- A **3 becsatlakozási pont** iparág-specifikus mezői → **strukturált JSON (JSONB)**, amit az Iparág-definíció sémája ír le/validál.
- **Új iparág = új definíció-séma, nem DB-migráció.** → „nincs egyedi fejlesztés" adat-szinten; 1:1 a Fázis 2 mintája.

### Modul-vásárlás = a két plane találkozása (entitlement-vezérelt provisioning)
- Fizetés (control) → **entitlement** frissül → eseményvezérelt **provisioning** a data plane-ben → a Site-on megjelenik a modul.
- A hibrid modell miatt a **legtöbb aktiválás nem sémaváltás**, hanem jogosultság-kapcsoló + induló adat → **azonnali**.
- **Kivétel: külső-rendszert igénylő modulok** (saját domain→DNS, fizetés→fiók-összekötés) = **aszinkron** provisioning, státusz-jelzéssel.

## 3b — Generálás & kiszolgálás

### ⭐ Fő döntés: hibrid render — „statikus váz + dinamikus szigetek"
- **Bemutató** (jelenlét, galéria, kínálat-megjelenítés, leírás, vélemény) → **statikus HTML** (gyors, olcsó, CDN, SEO-barát).
- **Tranzakciós pontok** (elérhetőség, foglalás) → **dinamikus „sziget"** (élő adat kell).
- A statikus/dinamikus határ = a **bemutató-mag ↔ tranzakciós-hármas** = a **minimum ↔ szofisztikált** határ. Egy vonal, három nézet.
- Minimum-jelenlét: tisztán statikus + könnyű „kapcsolat"-sziget (üzenetküldő űrlap).

### Build & serving
- **Per-tenant inkrementális build:** Site a mock→Site konverziókor épül; szerkesztéskor CSAK az érintett tenant oldala újul. AI-fordítás (A3): igény szerint generál → cache.
- **Serving:** statikus → **CDN/edge** (globálisan a vendéghez közel); dinamikus → tenant data plane backend (RLS); **domain-routing** (saját + meta-domain → tenant-feloldás); **aggregátor-portál** a control plane-ből épül.
- Generálás = control plane (agentek); szolgálás = data plane.

## 3c — AI-agent orchestráció

### A fő futószalag: mock-gyártó pipeline (leadenként)
1. **Scrape-agent** (Maps/portál/cégnyilvántartás/régi honlap → nyers anyag)
2. **Profil-építő agent** (strukturált Vállalkozás-profil az iparág-séma szerint)
3. **Copy-agent** (marketing-szöveg, kontextus-alapú, A3 + egyedi mag)
4. **Vizuál/paletta-agent** (arculat-preset; no emoji, SVG)
5. **Kompozíció-agent** (kész, kattintható mock)

- **Orchestráció:** vezénylő leadenként; részleges adat, retry, queue, rate-limit; párhuzamos + batch a tömeghez.
- **Human-gate (A1/A2):** agentek confidence-t adnak → Kurátor-gate routol (auto-pass a magabiztosra, ember a low-confidence-re); az auto-pass idővel tágul.
- **Többi agent:** outreach, onboarding/support, karbantartó (láthatóság-sync), provisioning.
- ⚠️ **Biztonsági határ:** agentek a control plane-ben; a **vendég-PII-hez üzletileg nem férnek** (data plane izolált).

### Döntés — lead-priorizálás: indulásnál ALL IN
- Kezdetben minden leadnek mock (max kiküldés → valós arányok), **közben kategória/konverziós adatot gyűjtünk**.
- Később: **adat-vezérelt lead-scoring** → a drága gyártást a legígéretesebb leadekre. (A1/A2: előbb tanulunk.) Lásd BACKLOG.
- Költség: olcsóbb modellek a tömeg-lépésekre, drágább csak ahol számít (copy, vizuál).

## 3d — Kereszt-metsző enterprise-rétegek

### a) i18n (A3) — beépítve
Nyelv-független forrás + AI-fordítás-cache; determinisztikus rész (jog/formátum/pénznem) ország-szabály-táblából.

### b) Temporal / audit — „időtárolás" (réteges) ⭐
| Adat | Kezelés | Miért |
|------|---------|-------|
| Minden művelet | **audit-log** (ki-mit-mikor) | megfelelőség, biztonság, agent-döntés nyomon követése |
| Tartalom (profil, kínálat, Site) | **verziózás** (visszaállítható) | szerkesztés-hibák, bizalom, support~0 |
| Tranzakció/pénzügy (foglalás, ár) | **immutábilis / bitemporal** | integritás, vita-rendezés, számvitel |
→ Nem „full event-sourcing mindenre"; erős a kritikus helyeken, olcsó máshol.

### c) Security — nagyrészt a helyén
Data plane izoláció (RLS + PII-titkosítás, 3a); agent-határ (3c); **kis támadási felület** (Site-ok biztonságos közös
sablonból, a tenant NEM injektál kódot); secret-kezelés a külső integrációkhoz.

### d) Identitás & hozzáférés (RBAC) — ⭐ KÉTFÉLE user-domain
- **Külső userek** (tenant, lead, vendég): a tenant csak a SAJÁT data plane-jét; a vendég nem a mi identitás-rendszerünk (az adat a tenanté).
- **Belső userek** (a mi csapatunk): **szerepkör-szintű jogosultság-kiosztás** (kurátor / pénzügy / sales / support / admin külön).
- **Agent:** gép-identitás, szűk jogkör (control plane; vendég-PII tiltva).
- ⭐ **Szimmetria:** a rendszer KÉT moduláris platform — a KÜLSŐ (tenant-facing Site-modulok) és a BELSŐ
  (operátor-facing back-office: pénzügy/sales/CRM/bizonylat-mgmt). Mindkettő moduláris, saját RBAC-cal. A belső
  modul-katalógus kidolgozása → BACKLOG (későbbi fázis).

---

## Fázis 3 — fő kimenetek (összefoglaló)
1. ⭐ **Control plane vs. Data plane** szétválasztás; a kettőt entitlement-vezérelt provisioning köti (instant modul-aktiválás).
2. **Tiered tenant-izoláció** (RLS + PII-titkosítás + prémium külön-izoláció).
3. **Hibrid adatmodell** (fix mag + definíció-vezérelt JSONB) — új iparág = konfiguráció, nem migráció.
4. **Hibrid render** (statikus váz + dinamikus szigetek) — a statikus/dinamikus határ = minimum/szofisztikált határ; CDN + per-tenant inkrementális build.
5. **Mock-gyártó agent-pipeline** + kivétel-alapú human-gate; lead-priorizálás: indulásnál all in.
6. **Réteges időtárolás** (audit-log / verziózás / tranzakció-immutabilitás).
7. ⭐ **Két moduláris platform** (külső Site-modulok + belső back-office), külön RBAC-cal.

## Következő: Fázis 4 (Vertikális MVP)
Egy iparág + egy piac, a teljes tölcsér kicsiben, a valódi magra építve („walking skeleton"): a 3 becsatlakozási pont
egy iparágon élesben, minimum-jelenlét statikus render, egy dinamikus foglalás-sziget, a mock→Site provisioning end-to-end.
