/** Minimal IMAP over TLS: LOGIN, SELECT, SEARCH UNSEEN, FETCH RFC822, STORE \Seen. */

export type FetchedMail = {
  uid: string;
  raw: string;
};

function encodeImapString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export class ImapClient {
  private conn: Deno.TlsConn | null = null;
  private buffer = new Uint8Array(0);
  private tag = 0;
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  constructor(
    private host: string,
    private port: number,
  ) {}

  async connect(): Promise<void> {
    this.conn = await Deno.connectTls({ hostname: this.host, port: this.port });
    await this.readUntil((text) => text.includes('\n'));
  }

  async login(user: string, password: string): Promise<void> {
    const res = await this.command(`LOGIN ${encodeImapString(user)} ${encodeImapString(password)}`);
    if (!/OK /i.test(res)) throw new Error('IMAP-Login fehlgeschlagen.');
  }

  async select(folder: string): Promise<void> {
    const mailbox = folder.trim() || 'INBOX';
    const res = await this.command(`SELECT ${encodeImapString(mailbox)}`);
    if (!/OK /i.test(res)) throw new Error(`IMAP-Ordner ${mailbox} nicht wählbar.`);
  }

  async searchUnseen(): Promise<string[]> {
    const res = await this.command('UID SEARCH UNSEEN');
    const line = res.split('\n').find((row) => /^\* SEARCH/i.test(row.trim())) ?? '';
    const ids = line.replace(/^\*\s+SEARCH/i, '').trim().split(/\s+/).filter((id) => /^\d+$/.test(id));
    return ids;
  }

  async fetchRfc822(uid: string): Promise<string> {
    if (!/^\d+$/.test(uid)) throw new Error('Ungültige IMAP-UID.');
    const res = await this.command(`UID FETCH ${uid} (RFC822)`);
    const literal = res.match(/\{(\d+)\}\r?\n/);
    if (!literal) return res.slice(0, 1_000_000);
    const size = Number(literal[1]);
    if (!Number.isFinite(size) || size < 0 || size > 1_000_000) {
      throw new Error('IMAP-Nachricht zu groß oder ungültig.');
    }
    const start = res.indexOf(literal[0]) + literal[0].length;
    return res.slice(start, start + size);
  }

  async markSeen(uid: string): Promise<void> {
    if (!/^\d+$/.test(uid)) throw new Error('Ungültige IMAP-UID.');
    await this.command(`UID STORE ${uid} +FLAGS (\\Seen)`);
  }

  async logout(): Promise<void> {
    try {
      await this.command('LOGOUT');
    } catch {
      // ignore
    }
    this.conn?.close();
    this.conn = null;
  }

  private nextTag(): string {
    this.tag += 1;
    return `A${this.tag}`;
  }

  private async command(payload: string): Promise<string> {
    const tag = this.nextTag();
    await this.write(`${tag} ${payload}\r\n`);
    return this.readUntil((text) => new RegExp(`^${tag} `, 'm').test(text));
  }

  private async write(text: string): Promise<void> {
    if (!this.conn) throw new Error('IMAP nicht verbunden.');
    const bytes = this.encoder.encode(text);
    let offset = 0;
    while (offset < bytes.length) {
      const written = await this.conn.write(bytes.subarray(offset));
      offset += written;
    }
  }

  private async readUntil(done: (text: string) => boolean): Promise<string> {
    if (!this.conn) throw new Error('IMAP nicht verbunden.');
    while (true) {
      const text = this.decoder.decode(this.buffer);
      if (done(text)) return text;
      const chunk = new Uint8Array(8192);
      const n = await this.conn.read(chunk);
      if (n === null) return this.decoder.decode(this.buffer);
      if (this.buffer.length + n > 2_000_000) {
        throw new Error('IMAP-Antwort zu groß.');
      }
      const next = new Uint8Array(this.buffer.length + n);
      next.set(this.buffer);
      next.set(chunk.subarray(0, n), this.buffer.length);
      this.buffer = next;
    }
  }
}
