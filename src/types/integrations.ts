export type SystemType =
  | 'erp'
  | 'telematics'
  | 'email_imap'
  | 'rest_api'
  | 'csv_import'
  | 'research_source';

export interface SystemIntegration {
  id: string;
  company_id: string;
  depot_id: string | null;
  system_type: SystemType;
  name: string;
  config: Record<string, string>;
  vault_secret_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const CONFIG_FIELDS: Record<SystemType, string[]> = {
  erp: ['base_url', 'client_id', 'mandant_nr'],
  telematics: ['api_url', 'vehicle_group'],
  email_imap: ['host', 'port', 'folder'],
  rest_api: ['base_url', 'timeout_ms'],
  csv_import: ['sftp_host', 'sftp_port', 'remote_path'],
  research_source: ['base_url', 'notiz'],
};

export const CREDENTIAL_FIELDS: Record<SystemType, string[]> = {
  erp: ['client_secret'],
  telematics: ['api_key'],
  email_imap: ['username', 'password'],
  rest_api: ['auth_header'],
  csv_import: ['sftp_username', 'sftp_password'],
  research_source: [],
};

export const TYPE_LABELS: Record<SystemType, string> = {
  erp: 'ERP-System',
  telematics: 'Telematik',
  email_imap: 'E-Mail (IMAP)',
  rest_api: 'REST API',
  csv_import: 'CSV / SFTP',
  research_source: 'Branchen-Website (Recherchequelle)',
};

export const TYPE_ICONS: Record<SystemType, string> = {
  erp: '🏢',
  telematics: '📡',
  email_imap: '📧',
  rest_api: '🔌',
  csv_import: '📂',
  research_source: '🔎',
};
