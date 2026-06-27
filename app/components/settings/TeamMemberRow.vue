<template>
  <tr class="border-b last:border-0 hover:bg-muted/50 transition-colors">
    <!-- Email Column -->
    <td class="py-3 px-4">
      <div class="flex items-center gap-3">
        <Avatar :email="member.email" size="sm" />
        <span class="text-sm font-medium text-foreground">{{ member.email }}</span>
      </div>
    </td>

    <!-- Role Column -->
    <td class="py-3 px-4">
      <Select
        v-if="canEditRole"
        :model-value="member.role"
        :options="roleOptions"
        class="w-28"
        @update:model-value="(val: string) => emit('update-role', { memberId: member.id, newRole: val })"
      />
      <Badge
        v-else
        :variant="getRoleBadgeVariant(member.role)"
      >
        {{ formatRoleLabel(member.role) }}
      </Badge>
    </td>

    <!-- Joined Column -->
    <td class="py-3 px-4">
      <span class="text-sm text-muted-foreground">
        {{ formatDate(member.created_at) }}
      </span>
    </td>

    <!-- Actions Column -->
    <td class="py-3 px-4">
      <div v-if="canRemove" class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          @click="$emit('manage-access', { member })"
        >
          Access
        </Button>
        <Button
          variant="destructive"
          size="sm"
          :disabled="isLastOwner"
          @click="$emit('remove', { memberId: member.id })"
        >
          Remove
        </Button>
      </div>
    </td>
  </tr>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Select from '~/components/ui/Select.vue'
import Avatar from '~/components/ui/Avatar.vue'
import type { TeamMember } from '~/composables/useTeamManagement'

interface Props {
  member: TeamMember
  currentUserRole: 'owner' | 'admin' | 'member' | 'viewer' | null
  isLastOwner?: boolean
}

interface Emits {
  (e: 'update-role', payload: { memberId: string; newRole: string }): void
  (e: 'remove', payload: { memberId: string }): void
  (e: 'manage-access', payload: { member: TeamMember }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const canEditRole = computed(() => {
  if (props.currentUserRole === null) return false
  if (props.currentUserRole === 'owner') return true
  if (props.currentUserRole === 'admin' && props.member.role !== 'owner') return true
  return false
})

const canRemove = computed(() => {
  if (props.currentUserRole === null) return false
  if (props.currentUserRole === 'owner' || props.currentUserRole === 'admin') {
    return true
  }
  return false
})

const roleOptions = [
  { label: 'Member', value: 'member' },
  { label: 'Viewer', value: 'viewer' },
  { label: 'Admin', value: 'admin' },
  { label: 'Owner', value: 'owner' }
]

const getRoleBadgeVariant = (role: string): string => {
  switch (role) {
    case 'owner':
      return 'success'
    case 'admin':
      return 'warning'
    default:
      return 'outline'
  }
}

const formatRoleLabel = (role: string): string => {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} ${months === 1 ? 'month' : 'months'} ago`
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
}
</script>
