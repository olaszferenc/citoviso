# 2026-09-27 — Kattintható linkek az admin Üzenetek levéltörzsében

## Kérés
A tulaj (képernyőképpel): a tenant-admin Üzenetek fülén a kinyitott levél szövegében a hivatkozások
(foglalási kérés „Elfogadom / Nem szabad”, számla-, belépési linkek) nyers szövegként álltak — legyenek kattinthatók.

## Elvégzett munka
- `src/server/adminViews.ts`: új `linkifyText()` + `RE_BODY_URL`; az `.adm-msg__body` bekezdése ezt használja az `esc()` helyett.
  - Csak `http(s)://` lesz link; az illesztés a NYERS szövegen, minden darab külön `esc()` → a query-string `&`-je nem duplán escape-elt.
  - A mondatvégi írásjel (`.,;:!?)]`) a linken kívül marad.
  - `target="_blank" rel="noopener noreferrer"`.
- `public/assets/ui/citui-admin.css`: `.adm-msg__body p a` — `--citui-link-ink`, aláhúzás, `overflow-wrap:anywhere` (a hosszú URL 390 px-en tördel).
- Ellenőrzés: tsc + design-token-lint zöld; függvény-próba `&`/`<script>` bemenettel; ui-shot 390 + 1280 a Camping Carina foglalási levelén, megnézve, a tulajnak elküldve.
- §2b felület-kapu: kivétel naplózva (tulaj kérése, apró mintakövető javítás, „ok”).
- Commit `e09f2862`, land: IGAZOLTAN FENT. Nincs élesítve (csak a nagy deployjal).

## Nyitott kérdés
- Az adminból kattintott „Elfogadom” azonnal dönt (ugyanaz a `GET /foglalas/<token>/elfogadom`, mint a levél egykattintásos útja).
  Ha a tulaj az adminban megerősítést szeretne, az külön kör.
