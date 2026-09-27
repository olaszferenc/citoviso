## ADR-XXXX — A tulaj feltöltött fotója konvertálódik: böngészőben és szerveren (≤2560 px, álló, metaadat nélkül)

**Dátum:** 2026-09-27 · **Státusz:** elfogadva (tulaj: „konvertáljuk a feltöltött képeket”) · **Kapcsolódik:** ADR-0198 (feltöltési szabályok), ADR-0224 (Fotók fül)

### Kontextus
A tulaj telefonról töltött fel képeket a Fotók fülön (dev): egy sem ment fel. Két ok:
1. A publikus szerver közös body-olvasója (`readRawBody`) minden kérést 64 KB-ra korlátozott, és a
   határon a kérést FOLYAM KÖZBEN dobta el — a telefon XHR-je 100%-on megakadt, mögötte a sor 0%-on
   állt. Mérve: a régi kódon egy 8 MB-os törzs 400-at kapott.
2. A telefonos fotó 3–12 MB (4000+ px); a 6 MB-os kliens-határ a tulaj egyik képét már a böngészőben
   elutasította („túl nagy (8,8 MB, a határ 6 MB)”). A felférő képek teljes méretben mentek volna ki a
   nyilvános oldalra, EXIF-ben a tulaj GPS-helyével.

### Döntés
1. **Body-határ útvonalanként:** az `/admin/photos` 8,5 MB-ot olvas (egy 6 MB-os kép base64-ben);
   a határ felett a szerver tovább üríti a kérést és VÁLASZOL (nem vágja el). Minden feltöltő
   fájlonként egy kérést küld (Fotók fül + szoba-szerkesztő); a Fotók fül 120 mp-es timeouttal.
2. **Konvertálás két félen, egy szabállyal** (`src/tenant/photoUpload.ts`):
   - böngésző (`SHRINK_JS` / `citShrink`): canvas → hosszabb él ≤ 2560 px, JPEG 85%; 1,5 MB alatti,
     határon belüli fájl érintetlen; dekódolási hiba → az eredeti megy. A 6 MB-os határ a KÜLDÖTT
     fájlra vonatkozik.
   - szerver (`normalizeUpload`, sharp): EXIF-forgatás, ≤ 2560 px, minden metaadat (GPS) törölve;
     átlátszó kép → webp; a már tiszta, határon belüli JPEG bájtra megmarad (nincs dupla újrakódolás);
     nem dekódolható → „nem kép” elutasítás.
3. A felületi feliratok NEM változnak (a „max. 6 MB képenként” súgósor marad — tulaj döntése).

### Következmények
- Őrök: `scripts/photo-upload-body-check.mts` (a régi olvasón piros), `scripts/photo-normalize-check.mts`
  (szerver + valódi Chromium + a két feltöltő lap hibátlanul indul); mindkettő a pre-commitban.
- A 2560 px a legszélesebb renderelt hero; ha egy sablon ennél szélesebbet kér, ezt a konstanst kell emelni.
- HEIC-et a böngésző nem dekódol; az ilyen fájlt a típus-szűrő ma is elutasítja (a telefon böngészője
  jellemzően JPEG-et ad át).
