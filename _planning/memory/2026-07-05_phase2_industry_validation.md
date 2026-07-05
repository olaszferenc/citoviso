# Fázis 2 — Az absztrakció próbája (szállás + vendéglátás) — ✅ KÉSZ

Dátum: 2026-07-05
Típus: tervezés (Fázis 2, lásd `_planning/ROADMAP.md`)
Módszer: mindkét iparágat végigmodelleztük az Iparág-definíció 4 rétegén, majd rétegenként kivontuk a
KÖZÖS magot és az iparág-specifikus eltérést. Eredmény: a tézis (iparág-független mag) **igazolva**.

---

## ① Ügyfélút — közös 7-lépéses gerinc
1. **Felfedezés** (rátalál: SEO/Maps/aggregátor) — közös
2. **Tájékozódás** (milyen a hely) — közös
3. **Bizalom** (vélemények) — közös
4. **Kínálat** (mit kínál) — szoba-katalógus ↔ étlap — *iparág-spec.*
5. **Mérlegelés** (ár + elérhetőség) — dátum-foglaltság ↔ nyitvatartás/asztal — *iparág-spec.*
6. **Konverziós akció** — szoba-foglalás ↔ asztalfoglalás — *iparág-spec.*
7. **Utókövetés** (visszaigazolás, kommunikáció) — közös
> Variánsok a meglévő lépéseken: check-in infó → 7.; elvitel/házhoz → alternatív konverzió (6./④ modul).

## ② Ügyvitel — a tulaj oldali folyamat (az ügyfélút tükre)
Profil-karbantartás · Kínálat-kezelés · Elérhetőség-kezelés · Foglalás-kezelés · Vendég-kommunikáció · Üzleti visszamérés.
Tükör: Profil↔Tájékozódás, Kínálat-kezelés↔Kínálat, Elérhetőség-kezelés↔Mérlegelés, Foglalás-kezelés↔Konverzió, Kommunikáció↔Utókövetés.
**Két határ:**
- **Ki üzemelteti:** Citoviso-agentek = a mi tölcsérünk; a tenant-ügyvitelet a tulaj viszi a mi (nagyrészt automatizálható) eszközeinkkel.
- **Két fizetési sík:** Tenant→Citoviso = előfizetés (a mi bevételünk); Vendég→Tulaj = szolgáltatás-díj (a tulajé, a pénz a tulaj fiókján folyik, nem rajtunk át — jogi tisztaság).

## ③ Adat-séma — közös 6-entitásos mag
Vállalkozás-profil · **Kínálati egység (Offering)** · Ár · Elérhetőség · Foglalás · Vélemény.
Minta: **fix közös mag-entitások + iparág-definíció-vezérelt specializáció** (altípus + attribútumok + idő/ár-szemantika).
Csoportosítás: szállástípus/csomag ↔ menü. Ország az adatban: pénznem (Ár), nyelvi mezők, jogi mezők.

## ④ Modulkészlet — az előző 3 réteg „bekapcsolható" leképezése
- **Univerzális:** jelenlét, galéria, kapcsolat+térkép, vélemény, saját domain, meta-domain+aggregátor, hosting, SEO, Google/FB-sync, analytics, nyelv/AI-fordítás, auto vendég-kommunikáció.
- **Iparág-spec. (szállás):** szoba-katalógus, foglaltság-naptár, online szoba-foglalás, ár-naptár, csomagok.
- **Iparág-spec. (étterem):** étlap/itallap, nyitvatartás+asztal, online asztalfoglalás, elvitel/házhoz, menük.
- Besorolás az 1d taxonómiába: univerzális / iparág-spec. (kínálat-megjelenítő, elérhetőség, konverziós) / ország-függő / tenant-belső.

---

## ⭐⭐ Fázis 2 KONKLÚZIÓ — a tézis bizonyítéka
Mind a 4 réteg (ügyfélút, ügyvitel, adat-séma, modulkészlet) UGYANAZT mutatja:
> **Közös, iparág-független mag + specializáció pontosan 3 becsatlakozási ponton: KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ.**

Egy Iparág-definíció lényegében **ezt a három interfészt** implementálja (+ bemutató-attribútumok); minden más közös.

### A három becsatlakozási pont kifejtve
- **1) KÍNÁLAT** — *„mit lehet választani"*, a **statikus termék-definíció**. A definíció adja: a kínálati egység szerkezetét, a csoportosítást, a megjelenítési mintát. (Szoba `{kapacitás, felszereltség}` ↔ étel `{kategória, allergén}`.)
- **2) ELÉRHETŐSÉG** — *„mikor/mennyi"*, a **dinamikus állapot** (a legtöbb iparág-specifikus logika). A definíció adja: idő-modell, kapacitás-modell, foglalási szabályok. **Folytonos dátum-tartomány-készlet (szállás) ↔ diszkrét idő-slot + asztal-kapacitás (étterem).**
- **3) KONVERZIÓ** — *„a foglalás aktusa"*, az **érték-teremtő tranzakció**: egység + slot + vendég-adat → Foglalás, elérhetőség csökken, opcionális fizetés, visszaigazolás. A definíció adja: foglalási egység, tranzakciós lépések (előleg/megerősítés/lemondás), variánsok (asztalfoglalás vs. elvitel).

**A lánc:** Kínálat (statikus termék) → Elérhetőség (dinamikus állapot) → Konverzió (tranzakció, ami az állapotot fogyasztja).

### Miért skálázható más iparágra (általánosíthatóság-teszt)
Ugyanaz a hármas más szemantikával: fodrász (szolgáltatás / stylist-slot / időpont), autószerviz (szerviz-típus / szerelő-kapacitás / időpont+jármű), bolt (termék / raktárkészlet / kosár). → a modell tényleg iparág-agnosztikus.

### Kapocs az 1d érték-lépcsőhöz
A három pont **mélysége adja a minimum→szofisztikált tengelyt**: a minimum jelenlétnél a hármas statikus/„kikapcsolt" (Kínálat csak bemutató, nincs online foglalás); a szofisztikáltnál a teljes tranzakciós hármas él. **Az upsell = a három becsatlakozási pont fokozatos bekapcsolása.**

---

## A3 alapelv (itt merült fel, felvéve a ROADMAP kereszt-metsző elvei közé)
**Nyelv ≠ korlát; AI-vezérelt, kontextus-alapú lokalizáció.** A tartalmi/marketing szöveget AI fordítja
kontextus-alapon (nem szó-szintű); NEM hardcoded string-táblák, hanem nyelv-független forrás + AI-generált
(cache-elt) variánsok. Három nyelvi felület: Site (vendég), admin (tenant), outreach (lead).
⚠️ Határ: a **jogi szöveg + formátum + pénznem determinisztikus, ország-szabály alapú** — NEM szabad fordító-AI-ra bízva.
Ország-lokalizáció = **Nyelv (AI, dinamikus) | Jog+formátum+pénznem (determinisztikus)**.

## Következő: Fázis 3 (architektúra)
A legfontosabb bemenet: a motort úgy építeni, hogy a **Kínálat/Elérhetőség/Konverzió hármas** legyen a
definíció-vezérelt „csatlakozó", minden más közös. Témák: tenant-izoláció, fix mag + rugalmas attribútum-réteg,
i18n (A3), temporal/audit, hosting-lépték, agent-orchestráció, security.
