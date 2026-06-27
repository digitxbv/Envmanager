import { defineStore } from 'pinia'

interface Organization {
  id: string
  name: string
  created_at: string
}

type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

export const useOrganizationStore = defineStore('organization', {
  state: () => ({
    selectedOrganizationId: null as string | null,
    organizations: [] as Organization[],
    // Per-org cache of the current user's role. The role is otherwise re-queried
    // 3-4x on every dashboard load (layout + each page); for US users that's
    // 3-4 redundant transatlantic round-trips. Populated on first read.
    roleByOrg: {} as Record<string, OrgRole | null>
  }),

  getters: {
    selectedOrganization: (state) => {
      return state.organizations.find(org => org.id === state.selectedOrganizationId) || null
    }
  },

  actions: {
    setRole(orgId: string, role: OrgRole | null) {
      this.roleByOrg[orgId] = role
    },

    setOrganizations(orgs: Organization[]) {
      this.organizations = orgs
      // Auto-select first org if none selected
      if (!this.selectedOrganizationId && orgs.length > 0) {
        const firstOrg = orgs[0]
        if (firstOrg) {
          this.selectedOrganizationId = firstOrg.id
        }
      }
    },

    selectOrganization(orgId: string) {
      this.selectedOrganizationId = orgId
    }
  }
})
