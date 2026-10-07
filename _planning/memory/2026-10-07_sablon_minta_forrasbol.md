# 2026-10-07 — A mock minta-blokkjai a forrásból (szolgáltatás, szobakártyák, cím)

SUB-szál a csapat-koordinátornak (brief: `~/rc-briefs/sablon-mintablokk-forrasbol-20261007.md`,
átadás: `~/rc-briefs/sablon-mintablokk-forrasbol-atadas-20261007-1735.md`). Döntés: ADR-XXXX.
Lokál + land; élesre SEMMI (nagy deploy).

## Mit javítottunk
1. **Szolgáltatás-minta a forrásból:** a forrás saját tételei elöl, a tagadott típus („Háziállat nem
   engedélyezett” → Kisállat) kimarad — a minta-szobák felszereltségéből is.
2. **Szobakártyák:** prózai egységnevek („Family”, „Gold” apartman) → annyi kártya; kimondott szám →
   számozott; semmi → 1 kártya „Az egész szállás” (nem kitalált 3).
3. **„Hungary”** le a megjelenített címről (a ház saját országa; idegen ország marad), a renderelésben.
4. **„Vendegház”:** a Google Places-névből jön (`lead.name`), a sablon nem ront — nem javítottuk, kurátori döntés.

5. **Tényhűség-őr (FLAG mindhárom mockon) → javítva, ami a mi változásunk mellékhatása volt:** a valós nevű
   (Family/Gold) és az „Az egész szállás” kártya nem visel generikus minta-chipet. Ellenőrizve: a renderelt
   HTML-ben 0 „Reggeli kérhető / Erkély / Ingyenes Wi-Fi / Saját fürdőszoba” a kártyákon; room-details,
   live-sample-room, whole-only-guest, guest-mobile, room-card-overflow, fact-sample zöld.

## Fájlok
- ÚJ: `src/engine/sampleFromSource.ts`, `src/engine/displayAddress.ts`, `scripts/sample-from-source-check.mts`
- Módosítva: `src/engine/{recipe,moduleSections,templateKit,render}.ts`, `src/generator/{generateEngine,marketCheck}.ts`,
  `scripts/room-card-overflow-check.mts`, `hooks/pre-commit`

## Esettanulmányok (élesről csak olvasva, $0 újrarender)
`assets/design-refs/_drafts/sablon-minta/<id>-{elotte,utana}*.{html,png}` — 25611f91 Partvilla, 63bcac22 Főnix,
2f5bb7f5 Kisvasút, ea625e43 Vitorlás. (A `_drafts/` a land-kor törlődik.)

## Nyitott
- A tényhűség-őr korábbról meglévő leletei (külön döntés, a koordinátornak jelezve): az érkezés/távozás
  minta-időpontok ellentmondhatnak a forrás valós idejének (Partvilla); forrástalan generikus
  szolgáltatás-tételek „Minta” jelöléssel; „Szobák” fej egy „Az egész szállás” kártya fölött.
- A MÁR legenerált mockokban a régi tartalom marad, amíg újra nem renderelik / generálják őket.
- „Kisvasút Vendegház” lead-név javítása a konzolon — kurátori döntés.
