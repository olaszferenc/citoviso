## ADR-0301 — A napi Google-riport VALÓS számlát mutat a Cloud Billing BigQuery-exportjából; amíg a nap nem teljes, a becslés vezet és kimondja, miért (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (SUB „H rész”, koordinátor: CIT „Places API 600 $” fő session; brief:
`~/rc-briefs/places-h-riport-valos-szamla.md`; tulaj: „2. igen” — Billing export BigQuery-be) · **Visszafordíthatóság:**
🔄 olcsó (egy olvasó lekérdezés; `GOOGLE_BILLING_EXPORT_TABLE=` üresen kikapcsol) · **Kapcsolódó:** ADR-0297 (a napi riport;
ott az „Elvetett (a)” volt a billing export — ez az ADR azt hozza be), ADR-0162 (közös pénz-formázó).

**Kontextus.** Az ADR-0297 riportja listaáras BECSLÉS (Monitoring-hívásszám × feltételezett SKU, ingyenes keret nélkül).
A tulaj bekapcsolta a Cloud Billing standard usage cost exportot: `mineralcrm.billing_export` (EU), fiók
`012AB6-FB8C94-04076D`, tábla `gcp_billing_export_v1_012AB6_FB8C94_04076D`. Az export órákat, néha >24 órát késik.

**Döntés.**
1. **Forrás:** BigQuery `jobs.query` (REST, a gcloud-tokennel, job-projekt `mineralcrm`, location `EU`), EGY olvasó
   lekérdezés: a tábla frissessége (sorszám, első használat-kezdet, legutolsó használat-vég, legutolsó export) LEFT JOIN a
   nap soraira — `project.id × service.description × sku.description × currency`, `SUM(cost)` + `SUM(credits.amount)`.
   A nap a budapesti nap a `usage_start_time`-on (`@start`/`@end` paraméter, DST-napon 25/23 óra). Táblát/datasetet
   nem hoz létre, nem ír. A táblanév szigorú mintán megy át, mielőtt a SQL-be kerül.
2. **Mikor „kész” a nap:** ha a tábla legutolsó `usage_end_time`-ja eléri a nap végét. Különben **késő** (`late`): a fő szám a
   becslés, a riport kimondja a késést és az utolsó beérkezett használatot, a részleges valós összeget RÉSZLEGES-ként
   mellé írja. **Hiányzik** (`missing`): nincs tábla (404 notFound) / üres tábla / az export a nap UTÁN indul. **Hiba**
   (`error`): HTTP, hálózat, időtúllépés. Egyik sem néma: a sor mindig ott van („Valós költség: NINCS MÉG — <ok>”), és a
   tárgy is jelzi („becslés; a számla-adat még nincs meg” / „számla-lekérdezés hibás”).
3. **Ha mindkettő van:** a valós a fő szám (tárgy: „5 050 Ft (számla) · becslés ~49,50 $”), a becslés alatta — az eltérés
   maga is információ. A valós rész projektenként bont (a fiók alatt az MR projektjei is lehetnek; a `mineralcrm`-et
   jelöli, a projekt nélküli fiók-szintű tételt „(nincs projekt)”-ként), soronként bruttó + jóváírás; a 0 költségű tételeket
   csak megszámolja. Ha a Monitoring bukik, de a számla kész: valós riport, „Becsült költség: NINCS — <ok>”. Ha egyik sincs:
   `[NINCS ADAT]`, mindkét okkal.
4. **Pénznem és küszöb:** a pénznem a tábla `currency` mezője; a forint egész forint, minden más centtel, a közös
   formázóból (`formatMoney`/`formatNumber`/`currencySign`, money-format-check ⑤ zöld). A valós küszöb a SAJÁT
   pénznemében: `GOOGLE_COST_DAILY_THRESHOLD_HUF` (alap 7 000), `…_EUR` (alap 18), USD-re a régi `…_USD` (20) — az
   alapértékek ~20 $-nak felelnek meg, de árfolyamot a kód SEHOL nem alkalmaz. Ha a számla kész és a pénzneméhez van
   küszöb, a napi küszöb a VALÓS összegen fut (a becslés-küszöb ilyenkor nem dönt); ha nincs küszöb abban a pénznemben,
   a riport kimondja, és a becslés USD-küszöbe fut. A ≥2× tétel-kiemelés (Monitoring) változatlanul él.

**Mérés.** 2026-10-02 07:59-kor a tábla még NEM létezett (az export bekapcsolva, első adat még nem jött): élő
`--print` a 10-01 napra → „Valós költség: NINCS MÉG — a számla-export táblája (…) még nem létezik …”, a becslés (11,68 $)
a fő szám. **A valós ág élesen még NEM mért** — csak hermetikusan és egy literál-táblán futtatott ugyanilyen SQL-lel.

**Őr.** `scripts/google-cost-report-check.mts` ⑪–⑰ (fetch-csonk: Monitoring + BigQuery egy fetch mögött): valós ág
(nettó, projekt-bontás, bruttó/jóváírás, a lekérés paraméterei, csak-olvasó SQL, hibás táblanév dob), valós küszöb,
pénznem (HUF/EUR/USD/RON), nincs-tábla / üres / korai export / 403 / kivétel / kikapcsolt, késő adat, egyik-másik forrás
hiánya, BigQuery-lapozás, DST. Mutációval mérve, mind piros: késés-ág ki (6), jóváírás nélkül (8), küszöb nélküli pénznem
USD-vel (2), 404 ≠ missing (4), korai export-kezdet ki (2), a késő nap valósnak számít (11), lapozás ki (3).

**Elvetett.** (a) A becslés teljes kiváltása — a számla késik, reggel 07:10-kor a tegnapi nap gyakran még nem teljes;
a becslés a Monitoringból azonnal megvan. (b) Árfolyam-váltás a USD-küszöbhöz — egy elavult árfolyam néma hamis
zöldet vagy hamis riasztást adna; a küszöb a pénznemben él. (c) A `_PARTITIONTIME` szerinti szűrés — a partícionálás
módja a még nem létező táblán nem mérhető; a tábla napi néhány száz sor, a teljes olvasás olcsó.
