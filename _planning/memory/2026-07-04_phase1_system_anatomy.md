# Fázis 1 — Rendszer-anatómia (iparág-független) — MUNKAÁLLAPOT

Dátum: 2026-07-04
Típus: tervezés (Fázis 1, lásd `_planning/ROADMAP.md`)
Státusz: 1a KÉSZ · 1b vázlat + 2 nyitott kérdés · 1c/1d hátra

## 1a — Aktorok & szerepek ✅ (jóváhagyott)

**Emberi / szervezeti:**
1. **Lead** — scraper által beazonosított cél-vállalkozás (elavult VAGY hiányzó honlap). Még nem tud rólunk.
   Életút: *beazonosított → megkeresett → mockot megnyitott → konvertált / elutasított / néma*.
2. **Tulaj (Tenant)** — a lead, aki fizetett és élesített. Self-service adminban szerkeszt, modult vált, előfizetést kezel.
3. **Végfelhasználó / Vendég** — a tulaj SAJÁT ügyfele (foglal, asztalt kér). **NEM a mi üzleti aktorunk.** A generált oldal neki szól.
4. **Operátor (Mi)** — Citoviso-csapat emberi kontroll-pontjai: pénzügyi felügyelet, jogi/eszkaláció. Minimalizálandó.
5. **Kurátor** — a legyártott mock minőségi ellenőre a „nulladik pont" védelmére (egyelőre ember, később automatizálható; lehet Operátor-alszerep).

**Nem-emberi:**
6. **AI-agent-flotta** — a háttér munkaereje: scrape, mock-generálás, copy/tartalom, vizuál/paletta, outreach, onboarding/support agentek. „Majdhogynem kizárólag" ezek dolgoznak.
7. **Külső rendszerek** — adatforrások (Google Maps, portálok, **+ hivatalos cégnyilvántartás [új ötlet]**), fizetési szolgáltató, domain-regisztrátor, e-mail/SMS-küldő, láthatóság-integrációk (Google Business, Facebook).

### 1a DÖNTÉSEK (rögzített)
- **Cégnyilvántartás mint adatforrás** felvéve (ötlet-szinten; erős a „nincs honlap" leadekre: név, cím, tevékenység, kapcsolat).
- **A Vendég nem a mi üzleti aktorunk** — a tulaj ügyfele és felelőssége; jogilag ez a tiszta (nem lépünk a tulaj és vendége közé).
  Következmény-ELVEK (megvalósítás → Fázis 3):
  1. **Kötelező izoláció:** minden megrendelt honlap SAJÁT, szeparált adattár → a vendég-adat tenantonként elkülönül.
  2. Mi legfeljebb **technikai adatfeldolgozó**, NEM adatkezelő a vendég felé.
- ⚠️ Lépték-zászló (Fázis 3): „saját DB minden honlaphoz" több százezres léptéknél komoly kérdés — az IZOLÁCIÓ elvét tartjuk, a megvalósítás (schema-per-tenant / DB-per-tenant / site-store) architektúra-döntés.
- Reseller/affiliate csatorna: egyelőre nincs (a lista teljes közvetlen modellként).

## 1b — A tölcsér mint rendszer-gerinc (VÁZLAT — validálásra vár)

| # | Állomás | Ki csinálja | Fő állapot-váltás |
|---|---------|-------------|-------------------|
| 1 | Lead-felkutatás | scraper-agent + külső források (Maps, portál, cégnyilvántartás) | → beazonosított lead |
| 2 | Mock-gyártás | generáló agentek (adat→copy→vizuál/paletta) | → kész mock |
| 3 | Mock-kuráció | **Kurátor (ember)** — nulladik-pont gate | → jóváhagyott / visszadobott |
| 4 | Megkeresés | outreach-agent, multi-csatorna (e-mail/SMS) | → megkeresett |
| 5 | „Puff-varázslat" | lead böngészője (külső) + tracking | → megnyitott / érdeklődik |
| 6 | Élesítés = konverzió | self-service + fizetés (külső) + jogi nyilatkozat + domain (külső) + **Operátor: pénzügyi kontroll (ember)** | → fizetett → Tenant létrejön, izolált store provisionálva |
| 7 | Hosting / üzemeltetés | infra (automata) | → élő oldal |
| 8 | Upsell / lifecycle | ajánló-agent + self-service katalógus; előfizetés-kezelés | → modul aktiválva / lemondva → inaktiválás |

**Emberi kéz csak 2 helyen:** #3 mock-kuráció (átmenetileg) és #6 pénzügyi kontroll.

### 1b NYITOTT KÉRDÉSEK (innen folytatjuk)
- **(a)** A #3 kuráció MINDEN mockra kell, vagy mintavételes / kockázati jel alapján? (tömeg-léptéknél költség-kérdés)
- **(b)** A #6 pénzügyi kontroll MINDEN tranzakcióra emberi, vagy csak küszöb/anomália fölött? (több százezer usernél a „minden fizetést ember néz" nem skálázik)

## Hátralévő Fázis 1 al-blokkok
- **1c** — fő fogalmak iparág-agnosztikus definíciója (mock, site, modul, iparág-definíció, lead, tenant, előfizetés).
- **1d** — moduláris kompozíció elve (mi a modul, minimum → szofisztikált).
