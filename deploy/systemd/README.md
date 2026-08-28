# systemd unitok

Verziózott unit-fájlok, hogy a telepítés **reprodukálható és átnézhető** legyen —
ne ad-hoc `ssh` parancsokból álljon össze (ugyanaz az elv, mint ADR-0053-ban a
deploynál: verzió megy ki, nem kézi művelet).

## `citoviso-domain-resume` (ADR-0071)

**Mit csinál.** Kétpercenként továbbnyomja a beragadt egyedi-domain beszerzéseket
(`npx tsx scripts/resume-domains.mts`).

**Miért kell.** A domain-vétel után az NS-delegálás és a TLS-kibocsátás **percekig**
tart. A fizetési webhook nem várhat rá (a gateway timeoutolna), ezért a beszerzés
`dns_pending` / `tls_pending` állapotban parkol. Enélkül a timer nélkül a tenant
kifizetné a domaint, a beszerzés pedig félúton állna, amíg valaki kézzel újra nem
futtatja — vagyis a „zéró emberi interakció" ígéret pont a leglassabb lépésnél bukna.

**Miért veszélytelen gyakran futni.** A `runDomainProvisioning` idempotens: a
végállapotú (`live` / `failed`) sorokat kihagyja, és minden állapot csak a SAJÁT
lépésébe lép be újra — nincs dupla vétel, nincs dupla e-mail.

**Telepítés (dev gépen már fut):**

```bash
sudo cp deploy/systemd/citoviso-domain-resume.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now citoviso-domain-resume.timer
```

**Ellenőrzés:**

```bash
systemctl list-timers citoviso-domain-resume.timer
tail -f /home/citoviso/.claude/citoviso-domain-resume.log
```

⚠️ **Élesen a `WorkingDirectory` MÁS**: a dev gépen `/home/citoviso/citoviso` (a fő fa,
ADR-0052 integrációs pont), az éles VPS-en `/opt/citoviso/app`. A unit-fájlt élesítés
előtt ehhez kell igazítani — a `StandardOutput` naplóút szintén.

⚠️ Az éles telepítés **külön, kimondott engedélyt igényel** (CLAUDE.md §0.3) — ez a
mappa csak a reprodukálható receptet tartja.
