# 2026-09-30 — public/console unit a repóban OnFailure-rel + [TESZT] riasztás-tárgy (ADR-0279)

**Szál:** deploy-készenléti SUB (koordinátor: „Deploy-készenlét felderítés”, cit92d2a67e), brief
`~/rc-briefs/dk2-public-console-unit-repo.md`. Semmi nem ment élesre; élesről csak OLVASTAM.

## Elvégezve
- `citoviso-public.service` / `citoviso-console.service` → `deploy/systemd/` (dev-alak), `targets.json`
  `services`: `prod`. A kiolvasott éles fájl: `deploy/systemd/prod-snapshot/` (sha a VPS-en mérve).
  Render − `OnFailure=` sor = az éles, bájtra (`house-alert-check` ④, negatív kontrollokkal).
  Élesen szimulált `timers_plan` (csak sha-olvasás): mindkettő „módosul”, a diff 1 sor.
- `scripts/systemd-units.mts`: az időzítő nélküli prod service-re is kötelező az `OnFailure=` (+2 önteszt).
- `src/console/houseAlert.ts`: `[TESZT] ` előtag `!isLiveHost(config.publicBaseUrl)` esetén (`alertSubject`);
  `unitAlertDue` crash-hurok fojtás; `alertUnitFailure` külön szöveg az újrainduló szerverre.
- `scripts/unit-failure-alert.mts`: `systemctl show -p SubState -p NRestarts` (kulcs szerint parse-olva —
  a `--value` sorrendje NEM a `-p` sorrend, mérve), fojtás, fail open.
- `deploy/systemd/README.md`: mikor jön levél.

## Mért tény, ami a briefnek ellentmondott
systemd 257 `RestartMode=normal`: `Restart=always` mellett az `OnFailure=` MINDEN crash-nél elsül
(próba-unit user-systemd-ben: 20 mp alatt 5×, `SubState=auto-restart`, `NRestarts` 0→4), NEM csak a
start-limit után. Az alap start-limit `RestartSec=3` mellett nem merül ki → fojtás nélkül ~900 levél/óra.

## Nyitott
- DÖNTÉS KELL: `StartLimit*` a két szerveren — alapértéken hagyva (javaslat: így marad).
- A GATE 6 kiírása „N prod időzítő telepítve” — a service-eket nem számolja külön (kozmetika, nem nyúltam).
