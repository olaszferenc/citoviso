# 2026-10-26 — Fájlnév-alt (Dobos) és egy egység / kerti kilátás (Francia ház)

Koordinátor (citdcb3daea), Vera J-leletei. Lokál javítás, élesen NINCS. ADR-0404 9–10.

## Dobos Apartman 97e61003 (hupont), B mock ddb13dfb
- Ok: a hupont-oldal az `alt`-ba a fájlnevet írja („kep_128.jpg”, „hirdeteshez_008.jpg”); a `ownSiteImages` ezt captionként vette fel, a `toSitePhotos` altnak tette.
- Javítás: `photoCaption.isFilenameCaption` (képkiterjesztés vagy „IMG_1182”/„DSC_0012”/„kep_128” alak); render-időben `withoutFilenameAlts` → „<név> — N. kép”; a gyűjtés és a `toSitePhotos` sem veszi fel. Élesen 238 ilyen alt (pl. „4-2-1000007130.jpg”, „IMG_1182”).
- Teszt: `photo-caption-check` (vektorok, toSitePhotos, ownSiteImages, minden sablon renderje; régi render-en 21 sablon bukik).
- Deploy után: SIMA rerender elég (render-idejű).

## Francia ház e0d06c0f (booked.hu), A mock 4058bf08
- „Panoráma” a „kilátást nyújt a kertre”-ből: a `NEAR_VIEW` csak a közvetlen „kilátás a kert…”-et fogta → most legfeljebb két közbeékelt szóval is.
- „1. szoba” + Foglalás egy egész apartmanon: a booked JSON-LD `numberOfRooms: 1` → `sampleRoomCount: 1`. Most 1-es számból nincs számozott kártya (egy egység = az egész szállás).
- Teszt: `sample-from-source-check` (valós szöveg + ellenpróbák).
- Deploy után: `--resample` (a jelzések a siteData-ban).
