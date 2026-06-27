<template>
  <Dialog
    :open="open"
    title="Delete organization"
    @close="handleClose"
  >
    <div v-if="organization" class="space-y-4">
      <div class="rounded-md border border-destructive/20 bg-destructive/5 p-3">
        <p class="text-sm text-destructive">
          This permanently deletes
          <span class="font-semibold">{{ organization.name }}</span>
          and everything in it — all projects, environments, variables, secrets,
          members, integrations, and its subscription. User accounts are not
          removed. This cannot be undone.
        </p>
      </div>

      <div>
        <label class="mb-2 block text-sm font-medium">
          Type <span class="font-semibold">{{ organization.name }}</span> to confirm
        </label>
        <Input
          v-model="confirmText"
          :placeholder="organization.name"
          autocomplete="off"
        />
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="outline" :disabled="deleting" @click="handleClose">
          Cancel
        </Button>
        <Button
          variant="destructive"
          :disabled="!canDelete"
          :loading="deleting"
          @click="handleDelete"
        >
          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          Delete organization
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Dialog from '@/components/ui/Dialog.vue'

interface DeletableOrganization {
  id: string
  name: string
}

const props = defineProps<{
  open: boolean
  organization: DeletableOrganization | null
}>()

const emit = defineEmits<{
  close: []
  deleted: [organization: DeletableOrganization]
}>()

const { $toast } = useNuxtApp()
const { deleteOrganization } = usePlatformAdmin()

const confirmText = ref('')
const deleting = ref(false)

const canDelete = computed(() =>
  !deleting.value &&
  !!props.organization &&
  confirmText.value.trim() === props.organization.name
)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) confirmText.value = ''
  }
)

const handleClose = () => {
  if (deleting.value) return
  emit('close')
}

const handleDelete = async () => {
  if (!props.organization || !canDelete.value) return

  const target = props.organization
  deleting.value = true

  try {
    await deleteOrganization(target.id)
    $toast.success(`${target.name} deleted`)
    emit('deleted', target)
    emit('close')
  } catch {
    // Error toast is shown by the composable; keep the dialog open for retry.
  } finally {
    deleting.value = false
  }
}
</script>
