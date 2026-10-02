## ADR-XXXX — Nincs saját-fotó nyomás: a vevő a képekről nyilatkozott, az élesítés nem függ saját fotótól (2026-10-02)

**Státusz:** elfogadva (tulaj-döntés; SUB, koordinátor: CIT „élesi teszt” fő session; brief `~/rc-briefs/javitas-elek-0930/l1-megkereso-level.md` ⑤) ·
**Lokál, nem élesítve** (§0) · **Kapcsolódó:** a vásárláskori képjogi nyilatkozat (`src/legal.ts`), ADR-0224 (tenant-admin Linear),
az `assets/design-refs/tenant-admin/admin-linear/` kontraktus.

### Kontextus
A vevő a rendeléskor nyilatkozik, hogy az oldal képeit jogosan használhatja — ez lezárt tulaj-döntés. A tenant-admin
ennek ellenére azt üzente a fizető vevőnek, hogy a képei nem elegendők: borostyán figyelmeztető sáv („Az élesítéshez a
saját, jogtiszta fotói kellenek”), elsődleges „Cserélje sajátra” gomb az Áttekintésen, és egy „Élesítés előtt” jelölésű
teendő („Töltsön fel saját fotókat”), ami csak saját feltöltéssel zárulhatott. A modul-leírás („élesítéskor az Ön saját
képeivel töltjük fel”) és a mock-kérő levél („a saját képeivel … véglegesítjük”) ugyanezt ígérte/követelte.

### Döntés
1. Egyetlen felület, levél, súgó vagy kontraktus sem köti az élesítést saját fotóhoz, és nem sürget cserét. Legfeljebb
   semleges lehetőség marad: **„Ha szeretné, feltölthet saját képeket.”**
2. A Fotók-sáv semleges színű felajánlás (nem borostyán figyelmeztetés); a tényt megtartja: az első saját feltöltés
   lecseréli a mostani képeket. Az Áttekintésen mindig „Fotók kezelése” (nem elsődleges gomb). A fotó-teendő kikerül.
3. **Őr:** `scripts/own-photo-pressure-check.mts` (pre-commit, mindig fut; önteszt a bejelentett mondatokkal és a
   semleges utódokkal). A `src/legal.ts` maga a nyilatkozat — név szerint kivétel.

### Nyitólap (a koordinátor továbbította, tulaj-döntés 2026-10-02)
A platform nyitólapja (`public/index.html`, tegező) sem köti a véglegesítést/élesítést saját képhez: kikerült „a saját
képeiddel, szövegeddel közösen véglegesítjük”, a „Saját képeid, szöveged” kártya („A te adataidból” lett) és a GYIK
„az éles oldalhoz jól jönnek a saját fotóid” mondata. Az őr hatóköre a `public/**/*.html`-re bővült (tegező alakokkal).

**Visszafordíthatóság:** 🔄 olcsó (szöveg + egy teendő-sor).
