## ADR-0148 — A képernyő mondja meg, KI beszélt; és a háttérmunka mondja ki, hogy KÉSZ

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA (tulajdonosi választás: mindkét felületen
az **„A" változat**) · **Kapcsolódó:** Elek FK-007 H1, FK-003b L03/L06, ADR-0118/0138
(háttérmunka-életjel), 03-INVARIANTS §B.17 · **Terv-kontraktusok:**
`assets/design-refs/tenant-admin/booking-quote-author/`,
`assets/design-refs/console/gen-progress-end/` · **Őr:** `scripts/quote-author-check.mts`

**① AZ IDÉZET-DOBOZNAK HÁROM SZERZŐJE LEHETETT, ÉS EGYIKET SEM NEVEZTE MEG.**
Mérve (Elek FK-007 H1): a döntés után a vendég eredeti kérdése („van-e etetőszék?")
**eltűnt** a tulaj nézetéből — a helyén előbb a tulaj SAJÁT üzenete, majd a lemondási
indok állt, **ugyanabban a jelöletlen dobozban**. ⛔ Az adat végig megvolt: a
`booking_request.message` oszlopot egyetlen döntési út sem írja felül — a hiba
**kizárólag a megjelenítésben** élt. Ezért: minden doboz megnevezi a szerzőjét
(**Vendég / Ön / Rendszer**), és a vendég kérdése a döntés után is a soron marad.
⭐ **A szerző az ADATBÓL származik, nem a renderelő ágból:** a `decided_by` enum dönt.
A lemondás indokát a **vendég is írhatja** (`public.ts`, `by:"guest"`), tehát a doboz
„Ön"-nek címkézése ott hazugság lenne — mérve, a fixture külön esetként tűzi ki.
`null` (legacy) esetén **nem nevezünk meg szerzőt** („Megjegyzés"): a téves név rosszabb,
mint a hiányzó.

**② A HALADÓ CSÍK SOHA NEM MUTATOTT HALADÁST.** Mérve (FK-003b L03): a csík **mindkét**
felvételen teljesen üres, egyenletes szürke volt, és a 0:00→0:01 közti **teljes pixeldiff
kizárólag az eltelt-idő szövegére** korlátozódott. Az ok: `width:34%` fix kitöltés
végtelenített `conSlide` animációval, **semmilyen adathoz nem kötve** — progress-jel nem
is létezett a rendszerben. Letiltott animációnál a kitöltés `margin-left:-34%`-on áll,
azaz a sávon KÍVÜL (innen az „üres szürke"); egy `prefers-reduced-motion` szabály pedig
`width:100%`-ra állította, vagyis futás közben TELI csíkot mutatott.
**Döntés: a csík kivezetve.** Helyette a motor jelenti a **valós szakaszt**
(`generateEngineMock` → `onStage`: adatok betöltése · fotók gyűjtése · szöveg generálása ·
oldal renderelése), több sablonnál pedig az **elkészültek száma** áll ott.
⛔ **Százalékot nem írunk:** a szakaszok hossza erősen egyenetlen (az AI-hívás a futásidő
zöme), tehát az arányos csík a hátralévő időről hazudna — „az eltelt idő önmagában
őszintébb" (tulajdonosi megfogalmazás).

**③ A HÁTTÉRMUNKA NÉGY DOLGOT TARTOZIK.** Eddig hármat mondtunk ki (elindult · fut ·
miért bukott); a **negyedik** hiányzott: hogy **KÉSZ**. A sáv némán eltűnt — se „kész",
se időtartam, se link az eredményhez. Mostantól a lezáró sor kimondja mindhármat, és
**megmarad** az outcome TTL-jéig, tehát a kurátor akkor is megtudja, ha közben máshol
járt. A bukás is megmondja, **mennyi idő után** állt le.

**④ Gépi kapu:** `scripts/quote-author-check.mts` a RENDERELT kimeneten mér (mindkét hiba
a megjelenítésben élt, nem az adatban). A fixture a TERMÉK típusaiból épül (`InboxItem`,
`LeadDetail`, `MonthView`) — a `scripts/` nincs típus-ellenőrizve, a kézzel gyűjtött
fixture némán elavul. `--self-test` a VALÓDI kimenetet rontja vissza a bejelentett
állapotra (nem üres sztringet mér): **11 sértés**.
⚠️ Az önteszt KÉT saját gyenge állításomat buktatta le: a „kész" a generálás-panelen is
ott van (a rontásnak mindkét helyet el kellett némítania), a szakasz-felirat ellenőrzése
pedig „bármilyen négybetűs szót" keresett, tehát sosem tudott volna pirosra menni.

**Visszafordíthatóság:** 🔄 a feliratok és a szakasz-nevek szabadon hangolhatók;
🚪 a `conSlide` álcsík visszahozása szándékos regresszió lenne — az őr tiltja.
