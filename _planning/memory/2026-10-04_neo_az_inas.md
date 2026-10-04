# 2026-10-04 — Neo az Inas: digitális kurátor-munkatárs (ADR-XXXX)

**Kérés (tulaj brief):** Marika-szerű munkatárs, aki az admin konzolban, böngészőben elvégzi a
kurátori előkészítést: digitális lenyomat (van-e más honlapja), elérhetőség keresése Google-ben,
nyitókép, mock típus, generálás, szöveg-ellenőrzés.

**Fordulat:** az első tervem a meglévő végpontok láncolása volt (API-pipeline, költségbecsléssel).
A tulaj elutasította: perszóna kell, aki a saját Chrome-jában kattint, néz, olvas, és nála van az
ontológia. Tanulság a memóriában: `feedback_digital_colleague_is_a_person_not_a_pipeline`.

**Elkészült:**
- `neo/charter/CHARTER.md`, `neo/charter/RUNBOOK.md` — munkakör, kemény határok, napi menet, jelentés-formátum.
- ADR-XXXX (+ az ADR-0028-ban módosítás-mutató): Neo választhat sablont indoklással; szűk éles felhatalmazás.
- Éles konzol-fiók `neo` („Neo az Inas”), jelszó: `~/.config/citoviso/neo-prod-operator.txt` (600).
- Működési memória a fán kívül: `~/neo/` (naplo/, jelentesek/, tanulsagok.md, ugyek.md, chrome-profile/).
- Mérés: a Google a headless Chrome-ot normál UA-val átengedi (rendes találati lista).

**Nyitott:** a konzol nem ellenőrzi a szerepkört → a határt ma csak a charter tartja; kurátor-szerepkör
szerver-oldali írás-kapuval + operátor-műveleti napló a nagy deployjal.
