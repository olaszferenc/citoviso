## ADR-0250 — A lead-lap fotó-mérése cache-találatra nem vár, és a múló hiba újrapróbája tényleg kimegy a hálózatra

**Dátum:** 2026-09-27 · **Státusz:** elfogadva (tulaj: a „G” út — a gyökérokot külön szál javítja; brief `~/rc-briefs/lead-lap-photo-health-lassu.md`) · **Kapcsolódik:** ADR-0134 (a renderelt artefaktumon mér), ADR-0150 (`nophoto`), ADR-0249 (bukott kapu a tiszta mainen)

### Kontextus
A konzol `/lead/<id>` lapja artefaktumonként egy `photo-health` kérést indít (a mért leaden 20-at). Mindegyik
`assessMockPhotos()`-t futtat, és egy futás ~7,4 s volt — **a második futásra is ugyanannyi**. Mérve
(lead `de9bcca7…`, 21 kép, mind `lh3.googleusercontent.com`): a gazdagépenkénti 350 ms-os szünet
(`HOST_GAP_MS`) a CACHE-TALÁLATRA is lefutott, pedig ott nincs kérés, tehát nincs burst, amit ritkítani
kellene: 21 × 350 ms = 7,35 s. A lap `networkidle`-je így ~31 s volt (hideg és meleg cache-sel is), és a rá
`networkidle`-lel váró kapuk a Playwright 30 s-os határán billegtek.

Mérés közben egy második hiba is előjött: a múló hiba (429/503/hálózat) „udvarias újrapróbája” SOSEM ment ki
a hálózatra. Az első bukás a `fetchPhoto` cache-ébe került (5 perc), a második hívás a saját bukását olvasta
vissza. Egy egyszeri 503 így „törött képként” ment a kapuba — téves piros, amit a modul feje kifejezetten
drágának nevez (a fizetni akaró vevő megkeresését állítja meg). Mérve: 503→200 fixture-rel a mainen 1
szerver-hívás, 1 törött; javítva 2 hívás, 0 törött.

### Döntés
1. `probeImageRefs`: a friss cache-sor (`cachedVerdict`) azonnal verdikt — sorosítás és szünet nélkül. Ez
   UGYANAZ a sor, amit a `fetchPhoto` is visszaadna, és amit a konzol proxyja a csempén mutat, tehát a mérés
   tartalma nem változik (ADR-0134 érintetlen: továbbra is a renderelt fájl hivatkozásait méri).
2. Az újrapróba `fetchPhoto(url, { refresh: true })` — megkerüli a saját, épp beírt bukását.
3. `fetchPhoto` egy URL-re egyszerre egy hálózati kérést indít (in-flight összevonás): a lap 20 párhuzamos
   mérése többnyire ugyanazokat a fotókat kéri, e nélkül 20 azonos kérés menne ugyanarra a gazdagépre.

### Mérés (ugyanazon a leaden, fő fa `d8ae2682` vs. munkafa)
| | előtte | utána |
|---|---|---|
| `assessMockPhotos`, meleg cache | 7 404 ms | 7–20 ms |
| lead-lap `networkidle`, friss folyamat (hideg cache) | 31,9 s / 31,9 s | 11,7 s / 12,6 s |
| lead-lap `networkidle`, második betöltés (meleg) | 29,1 s | 2,7 s |

A hideg ~12 s a valódi, egyszeri hálózati kör (21 fotó, gazdagépenként sorosítva) — azt szándékosan nem
gyorsítjuk (a 429-et a burst termeli).

### Őr
`scripts/mock-photo-gate-check.mts` ② három új sora: az ismételt mérés ugyanazt adja · nem vár a szünetre
(< 250 ms) · a 503→200 újrapróba kimegy és épnek mér. Negatív kontroll: a régi `mockPhotoHealth.ts` +
`photoProxy.ts` mellett a két utóbbi PIROS (1 402 ms; 1 hívás/1 törött).

### Visszafordíthatóság
🔄 olcsó — három kis változás, egy fájlonként.

### Elvetett alternatívák
- **Csak a legutóbbi artefaktumot mérni, a többit kattintásra:** felület-változás (§2b), és a kurátor a régebbi
  mock kártyáján a kapu-előjelzést elveszítené. A mért ok nem a darabszám volt.
- **Kliens-oldali sorba állítás:** a 20 kérés ideje nem a párhuzamosságból jött, hanem a semmire várásból.
- **Eredmény-cache artefaktum-kulcsra:** a fotó-verdikt cache már megvan; egy második cache a „két igazság”
  mintát hozná (a kapu régebbi verdiktet mondhatna, mint a csempe).

### Következmény
A `console-contrast-check` és az `outreach-link-live-check` 90 s-os kimondott időkorlátja (a Webcím-szál
tüneti kezelése, `cit873a226d`) visszavehető — a döntés a tulajé.
