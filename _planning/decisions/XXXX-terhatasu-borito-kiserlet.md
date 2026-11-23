## ADR-XXXX — Térhatású borítókép (mélységkép + WebGL) a mockon és a tenant-oldalon, kísérletként

**Státusz:** ELFOGADVA (tulaj, 2026-11-23, session `cite2d1c9b4`, brief `hero-20261123-080710.md`) ·
**Épít:** ADR-0016 (egy motor, mock = élő), ADR-0044 (modul-konfig), ADR-0115 (mozgásréteg, fail-safe),
ADR-0159 (kiküldött mock: intro ki), ADR-0341 (fotó-szállítás, saját proxy), ADR-0423 (3 kiküldhető sablon).

### Háttér

A díjnyertes szállásoldalakon a hero sokszor videó. A tulaj a Google Flow-val (Veo) készített egy élő hero-t a
Duna Vibe House fotójából. A videógyártás gépidő, nem Claude-token, de a Flow kézi, a Veo API fizetős, tehát
tömegre kiesik. Helyette: **mélységkép** (Depth Anything V2 Small, ONNX), amiből a böngésző WebGL-lel mozgatja a
nézőpontot. Videófájl nincs, új tartalmat nem talál ki (a fotó saját képpontjai mozognak) → §B.17-biztos.
Mérve 2026-11-23 (dev, processzor): 0,9–2,2 mp/kép; a mélység-PNG 25–56 KB.

### Döntés

① **Paraméterek (tulaj, a mockokon kipróbálva):** sebesség 1,5×, erősség 2× (az első, 14 mp-es / 0,022-es
alapértékhez képest). 3× erősségnél a vékony tárgyak szellemképesek.

② **Kísérletként indul.** A kiküldött mockok egy része kap térhatást, a többi nem (a meglévő kiküldési
kísérlet-réteg, `outreach_variant`); a számok döntenek, mielőtt mindenki megkapja.

③ **A már kiküldött mockok NEM kapnak utólag térhatást.** Csak az új kiküldések.

④ **Mock = élő (§23):** ha a mock térhatással ment ki, a vevő élő oldala is úgy indul. A tenant a
tenant-adminban **be- és kikapcsolhatja** („Térhatású borítókép”); borítókép-cserénél / saját fotónál a háttérben új
mélységkép készül, addig állókép.

⑤ **Egy közös réteg, három sablonba bekötve** (parallax: a háttérkép helyén; gate-opening: a kapuszárnyak mögött;
wordmark-grow: a belépő animáció UTÁN indul). Ha az oldal adatában nincs mélységkép, a kimenet bájtra a mai.

⑥ **Fail-safe (ADR-0115):** csökkentett mozgás / nincs JS / nincs WebGL → állókép; a hero képernyőn kívül → áll.
A kiküldött mockon a térhatás megy (nem belépő animáció, az ADR-0159 nem érinti).

⑦ **Kimarad automatikusan:** kis felbontású hero (rövidebb oldal < 700 px vagy hosszabb < 1000 px; pl. a Vénusz 511 px széles képe) és **Google Places-fotó**
(fizetős hoszt, sem proxy, sem tárolt származék). A WebGL csak saját eredetű képet fogad → a hero az ADR-0341
saját útján (`/configure/<artifactId>/photo/<hash>`) vagy a tenant `/uploads/` útján jön.

⑧ **Név:** „térhatású borítókép” / kódban `depthHero` — NEM „parallax” (az egy meglévő sablon neve).

⑨ **A „lapos kép” NEM automatikus kimaradás** (mérve 2026-11-23): a mélységkép szórása nem választja szét a
laposat a mélytől — egy mesterséges csíkos fal 0,21-et adott, öt valódi borító 0,24–0,29-et (a min-max normalizálás
felhúzza a zajt). A szórást eltároljuk elemzésre; a rossz hatású borítót ember kapcsolja ki (kurátor / tenant).

⑩ **A kísérleti ág a GENERÁLÁSKOR dől el, nem küldéskor**: a mock a küldés előtt elkészül, jóváhagyják és befagy,
tehát a fájlnak már egyeznie kell az ággal. Az ág a lead azonosítójából jön (`seedOf("depth-hero:"+leadId) % 2`),
újragenerálásnál stabil; `inputs.heroDepthArm` = `depth` | `control` | `skip:<ok>` (a `skip` a kiértékelésből
kimarad, különben a kontroll-ág a kis/Places-borítók felé torzulna). Kapcsoló: `DEPTH_HERO_EXPERIMENT=1`
(alapból ki — a bekapcsolás üzemeltetési döntés). A meglévő `link72` mérőszám (levél → mock-kattintás 72 órán belül)
ezt NEM méri, mert a dizájn csak a kattintás UTÁN látszik: a kiértékelés kattintás utáni jelekből (görgetés,
időtartam, érdeklődés / rendelés-szándék a `mock_event`-ben, válasz, rendelés) készül.

⑪ **Futtatás:** `onnxruntime-node` (CPU; a `.npmrc` kihagyja a 284 MB-os CUDA-csomagot), a modell int8 változata
(27 MB, sha256-tal rögzítve, `scripts/depth-model-fetch.mts`; a gitben nincs). Külön folyamatban, egyszerre egy:
mérve 2,1 mp és 336 MB képenként. A mélységkép `sites/_depth/<sha24>.png`, cache: `photo_depth_map`; kiszolgálás:
`/configure/depth/<sha24>.png` (relatív, minden hoszton saját eredetű).

### Nem döntés — még nyitva

- A tenant-admin kapcsoló kinézete: terv-kapu (§2b), mock előbb.
- A kísérlet aránya és időtartama, a siker-mérőszám.
