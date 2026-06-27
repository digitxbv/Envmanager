const CAMPAIGN_STORAGE_KEY = 'campaign_params'
const EXPIRY_DAYS = 30

const CAMPAIGN_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'rdt_cid',
  'fbclid',
] as const

type CampaignParams = Partial<Record<(typeof CAMPAIGN_PARAM_KEYS)[number], string>>

interface StoredCampaignParams extends CampaignParams {
  captured_at: string
}

export const useTrackingParams = () => {
  const captureCampaignParams = () => {
    if (import.meta.server) return

    // First-touch: don't overwrite existing params
    const existing = localStorage.getItem(CAMPAIGN_STORAGE_KEY)
    if (existing) {
      // Check expiration
      try {
        const parsed: StoredCampaignParams = JSON.parse(existing)
        const age = Date.now() - new Date(parsed.captured_at).getTime()
        const maxAge = EXPIRY_DAYS * 24 * 60 * 60 * 1000
        if (age <= maxAge) return // Still valid, keep first-touch
        // Expired — fall through to capture new params
      } catch {
        // Corrupted — fall through to capture new params
      }
    }

    const urlParams = new URLSearchParams(window.location.search)
    const captured: CampaignParams = {}

    for (const key of CAMPAIGN_PARAM_KEYS) {
      const value = urlParams.get(key)
      if (value) captured[key] = value
    }

    // Only store if we found at least one param
    if (Object.keys(captured).length > 0) {
      const toStore: StoredCampaignParams = {
        ...captured,
        captured_at: new Date().toISOString(),
      }
      localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(toStore))
    }
  }

  const getCampaignParams = (): CampaignParams | null => {
    if (import.meta.server) return null

    const stored = localStorage.getItem(CAMPAIGN_STORAGE_KEY)
    if (!stored) return null

    try {
      const parsed: StoredCampaignParams = JSON.parse(stored)
      const age = Date.now() - new Date(parsed.captured_at).getTime()
      const maxAge = EXPIRY_DAYS * 24 * 60 * 60 * 1000

      if (age > maxAge) {
        localStorage.removeItem(CAMPAIGN_STORAGE_KEY)
        return null
      }

      // Return params without the metadata
      const { captured_at: _, ...params } = parsed
      return Object.keys(params).length > 0 ? params : null
    } catch {
      localStorage.removeItem(CAMPAIGN_STORAGE_KEY)
      return null
    }
  }

  // Backward compat for existing code
  const getGclid = (): string | null => {
    const params = getCampaignParams()
    return params?.gclid ?? null
  }

  return { captureCampaignParams, getCampaignParams, getGclid }
}
