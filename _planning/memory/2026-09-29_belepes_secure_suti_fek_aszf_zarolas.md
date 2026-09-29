# Belépés-keményítés: feltételes Secure süti, belépési fék, ÁSZF §9 zárolás (2026-09-29)

SUB-szál (koordinátor: `cit92d2a67e`, „Deploy-készenlét felderítés”) · brief: `~/rc-briefs/dk-biztonsag-apro.md` · ADR-XXXX.

## Elvégezve
- `src/auth/loginGuard.ts` (új): `isHttpsRequest` / `sessionCookieAttrs` + `loginLocked` / `recordLoginFailure` (10 hibás / 10 perc / IP / birodalom).
- `src/auth/tenantAuth.ts`, `src/auth/operatorAuth.ts`: `setCookie` → `sessionCookieAttrs(res.req, …)`.
- `src/server/public.ts` POST `/login`, `src/console/server.ts` POST `/login`: fék a jelszó előtt, 429 + `T()` üzenet.
- `src/legal.ts`: ÁSZF §9 zárolás-bekezdés, `ASZF_VERSION` 1.3 / 2026-09-29.
- `scripts/login-hardening-check.mts` (új, pre-commit-be kötve), `scripts/legal-check.mts` (§9 + DelayedCapture-kötés + self-test ág).
- `src/i18n/catalog.json` (2 új felirat).

## Mérve
- `login-hardening-check --self-test`: 34 ✓; negatív kontroll (isHttps=true / =false / tenant-fék kikapcsolva) → 4 / 4 / 2 piros.
- `legal-check --self-test`, `i18n-lint`, `extract-i18n --check`, `tsc --noEmit`, `guard-wiring-check`, `gate-lane-check`, `gate-output-check`: zöld.
- Éles nginx (csak olvasás): `X-Forwarded-Proto $scheme`, 80+443 listen.

## Nyitott / figyelni
- Ha a Cloudflare „Flexible” SSL-lel HTTP-n éri el az origint, a `$scheme` = http → az nginx felülírja az XFP-t http-re; ilyenkor a `CF-Visitor` fejléc adja a Secure-t (az nginx továbbengedi). Élesítés után egy `curl -sI` a `/logout`-on megmutatja.
- Az ÁSZF 1.3 a meglévő elfogadásokat nem érinti (az elfogadott verzió köt); élő vevő a pilot előtt nincs.
- CSRF, XFF-hamisítás, vendég-lemondó token: PILOT UTÁN (tulaj).
