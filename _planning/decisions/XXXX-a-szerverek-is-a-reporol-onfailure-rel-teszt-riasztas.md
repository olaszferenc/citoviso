## ADR-XXXX — A hosszan futó service-ek is a repóból települnek OnFailure-rel; a nem éles riasztás [TESZT]-tel jelölt (2026-09-30)

**Dátum:** 2026-09-30 · **Státusz:** elfogadva (deploy-készenléti SUB, koordinátor: „Deploy-készenlét
felderítés”; brief: `~/rc-briefs/dk2-public-console-unit-repo.md`) · **Kapcsolódó:** ADR-0276 (a ház
riasztást kap; `OnFailure=citoviso-alert@%n.service`), ADR-0053 (verzió megy ki, nem kézi művelet),
a deploy GATE 6.

**Kontextus.** A `citoviso-public.service` és a `citoviso-console.service` kézzel települt a VPS-re; a repó
`deploy/systemd/` csak az időzítőket tartotta, ezért az ADR-0276 `OnFailure=`-je a két legfontosabb
egységre nem jutott el. Tulaj (2026-09-30): „Nincsenek a repóban, miért? Mindegy, szerintem kellenek oda!”
— és: „ha a későbbi teszteléshez kellhet, akkor email tárgyban legyen egyértelmű, hogy teszt”.

**Mérés (2026-09-30).**
- Élesen a két unit sha256-ja: public `281f9012549232fc2de8fdfd067dc0f386f0b1ae30e809413fd79b8d7b667710`,
  console `9f6bd77a920101d24ea6e486e9be02d51c13c3d95ff9ac3d21871d9dd4f0d84e`; nincs drop-in, nincs
  `StartLimit*` (alapérték 10 s / 5), `EnvironmentFile` sincs.
- systemd 257, `RestartMode=normal`: egy `Restart=always` egység **minden** összeomlásnál „failed”-en megy át,
  az `OnFailure=` minden crash-nél elsül (próba-unit: 20 mp alatt 5 elsülés, `NRestarts` 0→4, `SubState=auto-restart`).
  A brief feltevése („csak a start-limit után”) erre a verzióra NEM igaz. `RestartSec=3` mellett az alap
  start-limit gyakorlatilag nem merül ki → crash-hurokban ~4 mp-enként egy levél, végtelenül.
- A deploy-restart élesen „Deactivated successfully” — a szabályos stop nem riaszt.

**Döntés.**
1. A két unit a `deploy/systemd/`-be kerül dev-alakban, a `targets.json` `services` listáján `prod`-ként. Az éles
   render a mai éles unit + pontosan az `OnFailure=` sor (fixture: `deploy/systemd/prod-snapshot/`, őr:
   `house-alert-check` ④). A `deploy-prod.sh` változatlan: a GATE 6 telepíti és visszaméri, a későbbi
   kanári-restart a daemon-reload utáni új unitot veszi fel.
2. A `systemd-units check` ADR-0276-os piros szabálya („prod service OnFailure nélkül”) az időzítő nélküli prod
   service-ekre is áll (kivéve a riasztó sablont — hurok).
3. **Crash-hurok fojtás:** a `unit-failure-alert.mts` a `systemctl show` `SubState`/`NRestarts`-ából dönt
   (`unitAlertDue`): leállva maradt egység → mindig levél; újrainduló → az 1., 11., 101., 1001. … összeomlás.
   Olvashatatlan állapot → levél (fail open).
4. **[TESZT]:** `alertHouse` a tárgy elé `[TESZT] `-et tesz, ha `!isLiveHost(config.publicBaseUrl)`
   (`src/invoicing/keyGuard.ts`, az „éles” egyetlen definíciója). A dev továbbra is küld.

**DÖNTÉS KELL (tulaj).** `StartLimitIntervalSec` / `StartLimitBurst` a két szerveren: alapértéken hagyva
(= soha nem adja fel). Egy `300 / 5` a publikus oldalt 5 összeomlás után véglegesen leállítaná (kézi
`systemctl reset-failed` + `start`-ig), cserébe „feladta” levelet adna. Javaslat: maradjon alapértéken, a
riasztást a 3. pont ritkítja.

**Következmény.** A következő deploy GATE 6-ja „módosul”-t ír ki a két unitra; a diff 1 sor. A két unitban
nem lehet komment (a bájt-egyezés miatt); a magyarázat a `deploy/systemd/README.md`-ben él.
