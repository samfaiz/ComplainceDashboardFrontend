export type Role = "super_admin" | "admin" | "analyst" | "viewer";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** The org this user belongs to (null for the platform owner). */
  organization_id: number | null;
  organization_name: string | null;
  /** True for throwaway "try it" demo accounts. */
  is_demo: boolean;
  /** When the demo account expires (ISO string); null for normal accounts. */
  demo_expires_at: string | null;
  is_active: boolean;
  is_admin: boolean;
  is_super_admin: boolean;
  /** Platform owner (super_admin) — can manage all organizations. */
  is_platform_owner: boolean;
  /** Set when a platform owner has "entered" an org to view it scoped. */
  viewing_organization?: { id: number; name: string } | null;
  can_manage: boolean;
  mfa_enabled: boolean;
  /** True when admin has flagged this account to enroll MFA. */
  mfa_required: boolean;
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

export interface Organization {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string | null;
  users_count: number;
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

export type WidgetType = "stat" | "gauge" | "pie" | "donut" | "bar" | "line" | "area" | "table";

export type SortMode = "none" | "value_desc" | "value_asc" | "label_asc";
export type TimeRange = "7d" | "14d" | "30d" | "90d" | "all";
export type Granularity = "day" | "week";
export type ThresholdDirection = "higher_is_better" | "lower_is_better";

export interface WidgetThresholds {
  good?: number;
  warn?: number;
  direction?: ThresholdDirection;
}

export interface WidgetConfig {
  // stat / gauge
  metric?: string;
  rule?: { match?: string; conditions?: Array<{ field: string; op: string; value: string }> };
  display?: "count" | "percent";
  thresholds?: WidgetThresholds;
  // pie / donut / bar
  field?: string;
  horizontal?: boolean;
  sort?: SortMode;
  topN?: number; // 0 = all
  showOther?: boolean;
  // line / area
  series?: string[];
  range?: TimeRange;
  granularity?: Granularity;
  smooth?: boolean;
  // common display
  palette?: string;
  showLegend?: boolean;
  showValues?: boolean;
  unitSuffix?: string;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig & Record<string, unknown>;
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
  /** True when the current user owns the dashboard. */
  owned?: boolean;
  /** True for assigned (view-only) dashboards. */
  read_only?: boolean;
  /** Owner name shown on read-only dashboards. */
  owner_name?: string | null;
}

export interface AssignableDashboard {
  id: number;
  name: string;
  is_default: boolean;
  owner: { id: number; name: string; email: string; role: Role };
  widget_count: number;
  updated_at: string;
}

export interface AssignedDashboard {
  id: number;
  name: string;
  owner: { id: number; name: string; email: string };
  assigned_at: string;
  assigned_by_user_id: number | null;
}

export type Severity = "critical" | "high" | "moderate" | "medium" | "low" | "unknown";

export interface VulnAdvisory {
  id: string | number | null;
  cve: string | null;
  title: string;
  severity: Severity | string;
  affected_versions: string | null;
  cvss: number | null;
  url: string | null;
}

export interface StackPackage {
  ecosystem: "php" | "npm" | "runtime";
  name: string;
  version: string;
  dev: boolean;
  description?: string | null;
  homepage?: string | null;
  advisories: VulnAdvisory[];
  highest_severity: string | null;
}

export interface RuntimeEntry {
  name: string;
  version: string | null;
  ecosystem: "runtime";
}

export interface TechStackSnapshot {
  generated_at: string;
  runtime: RuntimeEntry[];
  totals: {
    packages: number;
    php: number;
    npm: number;
    vulnerable: number;
    advisories: number;
  };
  packages: StackPackage[];
  errors: { source: string; message: string }[];
}

/* -------------------- Notifications -------------------- */

export interface MailSettings {
  id: number;
  transport: "smtp" | "log";
  host: string | null;
  port: number | null;
  encryption: "tls" | "ssl" | null;
  username: string | null;
  has_password: boolean;
  from_address: string | null;
  from_name: string | null;
  reply_to: string | null;
  enabled: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  last_test_error: string | null;
}

export interface NotificationTemplate {
  id: number;
  event_key: string;
  display_name: string;
  category: string;
  default_severity: "info" | "warning" | "critical";
  subject: string;
  body_html: string;
  body_text: string | null;
  enabled: boolean;
  variables: Record<string, string>;
  default_audience: Role[];
  updated_at: string;
}

export interface NotificationSubscription {
  event_key: string;
  display_name: string;
  category: string;
  default_severity: "info" | "warning" | "critical";
  enabled: boolean;
  is_explicit: boolean;
  default_on: boolean;
}

export interface NotificationLogEntry {
  id: number;
  user_id: number | null;
  user?: { id: number; name: string; email: string } | null;
  event_key: string;
  channel: string;
  recipient: string;
  subject: string;
  status: "queued" | "sent" | "failed" | "skipped";
  error: string | null;
  sent_at: string | null;
  created_at: string;
}
