# 2026-11-13 — Overlay ⑪ (card-sidebar, 1536×864, süti-sávval): a mainen már zöld, kód nem változott

**Brief:** `~/rc-briefs/mock-overlay-card-sidebar-fix-20261113.md` · **Fa:** `cit3a3f54d7` · **Koordinátor:** `cit9b4690e3`

## Mit találtam
- A hiba („a kártya elől lépve sem ül szövegsorra — {"hits":["Erzsébet utca 23, Balato"]}”) determinisztikusan
  reprodukálható a `7deea25e`-n (a 11-12 16:40-es main): süti-sávval a pirula-pár középen, `y=724..771`, a hős
  meta-során (csillag · értékelés · cím) ül, mert a `heroTitleRects` csak a `<h1>` utáni `<p>` testvéreket kerülte,
  a card-sidebar meta-sora viszont `<div>`.
- A javítás már a mainen van: `55ee6df6` (ADR-0440 lead-lap, „mellékjavítás”), `assets/runtime/cit-configurator.js`
  `heroTitleRects` — a cím alatti rövid (≤160 karakter), vezérlő/kép nélküli szöveges testvér is akadály. A mainre
  2026-11-13 00:01-kor került. Ettől a süti-sávos pár a jobb sarokba megy (`x=1050..1512`), a címsorra nem ül.
- A piros naplók (`g2main.log` 11-12 16:46, `overlay.log` 11-12 20:20, `land.log` 11-12 19:51) MIND a javítás előttiek.
  A „a mainen is piros” állítás (ország-réteg 3/1 land, ADR-0068 tulaj-kivétel) ezekre épült, a 11-13-i mainre nem igaz.
- Kettéosztás (`scripts/_diag-card.mts`, ideiglenes, nem commitolt): `7deea25e` piros → `55ee6df6`, `c4c125af`,
  `d5393afc`, `817ab3a6` zöld. A mostani mainen 4/4 diag-futás zöld, a teljes kapu card-sidebar ága is.
- Mobil (390×844, álló, alsó sáv) a két állapotban vizuálisan azonos.

## Képek (a fában, gitignore-olt)
- `assets/design-refs/_drafts/overlay/elotte-7deea25e/card-sidebar-{1536,390}-{nyug,suti}.png`
- `assets/design-refs/_drafts/overlay/utana-817ab3a6/card-sidebar-{1536,390}-{nyug,suti}.png`

## Nyitott
- Az `55ee6df6` javítása nincs `cit-cfg-trialfx-*` jelölővel körülvéve, ezért a kapu `--self-test`-je nem bizonyítja,
  hogy nélküle piros lenne. Regressziót a sima kapu-futás ettől még elkap (a 11-12-i piros pont ez volt).
