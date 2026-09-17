# 2026-09-16/17 — A Barion négy kérése teljesítve; a Pixel csatornája némán állt

## Mi történt

A Barion elfogadóhely-bírálata (Remark `-001`, `-003`) érdemben elindult — már nem az
azonosítót kifogásolta, hanem a tartalmat. A négy pontból három kódot igényelt, egy
dokumentumot. **Mind a kettő éles válasz beküldve (2026-09-17, tulaj).**

| Barion-kérés | Amit szállítottunk |
|---|---|
| `-001/1` ÁSZF: a bérelt honlapba fizetési szolgáltató nem köthető be | ÁSZF 1.2 §1 (ADR-0185) |
| `-001/2` Base + Full Pixel (kedvezményes díjcsomag feltétele) | ADR-0186, teljes tölcsér |
| `-001/3` domain-igazolás | Cloudflare-számla IN-73728274 (tulaj csatolta) |
| `-001/4` 15 napos visszatartás tudomásulvétele | a válaszban |
| `-003/1` a lemondás PONTOS módja | ÁSZF 1.2 §4, a VALÓDI úttal |
| `-003/2` „a kivonaton a Barion Payment Zrt. szerepel" | ÁSZF 1.2 §2 (+ Apple Pay-korlát) |

**Éles:** `61e788a`, tag `prod/20260917-0943`. Pixel-azonosító: `BP-rTpo59JAam-6C`.

## A négy lelet, amit a mérés adott (és a kód nem mutatott volna)

**① A Pixel CSATORNÁJA néma volt.** A `bp.js` a pixel-azonosítót `window.barion_pixel_id`-ből
vagy egy INLINE szkript szövegéből olvassa; mi `data-pixel-id` attribútumban adtuk át. A Barion
kódja emiatt „Base code implementaion not found"-ot adott, a küldő iframe (`barion_receiver`)
fel sem épült, és az események feldolgozatlanul álltak. **Élesen, deploy UTÁN mértem meg** — a
kód jelenléte zöld volt, a viselkedés nem. Egy sor a javítás.

**② A `bp.js` magától NEM küld `contentView`-t.** A Base nálunk emiatt a JS-es látogatókra néma
volt (a `<noscript>` kép viszont küldött egyet a JS nélkülieknek) — vagyis a hiányzó adat pont
a látogatók ~99%-ára esett.

**③ A süti-sáv és a sablon ragadó foglalás-sávja egymáson állt.** A gomb közben végig
KATTINTHATÓ volt (`elementFromPoint` = „elérhető"), tehát kattintás-alapú ellenőrzés zölden
átengedte volna. A hibát a KÉP és a téglalap-metszet mutatta meg. 14 sablon javítva.

**④ A STÍLUS utazott, a TOKENEK nem.** Az ADR-0145 ① a stíluslapot a sáv mellé tette — de a
szabályok `--citui-*` tokenekre hivatkoznak, azok pedig a `citui.css`-ben élnek, amit CSAK a
saját felületeink töltenek be. A generált szállás-oldalon a sáv **háttér nélkül, átlátszóan**
renderelt, a felirata a lap tartalmán feküdt. Minden token tartalék-értéket kapott.

## ⛔ Három saját hiba, mind kimondva

**① Hiányos teszt-stubból VALÓDI leletet jelentettem.** „A Pixel élesben soha nem küldött
semmit" — ezt a saját mérőeszközöm műterméke szülte: a `bp.js` HÁROMLÉPCSŐS kézfogással indul
(`barion.html` → `pixelStatusBase` → `barionbase.html` → `pixelStatus` → `load_tracker`), és a
stubom ezt nem játszotta le. **Egy külső rendszert utánzó teszt-dublőr addig nem bizonyíték,
amíg a valódi protokollt nem reprodukálja.**

**② Az ellenkontrollom rossz időzítésen futott.** Miután pótoltam a kézfogást, az A/B alapján
kijelentettem, hogy a `load`-javítás fölösleges — pedig csak az én próbám kattintott későn.
Gyors elfogadásnál nélküle **6 állítás bukik**. A hiba időzítés-függő volt; az ellenkontrollnak
a KÖRÜLMÉNYT is kontrollálnia kell, nem csak a kódot.

**③ A saját őröm kétszer mért ÜRES HALMAZON.** Az átfedés-detektor előbb az aurora teljes
képernyős háttér-rétegét nézte sávnak, majd — javítás után — megkövetelte, hogy az elem a lap
aljához TAPADJON, miközben a javítás értelme épp az, hogy feljebb csússzon. **28 mérésből 0
talált bármit**, és zölden hallgatott. A végleges alak 14 valódi mérést végez, a visszarontott
állapoton 14 bukással.

## Döntés, amit a tulaj a MÉRÉSSEL A KEZÉBEN hozott

A Full Pixel ára-haszna kimérve (Barion díjszabás 2026-01-17): Starter 1,49% vs. Advanced
1,19% → **0,30 százalékpont**, a mai méreten ügyfelenként ~12 Ft/hó, 100 előfizetőnél
~1 200 Ft/hó. A javaslatom a Starter volt; a tulaj az Advanced-et választotta. A mérés nem
azért készült, hogy eldöntse — azért, hogy tudott döntés legyen.

## Fájlok

- `src/legal.ts`, `src/server/legalViews.ts` — ÁSZF 1.2
- `public/assets/runtime/cit-consent.{js,css}` — a Pixel-kapu, az azonosító, a tokenek tartaléka
- `assets/runtime/cit-configurator.{js,css}` — kosár/pénztár események, `payableTotal()`
- `src/server/consent.ts` (`pixelQueueScript`), `src/console/{views,server}.ts`
- `src/engine/templates/*.ts` — 14 sablon ragadó sávja
- `scripts/barion-pixel-check.mts` (ÚJ), `scripts/consent-sticky-overlap-check.mts` (ÚJ)
- `_planning/DECISIONS.md` — ADR-0185, ADR-0186 + utószál

## Nyitott

- **Tulaj:** hatósági bizonyítvány (`UEVH-00277388`) + videó-azonosítás az **Üzleti profilba**.
- A Barion oldalán a Pixel állapota `approvedBase: false` — az ő bírálatuk része.
- ⚪ Az éles oldal külső CDN-eket hív (Google Fonts, unpkg, OSM) hozzájárulás nélkül — most,
  hogy a sáv jogi keretet kapott, ez a következő logikus kör.
- ⚪ A székhely utcaneve három írásmódban él (számla: `Klebersberg Kuno`, impresszum:
  `Klebelsberg Kunó`, NAV: `KLEBESBERG … Kuno`). Nem blokkoló.
