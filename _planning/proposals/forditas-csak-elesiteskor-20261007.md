# Fordítás csak élesítéskor, csak diffből — terv a tulajnak (2026-10-07)

> Döntési anyag, kód előtt. Koordinátor: cita768df48-70. A tulaj szava:
> „Fordítás csak akkor ha élesre megy valami és azt is diffel kéne... Vagy: legyen egy fordító munkatársunk, aki ezt megteszi”

## 1. Mi derült ki (mérve, 2026-10-07)

- **A deploy már ma is fordít, és már ma is csak diffből.** A `deploy-prod.sh` GATE 5 (ADR-0207) csak akkor fut,
  ha a `PROD_SHA..SHA` tartományban `kb/entries/**` vagy `src/i18n/catalog.json` változott, és a fordító
  (`ensureLanguagePack`) csak a HIÁNYZÓ UI-stringet és a forrás-lenyomat szerint ELAVULT súgó-cikket fordítja.
  A GATE 5b független méréssel blokkol, ha bármi magyarul maradna. → Az (a) változat gerince megvan.
- **A pénz nem itt ment el, hanem a dev-ben.** A két dev szerver (:4600, :4800) minden indításkor
  lefuttatta ugyanezt — minden land után, duplán, az éles kulccsal. Ráadásul a dev `language_pack` /
  `kb_translation` tábla KÖZÖS a munkafák között, a magyar forrás fánként más → a fák egymás fordítását
  érvénytelenítik, a boot újrafordít (ADR-0207 ③ ugyanezt mérte a commit-kapunál).
  **Ma javítva:** `I18N_BOOT_TOPUP=0` a dev `.env`-ben → a dev boot csak mér, nem hív API-t.
- **Mennyi egy élesítés fordítása:** az utolsó két deploy-tartomány 4 cikk + 99 string, ill. 1 cikk + 10 string.
  Egy medián súgó-cikk (~5,5 KB) ≈ 0,07 $/nyelv opus-szal → 6 nyelven ≈ 0,4 $/cikk; 99 string × 6 nyelv ≈ 1,5 $.
  → **egy tipikus deploy ≈ 1–3 $**, a dev-boot napi 8–10 $-jával szemben.
- **Ami még API-n fordít a dev-ben:** idegen nyelvű lead mock-generálása / scrape-indulás / outreach
  (`ensureLanguagePack` — ez a teljes KB-t is frissíti az adott nyelven). Ma már mérőn van (`translation_spend`,
  kiváltó: `on-demand`), a boot pedig `boot`, a CLI/deploy `cli` címkével.

## 2. A két út

| | (a) diff-alapú deploy-lépés (API) | (b) fordító munkatárs (előfizetés) |
|---|---|---|
| Költség | ~1–3 $ / deploy, mérve | API 0 $; előfizetésből ≈ 2 cent / API-$ → ~2–6 cent / deploy |
| Minőség | ugyanaz a modell, felügyelet nélkül; a placeholder-őr kidob, de a stílust senki nem nézi | ugyanaz a modell + a munkatárs a KONTEXTUST is látja (a felületet, a korábbi fordítást), és a tulaj/kapu átnézheti |
| Kockázat: magyar szöveg idegen oldalon | GATE 5b blokkol → nem megy ki | ugyanaz a GATE 5b; ha a munkatárs nem végzett, a deploy ÁLL (fail-closed) — késik, nem szivárog |
| Kockázat: folyamat | automatikus, nincs várakozás | egy emberi-szerű lépés a deploy előtt; ha a munkatárs nem fut, a deploy vár |
| Hol él a fordítás | csak az éles DB-ben (nem verziózott, nem nézhető át) | **verziózott fájlként a repóban** — a fordítás a verzióval EGYÜTT megy ki (ADR-0053 szelleme) |
| Bevezetés | kész (GATE 5) — csak a prod boot-hálót kell levenni | új: export/import formátum, munkatárs-perszóna, deploy-lépés „import” módban |

## 3. Javaslat: (b), de úgy, hogy az (a) maradjon a biztonsági háló

1. **A fordítás FÁJL lesz a repóban, nem DB-állapot.** `i18n/packs/<lang>.json` (UI) és
   `kb/entries/<id>/entry.<lang>.md` (+ a magyar forrás lenyomata). A deploy ezeket API nélkül TÖLTI BE
   az éles DB-be. Ettől a fordítás átnézhető (git diff), visszagörgethető, és a „mi fut élesen?” a
   fordításra is igaz. Ez az ADR-0036 módosítása (a csomag forrása a repó, a DB csak gyorsítótár).
2. **Fordító munkatárs (saját sessionös perszóna, mint Neo/Poe/Vera):** élesítés előtt megkapja a diffet
   (`prod/<utolsó tag>..<jelölt commit>`: új/változott stringek + cikkek), lefordítja a 6 nyelvre a
   saját sessionjében (előfizetés, 0 API-$), commitol, landol. A meglévő őrök futnak rajta
   (placeholder-épség, markdown-szerkezet, gombfelirat-idézet magyarul marad).
3. **A deploy GATE 5 „import + ellenőrzés” módra vált**: betölti a fájlokat, a 5b mér. Ha hiányzik
   valami → a deploy MEGÁLL és megmondja, mi hiányzik (nincs néma API-pótlás). Vészhelyzetre egy
   kimondott kapcsoló (`--translate-missing`) az (a)-t futtatja: API, mérőn, csak a hiányra.
4. **A boot-háló élesen is kikapcsol** (`I18N_BOOT_TOPUP=0` az éles `.env`-ben, a nagy deployjal) —
   a deploy-kapu után úgyis nincs mit pótolnia, és boot-kor a forgalom már megy.
5. **Dev:** fordítás nincs. Idegen nyelvű mockot a dev a repóban lévő fájlokból kap; ami nincs
   lefordítva, az hangos hu-fallback (dev-ben elfogadható, élesen a kapu nem engedi).

**Miért (b):** a költség gyakorlatilag nulla, a minőség jobb (kontextus + átnézhetőség), a magyar-szivárgás
kockázata NEM nő (ugyanaz a fail-closed kapu), és a fordítás végre a verzió része. Az ára egy deploy előtti
lépés, ami késleltethet — de ezt a kapu láthatóvá teszi, és a vészkapcsoló feloldja.

**Ha a tulaj most nem akar új munkatársat:** a (a) már ma így működik; elég a 4. pont (prod boot-háló le)
— onnan a fordítás API-költsége = deployonként ~1–3 $, mérve.

## 4. Kérdés a tulajnak

- (b) fordító munkatárs + fordítás a repóban — vagy marad az (a) a meglévő deploy-kapuval?
- A prod boot-háló kikapcsolása mehet a következő nagy deployjal?
