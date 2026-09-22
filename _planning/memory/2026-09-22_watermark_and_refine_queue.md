# 2026-09-22 — Két halott ígéret élesítése, és három éles hiba, amiről senki nem tudott

**Feladat (tulaj):** „menjen mindkettő" — ① a §A.2 vízjel-kizárás halott kódja, ② a REFINE-sor.
Döntések: **ADR-0200** (vízjel) · **ADR-0201** (REFINE-sor).

## ① A §A.2 „egyetlen feltétlen kizárás"-a halott kód volt

A `03-INVARIANTS §A.2` azt ígéri, hogy élesítéskor a vízjeles fotó FELTÉTLEN kizáró ok, és a
kapu évek óta ott áll (`photoPolicy.ts:36`). Mérve: a `watermarked` flaget a **termelési úton
SEMMI nem állította `true`-ra** — egyedül egy teszt-fixture. A fék be volt építve, a pedál
működött, de soha senki nem nyomta meg.

**Szállítva:** a vízjel-ítélet a MÁR FUTÓ vision-körbe került (nem új pipeline) · KÜLÖN mező,
nem `subject` kategória (a vízjel ortogonális a tartalomra: egy vízjeles kép is lehet a szállás
tökéletes külső fotója) · a bélyeg a `dropNeverShown`-ban ragad rá, mert **mind a NÉGY**
renderelő út ezt hívja · `PROMPT_VERSION` v2→v3 · migráció 0070 · a kizárás maga sem NÉMA
(a `applyLivePhotoPolicy` kiírja, mit vett le).

**⭐ Az újrapontozás EGYBEN a mérés volt** (tulajdonosi jóváhagyással, ~$0,33): 91 ítéletből
**12 vízjeles**, mind ugyanarról a szállásról. **Szemmel ellenőrizve 2 pozitív + 2 negatív —
mind helyes**; a találatokon ott a `www.zimmerinfo.hu/lelle/kativilla` felirat. **Ez a 12 fotó
eddig kiment volna egy fizető ügyfél ÉLŐ lapjára, idegen cég vízjelével.** Az ítélet nélkül
maradt 192 fotó mintázva **mind halott URL** (404/400) — halott kép amúgy sem megy ki.

⚠️ **Amit NEM bizonyít:** 4 szem-ellenőrzés nem pontosság-mérés. Téves `false`-ot (a veszélyes
irány) nagyobb mintán nem zártam ki — ezért hangos minden kizárás.

## ② A REFINE-javaslatot a review LEZÁRÁSA temette el

A `listReviews()` kiszűr minden párosított review-t, **mielőtt** bármi más lefutna. PROMOTE-ra
helyes; REFINE-ra végzetes, mert azt a gép sosem vezeti át — **a lezárás MAGA temet**. Mérve:
23 blokk állt elérhetetlenül. A kód közben egy kommentben az ellenkezőjét ígéri.

⭐ **Nem elméleti kár:** az egyik eltemetett javaslat (2026-08-02) SZÓ SZERINT kimondta, hogy a
`watermarked` halott kód, és hogy a vízjel-detektálás KÖTELEZŐ. **Hét hétig ült az
`applied/`-ban**, és a §A.2-lyukat végül egy FÜGGETLEN mérés találta meg újra. A válasz megvolt
— csak elérhetetlen.

**Szállítva:** `refine-queue.mts` — a sor SZÁRMAZTATOTT (javaslatok − emberi döntések), az
egyetlen új tartós állapot a `REFINE-DECISIONS.md`. **A gép SOHA nem zár le tételt**, az
indoklás KÖTELEZŐ. Az értesítő a nyitott REFINE-ra is megszólal, külön megnevezve.

## ⛔ Két további ÉLES hiba, amit ez a kör tárt fel

1. **A jóváhagyható ág nem jött létre — a „kör bezárult" élesben NEM állt.** A 2026-09-20-i cron
   létrehozta a worktree-t, majd a `git commit` elbukott: a friss worktree-ben nincs
   `node_modules`/`.env`, ezért a pre-commit őrei `ERR_MODULE_NOT_FOUND`-dal elszálltak.
   Javítva (symlinkek + hangos bukás); **élesben újrafuttatva:** `wt/distill20260922` commitolva
   létrejött.
2. **Az ág-felismerő IDEGEN munka-ág törlését ajánlotta.** A `wt/distill*` glob illeszkedett a
   `wt/distillnotify`-ra — egy ember munka-ágára —, kész `branch -D` paranccsal. Javítva:
   `^wt/distill\d{8}$`.

## ⭐ Az előző kör értesítője ÉLESBEN lefutott

2026-09-20, cron: **SMS + e-mail kiment a tulajnak** (queue-id 43). A gyökérok megszüntetése
végponttól végpontig bizonyított — nem fixture-ön.

## ⛔ SAJÁT HIBÁIM

1. **Az őröm MÁSODSZOR omlott össze piros helyett.** Üres tömb indexelése, `rc=1`, a záró
   összegzés és a takarítás előtt, **egyetlen lelet nélkül** — tehát „elkapva"-nak látszott. A
   testvér-őrben ezt már javítottam ÉS memóriába mentettem; **a javítás nem terjedt át magától
   a testvérre.** Most mindkettőben ott az összeomlás-háló.
2. **Egy szabotázsom nem is alkalmazódott** (komment ékelődött a minta közepébe), és `rc=0`-val
   „az őr vak"-nak látszott. Azóta minden szabotázs BIZONYÍTJA, hogy a csere megtörtént.
3. **Az ADR-szám kétszer kelt el a munka alatt** (0187 → 0196 → végül 0200). Mindkétszer csak az
   írás előtti ÚJRAMÉRÉS fogta meg; 32, majd további 4 idegen commit érkezett közben.
4. **A mérőeszközöm elnémította a saját bizonyítékát:** `execFileSync` sikeres futásnál csak a
   stdout-ot adja vissza, a figyelmeztetés viszont stderr-re megy → hibátlan termék ment pirosra.

## Nyitott

- **23 nyitott REFINE-tétel** (2 ÉLŐ · 1 átfogalmazott · 14 nem található · 6 mérhetetlen) —
  a sor él, a döntés a tulajé: `npx tsx _planning/DOMAIN/_tools/refine-queue.mts`.
- **`wt/distill20260922`** commitolva vár jóváhagyásra (4 PROMOTE blokk).
- A vízjel-detektálás pontossága címkézett korpuszon továbbra sincs mérve.
