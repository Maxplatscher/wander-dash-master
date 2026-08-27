import { describe, expect, it } from 'vitest';
import { isPrivateOrLoopback, validateExternalUrl } from './ssrf';

describe('ssrf guard', () => {
  it('blockiert Loopback, RFC1918 und Cloud-Metadata', () => {
    expect(isPrivateOrLoopback('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopback('10.0.0.8')).toBe(true);
    expect(isPrivateOrLoopback('192.168.1.1')).toBe(true);
    expect(isPrivateOrLoopback('169.254.169.254')).toBe(true);
    expect(isPrivateOrLoopback('metadata.google.internal')).toBe(true);
    expect(isPrivateOrLoopback('imap.gmail.com')).toBe(false);
  });

  it('lässt öffentliche HTTPS-CSV-URLs durch und blockt file/localhost', () => {
    expect(validateExternalUrl('https://example.com/orders.csv').ok).toBe(true);
    expect(validateExternalUrl('http://127.0.0.1/secret').ok).toBe(false);
    expect(validateExternalUrl('file:///etc/passwd').ok).toBe(false);
  });
});
