import { describe, expect, it } from 'vitest';
import {
  formatRelativeDe,
  parseFolderPath,
} from './folder-source';

describe('parseFolderPath', () => {
  it('erkennt IMAP mit Host und Ordner', () => {
    expect(parseFolderPath('imap.example.com · INBOX/Lieferscheine')).toEqual({
      kind: 'email_imap',
      config: { host: 'imap.example.com', port: '993', folder: 'INBOX/Lieferscheine' },
      display: 'imap.example.com · INBOX/Lieferscheine',
    });
  });

  it('erkennt UNC-Pfade und kennzeichnet sie als manuell', () => {
    const parsed = parseFolderPath('\\\\fileserver\\scans\\lieferscheine');
    expect(parsed?.kind).toBe('unc_share');
    expect(parsed?.display).toBe('\\\\fileserver\\scans\\lieferscheine');
  });

  it('erkennt SFTP-Angaben', () => {
    const parsed = parseFolderPath('sftp.partner.example:/out/shipments/');
    expect(parsed?.kind).toBe('csv_import');
    expect(parsed?.config.sftp_host).toBe('sftp.partner.example');
    expect(parsed?.config.remote_path).toBe('/out/shipments/');
  });
});

describe('formatRelativeDe', () => {
  const now = Date.parse('2026-08-26T12:00:00.000Z');

  it('sagt noch nicht gelesen ohne Zeitstempel', () => {
    expect(formatRelativeDe(null, now)).toBe('noch nicht gelesen');
  });

  it('formatiert Minuten', () => {
    expect(formatRelativeDe('2026-08-26T11:56:00.000Z', now)).toBe('vor 4 Minuten');
  });
});
