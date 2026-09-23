## ADR-0159 — A kiküldött mock-lap KERETEZÉSE: minden látogató az első pixeltől tudja, mit néz

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA (tulajdonosi választás: „**A — diszkrét felső
sáv**", három működő változat és renderelt mobil+asztali képek alapján; a B — nyitókártya —
és a C — jelvény + lebegő fiók — elvetve) · **Kapcsolódó:** ADR-0112 (a leiratkozás a lap
LEGALJÁN; ez az ADR nem vonja vissza), ADR-0087 (név-masthead), ADR-0115 (mozgás-réteg),
ADR-0147 (az injektált réteg elveszti a helyét a sablon CSS-étől), 03-INVARIANTS §B.17
(tényhűség) és §C (outreach) · **Kontraktus:** `assets/design-refs/prospect-page/framing/`
(README + `plan.html` + mobil/asztali kép) · **Kiváltó:** Elek FK-004b (2026-09-13).

**A LELET.** A `/p/<token>` előnézeten a magyarázat a lap **ALJÁN** állt
(`prospectNotice.ts` → `appendToBody`), felső sávot pedig **kizárólag a LEIRATKOZOTT**
látogató kapott. Aki egy hideg levélből nyitotta meg a linket — tehát mindenki, akit
meg akarunk nyerni —, magyarázat nélkül állt a saját szállásáról készült idegen
weboldalon. Ez az első és sokszor egyetlen képernyő, amit valaha lát tőlünk.

**A DÖNTÉS.** A követett előnézet **minden** látogatója a lap tetején, a folyamban
(nem overlay, nem ragadó) kap egy diszkrét sávot, ami **azonnal** kimondja, hogy ez
**honlap-terv az ő szállásáról**, **kitől** jött (a hirdető a configból), és hogy **ez
még nem élő oldal**; a **miért kapta** (jogos érdekű megkeresés, Grt. 6. § / GDPR
6. cikk (1) f)) plusz a mérés-tájékoztató, az Adatkezelési tájékoztató és a
**Leiratkozás** egy kattintásra, **helyben** nyílik.

**AMI KÖT (a kontraktus rövid alakja):**

① **Minden látogatónak.** A leiratkozott továbbra is a SAJÁT, más szövegű sávját kapja
(nem mérünk, nem küldünk emlékeztetőt) — és **egy látogató sosem lát kettőt**, mert a
kettő mást állít: az egyik rögzít, a másik nem (§B.17).

② **A jogi részlet JS NÉLKÜL is nyílik** — natív `<details>`, nem szkriptelt kapcsoló.
A mock egy IDEGEN böngészőben nyílik meg; a kiút nem múlhat egy betöltött szkripten.

③ **A felső sáv NEM váltja ki az alsó jogi lábazatot** (ADR-0112 érvényben marad), és
a két hely **nem két igazság**: a mondatok EGY forrásból (`LEGAL_BASIS`,
`TRACKING_NOTICE`, `legalLinks`) állnak elő.

④ **Üres hirdető-confignál nem találunk ki nevet** (§B.17 magunkra is áll).

⑤ **Skin-független** (a modul két engedélyezett semleges szürkéje), mert az
engine-renderelt mock nem tölti be a `citui.css`-t, és 19 sablonon kell olvashatónak lennie.

⑥ **A sablon CSS-e nem veheti el a helyét.** Mérni kell, nem feltételezni: a sáv a lap
tetején marad, teljes szélességű, **lenyomja** a lapot, és semmi nem fest fölé.

**AZ ŐR.** `scripts/prospect-framing-check.mts` — a RENDERELT lapon, 5 sablonon × 2
szélességen, a nyitó-animáció lefutása után; öt piros önteszttel és álpozitív
kontrollal a leiratkozott ágra. A „lenyomja a lapot" állítás referenciája **ugyanaz a
lap a sáv nélkül** (a különbség a sáv magassága) — nem egy beégetett szám.

**AMIT A MÉRÉS ÍRT ÁT (mind a saját mérőeszközömben volt a hiba):** a csukott
`<details>` tartalmának **van** layout-doboza Chromiumban, ezért a méret-alapú
„látszik?" kérdés a csukott jogi részt nyitottnak mondta (`checkVisibility()` a helyes
kérdés); egy sablon **rejtett** fixed navjának (`opacity:0`) a **gyerekei** `opacity:1`-et
számolnak, ezért hamis „a sáv fölé fest" riasztást adtak (`checkOpacity` az ŐSÖKET
nézi); az aurora `body>*{position:relative}`-je miatt a statikus-horgony keresés **null**-t
adott. És az „átfedés" önmagában **nem hiba**: egy parallax réteg 16 px-re benyúlik a sáv
sávjába, de MÖGÉ fest — a helyes kérdés az, hogy ki fest FÖLÉ.

**⑦ NINCS NYITÓ-ANIMÁCIÓ A KIKÜLDÖTT MOCKON** *(a korábbi nyitott pont LEZÁRVA,
tulajdonosi döntés ugyanaznap: „kapcsold ki a nyitó-animációt a kiküldött mockon").*
Két sablon teljes képernyős ADR-0115 introval indul — `arch-frames` (`.cit-fintro`,
~4,7 mp) és `wordmark-grow` (`.cit-intro`, **6 mp-nél még futott**) —, és alatta a
keretezés sem látszott. A `/p/<token>` lapon mindkettő ki van kapcsolva, **két
egymást fedő fékkel**: a `<html data-cit-no-intro>` (a mozgás-réteg saját kapcsolója,
így a lap `overflow:hidden`-be sem kerül) **és** egy `<style>` a válaszban — ez utóbbi
a JS-nélküli látogatóért **és a RÉGI artefaktumokért** (a lap egy hetekkel korábban
rendelt fájlból jön, tehát az AKKORI no-JS hálót viszi). Az őr mindkét felét külön
piros önteszttel méri. ⚠️ A kapcsoló első változata NEM ÉRT HATÁLYBA: az idempotencia-
őrszem (`includes("data-cit-no-intro")`) az intro SAJÁT szkriptjének forrására
illeszkedett, ezért a függvény érintetlenül adta vissza a lapot — a `<html>` TAG-et
kell kérdezni, nem a dokumentumot.

**⑧ ÉS EGY HIBA, AMI EMELLETT DERÜLT KI: JS NÉLKÜL A KÉT INTRO ÜRES PANELT ADOTT.**
A `.cit-fintro` / `.cit-intro` `position:fixed; inset:0`, **opak** háttérrel; a benne
lévő nevet a `.cit-on` osztály teszi láthatóvá, és az elemet is JS veszi ki. Szkript
nélkül **egyik sem történik meg**: a látogató egy teljes képernyős üres panelt kap
(fényképezve, 390 px, mindkét sablonon) — és ez **az élő tenant-lapokra is állt**.
A `runtime.ts` `<noscript>` hálója eddig csak a *rejtett* tartalmat kényszerítette
láthatóvá; itt az ellenkezője kellett: egy overlay, aminek JS nélkül semmi dolga.
Ez **hibajavítás, nem tervezői döntés**, ezért a hálóban van, nem a `/p/` úton.

**Visszafordíthatóság:** 🔄 — felület-szintű, nulla migráció, nulla adat-mozdulat.
🚪 Kifelé tett vállalás: a leendő vevőnek mutatott első képernyő tartalma.
**Élesítés NINCS** (§0.3) — külön, kimondott tulajdonosi utasítás kell hozzá.
