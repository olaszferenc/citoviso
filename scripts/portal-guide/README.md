# Portál-naptár bemutató: a felvevő

A „Hirdeti máshol is?” kártya bemutató-videóit és képeit állítja elő
(terv: `assets/design-refs/console/portal-bemutato/README.md`). Csak dev-gépen fut, a lokális DB-vel.

| fájl | mit csinál |
|---|---|
| `plan.mjs` | Portálonként a lépések listája. `t`: szakaszkártya; `c`: Citoviso-admin művelet (open/copy/paste/done); `p`: portál-képernyőkép, a fókuszterületek NATÍV pixelben `[x, y, w, h]`, mindegyikhez saját felirattal. |
| `record.mts` | Elindítja a public szervert a folyamaton belül, belép a teszt-tenantba („Myrna”, „Kisházi szoba” szoba), és végigviszi a VALÓDI admint. A portál HTTPS-válaszát csonkolja (nincs portálfiók). Mobil (390×780) és asztali (1280×800) felvételt készít, és kimenti az admin-képeket is. A végén `deleteCalendarLink`-kel takarít. |
| `still.html` | A portál-képernyőkép lejátszója: előbb az egész kép, aztán ráközelítés minden fókuszra, keret, felirat. |
| `title.html` | Teljes képernyős szakaszkártya (felirat, menüút, alcím). |
| `voice.mjs` | A feliratból kimondható szöveget csinál (angol gombnevek magyar kiejtéssel, pl. „ed kelender konnekson”), Piperrel hangot generál belőle (gyorsítótárazva), és megméri a hosszát. A felvevő a kép-időt a hanghoz igazítja. |
| `mix.mjs` | A naplózott időpontokra illeszti a hangokat a néma felvétel alá (ffmpeg, opus). |

## Eszközök (a repón KÍVÜL, `~/.cache/citoviso-tts/`, vagy a `TTS_DIR` változóban megadott helyen)

- `piper/`: https://github.com/rhasspy/piper/releases (2023.11.14-2, `piper_linux_x86_64.tar.gz`).
- `hu_HU-anna-medium.onnx` és `.onnx.json`: https://huggingface.co/rhasspy/piper-voices (`hu/hu_HU/anna/medium`). Más hang: `VOICE=berta` vagy `VOICE=imre`.
- `ffmpeg` és `ffprobe`: statikus build (johnvansickle.com).

Ingyenes, helyben fut, nincs API-hívás.

## Futtatás (a repó gyökeréből)

```bash
OUT=/tmp/pg   # bármilyen üres mappa
for P in "Booking.com" "Szállás.hu" "Airbnb"; do PORTAL="$P" OUT=$OUT npx tsx scripts/portal-guide/record.mts; done
for n in m-booking d-booking m-szallas d-szallas m-airbnb d-airbnb; do node scripts/portal-guide/mix.mjs $OUT $n; done
```

Utána a végleges fájlok a `public/assets/help/portal-naptar/` mappába kerülnek (tömörítve), és a
`src/server/portalGuide.ts`-ben a `GUIDE_V` értékét növelni kell, mert a CDN gyorsítótárazza az `/assets`-et:

```bash
FF=~/.cache/citoviso-tts/ffmpeg; D=public/assets/help/portal-naptar
for k in booking szallas airbnb; do for z in m d; do
  $FF -y -i $OUT/$z-$k.webm -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 -deadline realtime -cpu-used 8 -r 15 -c:a libopus -b:a 40k -ac 1 $D/$k-$z.webm
  for f in $OUT/$k-$z-*.png; do $FF -y -i $f -c:v libwebp -quality 82 $D/$(basename ${f%.png}).webp; done
done; done
```

## Élesítés előtt: saját portálképek

A `p` lépések képei (`public/assets/help/portal-naptar/<portál>-*.webp`) ma harmadik fél súgóiból
valók, licenc nélkül. Saját portálfiókból kell lefotózni ugyanazokat a képernyőket. Utána a
`plan.mjs`-ben a fókuszok koordinátáit az új képhez kell igazítani, a `portalGuide.ts` adatában pedig a
`box` százalékokat is (= natív px / képméret × 100).
