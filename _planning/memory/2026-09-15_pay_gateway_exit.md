# 2026-09-15 — Az átjáró és a bukás-lap: egy hangos út, és a képernyő megmondja, mit fizetsz

**Szál:** `wt/fizetespillanat` (B1 blokk zárása) · **ADR-0175** ·
**Kontraktus:** `assets/design-refs/console/pay-gateway-exit/` (plan.html + README + 2 kép)
**Tulajdonosi döntés:** „A — a fizetés a főszereplő”. **Élesítés NINCS.**

## A mért kiindulás (a valós exportált nézet-függvényeken, betöltött stíluslappal)

| lelet | mérve |
|---|---|
| a két gomb azonos | „Fizetek ▸” és „Elutasítom”: **mindkettő 35 px, fw 600, 12,5 px, fehér, 999 px** — csak a szövegszín más |
| nincs terméknév | `terméknév: false` mind a NÉGY átjáró-állapotban és a bukás-lapon |
| nincs másoló gomb | a hivatkozási azonosító csupasz `<code>` |
| nincs kiút | a bukás-lapról az újrapróbáláson és egy mailto-n túl semmi |

## ⛔⛔ Amit a KÉP fogott meg, és a DOM-mérés NEM

Az első CSS-em után a szonda azt mondta: `51 px / fw 700` vs `42 px / fw 600` — **a hierarchia
kész**. A képernyőképen viszont **mindkét gomb sötétkék kitöltött** volt, és az elsődleges sem
volt cián.

A generikus `.con button[type="submit"]:not(.ok):not(.bad):not(.hp-alt):not(.con-btn2)` **(0,6,1)**
veri a `.con .pay-act button[type="submit"]`-et **(0,3,1)**. A doboz-méretek helyesek voltak, a
**festés** nem — és a „halk” visszaút pont ugyanúgy nézett ki, mint a fizetés, vagyis az egész
terv értelme veszett el. Ugyanaz a specificitás-csapda, mint a `.con a` link-szabály a
gomb-feliraton.

⭐ **Tanulság az őrre:** a hierarchiát nem elég a dobozon mérni. Az őr most a **festést is**
állítja (`painted`), és külön mondja ki, hogy a halk gomb **NEM** lehet második tömör gomb.

## ⛔⛔ Egy őr-állítás MÁS KÉRDÉSRE válaszolt — és helyes kódon ment pirosra

A „rendezett fizetésen nincs terhelést indító gomb” szabályt a korábbi őröm így mérte:
`paid.buttons.length === 0`. Amint a lapra került a **másoló gomb** — ami semmit nem terhel —, a
kapu pirosra ment egy **helyes** változtatáson. A proxy a *gombok számát* kérdezte, nem azt, hogy
*lehet-e terhelést indítani*. Javítva: az őr a `/paid`-re és `/failed`-re menő űrlapokat és a
submit-gombokat számolja.

⚠️ Ez ugyanaz az osztály, mint a „felirat más kérdésre válaszol” memóriák — csak most a MÉRŐ
oldalán. Egy proxy, ami helyes kódon elbukik, ugyanolyan drága, mint amelyik hibásat átenged:
legközelebb valaki a szabályt fogja gyengíteni, nem a mérést javítani.

## Amit szállítottam

- **Gomb-hierarchia** méretben és vastagságban (51/42 px, 700/600, 15,2/13,6 px), **festéssel**
  megerősítve; a visszaút 42 px — tapintható marad.
- **Tétel-sor mindkét lapon**: szállásnév + termék + ciklus, a `payment → order_intent →
  prospect → lead` úton. **LEFT join**: egy elveszett prospect-sor nem teheti renderelhetetlenné
  a fizetés lapját. Név nélkül a sor a termékre szűkül — nem talál ki nevet (§B.17).
- **Másolható hivatkozási azonosító** mindkét lapon; a `<code>` a jelölésben marad, tehát JS
  nélkül is megvan. A szkript `head`-be megy és DOM-készre vár — a `layout()`-nak nincs `tail`
  rése, és egy ilyen rés minden konzol-lapot érintene.
- **Három nevesített kiút** a bukás-lapon. ⛔ **Üres sávot nem rajzolunk**: ha egyik út sincs
  (első vásárló, nincs retry-link, nincs cím), az elválasztó sem jelenik meg.

## Őr

`scripts/pay-exit-truth-check.mts` — **53 állítás**, **18 sértés** az öntesztben, minden
szabály-csoportra külön visszarontással; köztük a szállított hiba **szó szerint** (a halk
visszaút ugyanolyan súlyúra állítva). Két §B.17-fixtúra: **név nélkül** és **kiút nélkül**.
A kontraktus `## Kötő horgony` szakasza öt szerkezeti horgonyt köt (ADR-0164 ④), amit a
`contract-drift-check` mér.

## Kimondott hatókör-korlát

Az átjáró a **MOCK** átjáró. Élesben a Barion lapja jön, tehát ott ez a hierarchia nem a mi
kezünkben van. Azért kötjük, mert ezt méri az Elek, ez megy ki minden nem-Barion úton, és a
tétel-sor meg a másolható azonosító a saját lapjainkon marad érvényes.

Kapcsolódó: [[project_checkout_fullscreen]] · [[feedback_link_rule_eats_button_label]] ·
[[feedback_label_answers_a_different_question]] · [[feedback_badge_answered_one_of_nine_gates]]
