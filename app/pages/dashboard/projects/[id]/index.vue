<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <h1 v-if="loading" class="text-xl font-semibold text-foreground">Loading project</h1>
    <!-- Loading -->
    <LoadingSpinner v-if="loading" class="py-20" />

    <template v-else-if="project">
      <div class="space-y-6">
        <!-- Header -->
        <PageHeader :title="project.name" :description="project.description || undefined">
          <template #actions>
            <div v-if="canAccessSettings" class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Tooltip content="Secure API proxies for static sites">
                <Button variant="outline" size="sm" @click="navigateTo(`/dashboard/projects/${project.id}/proxies`)">
                  <Icon name="lucide:shield" class="mr-1.5 h-4 w-4" />
                  Proxies
                </Button>
              </Tooltip>
              <Tooltip content="Manage external integrations and sync targets">
                <Button variant="outline" size="sm" @click="navigateTo(`/dashboard/projects/${project.id}/integrations`)">
                  <Icon name="lucide:plug" class="mr-1.5 h-4 w-4" />
                  Integrations
                </Button>
              </Tooltip>
              <Tooltip content="Project settings, environments, and danger zone">
                <Button variant="outline" size="sm" @click="navigateTo(`/dashboard/projects/${project.id}/settings`)">
                  <Icon name="lucide:settings" class="mr-1.5 h-4 w-4" />
                  Settings
                </Button>
              </Tooltip>
            </div>
          </template>
        </PageHeader>

        <!-- Environment Tabs -->
        <Tabs v-model="activeTabId">
          <TabsList>
            <TabsTrigger
              v-for="env in environments"
              :key="env.id"
              :value="env.id"
            >
              {{ env.name }}
              <Badge v-if="env.is_protected" variant="warning" size="sm" class="ml-1.5">
                <Icon name="lucide:shield" class="h-4 w-4" />
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent
            v-for="env in environments"
            :key="'content-' + env.id"
            :value="env.id"
          >
            <div class="space-y-5">
              <!-- Pending changes toggle for protected environments -->
              <div v-if="env.is_protected && currentUserRole !== 'viewer'" class="flex w-full items-center gap-1 rounded-lg bg-muted/50 p-1 sm:w-fit">
                <button
                  @click="showPendingView = false"
                  :class="[
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    !showPendingView
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  ]"
                >
                  Variables
                </button>
                <button
                  @click="showPendingView = true"
                  :class="[
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5',
                    showPendingView
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  ]"
                >
                  Pending Changes
                  <span
                    v-if="pendingCount > 0"
                    class="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 rounded-full text-xs font-bold bg-warning text-white"
                  >
                    {{ pendingCount }}
                  </span>
                </button>
              </div>

              <!-- Pending Changes View -->
              <PendingChangesList
                v-if="showPendingView && env.is_protected"
                :changes="pendingChanges"
                :current-user-id="user?.id ?? user?.sub ?? ''"
                :is-loading="pendingLoading"
                :can-approve="currentUserRole === 'owner' || currentUserRole === 'admin'"
                @approve="openReviewModal($event, 'approve')"
                @reject="openReviewModal($event, 'reject')"
                @cancel="handleCancelChange"
              />

              <!-- Variables View -->
              <template v-else>
                <!-- Read-only banner -->
                <div v-if="!accessLoading && !canWrite" class="flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-4 py-3">
                  <Icon name="lucide:lock" class="h-4 w-4 text-muted-foreground" />
                  <span class="text-sm text-muted-foreground">You have read-only access to this environment</span>
                </div>

                <!-- Toolbar -->
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div class="flex items-center gap-3">
                    <div>
                      <h2 class="text-lg font-medium text-foreground">Variables</h2>
                      <p class="text-sm text-muted-foreground">
                        {{ env.name }} environment
                      </p>
                    </div>
                    <Badge
                      v-if="!accessLoading && accessLevel"
                      :variant="accessLevel === 'write' ? 'success' : 'default'"
                    >
                      <Icon :name="accessLevel === 'write' ? 'lucide:pencil' : 'lucide:eye'" class="h-4 w-4 mr-1" />
                      {{ accessLevel === 'write' ? 'Full access' : 'Read-only' }}
                    </Badge>
                  </div>

                  <!-- Primary + More actions -->
                  <div v-if="canWrite" class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <Button variant="outline" size="sm" @click="showAddVariableModal = true">
                      <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
                      Add Variable
                    </Button>
                    <Button variant="outline" size="sm" @click="showImportModal = true">
                      <Icon name="lucide:upload" class="mr-1.5 h-4 w-4" />
                      Import
                    </Button>
                    <Button variant="outline" size="sm" @click="showExportModal = true">
                      <Icon name="lucide:download" class="mr-1.5 h-4 w-4" />
                      Export
                    </Button>

                    <!-- More actions dropdown -->
                    <Dropdown align="right" width="12rem">
                      <template #trigger>
                        <Button variant="outline" size="sm">
                          <Icon name="lucide:more-horizontal" class="mr-1.5 h-4 w-4" />
                          More
                        </Button>
                      </template>
                      <template #content="{ close }">
                        <button
                          class="dropdown-item"
                          @click="close(); showSnapshotPanel = true"
                        >
                          <Icon name="lucide:camera" class="h-4 w-4 text-muted-foreground" />
                          Snapshots
                        </button>
                        <button
                          class="dropdown-item"
                          @click="close(); showSyncNowModal = true"
                        >
                          <Icon name="lucide:refresh-cw" class="h-4 w-4 text-muted-foreground" />
                          Sync Now
                        </button>
                        <button
                          v-if="hasNamingRules"
                          class="dropdown-item"
                          @click="close(); showAuditModal = true"
                        >
                          <Icon name="lucide:clipboard-check" class="h-4 w-4 text-muted-foreground" />
                          Audit Names
                        </button>
                        <button
                          class="dropdown-item"
                          @click="close(); showBulkUpdateModal = true"
                        >
                          <Icon name="lucide:layers" class="h-4 w-4 text-muted-foreground" />
                          Bulk Update
                        </button>
                      </template>
                    </Dropdown>
                    <SnapshotManager
                      headless
                      :open="showSnapshotPanel"
                      :environment-id="activeEnvironment?.id || ''"
                      :organization-id="project?.organization_id || ''"
                      :is-protected="activeEnvironment?.is_protected || false"
                      @restored="fetchVariables()"
                      @close="showSnapshotPanel = false"
                    />
                  </div>
                  <div v-else class="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
                    <Button variant="outline" size="sm" @click="showExportModal = true">
                      <Icon name="lucide:download" class="mr-1.5 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </div>

                <!-- Service filter -->
                <div v-if="services.length > 0" class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-medium text-muted-foreground">Service:</span>
                  <button
                    @click="selectedServiceId = null"
                    :class="[
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      selectedServiceId === null
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    ]"
                  >
                    All services
                  </button>
                  <button
                    @click="selectedServiceId = 'shared'"
                    :class="[
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      selectedServiceId === 'shared'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    ]"
                  >
                    <span class="h-2 w-2 rounded-full bg-gray-400 mr-1.5" />
                    Shared only
                  </button>
                  <button
                    v-for="svc in services"
                    :key="svc.id"
                    @click="selectedServiceId = svc.id"
                    :class="[
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      selectedServiceId === svc.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    ]"
                  >
                    <span class="h-2 w-2 rounded-full mr-1.5" :style="{ backgroundColor: svc.color || '#6B7280' }" />
                    {{ svc.name }}
                  </button>
                </div>

                <!-- Tag filter -->
                <div v-if="allTags.length > 0" class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-medium text-muted-foreground">Filter by tag:</span>
                  <button
                    v-for="tag in allTags"
                    :key="tag"
                    @click="toggleTagFilter(tag)"
                    :class="[
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      selectedTags.includes(tag)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    ]"
                  >
                    {{ tag }}
                  </button>
                  <button
                    v-if="selectedTags.length > 0"
                    @click="selectedTags = []"
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                </div>

                <!-- Bulk Actions Bar -->
                <div v-if="selectedCount > 0" class="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
                  <span class="text-sm font-medium text-foreground">{{ selectedCount }} selected</span>
                  <div class="h-4 w-px bg-border" />
                  <!-- Assign to Service -->
                  <Dropdown v-if="services.length > 0" align="left" width="12rem">
                    <template #trigger>
                      <Button variant="outline" size="sm" :loading="bulkActionLoading">
                        <Icon name="lucide:layers" class="mr-1.5 h-3.5 w-3.5" />
                        Assign Service
                      </Button>
                    </template>
                    <template #content="{ close }">
                      <button
                        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                        @click="bulkAssignService(null); close()"
                      >
                        <span class="h-2 w-2 rounded-full bg-gray-400" />
                        Shared
                      </button>
                      <button
                        v-for="svc in services"
                        :key="svc.id"
                        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                        @click="bulkAssignService(svc.id); close()"
                      >
                        <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: svc.color || '#6B7280' }" />
                        {{ svc.name }}
                      </button>
                    </template>
                  </Dropdown>
                  <!-- Delete -->
                  <Button variant="outline" size="sm" class="text-destructive hover:text-destructive" :loading="bulkActionLoading" @click="bulkDeleteConfirm">
                    <Icon name="lucide:trash" class="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <div class="flex-1" />
                  <button
                    @click="selectedVariableIds = new Set()"
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear selection
                  </button>
                </div>

                <!-- Phase 1 — empty environment: calm import-first guide -->
                <EmptyProjectGuide
                  v-if="!variablesLoading && variables.length === 0"
                  :can-write="canWrite"
                  class="mb-4"
                  @import="showImportModal = true"
                  @add="showAddVariableModal = true"
                />
                <!-- Phase 2 — has variables: push-to-platform strip -->
                <FirstStepsNudge
                  v-else-if="!variablesLoading && variables.length > 0"
                  :project-id="projectId as string"
                  class="mb-4"
                />

                <!-- Variable Table -->
                <DataTable
                  v-if="variablesLoading || variables.length > 0"
                  :columns="tableColumns"
                  :data="filteredVariables"
                  :loading="variablesLoading"
                  empty-message="No variables found."
                  :selectable="canWrite"
                  v-model:selected-rows="selectedVariableIds"
                  row-key="id"
                >
                  <!-- Empty state override (only reached when a filter hides all rows) -->
                  <template #empty>
                    <EmptyState
                      icon="lucide:search-x"
                      title="No variables match"
                      description="No variables match your current search or service filter."
                    />
                  </template>

                  <!-- Key cell -->
                  <template #cell-key="{ row }">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-foreground">{{ row.key }}</span>
                      <span v-if="services.length > 0" class="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span
                          class="h-1.5 w-1.5 rounded-full"
                          :style="{ backgroundColor: getServiceColor(row.service_id) }"
                        />
                        {{ getServiceName(row.service_id) }}
                      </span>
                    </div>
                  </template>

                  <!-- Value cell -->
                  <template #cell-value="{ row }">
                    <template v-if="!canSeeValues">
                      <div v-if="row.is_secret">
                        <EncryptedValueReveal
                          v-if="hasActiveAccess(row.id)"
                          :variable-id="row.id"
                          :grant-expires-at="getActiveGrant(row.id)?.access_expires_at || ''"
                          :reveal-fn="() => revealSecretValue(row.id)"
                        />
                        <div v-else-if="hasPendingRequest(row.id)" class="flex items-center gap-2 text-muted-foreground">
                          <Icon name="lucide:clock" class="h-4 w-4 text-warning" />
                          <span class="text-xs text-warning font-medium">Pending approval</span>
                        </div>
                        <div v-else-if="grantsLoading" class="flex items-center gap-1 text-muted-foreground">
                          <Icon name="lucide:lock" class="h-4 w-4" />
                          <span class="bg-muted rounded-md px-2 py-1">••••••••</span>
                        </div>
                        <div v-else class="flex items-center gap-2">
                          <span class="bg-muted rounded-md px-2 py-1 text-muted-foreground">••••••••</span>
                          <Button size="sm" variant="outline" @click="openRequestAccessModal(row)">
                            <Icon name="lucide:key" class="h-4 w-4 mr-1" />
                            Request Access
                          </Button>
                        </div>
                      </div>
                      <div v-else class="flex items-center gap-1.5 group/value">
                        <Tooltip :content="row._expanded ? '' : row.value" side="top">
                          <span
                            class="font-mono text-sm text-foreground max-w-[200px] truncate cursor-pointer inline-block"
                            @click="row._expanded = !row._expanded"
                            :class="{ 'whitespace-normal max-w-none': row._expanded }"
                          >{{ row.value }}</span>
                        </Tooltip>
                        <button
                          @click="copyVariableValue(row)"
                          class="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/value:opacity-100 shrink-0"
                          title="Copy value"
                        >
                          <Icon name="lucide:copy" class="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </template>
                    <template v-else>
                      <div v-if="row.is_secret" class="flex items-center gap-1.5 group/value">
                        <Tooltip :content="row.showSecret && !row._expanded ? (row.decryptedValue || '') : ''" side="top">
                          <span
                            v-if="row.showSecret"
                            class="font-mono text-sm text-foreground max-w-[200px] truncate cursor-pointer inline-block"
                            @click="row._expanded = !row._expanded"
                            :class="{ 'whitespace-normal max-w-none': row._expanded }"
                          >
                            {{ row.decryptedValue }}
                          </span>
                          <span v-else class="bg-muted rounded-md px-2 py-1 text-muted-foreground">
                            ••••••••
                          </span>
                        </Tooltip>
                        <button
                          @click="toggleSecretVisibility(row)"
                          class="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          :title="row.showSecret ? 'Hide value' : 'Reveal value'"
                        >
                          <Icon
                            :name="row.showSecret ? 'lucide:eye-off' : 'lucide:eye'"
                            class="h-4 w-4"
                          />
                        </button>
                        <button
                          @click="copyVariableValue(row)"
                          class="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/value:opacity-100 shrink-0"
                          title="Copy value"
                        >
                          <Icon name="lucide:copy" class="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div v-else class="flex items-center gap-1.5 group/value">
                        <Tooltip :content="row._expanded ? '' : row.value" side="top">
                          <span
                            class="font-mono text-sm text-foreground max-w-[200px] truncate cursor-pointer inline-block"
                            @click="row._expanded = !row._expanded"
                            :class="{ 'whitespace-normal max-w-none': row._expanded }"
                          >{{ row.value }}</span>
                        </Tooltip>
                        <button
                          @click="copyVariableValue(row)"
                          class="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/value:opacity-100 shrink-0"
                          title="Copy value"
                        >
                          <Icon name="lucide:copy" class="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </template>
                  </template>

                  <!-- Type cell -->
                  <template #cell-type="{ row }">
                    <div class="flex items-center gap-2">
                      <Badge :variant="row.is_secret ? 'destructive' : 'default'" size="sm">
                        {{ row.is_secret ? 'Secret' : 'Regular' }}
                      </Badge>
                      <FallbackIndicator
                        :value="row.value"
                        :fallback-value="row.fallback_value"
                        :is-secret="row.is_secret"
                      />
                    </div>
                    <ReferenceBadges
                      :variable-key="row.key"
                      :all-variables="variablesAsInputs"
                    />
                    <div v-if="row.tags?.length" class="flex flex-wrap gap-1 mt-1">
                      <span
                        v-for="tag in row.tags"
                        :key="tag"
                        class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {{ tag }}
                      </span>
                    </div>
                  </template>

                  <!-- Updated cell -->
                  <template #cell-updated="{ row }">
                    <div class="text-muted-foreground">{{ formatDate(row.updated_at) }}</div>
                    <div
                      v-if="isRecentlyModified(row) && row.updated_by"
                      class="text-xs text-primary"
                    >
                      by {{ getMemberEmail(row.updated_by) }}
                    </div>
                  </template>

                  <!-- Actions cell -->
                  <template #cell-actions="{ row }">
                    <div class="flex items-center justify-end gap-1">
                      <!-- Inline: Edit -->
                      <Tooltip v-if="canWrite" content="Edit variable">
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="editVariable(row)"
                        >
                          <Icon name="lucide:pencil" class="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <!-- Overflow menu -->
                      <Dropdown align="right" width="11rem">
                        <template #trigger>
                          <Button variant="ghost" size="icon">
                            <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                          </Button>
                        </template>
                        <template #content="{ close }">
                          <button
                            class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                            @click="close(); openDependencyPanel(row)"
                          >
                            <Icon name="lucide:git-branch" class="h-4 w-4 text-muted-foreground" />
                            Dependencies
                          </button>
                          <button
                            class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                            @click="close(); historyVariable = { id: row.id, key: row.key, is_secret: row.is_secret }"
                          >
                            <Icon name="lucide:history" class="h-4 w-4 text-muted-foreground" />
                            Version History
                          </button>
                          <button
                            v-if="canWrite && row.fallback_value && row.value"
                            class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                            @click="close(); resetToFallback(row)"
                          >
                            <Icon name="lucide:undo-2" class="h-4 w-4 text-muted-foreground" />
                            Reset to Fallback
                          </button>
                          <button
                            v-if="canAccessSettings && row.is_secret"
                            class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                            @click="close(); openCreateProxyFromVariable(row)"
                          >
                            <Icon name="lucide:shield" class="h-4 w-4 text-muted-foreground" />
                            Create Proxy
                          </button>
                          <button
                            v-if="canWrite"
                            class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                            @click="close(); deleteVariableConfirm(row)"
                          >
                            <Icon name="lucide:trash" class="h-4 w-4" />
                            Delete
                          </button>
                        </template>
                      </Dropdown>
                    </div>
                  </template>
                </DataTable>
              </template>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Add/Edit Variable Dialog -->
      <ClientOnly>
        <Dialog
          :open="showAddVariableModal || !!editingVariable"
          :title="editingVariable ? 'Edit Variable' : 'Add New Variable'"
          @close="cancelVariableEdit"
        >
          <form @submit.prevent="saveVariable" class="space-y-4">
            <div class="space-y-2">
              <label for="variableKey" class="text-sm font-medium text-muted-foreground">Key</label>
              <Input
                id="variableKey"
                v-model="variableForm.key"
                required
                placeholder="DATABASE_URL"
                :disabled="variableActionLoading || !!editingVariable?.is_secret"
              />
              <NamingValidationBadge
                v-if="project?.organization_id && activeEnvironment"
                :variable-name="variableForm.key"
                :organization-id="project.organization_id"
                :project-id="projectId as string"
                @apply-suggestion="variableForm.key = $event"
                @validation-change="namingHasErrors = $event.hasErrors"
              />
            </div>

            <div class="space-y-2">
              <label for="variableValue" class="text-sm font-medium text-muted-foreground">Value</label>
              <ReferenceAutocomplete
                id="variableValue"
                v-model="variableForm.value"
                placeholder="postgres://user:password@localhost:5432/db"
                :disabled="variableActionLoading"
                :available-variables="availableVariablesForAutocomplete"
                :current-key="variableForm.key"
              />
              <ResolvedValuePreview
                :raw-value="variableForm.value"
                :all-variables="variablesAsInputs"
                :current-key="variableForm.key"
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <input
                  id="showFallback"
                  type="checkbox"
                  v-model="variableForm.showFallback"
                  class="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  :disabled="variableActionLoading"
                />
                <label for="showFallback" class="text-sm font-medium text-muted-foreground">
                  Set fallback value
                </label>
              </div>
              <template v-if="variableForm.showFallback">
                <p class="text-xs text-muted-foreground">Default value used when the main value is empty</p>
                <Input
                  id="fallbackValue"
                  v-model="variableForm.fallback_value"
                  :placeholder="variableForm.is_secret ? '' : 'fallback value'"
                  :type="variableForm.is_secret ? 'password' : 'text'"
                  :disabled="variableActionLoading"
                />
              </template>
            </div>

            <div class="flex items-center space-x-2">
              <input
                id="isSecret"
                type="checkbox"
                v-model="variableForm.is_secret"
                class="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                :disabled="variableActionLoading || !!editingVariable"
              />
              <label for="isSecret" class="text-sm font-medium text-muted-foreground">
                Store as secret
              </label>
            </div>

            <div v-if="services.length > 0" class="space-y-2">
              <label for="serviceSelect" class="text-sm font-medium text-muted-foreground">Service</label>
              <select
                id="serviceSelect"
                v-model="variableForm.service_id"
                class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="variableActionLoading"
              >
                <option :value="null">Shared (no service)</option>
                <option v-for="svc in services" :key="svc.id" :value="svc.id">
                  {{ svc.name }}
                </option>
              </select>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">Tags</label>
              <div class="flex flex-wrap items-center gap-1.5 min-h-[2.25rem] rounded-md border border-border bg-background px-3 py-1.5">
                <span
                  v-for="tag in variableForm.tags"
                  :key="tag"
                  class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {{ tag }}
                  <button
                    type="button"
                    class="hover:text-destructive transition-colors"
                    @click="removeTag(tag)"
                    :disabled="variableActionLoading"
                  >
                    <Icon name="lucide:x" class="h-3 w-3" />
                  </button>
                </span>
                <input
                  v-model="tagInput"
                  class="flex-1 min-w-[80px] border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                  placeholder="Type tag and press Enter"
                  :disabled="variableActionLoading"
                  @keydown.enter.prevent="addTag"
                  @keydown.,.prevent="addTag"
                />
              </div>
              <p class="text-xs text-muted-foreground">Press Enter or comma to add a tag</p>
            </div>

            <div class="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                @click="cancelVariableEdit"
                :disabled="variableActionLoading"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                :loading="variableActionLoading"
                :disabled="namingHasErrors"
              >
                {{ editingVariable ? 'Update' : 'Add' }}
              </Button>
            </div>
          </form>
        </Dialog>
      </ClientOnly>

      <!-- Delete Variable Confirmation Dialog -->
      <ClientOnly>
        <Dialog
          :open="!!deletingVariable"
          title="Delete Variable"
          :description="`Are you sure you want to delete the variable ${deletingVariable?.key}? This action cannot be undone.`"
          max-width="sm"
          @close="deletingVariable = null"
        >
          <div class="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              @click="deletingVariable = null"
              :disabled="variableActionLoading"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              :loading="variableActionLoading"
              @click="deleteVariable"
            >
              Delete
            </Button>
          </div>
        </Dialog>
      </ClientOnly>

      <!-- Bulk Delete Confirmation Dialog -->
      <ClientOnly>
        <Dialog
          :open="showBulkDeleteDialog"
          title="Delete Variables"
          :description="`Are you sure you want to delete ${bulkDeleteCount} variables? This action cannot be undone.`"
          max-width="sm"
          @close="showBulkDeleteDialog = false"
        >
          <div class="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              @click="showBulkDeleteDialog = false"
              :disabled="bulkActionLoading"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              :loading="bulkActionLoading"
              @click="bulkDelete"
            >
              Delete {{ bulkDeleteCount }} variables
            </Button>
          </div>
        </Dialog>
      </ClientOnly>

      <!-- Export Modal -->
      <ExportModal
        v-model="showExportModal"
        :variables="variables"
        :project-slug="project?.name || 'export'"
        :environment-name="activeEnvironment?.name || 'development'"
        :project-friendly-id="project?.friendly_id || 1"
      />

      <!-- Import Modal -->
      <ImportModal
        v-model="showImportModal"
        :environment-id="activeEnvironment?.id || ''"
        :organization-id="project?.organization_id || ''"
        :project-id="projectId"
        :services="services"
        :default-service-id="selectedServiceId && selectedServiceId !== 'shared' ? selectedServiceId : null"
        @imported="handleImported"
      />

      <!-- Conflict Modal -->
      <ConflictModal
        v-model="showConflictModal"
        :conflict-data="conflictData"
        @use-mine="handleUseMine"
        @use-theirs="handleUseTheirs"
      />

      <!-- Sync Now Modal -->
      <SyncNowModal
        :open="showSyncNowModal"
        :project-id="projectId as string"
        :environment-id="activeEnvironment?.id || ''"
        :environment-name="activeEnvironment?.name || ''"
        @close="showSyncNowModal = false"
        @synced="handleSyncComplete"
      />

      <!-- Request Access Modal -->
      <RequestAccessModal
        v-model="showRequestAccessModal"
        :variable-name="requestAccessVariableName"
        :request-fn="(reason: string) => requestSecretAccess(requestAccessVariableId, reason)"
        @requested="handleRequestSubmitted"
      />

      <!-- Version History Panel -->
      <VersionHistoryPanel
        :open="!!historyVariable"
        :variable-id="historyVariable?.id || ''"
        :variable-key="historyVariable?.key || ''"
        :is-secret="historyVariable?.is_secret || false"
        :is-protected="activeEnvironment?.is_protected || false"
        @close="historyVariable = null"
        @rollback="fetchVariables()"
      />

      <!-- Pending Change Review Modal -->
      <PendingChangeReviewModal
        :is-open="showReviewModal"
        :change="reviewingChange"
        :mode="reviewMode"
        :is-two-person-pending="reviewingChange?.first_approver === null && activeEnvironment?.approval_mode === 'two_person'"
        @close="showReviewModal = false"
        @confirm="handleReviewConfirm"
      />

      <!-- Naming Audit Modal -->
      <NamingAuditModal
        v-model="showAuditModal"
        :environment-id="activeEnvironment?.id || ''"
        :organization-id="project?.organization_id || ''"
        :project-id="projectId as string"
        :is-protected="activeEnvironment?.is_protected ?? false"
        :variables="variables"
        @renamed="fetchVariables()"
      />

      <!-- Bulk Update Modal -->
      <BulkUpdateModal
        :open="showBulkUpdateModal"
        :project-id="projectId as string"
        @close="showBulkUpdateModal = false"
        @updated="fetchVariables()"
      />

      <!-- Dependency Panel -->
      <DependencyPanel
        :open="!!dependencyVariable"
        :variable-key="dependencyVariable?.key || ''"
        :all-variables="resolvedVariables"
        :access-stats="dependencyAccessStats"
        @close="dependencyVariable = null"
        @navigate="dependencyVariable = null"
      />

      <!-- Impact Analysis Modal -->
      <ImpactAnalysisModal
        :open="!!impactModalState?.open"
        :variable-key="impactModalState?.variableKey || ''"
        :referenced-by="impactModalState?.referencedBy || []"
        @proceed="handleImpactProceed"
        @cancel="impactModalState = null"
      />

      <!-- Reset Variable Dialog -->
      <Dialog
        :open="showResetVariableDialog"
        title="Reset to Fallback Value"
        :description="'Reset \'' + (pendingVariable?.key || '') + '\' to its fallback value? The current value will be cleared.'"
        @close="showResetVariableDialog = false"
      >
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="showResetVariableDialog = false">Cancel</Button>
          <Button variant="destructive" :loading="variableActionLoading" @click="confirmResetToFallback">Confirm</Button>
        </div>
      </Dialog>

      <!-- Proxy Builder Modal (from variable row action) -->
      <ProxyBuilderModal
        v-model="showProxyBuilderModal"
        :environment-id="activeEnvironment?.id || ''"
        :organization-id="project?.organization_id || ''"
        :pre-selected-variable="proxyPreSelectedVariable"
        @saved="proxyPreSelectedVariable = null"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import Dialog from '@/components/ui/Dialog.vue'
import ImportModal from '@/components/import/ImportModal.vue'
import ExportModal from '@/components/export/ExportModal.vue'
import ConflictModal from '@/components/conflict/ConflictModal.vue'
import SyncNowModal from '@/components/integrations/SyncNowModal.vue'
import EncryptedValueReveal from '@/components/encrypted/EncryptedValueReveal.vue'
import RequestAccessModal from '@/components/encrypted/RequestAccessModal.vue'
import PendingChangesList from '@/components/environments/PendingChangesList.vue'
import PendingChangeReviewModal from '@/components/environments/PendingChangeReviewModal.vue'

import VersionHistoryPanel from '@/components/variables/VersionHistoryPanel.vue'
import SnapshotManager from '@/components/variables/SnapshotManager.vue'
import NamingValidationBadge from '@/components/variables/NamingValidationBadge.vue'
import NamingAuditModal from '@/components/variables/NamingAuditModal.vue'
import FallbackIndicator from '@/components/variables/FallbackIndicator.vue'
import ReferenceAutocomplete from '@/components/variables/ReferenceAutocomplete.vue'
import ResolvedValuePreview from '@/components/variables/ResolvedValuePreview.vue'
import ReferenceBadges from '@/components/variables/ReferenceBadges.vue'
import BulkUpdateModal from '@/components/variables/BulkUpdateModal.vue'
import DependencyPanel from '@/components/variables/DependencyPanel.vue'
import ImpactAnalysisModal from '@/components/variables/ImpactAnalysisModal.vue'
import ProxyBuilderModal from '@/components/proxy/ProxyBuilderModal.vue'
import type { ConflictData } from '@/components/conflict/ConflictModal.vue'
import type { Database } from '~/types/database.types'
import type { PendingChange } from '~/composables/usePendingChanges'
import { resolveAll, parseReferences, type VariableInput, type ResolvedVariable } from '@/utils/variable-references'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type EnvironmentRow = Database['public']['Tables']['environments']['Row']
type VariableRow = Database['public']['Tables']['variables']['Row']

interface VariableItem extends VariableRow {
  value: string
  showSecret: boolean
  decryptedValue: string | null
  _expanded?: boolean
}

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

const route = useRoute()
const projectId = String(route.params.id)
const client = useSupabaseClient()
const user = useSupabaseUser()
const { $toast } = useNuxtApp()
const { triggerAutoSyncs } = useAutoSync()
const { track } = usePostHog()
const { checkLimit, checkEnvironmentVariableLimit } = useLimits()

// Services
const { services, fetchServices } = useServices(projectId)
const selectedServiceId = ref<string | null>(null) // null = All, 'shared' = Shared only, UUID = specific

// Breadcrumbs
const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

// DataTable column definitions
const tableColumns = [
  { key: 'key', label: 'Key' },
  { key: 'value', label: 'Value' },
  { key: 'type', label: 'Type' },
  { key: 'updated', label: 'Last Updated' },
  { key: 'actions', label: 'Actions', class: 'text-right' }
]

// State
const loading = ref(true)
const project = ref<ProjectRow | null>(null)
const environments = ref<EnvironmentRow[]>([])
const activeEnvironment = ref<EnvironmentRow | null>(null)
const variables = ref<VariableItem[]>([])

// Access control (must be after activeEnvironment declaration)
const activeEnvironmentId = computed(() => activeEnvironment.value?.id || '')
const { canWrite, canSeeValues, accessLevel, isLoading: accessLoading } = useEnvironmentAccess(activeEnvironmentId)

// Temporary access grants (batch fetch for current environment)
const {
  getGrantStatus,
  hasActiveAccess,
  hasPendingRequest,
  getActiveGrant,
  requestAccess: requestSecretAccess,
  revealValue: revealSecretValue,
  refresh: refreshGrants,
  isLoading: grantsLoading
} = useTemporaryAccess(activeEnvironmentId)

// Pending changes for protected environments
const {
  pendingChanges,
  pendingCount,
  isLoading: pendingLoading,
  fetchPendingChanges,
  submitChange,
  approve: approvePendingChange,
  reject: rejectPendingChange,
  cancelChange,
  checkCanApprove
} = usePendingChanges()

const variablesLoading = ref(false)

// Bulk selection state
const selectedVariableIds = ref<Set<string>>(new Set())
const selectedCount = computed(() => selectedVariableIds.value.size)
const bulkActionLoading = ref(false)
const showBulkDeleteDialog = ref(false)
const bulkDeleteCount = ref(0)

// Pending changes UI state
const showPendingView = ref(false)

// Bridge between Tabs component (string ID) and activeEnvironment (object)
const activeTabId = computed({
  get: () => activeEnvironment.value?.id || '',
  set: (id: string) => {
    const env = environments.value.find(e => e.id === id)
    if (env) {
      activeEnvironment.value = env
      showPendingView.value = false
    }
  }
})
const reviewingChange = ref<PendingChange | null>(null)
const reviewMode = ref<'approve' | 'reject'>('approve')
const showReviewModal = ref(false)

// Variable form
const showAddVariableModal = ref(false)
const editingVariable = ref<VariableItem | null>(null)
const variableForm = reactive({
  key: '',
  value: '',
  is_secret: false,
  fallback_value: '',
  showFallback: false,
  tags: [] as string[],
  service_id: null as string | null
})
const variableActionLoading = ref(false)
const namingHasErrors = ref(false)
const deletingVariable = ref<VariableItem | null>(null)

// Dialog state for reset variable confirmation
const showResetVariableDialog = ref(false)
const pendingVariable = ref<VariableItem | null>(null)

// Snapshot manager
const showSnapshotPanel = ref(false)

// Version history
const historyVariable = ref<{ id: string; key: string; is_secret: boolean } | null>(null)

// Bulk update
const showBulkUpdateModal = ref(false)

// Dependency panel
const dependencyVariable = ref<{ id: string; key: string } | null>(null)
const dependencyAccessStats = ref<any[] | null>(null)
const { logAccess, getAccessStats } = useVariableAccessTracking()

// Impact analysis
const impactModalState = ref<{
  open: boolean
  variableKey: string
  referencedBy: { key: string; environmentName: string; rawValue: string }[]
  action: 'edit' | 'delete'
  variable: VariableItem
} | null>(null)

// Reference resolution data
const variablesAsInputs = computed<VariableInput[]>(() =>
  variables.value.map((v) => ({
    key: v.key,
    value: v.value ?? '',
    fallbackValue: v.fallback_value,
    isSecret: v.is_secret
  }))
)

const resolvedVariables = computed<ResolvedVariable[]>(() =>
  resolveAll(variablesAsInputs.value)
)

const availableVariablesForAutocomplete = computed(() =>
  variables.value.map((v) => ({ key: v.key, value: v.is_secret ? '********' : (v.value || '') }))
)

// Tag input and helpers
const tagInput = ref('')

const addTag = () => {
  const tag = tagInput.value.trim().toLowerCase()
  if (tag && !variableForm.tags.includes(tag)) {
    variableForm.tags.push(tag)
  }
  tagInput.value = ''
}

const removeTag = (tag: string) => {
  variableForm.tags = variableForm.tags.filter(t => t !== tag)
}

// Tag filtering
const selectedTags = ref<string[]>([])

const allTags = computed(() => {
  const tagSet = new Set<string>()
  for (const v of variables.value) {
    if (v.tags) {
      for (const t of v.tags) tagSet.add(t)
    }
  }
  return [...tagSet].sort()
})

const filteredVariables = computed(() => {
  let result = variables.value

  // Service filter
  if (selectedServiceId.value === 'shared') {
    result = result.filter(v => !v.service_id)
  } else if (selectedServiceId.value) {
    result = result.filter(v => v.service_id === selectedServiceId.value || !v.service_id)
  }

  // Tag filter
  if (selectedTags.value.length > 0) {
    result = result.filter(v => {
      const t = v.tags || []
      return t.some(tag => selectedTags.value.includes(tag))
    })
  }

  return result
})

const toggleTagFilter = (tag: string) => {
  const idx = selectedTags.value.indexOf(tag)
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

// Service helpers
const getServiceName = (serviceId: string | null) => {
  if (!serviceId) return 'Shared'
  return services.value.find(s => s.id === serviceId)?.name || 'Unknown'
}
const getServiceColor = (serviceId: string | null) => {
  if (!serviceId) return '#6B7280'
  return services.value.find(s => s.id === serviceId)?.color || '#6B7280'
}

function getResolvedVariable(key: string): ResolvedVariable | undefined {
  return resolvedVariables.value.find(r => r.key === key)
}

// Conflict detection
const originalVersion = ref<number | null>(null)
const showConflictModal = ref(false)
const conflictData = ref<ConflictData | null>(null)

// Organization members cache for "modified by" display
const organizationMembers = ref<{ user_id: string; email: string; role: string }[]>([])

const currentUserRole = computed(() => {
  const userId = user.value?.id ?? user.value?.sub
  const member = organizationMembers.value.find(m => m.user_id === userId)
  return member?.role || null
})

const canAccessSettings = computed(() => {
  return currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
})

// Export/Import
const showExportModal = ref(false)
const showImportModal = ref(false)

// Sync Now
const showSyncNowModal = ref(false)

const showAuditModal = ref(false)
const hasNamingRules = ref(false)

// Proxy builder modal
const showProxyBuilderModal = ref(false)
const proxyPreSelectedVariable = ref<{ variable_id: string; variable_name: string } | null>(null)

// Check if naming conventions are configured
const checkNamingRules = async () => {
  if (!project.value?.organization_id) return
  try {
    const { getEffectiveRules } = useNamingConventions(computed(() => project.value?.organization_id || ''))
    const rules = await getEffectiveRules(projectId)
    hasNamingRules.value = !!rules
  } catch {
    hasNamingRules.value = false
  }
}

watch(() => project.value?.organization_id, (orgId) => {
  if (orgId) checkNamingRules()
}, { immediate: true })

// Request Access Modal
const showRequestAccessModal = ref(false)
const requestAccessVariableId = ref('')
const requestAccessVariableName = ref('')

function openRequestAccessModal(variable: VariableItem) {
  requestAccessVariableId.value = variable.id
  requestAccessVariableName.value = variable.key
  showRequestAccessModal.value = true
}

function handleRequestSubmitted() {
  refreshGrants()
}

// Open proxy builder from variable row action
async function openCreateProxyFromVariable(variable: VariableItem) {
  const limitResult = await checkLimit('proxy_functions')
  if (!limitResult.allowed) {
    const event = new CustomEvent('billing:limit-reached', {
      detail: limitResult
    })
    window.dispatchEvent(event)
    return
  }
  proxyPreSelectedVariable.value = {
    variable_id: variable.id,
    variable_name: variable.key
  }
  showProxyBuilderModal.value = true
}

// Open review modal
const openReviewModal = (change: PendingChange, mode: 'approve' | 'reject') => {
  reviewingChange.value = change
  reviewMode.value = mode
  showReviewModal.value = true
}

// Handle review confirm
const handleReviewConfirm = async (reason?: string) => {
  if (!reviewingChange.value) return

  try {
    if (reviewMode.value === 'approve') {
      await approvePendingChange(reviewingChange.value.id)
      $toast.success('Change approved')
    } else {
      await rejectPendingChange(reviewingChange.value.id, reason)
      $toast.success('Change rejected')
    }

    showReviewModal.value = false
    reviewingChange.value = null
    await fetchPendingChanges(activeEnvironment.value?.id)
    await fetchVariables() // Refresh variables in case change was applied
  } catch (error) {
    // Error toast handled by composable
  }
}

// Handle cancel change
const handleCancelChange = async (changeId: string) => {
  try {
    await cancelChange(changeId)
    $toast.success('Change cancelled')
    await fetchPendingChanges(activeEnvironment.value?.id)
  } catch (error) {
    // Error toast handled by composable
  }
}

// Fetch project data
const fetchProject = async () => {
  loading.value = true

  try {
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error || !data) {
      $toast.error('Project not found or access denied')
      navigateTo('/dashboard', { replace: true })
      return
    }

    project.value = data
  } catch (error) {
    $toast.error('Project not found or access denied')
    console.error(error)
    navigateTo('/dashboard', { replace: true })
  } finally {
    loading.value = false
  }
}

// Fetch environments
const fetchEnvironments = async () => {
  try {
    const { data, error } = await client
      .from('environments')
      .select('*')
      .eq('project_id', projectId)
      .order('name', { ascending: true })
    
    if (error) throw error
    
    environments.value = data || []
    
    // Set active environment if not already set
    if (environments.value.length > 0 && !activeEnvironment.value) {
      const firstEnvironment = environments.value[0]
      if (firstEnvironment) {
        activeEnvironment.value = firstEnvironment
        fetchVariables()
      }
    }
  } catch (error) {
    $toast.error('Failed to load environments')
    console.error(error)
  }
}

// Fetch variables for active environment
const fetchVariables = async () => {
  if (!activeEnvironment.value) return
  
  variablesLoading.value = true
  
  try {
    const { data, error } = await client
      .from('variables')
      .select('*')
      .eq('environment_id', activeEnvironment.value.id)
      .order('key', { ascending: true })
    
    if (error) throw error

    variables.value = (data || []).map<VariableItem>((v) => ({
      ...v,
      value: v.value ?? '',
      showSecret: false,
      decryptedValue: null
    }))
  } catch (error) {
    $toast.error('Failed to load variables')
    console.error(error)
  } finally {
    variablesLoading.value = false
  }
}

// Copy variable value to clipboard
const copyVariableValue = async (variable: VariableItem) => {
  try {
    let value: string
    if (variable.is_secret) {
      if (variable.decryptedValue) {
        value = variable.decryptedValue
      } else {
        const { data, error } = await client
          .rpc('decrypt_variable_value', { variable_id: variable.id })
        if (error) throw error
        value = typeof data === 'string' ? data : ''
      }
    } else {
      value = variable.value || ''
    }
    await navigator.clipboard.writeText(value)
    $toast.success(`Copied "${variable.key}" value`)
  } catch {
    $toast.error('Failed to copy to clipboard')
  }
}

// Toggle secret visibility
const toggleSecretVisibility = async (variable: VariableItem) => {
  if (!variable.is_secret) return

  // If already showing secret, hide it and clear decrypted value
  if (variable.showSecret) {
    variable.showSecret = false
    variable.decryptedValue = null
    return
  }

  try {
    // Call RPC function to decrypt the value
    const { data, error } = await client
      .rpc('decrypt_variable_value', { variable_id: variable.id })

    if (error) throw error

    // Store decrypted value temporarily and show it
    variable.decryptedValue = typeof data === 'string' ? data : null
    variable.showSecret = true

    // Log decrypt access (fire-and-forget)
    if (activeEnvironment.value) {
      logAccess(activeEnvironment.value.id, 'web_decrypt')
    }
  } catch (error) {
    $toast.error('Failed to reveal secret')
    // Only log safe metadata in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Secret reveal failed:', variable.id)
    }
  }
}

// Edit variable
const editVariable = async (variable: VariableItem) => {
  // Warn if variable is referenced by others via ImpactAnalysisModal
  const resolved = getResolvedVariable(variable.key)
  if (resolved && resolved.referencedBy.length > 0) {
    impactModalState.value = {
      open: true,
      variableKey: variable.key,
      referencedBy: resolved.referencedBy.map(refKey => {
        const refVar = resolvedVariables.value.find(r => r.key === refKey)
        return { key: refKey, environmentName: activeEnvironment.value?.name || '', rawValue: refVar?.rawValue || '' }
      }),
      action: 'edit',
      variable,
    }
    return
  }

  proceedEditVariable(variable)
}

const proceedEditVariable = async (variable: VariableItem) => {
  editingVariable.value = variable
  originalVersion.value = variable.version  // Track version for conflict detection
  variableForm.key = variable.key
  variableForm.is_secret = variable.is_secret
  variableForm.fallback_value = variable.fallback_value || ''
  variableForm.showFallback = !!variable.fallback_value
  variableForm.tags = variable.tags || []
  variableForm.service_id = variable.service_id || null

  // For secrets, decrypt the value first
  if (variable.is_secret) {
    try {
      const { data, error } = await client
        .rpc('decrypt_variable_value', { variable_id: variable.id })

      if (error) throw error

      variableForm.value = typeof data === 'string' ? data : ''
    } catch (error) {
      $toast.error('Failed to load secret value')
      // Only log metadata, not the error object
      if (process.env.NODE_ENV === 'development') {
        console.error('Secret load failed for variable:', variable.id)
      }
      cancelVariableEdit()
      return
    }
  } else {
    variableForm.value = variable.value ?? ''
  }
}

// Cancel variable edit
const cancelVariableEdit = () => {
  showAddVariableModal.value = false
  editingVariable.value = null
  originalVersion.value = null
  namingHasErrors.value = false
  resetVariableForm()
}

// Reset variable form
const resetVariableForm = () => {
  variableForm.key = ''
  variableForm.value = ''
  variableForm.is_secret = false
  variableForm.fallback_value = ''
  variableForm.showFallback = false
  variableForm.tags = []
  variableForm.service_id = selectedServiceId.value && selectedServiceId.value !== 'shared' ? selectedServiceId.value : null
  tagInput.value = ''
}

// Save variable (add or update)
const saveVariable = async () => {
  if (!activeEnvironment.value) return
  if (!project.value) return
  
  // Validate form
  if (!variableForm.key.trim()) {
    $toast.error('Key is required')
    return
  }
  if (!variableForm.value.trim() && !(variableForm.showFallback && variableForm.fallback_value.trim())) {
    $toast.error('Value or fallback value is required')
    return
  }
  
  variableActionLoading.value = true

  try {
    // Check if environment is protected - submit as pending change instead
    if (activeEnvironment.value?.is_protected) {
      await submitChange({
        environmentId: activeEnvironment.value.id,
        action: editingVariable.value ? 'update' : 'create',
        variableId: editingVariable.value?.id,
        key: variableForm.key.trim(),
        value: variableForm.value,
        isSecret: variableForm.is_secret
      })

      $toast.success('Change submitted for approval')
      resetVariableForm()
      showAddVariableModal.value = false
      editingVariable.value = null
      await fetchPendingChanges(activeEnvironment.value.id)
      variableActionLoading.value = false
      return
    }

    if (editingVariable.value) {
      // Check for concurrent modifications (conflict detection)
      const { data: current, error: fetchError } = await client
        .from('variables')
        .select('version, updated_by, updated_at, value, is_secret')
        .eq('id', editingVariable.value.id)
        .single()

      if (fetchError) throw fetchError

      if (current.version !== originalVersion.value) {
        // Conflict detected - get their value and show modal
        let theirValue = current.value
        if (current.is_secret) {
          const { data: decrypted } = await client
            .rpc('decrypt_variable_value', { variable_id: editingVariable.value.id })
          theirValue = decrypted || current.value
        }

        // Get email of user who made the change
        let theirEmail = 'another user'
        const organizationId = project.value?.organization_id
        if (current.updated_by) {
          const { data: userData } = await client
            .from('organization_members')
            .select('user_id')
            .eq('user_id', current.updated_by)
            .single()

          if (userData && organizationId) {
            const { data: emailData } = await client
              .rpc('get_organization_members_with_emails', { org_id: organizationId })
            const member = emailData?.find((m: { user_id: string }) => m.user_id === current.updated_by)
            theirEmail = member?.email || 'another user'
          }
        }

        conflictData.value = {
          variableKey: variableForm.key,
          myValue: variableForm.value,
          theirValue: theirValue ?? '',
          theirEmail,
          theirUpdatedAt: current.updated_at ?? new Date().toISOString()
        }
        showConflictModal.value = true
        variableActionLoading.value = false
        return
      }

      // No conflict - proceed with update (include updated_by)
      const { error } = await client
        .from('variables')
        .update({
          value: variableForm.value,
          fallback_value: variableForm.showFallback ? (variableForm.fallback_value || null) : null,
          tags: variableForm.tags,
          service_id: variableForm.service_id || null,
          updated_by: user.value?.id ?? user.value?.sub,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingVariable.value.id)
        .eq('version', originalVersion.value)  // Optimistic lock

      if (error) throw error

      $toast.success(`Variable "${variableForm.key}" updated`)
      track('variable_updated', {
        environment_id: activeEnvironment.value.id,
        project_id: projectId
      })
    } else {
      // Check variable limit before creating
      const limitCheck = await checkEnvironmentVariableLimit(activeEnvironment.value.id)
      if (!limitCheck.allowed) {
        $toast.error(`Variable limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan.`)
        variableActionLoading.value = false
        return
      }

      // Check if variable with same key already exists (scoped by service)
      let duplicateQuery = client
        .from('variables')
        .select('id')
        .eq('environment_id', activeEnvironment.value.id)
        .eq('key', variableForm.key.trim())

      if (variableForm.service_id) {
        duplicateQuery = duplicateQuery.eq('service_id', variableForm.service_id)
      } else {
        duplicateQuery = duplicateQuery.is('service_id', null)
      }

      const { data: existing, error: checkError } = await duplicateQuery

      if (checkError) throw checkError

      if (existing?.length > 0) {
        $toast.error(`Variable "${variableForm.key}" already exists`)
        variableActionLoading.value = false
        return
      }
      
      // Create new variable
      const { error } = await client
        .from('variables')
        .insert({
          key: variableForm.key.trim(),
          value: variableForm.value,
          is_secret: variableForm.is_secret,
          fallback_value: variableForm.showFallback ? (variableForm.fallback_value || null) : null,
          tags: variableForm.tags,
          service_id: variableForm.service_id || null,
          environment_id: activeEnvironment.value.id,
          organization_id: project.value.organization_id
        })
      
      if (error) throw error
      
      $toast.success(`Variable "${variableForm.key}" added`)
      track('variable_created', {
        environment_id: activeEnvironment.value.id,
        is_secret: variableForm.is_secret,
        project_id: projectId
      })
      await maybeTrackActivation('manual', 1)
    }
    
    // Refresh variables
    await fetchVariables()

    // Trigger auto-syncs (fire and forget)
    triggerAutoSyncs(activeEnvironment.value.id)

    // Reset form and close modal
    resetVariableForm()
    showAddVariableModal.value = false
    editingVariable.value = null
  } catch (error) {
    $toast.error('Failed to save variable')
    console.error(error)
  } finally {
    variableActionLoading.value = false
  }
}

// Delete variable confirm
const deleteVariableConfirm = (variable: VariableItem) => {
  const resolved = getResolvedVariable(variable.key)
  if (resolved && resolved.referencedBy.length > 0) {
    impactModalState.value = {
      open: true,
      variableKey: variable.key,
      referencedBy: resolved.referencedBy.map(refKey => {
        const refVar = resolvedVariables.value.find(r => r.key === refKey)
        return { key: refKey, environmentName: activeEnvironment.value?.name || '', rawValue: refVar?.rawValue || '' }
      }),
      action: 'delete',
      variable,
    }
    return
  }
  deletingVariable.value = variable
}

// Handle impact analysis proceed
const handleImpactProceed = () => {
  if (!impactModalState.value) return
  const { action, variable } = impactModalState.value
  impactModalState.value = null

  if (action === 'edit') {
    proceedEditVariable(variable)
  } else {
    deletingVariable.value = variable
  }
}

// Open dependency panel for a variable
async function openDependencyPanel(variable: VariableItem) {
  dependencyVariable.value = { id: variable.id, key: variable.key }
  dependencyAccessStats.value = null
  try {
    dependencyAccessStats.value = await getAccessStats(variable.id)
  } catch {
    // Non-critical — panel still shows deps without stats
  }
}

// Delete variable
const deleteVariable = async () => {
  if (!deletingVariable.value) return

  variableActionLoading.value = true

  try {
    // Protected environments require approval for deletions
    if (activeEnvironment.value?.is_protected) {
      await submitChange({
        environmentId: activeEnvironment.value.id,
        action: 'delete',
        variableId: deletingVariable.value.id,
        key: deletingVariable.value.key
      })

      $toast.success('Deletion submitted for approval')
      deletingVariable.value = null
      await fetchPendingChanges(activeEnvironment.value.id)
      variableActionLoading.value = false
      return
    }

    const { error } = await client
      .from('variables')
      .delete()
      .eq('id', deletingVariable.value.id)

    if (error) throw error

    $toast.success(`Variable "${deletingVariable.value.key}" deleted`)
    const activeEnvId = activeEnvironment.value?.id
    track('variable_deleted', {
      environment_id: activeEnvId,
      project_id: projectId
    })

    // Refresh variables
    await fetchVariables()

    // Trigger auto-syncs (fire and forget)
    if (activeEnvId) {
      triggerAutoSyncs(activeEnvId)
    }

    // Reset state
    deletingVariable.value = null
  } catch (error) {
    $toast.error('Failed to delete variable')
    console.error(error)
  } finally {
    variableActionLoading.value = false
  }
}

// Reset variable to its fallback value
const resetToFallback = (variable: VariableItem) => {
  pendingVariable.value = variable
  showResetVariableDialog.value = true
}

const confirmResetToFallback = async () => {
  if (!pendingVariable.value) return

  variableActionLoading.value = true
  try {
    const { error } = await client
      .from('variables')
      .update({
        value: null,
        updated_by: user.value?.id ?? user.value?.sub,
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingVariable.value.id)

    if (error) throw error
    $toast.success(`"${pendingVariable.value.key}" reset to fallback value`)
    await fetchVariables()
    if (activeEnvironment.value) {
      triggerAutoSyncs(activeEnvironment.value.id)
    }
  } catch (error) {
    $toast.error('Failed to reset variable')
    console.error(error)
  } finally {
    variableActionLoading.value = false
    showResetVariableDialog.value = false
    pendingVariable.value = null
  }
}

// Conflict resolution handlers
const handleUseMine = async () => {
  if (!editingVariable.value) return

  variableActionLoading.value = true

  try {
    // Force save with current values (ignoring version)
    const { error } = await client
      .from('variables')
      .update({
        value: variableForm.value,
        updated_by: user.value?.id ?? user.value?.sub,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingVariable.value.id)

    if (error) throw error

    $toast.success(`Variable "${variableForm.key}" updated with your changes`)
    showConflictModal.value = false
    await fetchVariables()

    // Trigger auto-syncs (fire and forget)
    if (activeEnvironment.value) {
      triggerAutoSyncs(activeEnvironment.value.id)
    }

    cancelVariableEdit()
  } catch (error) {
    $toast.error('Failed to save variable')
    console.error(error)
  } finally {
    variableActionLoading.value = false
  }
}

const handleUseTheirs = () => {
  showConflictModal.value = false
  cancelVariableEdit()
  $toast.info('Kept existing value')
}

// Fire `project_activated` exactly once — when the project gets its first
// variable(s), in any environment. Queries the project-wide count so it never
// double-fires (e.g. first var in development, then first var in production).
const maybeTrackActivation = async (method: 'import' | 'manual', justAddedCount: number) => {
  if (!activeEnvironment.value) return
  const envIds = environments.value.map((e) => e.id)
  if (envIds.length === 0) return
  // Count is scoped by RLS to environments the current user can access. For the
  // onboarding flow the project creator can access all environments, so this is
  // effectively project-wide; restricted collaborators only count what they see.
  const { count } = await client
    .from('variables')
    .select('id', { count: 'exact', head: true })
    .in('environment_id', envIds)
  if (isFirstActivation(count ?? 0, justAddedCount)) {
    track('project_activated', {
      project_id: projectId,
      environment_id: activeEnvironment.value.id,
      method,
    })
  }
}

// Handle import completed
const handleImported = async (count: number) => {
  await fetchVariables()
  if (!activeEnvironment.value) return
  triggerAutoSyncs(activeEnvironment.value.id)
  track('variables_bulk_imported', {
    count,
    environment_id: activeEnvironment.value.id,
    project_id: projectId
  })
  // `count` may include overwritten keys, but that only matters when the project
  // was already non-empty — in which case isFirstActivation() returns false anyway.
  await maybeTrackActivation('import', count)
}

// Handle sync completed
const handleSyncComplete = () => {
  showSyncNowModal.value = false
}

// Bulk assign service
const bulkAssignService = async (serviceId: string | null) => {
  const ids = [...selectedVariableIds.value]
  if (ids.length === 0) return

  bulkActionLoading.value = true
  try {
    const { error } = await client
      .from('variables')
      .update({ service_id: serviceId })
      .in('id', ids)

    if (error) throw error

    // Update local state
    variables.value.forEach(v => {
      if (selectedVariableIds.value.has(v.id)) {
        v.service_id = serviceId
      }
    })
    const name = serviceId ? getServiceName(serviceId) : 'Shared'
    $toast.success(`Assigned ${ids.length} variable${ids.length > 1 ? 's' : ''} to ${name}`)
    selectedVariableIds.value = new Set()

    // Trigger auto-syncs
    if (activeEnvironment.value) {
      triggerAutoSyncs(activeEnvironment.value.id)
    }
  } catch (error) {
    $toast.error('Failed to assign service')
    console.error(error)
  } finally {
    bulkActionLoading.value = false
  }
}

// Bulk delete confirm
const bulkDeleteConfirm = () => {
  bulkDeleteCount.value = selectedVariableIds.value.size
  showBulkDeleteDialog.value = true
}

// Bulk delete
const bulkDelete = async () => {
  const ids = [...selectedVariableIds.value]
  if (ids.length === 0) return

  bulkActionLoading.value = true
  try {
    const { error } = await client
      .from('variables')
      .delete()
      .in('id', ids)

    if (error) throw error

    $toast.success(`Deleted ${ids.length} variable${ids.length > 1 ? 's' : ''}`)
    selectedVariableIds.value = new Set()
    showBulkDeleteDialog.value = false
    await fetchVariables()

    // Trigger auto-syncs
    if (activeEnvironment.value) {
      triggerAutoSyncs(activeEnvironment.value.id)
    }

    track('variables_bulk_deleted', {
      count: ids.length,
      environment_id: activeEnvironment.value?.id,
      project_id: projectId
    })
  } catch (error) {
    $toast.error('Failed to delete variables')
    console.error(error)
  } finally {
    bulkActionLoading.value = false
  }
}

// Format date
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'Unknown'

  const date = new Date(dateString)
  return date.toLocaleString()
}

// Check if variable was modified recently (within 1 hour)
const isRecentlyModified = (variable: VariableItem) => {
  if (!variable.updated_at) return false
  const hourAgo = Date.now() - 60 * 60 * 1000
  return new Date(variable.updated_at).getTime() > hourAgo
}

// Get member email from user_id
const getMemberEmail = (userId: string) => {
  const member = organizationMembers.value.find(m => m.user_id === userId)
  return member?.email || 'unknown'
}

// Fetch organization members for "modified by" display
const fetchOrganizationMembers = async () => {
  if (!project.value?.organization_id) return

  try {
    const { data, error } = await client.rpc('get_organization_members_with_emails', { org_id: project.value.organization_id })
    if (error) throw error
    organizationMembers.value = data || []
  } catch (error) {
    console.error('Failed to fetch organization members:', error)
  }
}

// Clear selection when switching environments or service filter
watch(activeEnvironment, () => {
  selectedVariableIds.value = new Set()
  if (activeEnvironment.value) {
    fetchVariables()
    showPendingView.value = false
    // Log web_view access (fire-and-forget)
    logAccess(activeEnvironment.value.id, 'web_view')
    track('environment_switched', {
      environment_id: activeEnvironment.value.id,
      environment_name: activeEnvironment.value.name,
      project_id: projectId
    })
    if (activeEnvironment.value.is_protected) {
      fetchPendingChanges(activeEnvironment.value.id)
    }
  }
})

watch(selectedServiceId, () => {
  selectedVariableIds.value = new Set()
})

// Fetch data on mount
onMounted(async () => {
  // fetchProject and fetchEnvironments are independent (both keyed off the route's
  // projectId). Run them together so the variables — loaded inside fetchEnvironments —
  // don't wait behind the project fetch. One fewer transatlantic round-trip to content.
  await Promise.all([fetchProject(), fetchEnvironments()])

  // Set breadcrumbs once the project is loaded
  if (project.value) {
    breadcrumbs.value = [
      { label: 'Dashboard', to: '/dashboard' },
      { label: project.value.name }
    ]
  }

  // These need project.value.organization_id, so they run after fetchProject resolved.
  await Promise.all([fetchOrganizationMembers(), fetchServices()])
})
</script>
