## ADR-0195 — A publikus szoba-kártya: a mondat szétszedése, egy közös felugró, és egy horgony 12 sablonban (2026-09-21)

**Kontextus.** A jóváhagyott B terv (§2b kör, tulajdonosi jóváhagyás 2026-09-21,
kontraktus: `assets/design-refs/tenant-site/rooms-card/README.md`) megvalósítása.
A kiindulás egy kimondott kerülő út volt a kódban: *„they ride the note line every
template already renders — **no template edit**"*. A `src/tenant/editor.ts` egyetlen
`note` mezőbe fűzte a leírást ÉS a felszereltséget, ezért a vendég ezt kapta egy
mondatban: „az hogy … · Ingyenes Wi‑Fi · Síkképernyős TV · …" — nem tudta szétválasztani
a tulaj szavait egy funkció-listától.

**Döntés.**

**① A `note` szétszedése EGY helyen, de a fogyasztók egyenkénti döntésével.**
A `Room` kap `description`, `amenities: {label, icon}[]`, `photos[]`, `slug`,
`wholeProperty` mezőt; a `note` MARAD a minta-szobáknak és a régi archetípus-
renderelőknek. Azoknak `roomNoteLine(r)` adja vissza a történeti egysoros alakot —
enélkül négy legacy renderelő NÉMÁN semmit nem írt volna ki
(`feedback_widening_a_shared_list_needs_per_consumer_decision`). Mérve: **13 fájl**
fogyasztotta a szoba-`note`-ot (a brief 11-et becsült); ebből kettő — `markets.ts`,
`console/partnerData.ts` — NEM szoba-note, hanem azonos nevű, független mező.
A `multilangCore.ts` mindkét irányban bővült: a `description` és az `amenities[].label`
fordul, az `icon` (SVG-markup) érintetlenül megy át.

**② A közös kártya-réteg a `templateKit.ts`-ben, nem 13 másolatban.**
`roomShell()` (a kattintható héj + a `data-cit-room` horgony), `roomHint()` (a képen álló
jelvény), `roomDetails()` (a no-JS `<details>`, ami egyben a felugró ADATFORRÁSA).
A 12 saját szoba-szekciót rajzoló sablon + a közös tartalék ezt hívja be — a markup
sablon-specifikus, a KONTRAKTUS egy helyen él. A kártya **valódi `<a href="/apartman/
<slug>">`**, mert az egység-aloldal SEO-belépő (ADR-0041/0044 §12-13); a JS csak elfogja
a sima bal-kattintást, a Ctrl/⌘/középső kattintás továbbra is megnyitja az aloldalt.

**③ Egy predikátum a thin-content kapura.** `unitPageIsWorthWriting()` — ugyanazt olvassa
az aloldal-ÍRÓ ciklus és a kártya link-döntése. Két példány előbb-utóbb eltérne, és az
eltérés alakja egy 404-re mutató kártya lenne (`feedback_one_rule_two_copies`).

**④ A felugró a runtime-ban születik** (`register("rooms", mountRoomDetails)`), a
`mountGallery` mintájára: RÁÉPÜL a meglévő markupra. A `<details>`-t beolvassa és
KIVESZI a DOM-ból — szándékosan: egy csukott `<details>` nulla sor-dobozú szövegcsomókat
hagy a kártyán, amit a szoba-kártya őre joggal hív hibának. A teljes méretű nézet a MÁR
MEGLÉVŐ `.cit-lb` lightbox; az ESC EGY réteget hámoz (a felugró kezelője a DOM-ból
kérdezi meg, fent van-e a nagykép — nem a listener-sorrendből). A görgetés-zár közös
(`syncScrollLock`): a belső réteg bezárása nem adhatja vissza a görgetést egy még
takart lapnak.

**⑤ A galéria RUGALMAS, nem fix magasságú — ez a döntés, nem hangolás.**
A terv 260 px-es állóképe artdeco-n átment és három másik sablonon megbukott: a felugró
a SKIN betűit viseli, ezért egy pixel-költségvetés, ami egy skinre illik, nem szabály,
hanem véletlen (`feedback_barely_passing_value_hides_a_dead_rule`). A szoba-TÉNYEK
kapják a helyet, a kép veszi, ami marad (`flex: 0 1 auto` a galérián, oszlop-flex
belül, hogy a zsugorodást a STAGE nyelje el és az indexkép-sáv megtartsa a 68 px-ét).

**⑥ Az overlay pozíciója `!important` — kimondott, mért kivétel.** Az `aurora`
`body>*:not(.au-aurora):not(.au-nav){position:relative}` szabálya (0,2,1) leütötte a
`.cit-rd`-t (0,1,0) ÉS a duplázott `.cit-rd.cit-rd`-t (0,2,0) is: a „felugró" 4029 px-re
lent, NULLA magassággal nyílt — a vendég kattintott, és nem történt semmi. A
specificitás-verseny olyan verseny, amit a lap egy további `:not()`-tal mindig megnyer.
⭐ Ugyanez a lapszabály a MEGLÉVŐ nagykép-réteget is érintette, csendben, eddig is.

**Amit a mérés fogott meg — és amit nem én.**
Saját kapu (`scripts/room-details-check.mts`, **38 mérés · 114 kártya · 114 horgony**,
**7 visszarontásos negatív önteszt** kontrollal): a bejelentett három csapda mindegyike
(kifestett vs. `[hidden]`, DOM≠képernyő, a magasság a burkolón), a horgony-lefedettség,
a rétegzett ESC, a fókusz-visszatérés, a nulla JS-hiba.
⛔ **A kártya összezsugorodását egy IDEGEN őr fogta meg** (`room-card-overflow-check`):
a kattintható héj egyetlen flex-elemmé fogta a kártya tartalmát, és egy
`align-items:flex-start` rácsban a szoba fotója teljes szélességűről **75×50 px-re** esett
össze — az én kapum ezt nem kérdezte. Most kérdezi
(`feedback_restructure_blinds_a_foreign_guard` fordítottja: az idegen őr LÁTOTT).
⛔ **A saját mérőeszközöm két álbukást gyártott:** a hálózat-tiltásom `net::ERR_FAILED`-jét
„JS-hibának" olvasta, és a nyers sztring-illesztés három hamis leletet adott a
csupa-nagybetűs sablonokon. Mindkettő javítva, mindkettő kimondva.
⛔ **Két visszarontásom NEM vitt pirosra:** az egyik olyan mechanizmust célzott, ami már
nem létezik (a runtime kiveszi a `<details>`-t), a másik gyengébb volt a javításnál.
Egy visszarontás, ami nem reprodukálja a hibát, nem bizonyít semmit.

**Következmények.**
- A kártyán: kép + jelvény, név, férőhely, **ár**, „Részletek", „Foglalás". Az ár
  tulajdonosi döntéssel MARAD (a kontraktus §5 kimondja, hogy a terv nem dönti el).
- A jelvény hover-független és nem ígér többet, mint ami van: 2+ fotó → „{n} kép",
  EGY fotó → „Részletek" (soha nem „1 kép" — az galériát ígérne).
- Mérve: 19 sablonból **12** rajzolja saját maga a szoba-kártyát, **7** a közös
  tartalékra bízza; mind a 19 viseli a horgonyt, és őr tartja életben.

**NYITOTT.**
- ⏳ **Négy sablon a tulaj döntésére vár** (`arch-frames`, `tilted-gallery`,
  `wordmark-grow`, `transit`): ezek kártyája se leírás-sort, se Foglalás gombot nem
  ismert. A szállított változat „A": a KÉPEN álló jelvény az egyetlen belépő, a sablon
  saját rajza marad. A „B" az artdeco-szerű kártyára rajzolná át mind a négyet.
- ⏳ **Az ár-sor alakja.** A tulaj felvetette a „minimumtól" formát; ma a kártya a teljes
  SÁVOT mutatja („24 000–32 000 Ft / éj"), mert az Elek FK-007 mérés szerint a mai nap
  ára ellentmondott az ár-táblázatnak ÉS a foglaló-widgetnek egy képernyőn. A váltás egy
  korábbi, MÉRT döntést írna felül — külön kör, külön mérés.
- ⏳ **Az admin szoba-szerkesztő** (kártyás/nyitható, képfeltöltés, borítókép) külön
  §2b kört kér — a kontraktus §5 kiveszi a hatókörből.
