# 2026-10-09 — „Nem megy ki a válasz-SMS”: kiment, csak a konzol ragadt „Sorban”-on

## Bejelentés
Tulaj (15:29, képernyőkép): a Gemini Superior Apartman & Yacht (+36 20 433 2780) válaszára
küldött SMS 15:28-kor is „Sorban — a modem-sáv viszi ki” állapotot mutat.

## Diagnózis (mérve)
- `gammu-smsd.log` 14:09:32–14:09:59: mind a 3 rész `Transmitted` + `Delivery report: Delivered`.
- `~/.claude/citoviso-sms-relay.log`: `[modem-lane] KIMENT (gammu sentitems igazolja)` · queue `42e4e0fd…`.
- Éles DB: `outreach_reply_send 1235894b…` = `sent` (14:09:45), a válasz `answered_at` 14:09:49, `olaszferenc`.
- Vagyis a lánc (ADR-0332 modem-sáv → ack → `settleReplySends`) HIBÁTLAN volt. A hiba: a konzol lapja a
  küldés utáni átirányításkor (14:09:15) renderelődött `queued` állapottal, és SEMMI nem frissítette.

## Javítás (`fb5c5e82`, landolva `84d6904a`)
- `src/replies/answer.ts`: `replyHasPendingSend(replyId)` (előbb `settleReplySends()`).
- `src/console/server.ts`: `GET /replies/<id>/pending` → `{pending}`.
- `src/console/views.ts`: a „Sorban” jelzők `data-rep-pending="<reply id>"` horgot kapnak; a `REPLY_EDITOR_JS`
  15 mp-enként rákérdez, és `pending:false`-ra `location.reload()` (a vázlat sessionStorage-ben túléli).
- Ellenőrzés: Playwright (sorban → csak poll; rendeződés → újratöltés, a „Sorban” eltűnik, 0 JS-hiba),
  `outreach-reply-check` zöld, i18n- és design-token-lint zöld. §2b: tulaj-engedélyezett hibajavítás-kivétel.

## Nyitott
- Élesítés: a következő nagy deployjal (élesen addig kézi újratöltés kell a „Sorban” után).
