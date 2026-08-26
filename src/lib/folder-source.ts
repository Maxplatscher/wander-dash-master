import type { SystemIntegration, SystemType } from '@/types/integrations';

export const FOLDER_TYPES: SystemType[] = ['email_imap', 'csv_import', 'unc_share'];
export const TECHNICAL_TYPES: SystemType[] = ['erp', 'telematics', 'rest_api', 'research_source'];

export type FolderKind = 'email_imap' | 'csv_import' | 'unc_share';

export type ParsedFolderPath = {
  kind: FolderKind;
  config: Record<string, string>;
  display: string;
};

export function isFolderType(type: string): type is FolderKind {
  return FOLDER_TYPES.includes(type as SystemType);
}

export function parseFolderPath(raw: string): ParsedFolderPath | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('\\\\') || value.startsWith('//')) {
    const path = value.replace(/\//g, '\\');
    return { kind: 'unc_share', config: { path }, display: path };
  }

  const sftpMatch = value.match(/^(?:sftp:\/\/)?([^/\s:]+)(?::(\d+))?(?:[:/](.+))?$/i);
  if (/^sftp:\/\//i.test(value) || /^sftp\./i.test(value)) {
    const host = sftpMatch?.[1] ?? value;
    const port = sftpMatch?.[2] ?? '22';
    const remotePath = sftpMatch?.[3] ? `/${sftpMatch[3].replace(/^\/+/, '')}` : '/';
    const display = `${host}:${remotePath}`;
    return {
      kind: 'csv_import',
      config: { sftp_host: host, sftp_port: port, remote_path: remotePath },
      display,
    };
  }

  const [hostPart, folderPart] = value.split(/\s*·\s*/);
  const hostPort = hostPart.replace(/^imap:\/\//i, '').trim();
  const host = hostPort.replace(/:\d+$/, '');
  const portFromHost = hostPort.match(/:(\d+)$/)?.[1];
  const folder = (folderPart ?? 'INBOX').trim() || 'INBOX';
  if (!host) return null;
  return {
    kind: 'email_imap',
    config: { host, port: portFromHost ?? '993', folder },
    display: `${host} · ${folder}`,
  };
}

export function formatFolderSource(integration: SystemIntegration): string {
  const config = integration.config ?? {};
  if (integration.system_type === 'email_imap') {
    const host = config.host?.trim() || 'IMAP';
    const folder = config.folder?.trim() || 'INBOX';
    return `${host} · ${folder}`;
  }
  if (integration.system_type === 'csv_import') {
    const host = config.sftp_host?.trim() || 'sftp';
    const path = config.remote_path?.trim() || '/';
    return `${host}:${path}`;
  }
  if (integration.system_type === 'unc_share') {
    return config.path?.trim() || 'Netzwerkpfad';
  }
  return integration.name;
}

export function folderHonestyNote(type: SystemType): string | null {
  if (type === 'unc_share') {
    return 'Manuell/extern gepflegt — Edge Functions erreichen keinen Firmen-UNC-Pfad.';
  }
  if (type === 'csv_import') {
    return 'SFTP-Abholung ist noch nicht gebaut. Konfiguration liegt, Daten kommen nicht automatisch.';
  }
  return null;
}

export function folderStatus(integration: SystemIntegration): 'aktiv' | 'wartet' {
  if (integration.system_type === 'csv_import') return 'wartet';
  if (integration.system_type === 'email_imap' && !integration.vault_secret_id) return 'wartet';
  return integration.is_active ? 'aktiv' : 'wartet';
}

export function formatRelativeDe(iso: string | null, now = Date.now()): string {
  if (!iso) return 'noch nicht gelesen';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'noch nicht gelesen';
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return 'gerade eben';
  if (minutes === 1) return 'vor 1 Minute';
  if (minutes < 60) return `vor ${minutes} Minuten`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return 'vor 1 Stunde';
  if (hours < 24) return `vor ${hours} Stunden`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'vor 1 Tag';
  return `vor ${days} Tagen`;
}
