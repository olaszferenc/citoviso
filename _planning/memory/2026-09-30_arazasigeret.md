# Árazás-lap halott ígérete ki, fojtás-kulcs Cloudflare-tudatos, KB-útvonallista kódból, deploy utáni teendők (2026-09-30)

SUB-szál (koordinátor: „Deploy-készenlét felderítés”, `cit92d2a67e`) · brief: `~/rc-briefs/dk2-arazas-igeret-ip-kbpaths.md`.

## 1. Az Árazás lap halott ígérete (§B.17)
- `src/server/moduleConfigViews.ts` (dátumos alapár alatti súgó-sor): a „Lejárat előtt e-mailben emlékeztetjük.” KIKERÜLT;
  a mondat első fele („…a megadott napig érvényes, ahol nincs időszaki ár.”) igaz, maradt. Lejárat UTÁNI levételről
  a mondat nem szólt, így nincs mit megtartani.
- Utódja: `_planning/DEPLOY-READY.md` §4b.1 („legyen lejárat előtti értesítő, mint ahogy ígérjük”).
- `src/i18n/catalog.json` újragenerálva (`extract-i18n`), `i18n-lint` zöld.
- Súgó: a mondatot sem a KB-szöveg, sem kép nem mutatja (a kb-shot Árazás-fixture-jében nincs dátumos alapár) → kb-shot nem kellett.

## 2. Fojtás IP-je (ADR-XXXX)
- `src/server/clientIp.ts` (új): X-Real-IP (nginx felülírja) → különben socket; ha a társ Cloudflare-él → `CF-Connecting-IP`.
  XFF-et nem olvas. `public.ts` `throttled` és `loginGuard.ts` erre áll (a loginGuard saját másolata törölve).
- ⚠️ A brief premisszája élesen hiányos volt: az éles forgalom CF-en át jön, nginx-ben nincs `set_real_ip_from` → a puszta
  X-Real-IP a CF-él címe, egy PoP minden vendége egy számlálón. Mérve a guardon: a CF-et nem ismerő változattal az ugyanazon
  él mögötti MÁSIK vendég is 429-et kapott. Ezért a CF-ág (csak élről fogadott `CF-Connecting-IP`).
- Őr: `scripts/login-hardening-check.mts` ③ (valódi szerverek: login mindkét birodalom + `/t/<slug>/api/erdeklodes`);
  `hooks/pre-commit` diff-scope + `src/server/clientIp.ts`. Negatív kontroll: régi XFF-kulcs → 5 piros; CF-vak kulcs → 6 piros.
- Nem érintett: `src/analytics/siteVisit.ts` (látogató-hash, XFF) — nem fék.

## 3. Deploy KB-útvonallista kódból
- `scripts/deploy-prod.sh` `kb_paths <commit>`: `data-kb-anchor` VAGY `helpLink(` a `src/`-ben ∪ a cél-commit `kb-check.mts`
  VIEW_GROUPS korpusza ∪ `src/kb kb/entries scripts/kb-check.mts`; a GATE 1c a tartomány MINDKÉT végéből számol és kiírja a listát.
- ⚠️ Eltérés a brieftől: a csak-horgonyos `git grep` a bookingViews/offerViews-t KIHAGYTA volna (nincs bennük horgony, a súgó a
  feliratukat IDÉZI) — pont a 2026-09-29-es hiba. A korpusz-ág ezt fedi, és 8 eddig nem figyelt fájlt hoz be (nav, leadFilters,
  photoProxy, prospectNotice, testLogViews, moduleConfig, invoiceItem, messageTopics). HEAD-en: 12 → 20 útvonal.
- Önteszt: `bash scripts/deploy-prod.sh --self-test` (hermetikus teszt-repó, GIT_DIR kiürítve; fiktív horgonyos + helpLink-es +
  korpusz-fájl bent, semleges kint; HEAD-en booking/offer/contact bent). Rontott (csak-literál) változat → piros. deploy-pipe-check zöld.

## 4. `_planning/DEPLOY-READY.md`
- Új §4b „Deploy UTÁNI teendők (tulaj, 2026-09-30)”: lejárat előtti értesítő; az emlékeztető-levél hamis „a vendég nem lát árat”
  mondata; élesi őrködés e-mail+SMS — a MAI riasztók táblája (houseAlert / payLinkAlert / aamAlert / registryConfirmWatch /
  keyGuard) és az 5 hiányzó tétel (SMS a houseAlert-hez, megakadt `pending` fizetés, domain-bukás a háznak, számla-bukás,
  401/403 API-kulcs-halál).
- §5 „x-forwarded-for hamisíthatósága” sor → KÉSZ (ADR-XXXX).

## Nyitott
- DÖNTÉS: élesen az nginx `real_ip` (CF-tartományok) beállítása tisztább lenne — élesi konfig-írás, külön engedély.
- A CF-tartománylista kézi (a fájlban, 2026-09-30); elavulás csak „egy él = egy kliens” visszaesést okoz.
