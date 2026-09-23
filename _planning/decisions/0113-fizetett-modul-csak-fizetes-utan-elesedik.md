## ADR-0113 — Fizetett modul CSAK fizetés után élesedik: időarányos első díj (az ADR-0080 ② B-opció kivezetve) (2026-09-08)

**Dátum:** 2026-09-08 · **Státusz:** ELFOGADVA (tulajdonosi döntés e sessionben: „Fizetés-kapus
aktiválás", a felkínált három modell közül) · **Kapcsolódó:** ADR-0080 ②③④ (előfizetés-motor,
B-opció), ADR-0088 ④⑥⑨ (kupon, mandátum-visszavonás), ADR-0033/0034 (a 0033 upsell-gépezet),
ADR-0094 (fail-closed fizetés-út), ADR-0102 (modul-értékesítés kapcsoló).

**Kiváltó (tulaj-teszt a Dencs-tenanton, mérve a kódban ÉS a DB-ben):** éves fizetésű tenant →
az ismétlődő kártya-megbízást visszavonta (ADR-0088 ⑨, token törölve) → EZUTÁN modulokat
aktivált → a felület: „első díjuk a 2027-09-08-i számlán jelenik meg" = **12 hónap ingyen
használat**. Tovább: a sosem-számlázott modul lemondása azonnali és ingyenes
(`moduleChange.ts` switchedOff-ág), a fordulónapi számla pedig a fordulónapkori állapotot nézi
→ a „fordulónap előtt lemond, utána visszakapcsol" hurok **örökre ingyen** — és havi ütemnél is
él, csak 1 hónapos szeletekben. A mandátum-visszavonás SEMMIT nem kapuzott. Az ADR-0080 ②
indoka („a törtidőszak ajándék, max ~1 hónap; a kockázat ezen az árszinten elhanyagolható")
a HAVI ütemre volt méretezve — az éves ütem 12×-esre nyitotta az ablakot.

**Döntések:**
1. **Fizetett modul CSAK az első díj beérkezése után élesedik.** A 0033 upsell-gépezet
   (order kind='upsell' → pay-link/terhelés → webhook → activateUpsell) visszaáll a B-opció
   helyére. Token-mód: azonnali MIT-terhelés (payer-absent); díjbekérő-mód: fizetési link,
   az élesítés a fizetés-eseményben történik. Fail-closed (ADR-0094 minta): sikertelen vagy
   elmaradt fizetés = SEMMI nem aktiválódik.
2. **Első díj = időarányos a fordulónapig, megkezdett-hónap gránummal:** havi modulár ×
   hátralévő MEGKEZDETT hónapok száma a fordulónapig; éves ütemnél felül-korlát
   `12 − ajándékhónap` (ma 10) — az induló díj sosem drágább az éves csomagárnál. Havi
   ütemnél ez definíció szerint 1 teljes hónap — fillérszámla (az ADR-0080 ② eredeti
   ellenérve) így SEM keletkezik. A következő fordulónapi számlán a modul már normál tétel.
3. **Ami ingyenes, ingyenes marad:** 0 Ft-os modul bekapcsolása és a lemondás-visszavonás
   (rejoin — ki van fizetve a forduló végéig) azonnali, fizetés nélkül. A lemondás továbbra
   is a fordulónapon érvényesül (ADR-0080 ③ változatlan). A „sosem számlázott azonnali-ki"
   ág kivezet — új ilyen állapot nem keletkezik; a meglévő `awaiting_first_charge` sorok
   legacy-ként a régi szabály szerint futnak ki (a fordulón számlázódnak vagy azonnal
   kikapcsolhatók).
4. **Kedvezmény az aktiválási fizetésen:** az ADR-0088 kupon/ajánlat az első díjra a
   VÁSÁRLÁSKOR érvényesül (áthúzott listaárral, offer_id az orderen) — nem a fordulónapi
   számlán bujkál.
5. **A kapu az ÍRÁSON ül, nem a felületen** (feedback_additive_write_is_not_a_gate):
   `applyModuleChange` maga nem kapcsol be fizetős ÚJ modult — `requiresPayment`-tel tér
   vissza; kézzel gyártott POST sem kerülheti meg.

**Elvetve:** (a) elszámolás lemondáskor — díjbekérő-módban a behajtás bizonytalan (használt,
ki nem fizetett hónapok maradnának); (b) csak-mandátum-kapu — token-módban a hurok kicsiben
megmaradna.

**Visszafordíthatóság:** 🔄 a fizetés-út a meglévő, tesztelt 0033 gépezet; a gránum és a
felül-korlát paraméter. 🚪 Kifelé tett ígéret változik: a Modulok fül szövege
(„első díja a következő számlán" → „fizetés most, időarányosan") és a KB vele EGYÜTT frissül.
