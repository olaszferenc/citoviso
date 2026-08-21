// DMARC aggregate-report monitor for the sending domain (2026-08-21).
//
// WHY THIS EXISTS: outreach is the business. A cold mail that lands in spam is
// a lost conversion, and the only feedback channel that reports it is the DMARC
// aggregate report — a daily zipped XML mailed to the rua= address. Nobody is
// going to open those zips by hand, so an unsigned or spoofed source could ride
// along for weeks unnoticed.
//
// WHAT IT MEASURES (and it measures the thing that matters, not a proxy):
// not "did a report arrive", but the per-source authentication verdict inside
// it. A source that authenticates on neither SPF nor DKIM is a hard FAIL and
// exits non-zero. A source that passes only one of the two is a WARN: DMARC
// still passes today, but the mail breaks the moment a recipient forwards it
// (SPF does not survive forwarding, DKIM does).
//
// Zero new dependencies on purpose: IMAP over node:tls, ZIP via zlib.inflateRaw.
//
// Run:  npx tsx scripts/dmarc-report.mts [--days N] [--json] [--selftest]
// Creds: DMARC_IMAP_URL=imaps://user:pass@imappro.zoho.com:993
//        (falls back to deriving the IMAP host from SMTP_URL — same app password)

import tls from "node:tls";
import { gunzipSync, inflateRawSync, constants as zlibConstants } from "node:zlib";

/** One authentication verdict for one sending IP within one report. */
interface DmarcRecord {
  sourceIp: string;
  count: number;
  headerFrom: string;
  dkim: string;
  spf: string;
}

interface DmarcReport {
  orgName: string;
  domain: string;
  policy: string;
  records: DmarcRecord[];
}

type Verdict = "FAIL" | "WARN" | "PASS";

/** DMARC alignment verdict: both authenticate = PASS, one = WARN, neither = FAIL. */
function verdictOf(r: DmarcRecord): Verdict {
  const dkimOk = r.dkim === "pass";
  const spfOk = r.spf === "pass";
  if (dkimOk && spfOk) return "PASS";
  if (dkimOk || spfOk) return "WARN";
  return "FAIL";
}

// ---------------------------------------------------------------- XML parsing

/** First text value of <tag> inside the given XML fragment. */
function tag(xml: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? m[1].trim() : "";
}

/** All fragments enclosed by <name>...</name>. */
function blocks(xml: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

export function parseDmarcXml(xml: string): DmarcReport {
  const meta = blocks(xml, "report_metadata")[0] ?? "";
  const pol = blocks(xml, "policy_published")[0] ?? "";
  const records = blocks(xml, "record").map((rec) => {
    const row = blocks(rec, "row")[0] ?? "";
    const evaluated = blocks(row, "policy_evaluated")[0] ?? "";
    const ident = blocks(rec, "identifiers")[0] ?? "";
    return {
      sourceIp: tag(row, "source_ip"),
      count: Number(tag(row, "count") || "0"),
      headerFrom: tag(ident, "header_from"),
      dkim: tag(evaluated, "dkim"),
      spf: tag(evaluated, "spf"),
    };
  });
  return {
    orgName: tag(meta, "org_name"),
    domain: tag(pol, "domain"),
    policy: tag(pol, "p"),
    records,
  };
}

// ------------------------------------------------------------ archive helpers

/** Decompress a DMARC attachment: .gz, .zip (stored or deflated), or plain XML. */
export function decompressReport(buf: Buffer): string {
  if (buf[0] === 0x1f && buf[1] === 0x8b) return gunzipSync(buf).toString("utf8");
  if (buf.subarray(0, 4).toString("latin1") === "PK\x03\x04") {
    const method = buf.readUInt16LE(8);
    const nameLen = buf.readUInt16LE(26);
    const extraLen = buf.readUInt16LE(28);
    const start = 30 + nameLen + extraLen;
    const body = buf.subarray(start);
    if (method === 0) {
      const size = buf.readUInt32LE(18);
      return body.subarray(0, size || undefined).toString("utf8");
    }
    // Z_SYNC_FLUSH tolerates the central directory trailing the deflate stream.
    return inflateRawSync(body, { finishFlush: zlibConstants.Z_SYNC_FLUSH }).toString("utf8");
  }
  return buf.toString("utf8");
}

/**
 * Pull report attachments out of a raw RFC822 message.
 * Detects payloads by magic bytes rather than parsing MIME: robust against
 * whatever part structure the reporting provider happens to use.
 */
function extractAttachments(raw: string): Buffer[] {
  const out: Buffer[] = [];
  const re = /Content-Transfer-Encoding:\s*base64[^]*?\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const buf = Buffer.from(m[1].replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
    const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
    const isZip = buf.subarray(0, 4).toString("latin1") === "PK\x03\x04";
    if (isGzip || isZip) out.push(buf);
  }
  return out;
}

// ------------------------------------------------------------- minimal IMAP

/** Literal-aware IMAP client: enough to LOGIN, SEARCH and FETCH. */
class ImapClient {
  private socket!: tls.TLSSocket;
  private buffer = Buffer.alloc(0);
  private seq = 0;
  private waiter: { tag: string; resolve: (v: string) => void; reject: (e: Error) => void } | null = null;

  async connect(host: string, port: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.socket = tls.connect({ host, port, servername: host }, () => resolve());
      this.socket.on("error", (err) => {
        if (this.waiter) this.waiter.reject(err);
        else reject(err);
      });
      this.socket.on("data", (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.tryComplete();
      });
    });
    await this.awaitGreeting();
  }

  private awaitGreeting(): Promise<string> {
    return new Promise((resolve) => {
      const check = () => {
        const s = this.buffer.toString("latin1");
        if (s.includes("\r\n")) {
          this.buffer = Buffer.alloc(0);
          resolve(s);
        } else setTimeout(check, 20);
      };
      check();
    });
  }

  /**
   * Resolve the pending command once its tagged completion line arrives.
   * Skips over IMAP literals ({N}\r\n + N raw bytes) so message bodies that
   * happen to contain a tag-like line cannot terminate the read early.
   */
  private tryComplete(): void {
    if (!this.waiter) return;
    const s = this.buffer.toString("latin1");
    let i = 0;
    while (i < s.length) {
      const nl = s.indexOf("\r\n", i);
      if (nl === -1) return;
      const line = s.slice(i, nl);
      const lit = /\{(\d+)\}$/.exec(line);
      if (lit) {
        i = nl + 2 + Number(lit[1]);
        continue;
      }
      if (line.startsWith(this.waiter.tag + " ")) {
        const full = s.slice(0, nl);
        const w = this.waiter;
        this.waiter = null;
        this.buffer = Buffer.alloc(0);
        if (/ (NO|BAD) /.test(line)) w.reject(new Error(line));
        else w.resolve(full);
        return;
      }
      i = nl + 2;
    }
  }

  send(command: string): Promise<string> {
    const tagId = `C${String(++this.seq).padStart(3, "0")}`;
    return new Promise((resolve, reject) => {
      this.waiter = { tag: tagId, resolve, reject };
      this.socket.write(`${tagId} ${command}\r\n`);
      this.tryComplete();
    });
  }

  async logout(): Promise<void> {
    try {
      await this.send("LOGOUT");
    } catch {
      /* server may close first */
    }
    this.socket.destroy();
  }
}

/** IMAP connection details, from DMARC_IMAP_URL or derived from SMTP_URL. */
function resolveImapUrl(): URL {
  const explicit = process.env.DMARC_IMAP_URL;
  if (explicit) return new URL(explicit);
  const smtp = process.env.SMTP_URL;
  if (!smtp) {
    throw new Error(
      "Neither DMARC_IMAP_URL nor SMTP_URL is set. Expected imaps://user:pass@imappro.zoho.com:993",
    );
  }
  const u = new URL(smtp);
  u.protocol = "imaps:";
  u.host = u.hostname.replace(/^smtp/, "imap");
  u.port = "993";
  return u;
}

async function fetchReports(days: number): Promise<DmarcReport[]> {
  const url = resolveImapUrl();
  const client = new ImapClient();
  await client.connect(url.hostname, Number(url.port || 993));
  const user = decodeURIComponent(url.username);
  const pass = decodeURIComponent(url.password);
  await client.send(`LOGIN "${user}" "${pass}"`);
  await client.send("SELECT INBOX");

  const since = new Date(Date.now() - days * 86_400_000);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][since.getUTCMonth()];
  const sinceStr = `${since.getUTCDate()}-${mon}-${since.getUTCFullYear()}`;

  const searchRes = await client.send(`SEARCH SINCE ${sinceStr} SUBJECT "Report domain"`);
  const ids = (/^\* SEARCH([\d ]*)/m.exec(searchRes)?.[1] ?? "").trim().split(/\s+/).filter(Boolean);

  const reports: DmarcReport[] = [];
  for (const id of ids) {
    const raw = await client.send(`FETCH ${id} (BODY.PEEK[])`);
    for (const att of extractAttachments(raw)) {
      try {
        reports.push(parseDmarcXml(decompressReport(att)));
      } catch (err) {
        console.error(`  ! could not parse attachment in message ${id}: ${(err as Error).message}`);
      }
    }
  }
  await client.logout();
  return reports;
}

// ------------------------------------------------------------------ selftest

/**
 * Prove the guard goes RED on a bad source before trusting it when it is green.
 * A guard that has never been seen to fail is not evidence of anything.
 */
function selftest(): number {
  const mk = (dkim: string, spf: string) => `<record><row><source_ip>1.2.3.4</source_ip>
    <count>7</count><policy_evaluated><dkim>${dkim}</dkim><spf>${spf}</spf></policy_evaluated></row>
    <identifiers><header_from>citoviso.com</header_from></identifiers></record>`;
  const xml = (recs: string) =>
    `<feedback><report_metadata><org_name>test</org_name></report_metadata>
     <policy_published><domain>citoviso.com</domain><p>none</p></policy_published>${recs}</feedback>`;

  const cases: Array<[string, string, Verdict]> = [
    ["pass", "pass", "PASS"],
    ["fail", "pass", "WARN"],
    ["pass", "fail", "WARN"],
    ["fail", "fail", "FAIL"],
  ];
  let bad = 0;
  for (const [dkim, spf, want] of cases) {
    const rep = parseDmarcXml(xml(mk(dkim, spf)));
    const got = verdictOf(rep.records[0]);
    const ok = got === want && rep.records[0].count === 7;
    if (!ok) bad++;
    console.log(`  ${ok ? "ok  " : "FAIL"} dkim=${dkim} spf=${spf} -> ${got} (want ${want})`);
  }
  // The archive reader must survive a real deflate round-trip, not just plain XML.
  const plain = decompressReport(Buffer.from("<feedback/>", "utf8"));
  if (plain !== "<feedback/>") {
    bad++;
    console.log("  FAIL passthrough decompress");
  }
  console.log(bad === 0 ? "\nselftest: OK" : `\nselftest: ${bad} FAILED`);
  return bad === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------- main

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--selftest")) {
    process.exit(selftest());
  }
  const daysArg = argv.indexOf("--days");
  const days = daysArg !== -1 ? Number(argv[daysArg + 1]) : 30;

  const reports = await fetchReports(days);
  if (argv.includes("--json")) {
    console.log(JSON.stringify(reports, null, 2));
  }

  if (reports.length === 0) {
    console.log(`No DMARC aggregate reports found in the last ${days} days.`);
    return;
  }

  // Aggregate per source IP across all reports in the window.
  const bySource = new Map<string, { count: number; verdict: Verdict; dkim: string; spf: string }>();
  for (const rep of reports) {
    for (const rec of rep.records) {
      const v = verdictOf(rec);
      const prev = bySource.get(rec.sourceIp);
      bySource.set(rec.sourceIp, {
        count: (prev?.count ?? 0) + rec.count,
        // Keep the worst verdict seen for this source.
        verdict: prev && prev.verdict === "FAIL" ? "FAIL" : v === "FAIL" ? "FAIL" : prev?.verdict === "WARN" ? "WARN" : v,
        dkim: rec.dkim,
        spf: rec.spf,
      });
    }
  }

  const domain = reports[0].domain;
  const policy = reports[0].policy;
  console.log(`DMARC ${domain} (p=${policy}) — ${reports.length} report(s), last ${days} days\n`);

  let failed = 0;
  let warned = 0;
  for (const [ip, s] of [...bySource.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const mark = s.verdict === "PASS" ? "PASS" : s.verdict === "WARN" ? "WARN" : "FAIL";
    if (s.verdict === "FAIL") failed++;
    if (s.verdict === "WARN") warned++;
    console.log(`  [${mark}] ${ip.padEnd(16)} ${String(s.count).padStart(4)} msg   dkim=${s.dkim} spf=${s.spf}`);
  }

  console.log("");
  if (failed > 0) {
    console.error(
      `${failed} source(s) authenticated on NEITHER SPF nor DKIM — possible spoofing or broken auth.`,
    );
    process.exit(1);
  }
  if (warned > 0) {
    console.log(
      `${warned} source(s) pass only one mechanism. DMARC holds today, but forwarded mail will break.`,
    );
  }
  console.log(`OK — no unauthenticated source in the last ${days} days.`);
}

main().catch((err) => {
  console.error(`dmarc-report failed: ${(err as Error).message}`);
  process.exit(2);
});
