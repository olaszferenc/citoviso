## ADR-0186 utószál — a sáv IDEGEN lapra került, és két dolgot vitt magával, amit nem terveztünk (2026-09-16)

**Kapuk:** `scripts/consent-sticky-overlap-check.mts` (ÚJ) · `design-token-lint` ALLOW-bejegyzés.

**① A sablon saját ragadó sávja és a süti-sáv egymáson állt.** 14 sablonnak van fixed,
alulra tapadó CTA-ja (`au-mobcta`, `b-mobcta`, `mob-book`, …), mind `bottom:0`-val. Mindegyik
a `--citui-consent-h` (a sáv MÉRT magassága) fölé került. ⛔ A gomb közben végig
KATTINTHATÓ volt (`elementFromPoint` = „elérhető"), tehát egy kattintás-alapú ellenőrzés
zölden átengedte volna — a hibát a KÉP és a téglalap-metszet mutatta meg.

**② A STÍLUS utazott, a TOKENEK nem.** Az ADR-0145 ① a stíluslapot a sáv mellé tette, és ez
működött is — de a szabályok `--citui-*` tokenekre hivatkoznak, azok pedig a `citui.css`-ben
élnek, amit CSAK a saját felületeink töltenek be. A generált szállás-oldalon a tokenek
feloldatlanok lettek: a sáv **háttér nélkül, átlátszóan** renderelt, a felirata a lap
tartalmán feküdt. Javítás: minden token `var(--token, tartalék)` alakot kapott (a tartalék a
dizájn-mag mai értéke), ALLOW-bejegyzéssel — a saját lapjainkon a token nyer.

**⛔ A saját őröm kétszer mért üres halmazon, mielőtt jó lett.** Először a detektor az aurora
teljes képernyős háttér-rétegét nézte „sávnak"; javítás után viszont megkövetelte, hogy az
elem a lap aljához TAPADJON — miközben a javítás értelme épp az, hogy feljebb csússzon. Így
**28 mérésből 0 talált bármit**, és zölden hallgatott. A végleges alak 14 valódi mérést végez,
és a visszarontott állapoton **14 bukást** ad. Egy zöld őr önmagában nem bizonyíték.
