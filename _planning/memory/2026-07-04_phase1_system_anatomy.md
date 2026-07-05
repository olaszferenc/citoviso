# Fázis 1 — Rendszer-anatómia (iparág-független) — ✅ KÉSZ

Dátum: 2026-07-04
Típus: tervezés (Fázis 1, lásd `_planning/ROADMAP.md`)
Státusz: **1a–1d mind KÉSZ.** Következő: Fázis 2 (absztrakció próbája 1-2 iparággal).

---

## 1a — Aktorok & szerepek ✅

**Emberi / szervezeti:**
1. **Lead** — scraper által beazonosított cél-vállalkozás (elavult VAGY hiányzó honlap). Még nem tud rólunk.
   Életút: *beazonosított → megkeresett → mockot megnyitott → konvertált / elutasított / néma*.
2. **Tulaj (Tenant)** — a lead, aki fizetett és élesített. Self-service adminban szerkeszt, modult vált, előfizetést kezel.
3. **Végfelhasználó / Vendég** — a tulaj SAJÁT ügyfele. **NEM a mi üzleti aktorunk.** A generált oldal neki szól.
4. **Operátor (Mi)** — Citoviso-csapat emberi kontroll-pontjai: pénzügyi felügyelet, jogi/eszkaláció. Minimalizálandó.
5. **Kurátor** — a legyártott mock minőségi ellenőre a „nulladik pont" védelmére (egyelőre ember, később automatizálható).

**Nem-emberi:**
6. **AI-agent-flotta** — a háttér munkaereje: scrape, mock-generálás, copy, vizuál/paletta, outreach, onboarding/support agentek.
7. **Külső rendszerek / Harmadik fél** — adatforrások (Maps, portálok, cégnyilvántartás), fizetési szolgáltató, domain-regisztrátor, e-mail/SMS-küldő, láthatóság-integrációk (Google Business, Facebook).

### 1a döntések
- **Cégnyilvántartás mint adatforrás** felvéve (erős a „nincs honlap" leadekre).
- **A Vendég nem a mi üzleti aktorunk** → jogilag tiszta. Következmény-ELVEK (megvalósítás → Fázis 3):
  1. **Kötelező izoláció:** minden megrendelt honlap SAJÁT, szeparált adattár → vendég-adat tenantonként elkülönül.
  2. Mi legfeljebb **technikai adatfeldolgozó**, NEM adatkezelő a vendég felé.
- ⚠️ Lépték-zászló (Fázis 3): „saját DB minden honlaphoz" több százezres léptéknél komoly kérdés — az IZOLÁCIÓ elvét tartjuk, a megvalósítás (schema-per-tenant / DB-per-tenant / site-store) architektúra-döntés.
- Reseller/affiliate csatorna: egyelőre nincs (tiszta közvetlen modell).

## 1b — A tölcsér mint rendszer-gerinc ✅

| # | Állomás | Ki csinálja | Fő állapot-váltás |
|---|---------|-------------|-------------------|
| 1 | Lead-felkutatás | scraper-agent + külső források | → beazonosított lead |
| 2 | Mock-gyártás | generáló agentek (adat→copy→vizuál/paletta) | → kész mock |
| 3 | Mock-kuráció | Kurátor (ember, kivétel-alapon) | → jóváhagyott / visszadobott |
| 4 | Megkeresés | outreach-agent, multi-csatorna (e-mail/SMS) | → megkeresett |
| 5 | „Puff-varázslat" | lead böngészője (külső) + tracking | → megnyitott / érdeklődik |
| 6 | Élesítés = konverzió | self-service + fizetés + jogi nyilatkozat + domain + Operátor pénzügyi felügyelet | → fizetett → Tenant létrejön, izolált store |
| 7 | Hosting / üzemeltetés | infra (automata) | → élő oldal |
| 8 | Upsell / lifecycle | ajánló-agent + self-service katalógus; előfizetés-kezelés | → modul aktiválva / lemondva → inaktiválás |

### 1b döntések
- **(a) Mock-kuráció:** időben csúszó, **kockázat-alapú**. Induláskor minden mockot ember néz (a hibajelek betanítására) → ahogy nő a volumen, automata **minőség-gate (confidence)**, ember csak a low-confidence / kockázati mockokat látja. A kockázat **aszimmetrikus** (kiküldött hibás mock >> visszatartott) → bizonytalanság esetén ember. Skálázó: batch-grid review.
- **(b) Pénzügyi kontroll:** **NEM** minden tranzakcióra emberi. Tranzakció-befogadás = automata (fizetési szolgáltató). Ember = **pénzügyi felügyelet** kivétel-/aggregát-szinten (csalás, chargeback, nagy összeg, jogi flag, havi zárás).
- ⭐ **INVARIÁNS (iparág-független):** *Kivétel-alapú ember a hurokban, amely idővel önmagát vonja vissza.* Az ember sosem a fősodorban áll (az automata), csak a bizonytalan/kockázatos kivételeknél; a fősodor betanulásával az emberi lefedettség csökken. Érvényes minden humán-pontra (kuráció, pénzügy, support).

## 1c — Fő fogalmak (iparág-agnosztikus) ✅

**Motor-absztrakció:**
- **Iparág-definíció** — a motor cserélhető paramétere, 4 réteg: (i) vendég ügyfélútja, (ii) tulaj ügyvitele, (iii) adat-séma, (iv) modulkészlet. Új iparág = új definíció, nem új kód.

**Tölcsér-alanyok:**
- **Lead** — beazonosított cél-vállalkozás, még nem ügyfél.
- **Tenant** — konvertált (fizetett) ügyfél mint **izolált** egység (saját Site-ok, adattár, admin, előfizetés).

**Termék-artefaktumok:**
- **Vállalkozás-profil** — konkrét vállalkozás strukturált tényadata az iparág-séma szerint (a régi „Property" iparág-agnosztikus utódja; az „adat-objektum").
- **Mock** — személyre szabott, kattintható előnézet („a bizonyíték"). Ideiglenes, nem-éles, jogilag DEMÓ (hotlink-kép ok).
- **Site** — élesített, fizetett, publikus honlap; jogtiszta tartalommal, domainen, modulokkal.
- **Modul** — komponálható funkcionális építőelem; univerzális vagy iparág-specifikus; árazási egység is.

**Domain (2 külön fogalom):**
- **Saját domain** — a tenant saját neve (meghatalmazással regisztrálva vagy hozott).
- **Meta-domain jelenlét** — `nev.citoviso.com`. ⭐ ELV: **MINDIG megmarad**, akkor is, ha van saját domain.
  → **aggregátor / portál vektor** (kereshető, foglalható katalógus): hálózati elérés, SEO, **foglalás-irányítás**,
  a saját „booking.com-alternatívánk" a tenantoknak. Kell hozzá egy **kereső-/portálfelület**. Kifuttatás: Fázis 6.

**Kereskedelmi réteg:**
- **Előfizetés** — Tenant ↔ Citoviso viszony: mely modulok aktívak, milyen díjjal, milyen állapotban. Inaktiválás ehhez kötött. (Konstrukció: Fázis 6.)

**Munkaerő / események:**
- **Agent** — specializált, autonóm AI-végrehajtó.
- **Megkeresés (Outreach)** — elérési kísérlet egy csatornán a mock linkjével; állapotos; GDPR-releváns.

**Harmadik fél** — külső szereplő (adatforrás, fizetés, domain, kézbesítés, láthatóság, jövőbeli partner); mindegyikhez jogi/szerződéses keret + provenance.

**Ország(-lokalizáció)** — elsőrangú fogalom: jogi rezsim, nyelv/pénznem, helyi iparági eltérések, **árazás**.

### ⭐ 1c legnagyobb szerkezeti felismerés
A motor **KÉT tengely** mentén paraméterezett: **Iparág × Ország.** Egy iparág-definíció önmagában nem elég — kell rá ország-lokalizáció (jog + nyelv/pénznem + helyi eltérések + árazás). A generáló *mag* közös; a két tengely tölti fel.

> **Site = Tenant + (Iparág-definíció × Ország-lokalizáció) + Vállalkozás-profil + választott Modulok.**
> A gép nem csak „iparág-agnosztikus", hanem **iparág- ÉS ország-agnosztikus**.

## 1d — Moduláris kompozíció elve ✅

**Modul = önállóan hozzáadható/elvehető funkcionális képesség** a Site-on: diszkrét érték, önálló árazási egység, bármikor be/kikapcsolható, van adat-igénye/megjelenése/esetleg agent-háttere/harmadik-fél-függése.

**Taxonómia (a két tengely mentén):**
1. **Univerzális** — minden iparágban azonos: minimum-oldal, galéria, kapcsolat/térkép, saját domain, hosting, SEO, Google/FB-sync, analytics, meta-domain aggregátor-listázás.
2. **Iparág-specifikus** — az Iparág-definícióból: szállásnál foglalás+foglaltság+szoba/ár; étteremnél asztalfoglalás+étlap.
3. **Ország-függő réteg** — egy modulra: helyi fizetés, jogi megfelelés (consent/ÁSZF), számlázás/adó, nyelvi variáns, helyi platformok, árazás.
4. **Tenant-belső (operatív) — PLACEHOLDER** — CRM-lite, statisztika a tenant SAJÁT izolált adatán. Kidolgozás: Fázis 2 után. ⚠️ Cross-tenant aggregáció = külön jogi kérdés (nem most).

**Vertikális érték-lépcső (az upsell gerince):**
1. **Minimum jelenlét** (belépő, az élesítés első fizetős szintje) — szép reszponzív oldal, galéria, elérhetőség, térkép (a *láthatóság*).
2. **Közép** — saját domain, SEO, Google/FB-sync, analytics, több nyelv.
3. **Szofisztikált** — tranzakciós mag: online foglalás/asztalfoglalás, fizetés, aggregátor foglalás-irányítás, autom. vendég-kommunikáció.
A Site **élő kompozíció, nem fix csomag** — bármikor feljebb lép.

**Kompozíciós elvek:**
- **À la carte a fő modell** (egyedi kiválogatás); a csomagok (belépő/pro/prémium) csak ajánlott előre-válogatások (árazás: Fázis 6).
- **Függőségek/kizárások léteznek** (pl. online fizetés kell a foglaláshoz) — a rendszernek ismernie kell őket.
- **Dinamikus, bővülő katalógus:** új modul = új képesség MINDEN releváns tenantnak, egyedi fejlesztés nélkül.

### 1d döntések
- **Vendég-oldali modulok: KIHAGYVA** (konzisztens: nem lépünk a tenant és vendége közé).
- **Tenant-belső CRM/statisztika:** a tenant SAJÁT izolált adatán → nem sérti az elvet; kidolgozás Fázis 2 után; kategória placeholderként felvéve, hogy a Fázis 3 architektúra ne zárja ki.

---

## Fázis 1 — fő kimenetek (összefoglaló)
1. **Aktor-modell** (7 szereplő) + **kötelező tenant-izoláció** + vendég = nem üzleti aktorunk.
2. **8-állomásos tölcsér-gerinc**; ember csak kuráció + pénzügyi felügyelet, **kivétel-alapon, önmagát visszavonva**.
3. **Fogalmi szótár** iparág-agnosztikusan; kulcs-kettősségek: Lead→Tenant, Mock→Site.
4. ⭐ **Iparág × Ország kétdimenziós motor**; Site-képlet.
5. ⭐ **Meta-domain mindig megmarad → aggregátor/portál vektor** (Fázis 6).
6. **Modul-taxonómia** (univerzális / iparág-spec. / ország-függő / tenant-belső) + minimum→szofisztikált lépcső.

## Következő: Fázis 2
Az absztrakció próbája **1-2 konkrét iparággal** (szállás + vendéglátás): mindkettőt végigmodellezni a fenti fogalmi kereten (Iparág-definíció 4 rétege), és a KÖZÖSET kivonatolni — validálva, hogy a mag tényleg iparág-független.
