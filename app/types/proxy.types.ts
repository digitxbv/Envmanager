// =====================================================
// Proxy Function Type Definitions
// =====================================================
// Types for proxy function CRUD operations.
// Template types come from generated database.types.ts.

export interface SecretMapping {
  variable_id: string       // UUID from variables table
  inject_as: 'header' | 'body' | 'query'
  key: string               // Header name, body JSON path, or query param
  template?: string          // e.g. "Bearer ${value}"
}

export interface ProxyFunction {
  id: string
  organization_id: string
  environment_id: string
  service_id: string | null
  name: string
  slug: string
  description: string | null
  enabled: boolean
  target_url: string
  http_method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  target_headers: Record<string, string>
  secret_mappings: SecretMapping[]
  secret_token: string
  allowed_origins: string[]
  request_body_template: object | null
  pass_through_body: boolean
  rate_limit_per_minute: number | null
  template_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProxyFunctionForm {
  name: string
  description: string
  service_id: string | null
  target_url: string
  http_method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  target_headers: Record<string, string>
  secret_mappings: SecretMapping[]
  allowed_origins: string[]
  request_body_template: object | null
  pass_through_body: boolean
  rate_limit_per_minute: number | null
  template_id: string | null
}

export interface DailyStats {
  proxy_function_id: string
  day: string  // YYYY-MM-DD
  total_calls: number
  success_count: number
  client_error_count: number
  server_error_count: number
  avg_response_time_ms: number
  p95_response_time_ms: number
}

export interface HourlyStats {
  proxy_function_id: string
  hour: string  // ISO timestamp
  total_calls: number
  success_count: number
  error_count: number
  avg_response_time_ms: number
}

export interface ProxyUsageSummary {
  proxy_function_id: string
  proxy_name: string
  total_calls: number
  success_rate: number
  avg_response_time_ms: number
}

export interface ProxyTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  category: string
  icon: string | null
  target_url: string
  http_method: string
  target_headers: Record<string, string>
  secret_hints: Array<{ inject_as: 'header' | 'body' | 'query'; key: string; description?: string; template?: string }>
  request_body_template: Record<string, unknown> | null
  pass_through_body: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}