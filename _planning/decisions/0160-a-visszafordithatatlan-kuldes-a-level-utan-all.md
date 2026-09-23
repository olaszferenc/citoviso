## ADR-0160 — A visszafordíthatatlan küldés a levél UTÁN áll, ragadós sávban; a levél szövege pedig nem görgető doboz (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA (tulajdonosi választás: a bemutatott három
változatból a **„B — Ragadós küldés-sáv"**) · **Forrás:** Elek FK-004 (B6 köteg) ·
**Terv-kontraktus:** `assets/design-refs/console/outreach-sticky-send/` (plan-B.html + README.md
+ 4 kép) · **Őr:** `scripts/outreach-send-bar-check.mts` · **Kapcsolódó:** ADR-0147
(láthatóság = kifestve ÉS nem takart), ADR-0122 (a cím-szintű egyszer-küldés), §C.1/§C.2.

**Kontextus — mérve, nem becsülve.** A `/prospect/<id>/draft` lapon a kezelő
**visszafordíthatatlan** üzenetet küld egy idegennek. A küldés-gomb 1280 px-en **670 px**-rel,
390 px-en **1 641 px**-rel (≈ két telefon-képernyő) a levél KEZDETE ELŐTT állt, a lap alján
pedig se gomb, se visszaút nem volt. A levél szöveges változata `rows="22"` dobozban ült
(látható 445 px): 390 px-en a tartalom **61 %-a (702/1147 px) rejtve** — az aláírás, a
leiratkozó mondat, a **leiratkozó URL** és a **hirdető-azonosítás** —, és **1280 px-en is
kiesett** a „A megkeresés küldője: …" sor (§C.2). ⛔ Ugyanez a hibaosztály az iframe-en már
javítva volt, sőt őr is állt rajta — de az `outreach-preview-check` **csak az iframe-et mérte**
(`grep -c mailbody` = 0), ezért ZÖLDEN állt a csonkolás mellett. Nem tévedett: **más kérdésre
válaszolt.**

**Döntés.**
① **A levél szövege nem görgető doboz.** A `textarea rows="22"` helyén `<pre>` áll
(`white-space: pre-wrap`), `max-height` és `overflow` NÉLKÜL. Ez nem „nagyobb doboz": egy
`<pre>`-nek nincs scrollportja, tehát a hibaosztály **szerkezetileg** szűnik meg — JS-sel és
JS nélkül egyaránt. (A vágott előnézet mindig a VÉGÉT veszi el, és a jogi rész ott van.)
② **Minden állapot-átíró küldés a levél UTÁN, ragadós sávban.** A `/send`, `/send-pair`,
`/send-pair-sms` és `/send-all` kikerül a csatorna-kártyákról egy `position: sticky; bottom: 0`
sávba; a kártyák az ÁLLAPOTOT és a címzettet mondják. A sáv **mindig elérhető**, de sosem előzi
meg a levelet.
③ ⛔ **A sáv a `.panel`-en KÍVÜL ül.** A konzol `.con .panel { overflow-x: hidden }`-je a panelt
**scroll-konténerré** teszi, és egy azon belül ülő sticky a panel dobozához tapadna, nem a
képernyőhöz — néma díszlet lenne. A sáv a `.con-main` közvetlen gyereke.
④ **A sáv ZÁRVA indul, és a levél VÉGE nyitja** (`#cit-letter-end` + IntersectionObserver),
kimondva, hogy miért zárva — a kattintás ELŐTT, nem visszautasító sávban.
⑤ ⛔ **Fail-safe irány: a kiszolgáló NYITOTTAN rendereli, a SZKRIPT zárja be.** Egy halott
szkript így a kaput veszti el, nem a kezelő munkáját; a valódi garancia a POST-on újrafutó §C.
Fordítva a néma hiba egy örökre tiltott gomb lenne, ami tévesen „nem küldhető"-t állít.
⑥ Az MMS/SMS idővonal a levél UTÁN áll (nem ékelődik a Tárgy elé), és a lap alján is van
`← Vissza a leadhez`.

**Őr — és amit MAGÁN tanult meg.** `scripts/outreach-send-bar-check.mts`, a valódi konzolon,
valódi prospect-soron, 390 és 1280 px-en: sorrend (DOM **és** folyam-geometria, a sticky
ideiglenes kikapcsolásával) · **tapadás VALÓDI görgetéssel**, 5 mintavétel · láthatóság **KÉT
kérdésre** (ADR-0147: opacity-lánc = 1 **ÉS** `elementFromPoint`) · a jogi vég **pixelben**
(Range-ből vett dobozra) · a kapu zárva-indul/nyílik · JS nélkül nem tiltott.
⚠️ **Két saját mérési hibát fizettem meg menet közben, mindkettő az ADR-0147 tanulsága:**
(a) a felengedett gomb `opacity`-ja a `--citui-transition` miatt 0,5→1 **úszik**, miközben a
kapu attribútuma azonnal vált — az első változatom ezért 0,5-öt mért egy hibátlan gombon
(fantom-piros). Most a **pixelre** várunk rAF-enként, a keret a termék saját állandójából
levezetve (220 ms + gép-terhelési ráhagyás), és ha sosem fest ki: **PIROS**.
(b) a dizájn-mag `html { scroll-behavior: smooth }`-t ír elő, ezért a `scrollTo` után azonnal
olvasott doboz a RÉGI pozícióhoz tartozik — az őr így a leiratkozó linket „takartnak" mérte
390 px-en. `behavior: "instant"` + a megérkezés kivárása.
⛔ **Ugyanez a verseny ült a `mms-preview-gate-check`-ben is** (`scrollIntoView` után azonnali
`elementFromPoint`): eddig érme-feldobás volt, a megnőtt laptól vált állandó pirossá. Javítva —
**a viselkedés igazolása után**, nem előtte; az őr saját öntesztje (⑧) változatlanul fog.
**Piros önteszt (3 hibaosztály, a betöltött lapon, a termék forrásának érintése nélkül):**
a sávot a panelbe visszatéve a tapadás bukik · `opacity:0`-nál a **geometriai** verdikt ZÖLD
marad és a **láthatósági** megy pirosra (ez a lényeg) · a levelet 445 px-re vágva a jogi vég
pixel-próbája bukik. Összesen **7 állítás megy pirosra**.

**Amit ez a döntés NEM dönt el.** A Megkeresés-panel (`/lead/<id>#prospects`) változata **külön**
jön. A levél nyers tokenes URL-je („a csupasz URL BIZALMI elem") és az ár-doboz „-tól" vége /
a szándékos HTML↔text `p3`-eltérés **KÓDOLT DÖNTÉS** — a tulaj külön kérdezi meg, itt nem írtuk át.

**Visszafordíthatóság:** 🔄 felület-változás, adat- és sémaérintés nélkül.
**Élesítés:** NINCS (§0.3) — külön, kimondott engedély kell hozzá.
⚠️ **Sorszám:** `git fetch` után, közvetlenül írás előtt ellenőrizve (az `origin/main` legmagasabbja
0156 volt) — a landolás pillanata is ütközhet.
