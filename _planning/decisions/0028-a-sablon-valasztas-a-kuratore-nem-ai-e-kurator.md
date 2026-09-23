## ADR-0028 — A sablon-választás a KURÁTORÉ (nem AI-é) + kurátor-prompt a generálás előtt; tanuló-adat gyűlik

- **Tulaj-döntés (2026-08-08):** „Első körben a kurátor válasszon típust/sablont. Tudjon beadni
  promptot mock-generálás előtt. Egyelőre ezt nem bízhatjuk AI-ra. Majd tanuljuk."
- **Mit jelent:** (1) a mock-generálás art-sablonját (ADR-0027 flotta) a KURÁTOR választja a
  konzol lead-oldalán (select; alapértelmezés: fullbleed) — AI art-direction-választó NEM épül
  most; (2) a kurátor opcionális SZABAD-SZÖVEGES promptot adhat (hangvétel/hangsúly/célközönség),
  ami a brief-generátor és az editorial copywriter bemenetébe kerül — KIZÁRÓLAG hang-vezérlés:
  a §B.17 tényhűség-kontraktus a prompt tartalmára is áll (tényt a prompt sem adhat hozzá,
  a rendszer-promptok ezt explicit kimondják); (3) a beadott prompt az artifact
  `inputs.curatorPrompt` mezőjébe perzisztálódik → később tanuló-adat (melyik lead-típushoz
  milyen sablon/prompt vezetett konverzióhoz) az esetleges automatizáláshoz.
- **Flotta-bővítés ugyanekkor:** a tulaj 2 új referencia-irányt adott le (08-brutalism,
  10-dopamine-maximal → assets/design-refs/reference-quality/), ezek is sablonná válnak
  (brutalism, dopamine) — a kurátor 7 irányból választ.
- **Visszafordíthatóság:** 🔄 könnyű — a select/prompt additív form-mező; AI-választó később
  a gyűlt adat alapján bekapcsolható a kurátor felülbírálási jogával.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-08). Implementálva ebben a sessionben.
