export interface Variable {
  id?: string
  key: string
  value: string | null
  is_secret: boolean
  fallback_value?: string
  version?: number
  tags?: string[]
  service_id?: string
}
