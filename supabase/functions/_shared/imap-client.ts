const encoder = new TextEncoder();
const decoder = new TextDecoder();

function imapQuote(value: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error("Ungültige IMAP-Zeichen in Zugangsdaten");
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ImapClient {
  private conn: Deno.TlsConn;
  private leftover = new Uint8Array(0);
  private seq = 0;

  private constructor(conn: Deno.TlsConn) {
    this.conn = conn;
  }

  static async connect(host: string, port: number, timeoutMs = 15_000): Promise<ImapClient> {
    const conn = await Promise.race([
      Deno.connectTls({ hostname: host, port }),
      sleep(timeoutMs).then(() => {
        throw new Error("IMAP-Verbindung zeitüberschritten");
      }),
    ]) as Deno.TlsConn;
    const client = new ImapClient(conn);
    const greeting = await client.readLine();
    if (!/^\* (OK|PREAUTH)/i.test(greeting)) {
      client.close();
      throw new Error("IMAP-Server hat die Verbindung nicht bestätigt");
    }
    return client;
  }

  async login(username: string, password: string) {
    await this.command(`LOGIN ${imapQuote(username)} ${imapQuote(password)}`);
  }

  async select(folder: string) {
    await this.command(`SELECT ${imapQuote(folder)}`);
  }

  async uidSearchUnseen(): Promise<number[]> {
    const { text } = await this.command("UID SEARCH UNSEEN");
    const match = text.match(/\* SEARCH[^\r\n]*/i);
    if (!match) return [];
    return (match[0].replace(/^\* SEARCH/i, "").trim().split(/\s+/).filter(Boolean))
      .map((part) => Number(part))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  async uidFetchPeek(uid: number): Promise<{ header: string; text: string }> {
    const headerRes = await this.command(
      `UID FETCH ${uid} BODY.PEEK[HEADER.FIELDS (MESSAGE-ID FROM SUBJECT DATE)]`,
    );
    let textBytes = new Uint8Array();
    try {
      const textRes = await this.command(`UID FETCH ${uid} BODY.PEEK[TEXT]<0.80000>`);
      textBytes = textRes.literals[0] ?? new Uint8Array();
    } catch {
      try {
        const textRes = await this.command(`UID FETCH ${uid} BODY.PEEK[TEXT]`);
        textBytes = textRes.literals[0] ?? new Uint8Array();
      } catch {
        // Nur Header reicht — Textvorschau bleibt leer.
      }
    }
    return {
      header: decoder.decode(headerRes.literals[0] ?? new Uint8Array()),
      text: decoder.decode(textBytes),
    };
  }

  async uidMarkSeen(uid: number) {
    await this.command(`UID STORE ${uid} +FLAGS.SILENT (\\Seen)`);
  }

  async logout() {
    try {
      await this.command("LOGOUT");
    } catch {
      // ignore
    } finally {
      this.close();
    }
  }

  close() {
    try {
      this.conn.close();
    } catch {
      // ignore
    }
  }

  private nextTag(): string {
    this.seq += 1;
    return `A${this.seq}`;
  }

  private async command(cmd: string): Promise<{ text: string; literals: Uint8Array[] }> {
    const tag = this.nextTag();
    await this.conn.write(encoder.encode(`${tag} ${cmd}\r\n`));
    const literals: Uint8Array[] = [];
    let text = "";
    while (true) {
      const line = await this.readLine();
      const lit = line.match(/\{(\d+)\}\s*$/);
      if (lit) {
        const size = Number(lit[1]);
        if (size > 200_000) {
          throw new Error("IMAP-Nachricht zu groß");
        }
        literals.push(await this.readExact(size));
        text += `${line}\n`;
        continue;
      }
      text += `${line}\n`;
      if (line.startsWith(`${tag} `)) {
        if (!line.toUpperCase().startsWith(`${tag} OK`)) {
          throw new Error(line.slice(tag.length + 1));
        }
        break;
      }
    }
    return { text, literals };
  }

  private async readLine(): Promise<string> {
    while (true) {
      const idx = indexOfCrlf(this.leftover);
      if (idx >= 0) {
        const line = decoder.decode(this.leftover.subarray(0, idx));
        this.leftover = this.leftover.subarray(idx + 2);
        return line;
      }
      const chunk = new Uint8Array(4096);
      const n = await this.conn.read(chunk);
      if (n === null) throw new Error("IMAP-Verbindung geschlossen");
      const next = new Uint8Array(this.leftover.length + n);
      next.set(this.leftover);
      next.set(chunk.subarray(0, n), this.leftover.length);
      this.leftover = next;
    }
  }

  private async readExact(size: number): Promise<Uint8Array> {
    const out = new Uint8Array(size);
    let filled = 0;
    if (this.leftover.length) {
      const take = Math.min(this.leftover.length, size);
      out.set(this.leftover.subarray(0, take));
      this.leftover = this.leftover.subarray(take);
      filled += take;
    }
    while (filled < size) {
      const chunk = new Uint8Array(Math.min(4096, size - filled));
      const n = await this.conn.read(chunk);
      if (n === null) throw new Error("IMAP-Verbindung geschlossen");
      out.set(chunk.subarray(0, n), filled);
      filled += n;
    }
    return out;
  }
}

function indexOfCrlf(buf: Uint8Array): number {
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10) return i;
  }
  return -1;
}
