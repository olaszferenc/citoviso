## ADR-0093 — Egyedi domain: vételi ár-plafon őr + háromutas tulajdonjog-átszállás + paraméterezett feltételek

> ⚠️ **RÉSZBEN FELÜLÍRVA — ADR-0109 (2026-09-07).** A ② pont („küszöbtől INGYEN a domain")
> MÁR NEM ÉL: nincs ingyen-ág, a küszöb **belépési feltétellé** vált (a saját cím csak
> felette választható), a díj pedig HAVI. A ④ ár-plafon, a hűségidő és a kötbér-modell
> változatlanul érvényes. Implementálás előtt az ADR-0109-et olvasd.

**Dátum:** 2026-09-03 · **Státusz:** ELFOGADVA (tulaj) · **Kapcsolódó:** ADR-0020 (domain-stratégia,
24 hó — a ② pont MÓDOSÍTJA), ADR-0071/0078 (automata domain-beszerzés, fizetés = trigger),
ADR-0080 (előfizetés-motor, havi számlázás), `src/legal.ts` §9 (rendelési feltételek — egyedi domain).

**Kiváltó (tulajdonosi ötletelés, 2026-09-03):** ① a zéró-touch domain-vétel (ADR-0071) mögött
NINCS ár-kapu — egy prémium domain (akár milliós INWX-ár) emberi szem nélkül csúszna át; ② a 24
hónapos elköteleződés a magyar piacon túl magas belépési küszöb lehet; ③ a korai kilépő
kivásárlási útja nincs kimondva — a tulaj ötlete: a kivásárlás ne csak pénz lehessen, hanem
hűség is („maradj még egy évet változatlan csomagon, és a tiéd").

### Döntés

**① Ár-plafon őr a domain-vételen — KÉT kapuval.** A drága domain (a) már az ajánlat/konfigurátor
fázisban KISZŰRENDŐ (fel se kínálható — különben a vevő fizet, a vétel elhasal az őrön, és jön a
refund-út: `feedback_mock_path_masks_live_path` tanulsága); (b) a hiteles, registrar-oldali ár a
`provisionDomain` állapotgép `registering` lépése ELŐTT ellenőrzendő (a mai olcsó DNS+RDAP előcsekk
árat nem tud → a `RegistrarAdapter` bővül ár-visszaadással). A plafon **EUR-ban tárolt**
pricing-paraméter (az INWX EUR-ban áraz; nincs árfolyam-függés az őrben). Plafon felett: a vétel
NEM indul el, a vevő az ajánlatban alternatívát lát.

**② Elköteleződés ≠ előrefizetés; a minimum 24 hóról 12 hóra LAZUL (tulaj-döntés).** A
kötelezettségvállalás szerződéses, a fizetés HAVI marad (ADR-0080); egyösszegű éves előrefizetés
= opció a meglévő ingyen-hónap kedvezménnyel. Az ingyen domain feltétele: min. elköteleződés
(hónap) + min. csomagár — mindkettő paraméter.

**③ Tulajdonjog-átszállás HÁROM úton, ebben a kínálási sorrendben:**
1. **Kitöltött futamidő** → ingyen átszáll (lejárat + 90 nap + maradéktalan fizetés — a `legal.ts`
   §9 meglévő szabálya VÁLTOZATLAN; értékesítési érv: „a futamidő után a tiéd").
2. **Korai kilépésnél ELSŐKÉNT felkínálva: hűség-kivásárlás** — +12 hónap **változatlan csomagon**
   → a végén ingyen átszáll. A felmondás pillanata megújítási pillanattá fordul (a domain a
   kötődési horog, ADR-0020). A „változatlan csomag" kikötés kötelező — enélkül a hűség-évre
   mindenki a legolcsóbb csomagra váltana le.
3. **Fallback: készpénzes kivásárlás FIX áron** (nem időarányos: egyszerűbb kommunikálni és az
   ÁSZF-ben rögzíteni). Anti-gaming: a fix kivásárlási ár > vételi plafon, tehát rajtunk keresztül
   domaint venni-és-lelépni mindig ráfizetés — nem válhatunk olcsó domain-beszerzővé.

**④ Pricing-config paraméterek (pricing-admin felületen állítható) + pilot-értékek:**

| Paraméter | Pilot-érték |
|---|---|
| Domain-vételi ár-plafon (őr) | 15 € |
| Min. elköteleződés az ingyen domainhez | 12 hó |
| Min. csomagár az ingyen domainhez | 8 000 Ft/hó |
| Készpénzes kivásárlási fix ár | 20 000 Ft |
| Hűség-kivásárlás hossza | 12 hó |

**⑤ ÁSZF-implikáció:** a `legal.ts` §9 módosítandó — a „2 éves szerződéses viszony" szövege a
paraméteres minimumra igazítandó, és a két kivásárlási út (hűség/készpénz) kimondandó. Élő
egyedi-domaines tenant ma NINCS → a szöveg-módosítás most olcsó, verzió-konfliktus nélkül.

### Elhatárolás / kockázat

- A tulaj korábbi altenatív ötlete (a kivásárlási összeg előfizetési kreditre váltása) ELVETVE —
  furcsa előre-fizetett-kredit könyvelést szülne; a hűség-út ugyanazt éri el tisztán.
- **Visszafordíthatóság:** 🔄 — paraméterek + additív pricing-mezők + adapter-bővítés; maga a
  domain-vétel marad 🚪 egyirányú (ADR-0071), pont ezért kell elé az ár-őr.

**Impl. tételek:** `RegistrarAdapter` ár-visszaadás (mock+INWX) → ár-őr a `provisionDomain`-ben +
konfigurátor-szűrés → pricing_config új mezők + admin-felület → `legal.ts` §9 szöveg →
kivásárlási utak a tenant-admin felmondás-flow-ban (felület-munka → §2b terv-kapu!).
