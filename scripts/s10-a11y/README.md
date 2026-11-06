# S10 akadálymentességi híd (WhatsApp / Viber vezérlés adb-ről)

**Miért:** a WhatsApp a regisztrációs (és valószínűleg más) képernyőin ELDOBJA az adb-ről
injektált érintést és billentyűt (`input tap/text/keyevent`, uiautomator `click`) — az esemény
megérkezik, de a nézet nem reagál (mérve 2026-11-06, S10 / Android 12). Az akadálymentességi
`ACTION_CLICK` / `ACTION_SET_TEXT` viszont átmegy.

**Használat** (a telefonon a `com.citoviso.a11y/.CitA11yService` engedélyezve):

```
scripts/s10-a11y/a11y.sh click    <resource-id | pontos szöveg | content-desc | ~részlet>
scripts/s10-a11y/a11y.sh settext  <kulcs> "<szöveg>"
scripts/s10-a11y/a11y.sh back|home x
```

Az eredmény a broadcast `data` mezőjében jön vissza (`OK … -> true` / `NOTFOUND`), és a
logcat `CITA11Y` tagjén is. A képernyő tartalma: `uiautomator dump` (olvasás működik).

**Újraépítés / telepítés:** `bash scripts/s10-a11y/build.sh` (JDK 21 + `~/Android` build-tools 34).

## Messenger-jelenlét mérése (küldés nélkül)

`python3 scripts/s10-a11y/msg_check.py <bemenet.txt> <kimenet.csv> [korábbi.csv]` — a bemenet soronként
`lead_id|név|minősítés|város|36XXXXXXXXX`. Számonként megnyitja a `wa.me/<szám>` és a
`viber://chat?number=%2B<szám>` csevegést, kiolvassa, van-e fiók (Vibernél a profilnevet és az
utolsó aktivitást is), majd a kezdőképernyőre lép. Üzenetet NEM küld. 20–35 mp szünet számonként
(tiltás-kockázat). A futás alatt a telefonhoz ne nyúljon senki (a képernyőt használja).
