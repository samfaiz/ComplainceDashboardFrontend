export type Role = "admin" | "analyst" | "viewer";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  is_admin: boolean;
  can_manage: boolean;
  mfa_enabled: boolean;
  ip_flagged: boolean;
  must_change_password: boolean;
  current_ip: string | null;
  last_login_at: string | null;
  preferences: Record<string, unknown> | null;
}

export type SecretMode = "saved" | "per_login";
export type Vendor =
  | "generic"
  | "crowdstrike"
  | "defender"
  | "sentinelone"
  | "wazuh"
  | "trendmicro"
  | "cortex"
  | "cisco_amp"
  | "elastic"
  | "sophos";
export type AuthType = "bearer" | "api_key_header" | "basic" | "oauth2_client_credentials";

export interface Site {
  id: number;
  name: string;
  sources_count: number;
}

export interface ApiSource {
  id: number;
  name: string;
  site_id: number | null;
  vendor: Vendor;
  base_url: string;
  auth_type: AuthType;
  auth_config: Record<string, unknown>;
  request_config: Record<string, unknown>;
  field_mappings: Record<string, string>;
  refresh_interval_minutes: number;
  secret_mode: SecretMode;
  secret_hint: string | null;
  has_secret: boolean;
  requires_unlock: boolean;
  is_enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  latest_snapshot_id: number | null;
}

export interface PresetField {
  key: string;
  label: string;
  type: "text" | "password";
  target: string; // "secret" | "base_url" | "auth.<key>"
  required?: boolean;
  placeholder?: string;
  help?: string;
}

export interface Preset {
  vendor: Vendor;
  label: string;
  description: string;
  base_url: string;
  auth_type: AuthType;
  auth_config: Record<string, unknown>;
  request_config: Record<string, unknown>;
  field_mappings: Record<string, string>;
  fields: PresetField[];
  docs: string;
  docs_url?: string;
  setup_guide?: string[];
}

export interface Summary {
  total: number;
  by_os: Record<string, number>;
  by_health: Record<string, number>;
  by_compliance: Record<string, number>;
  by_agent_version: Record<string, number>;
  online: number;
  stale: number;
  offline: number;
  compliant: number;
  non_compliant: number;
  compliance_pct: number;
  agent_versions: number;
}

export interface Widget {
  id: string;
  type: "stat" | "gauge" | "pie" | "donut" | "bar" | "line" | "area" | "table";
  title: string;
  config: Record<string, unknown>;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dashboard {
  id: number;
  user_id: number;
  api_source_id: number | null;
  name: string;
  is_default: boolean;
  layout: Widget[];
}
