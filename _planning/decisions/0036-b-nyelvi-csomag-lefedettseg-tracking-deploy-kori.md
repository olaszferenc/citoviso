## ADR-0036/b — Nyelvi csomag: lefedettség-tracking + deploy-kori self-heal (fejlesztés alatti elavulás ellen)

- **Kiváltó (tulaj, 2026-08-20):** a globális szál fejlesztési fázisban van — a katalógus folyamatosan
  nő, így egy meglévő nyelvi csomag CSENDBEN elavul (az új stringek magyarul szivárognának ki), és a
  kiszolgáló-útvonalak csak olvasnak, nem generálnak. Kell: tracking (mely nyelv teljes / generálandó)
  ÉS deploy-kori check→generate.
- **Megoldás:**
  1. **Tracking:** `scripts/i18n-pack-status.mts` — lefedettség-riport nyelvenként a katalógushoz
     mérve (`pl: 208/215 ⚠️ GENERÁLANDÓ — 7 hiányzó`); `--ensure` flaggel pótol is. Az ismert
     nyelv-univerzum: meglévő csomagok ∪ aktív régiók országainak nyelvei (`knownLanguages`).
  2. **Deploy-kori self-heal:** mindkét szerver (konzol + publikus) BOOT-KOR fire-and-forget
     lefuttatja az `ensureAllLanguagePacks()`-et — deploy+restart automatikusan feltölti az összes
     ismert csomagot a friss katalógusra (hangos loggal; AI-hívás csak ha tényleg hiányzik valami).
  3. A meglévő rétegek maradnak: mock-generálás/scrape-indulás per-nyelv ensure; pre-commit
     katalógus-frissesség kapu; hiányzó string render-kor hangos hu-fallback.
- **Bizonyítva:** a lokál PL csomag 208/215-re avult a párhuzamos fejlesztéstől → tracking jelezte,
  --ensure 215/215-re pótolta.
- **Visszafordíthatóság:** 🔄 könnyű — additív (CLI + boot-horog).
- **Státusz:** ELFOGADVA / implementálva (2026-08-20).
