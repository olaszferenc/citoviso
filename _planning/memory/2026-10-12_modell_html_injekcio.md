# 2026-10-12 — A modell írta mock-HTML nem futtathat kódot (ADR-XXXX)

SUB az Elek-teszt koordinátor (`cit333dea6d`) alatt, fa `~/wt/cit949b0267`. Brief: `~/rc-briefs/ai-mock-injekcio-20261012.md`.

## Mérés (scratch-DB `citoviso_aiinj_*`, 4 valódi generálás, ~$1.3)
| út | injekció helye | eredmény |
|---|---|---|
| engine (élesen ez fut) | név `<script>`, cím `onerror`, portál-leírás prózai utasítás, vélemény `<script>`/`onerror`/`iframe`/`javascript:` | 0 lefutás — minden escape-elve |
| AI-HTML (`generateMock`) | név `<script>`, cím `onerror` | 0 — a modell kihagyta |
| AI-HTML | prózai utasítás a címben | **ÁTMENT**: `<script>` (betöltéskor lefutott), onclick, 7× onload, `javascript:` link |
| AI-HTML, javítás után | ugyanaz | a modell most nem követte (0/1) — a szűrő ettől függetlenül fut |

- A régi AI-út a véleményeket/leírásokat NEM kapja (csak név, cím, telefon, e-mail, fotók) — a brief gyanújával szemben a felület a kontakt-mezők + a kép-tartalom.
- A tárolt, áttört mock a kiszolgáló kapun át: 0 lefutás, a runtime (fej-őr, CitSeason, foglalás) működik.

## Kész
- `src/generator/modelHtml.ts` — `sanitizeModelHtml` (tokenizáló + újra-szerializálás), `isModelAuthoredArtifact`, `servableMockHtml`, `readServableMock`.
- Bekötve: `generate.ts` (AI-út, az injectRuntime ELŐTT), `console/server.ts` (serveMock, serveConfigure, /p mindkét ág + /folytatas), `console/data.ts` (`artifactInputs` a ProspectPage-en), `server/public.ts` (/m/), `conversion/provision.ts` (convertLead másoló ág).
- Őr: `scripts/model-html-sanitize-check.mts` (pre-commit) — 25 vektor, nyers önteszt (szűrés nélkül lefut), engine érintetlen, bekötés.

## Éles (csak olvasva)
823 mock, mind `composition`; 0 nem általunk tett szkript (11 szkript-alak, mind sablon-JS), 0 `on*=`, 0 `javascript:`/`data:text/html`, 823 iframe = Google-térkép. Tenant-oldal nincs élesen.

## CSP
Nonce + `strict-dynamic` + `object-src 'none'` + `base-uri 'none'`: 17/17 sablon + konfigurátor 0 sértés. Nem bevezetve (a /p teljes lapja futó szerveren nem mérve) — külön döntés.

## Nyitott
- CSP bevezetése a /p úton (nonce a saját szkript-tagokra, a szűrés UTÁN).
- A legacy AI-HTML út él, de nincs hívója — kivezetése külön döntés.
