<template>
  <div class="docker-view">
    <div class="page-head">
      <div>
        <h2 class="page-title">{{ t('docker.containerManage') }}</h2>
        <p class="page-sub">{{ t('docker.pageSub') }}</p>
      </div>
      <el-button type="primary" :icon="Refresh" @click="load" :loading="loading">{{ t('docker.refreshList') }}</el-button>
    </div>

    <el-alert
      v-if="dockerStatus !== 'running'"
      type="warning"
      :closable="false"
      show-icon
      :title="t('docker.dockerNotRunning')"
      :description="t('docker.dockerUnavailableDesc')"
      style="margin-bottom: 16px"
    />

    <el-card class="table-card" shadow="never">
      <el-table :data="containers" v-loading="loading" stripe style="width: 100%">
        <el-table-column :label="t('docker.containerId')" min-width="140">
          <template #default="{ row }">
            <span class="mono">{{ (row.id || '').slice(0, 12) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('docker.containerName')" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column :label="t('docker.imageName')" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{ row.image }}</template>
        </el-table-column>
        <el-table-column :label="t('docker.runStatus')" min-width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.state)" size="small" effect="dark">
              {{ row.state }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" min-width="320" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="success"
              :disabled="row.state === 'running'"
              @click="doAction('start', row)"
            >{{ t('docker.start') }}</el-button>
            <el-button
              size="small"
              type="warning"
              :disabled="row.state !== 'running'"
              @click="doAction('stop', row)"
            >{{ t('docker.stop') }}</el-button>
            <el-button
              size="small"
              type="primary"
              :disabled="row.state !== 'running'"
              @click="doAction('restart', row)"
            >{{ t('docker.restart') }}</el-button>
          <el-button size="small" @click="openUpdate(row)">{{ t('docker.update') }}</el-button>
          <el-button size="small" @click="openLogs(row)">{{ t('docker.logs') }}</el-button>
          <el-popconfirm :title="t('docker.confirmRemoveContainer')" @confirm="doAction('remove', row)">
            <template #reference>
              <el-button size="small" type="danger">{{ t('common.delete') }}</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && dockerStatus === 'running' && containers.length === 0"
        :description="t('docker.emptyContainers')"
      />
    </el-card>

    <!-- 日志对话框 -->
    <el-dialog v-model="logsVisible" :title="`${t('docker.containerLogs')} · ${currentName}`" width="760px">
      <pre class="logs-box">{{ logsText || t('docker.noLogs') }}</pre>
    </el-dialog>

    <!-- 更新对话框 -->
    <el-dialog v-model="updateVisible" :title="`${t('docker.updateContainer')} · ${currentName}`" width="480px">
      <el-form label-width="80px">
        <el-form-item :label="t('docker.imageTag')">
          <el-input v-model="updateTag" :placeholder="t('docker.tagPlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="updateVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="updating" @click="submitUpdate">{{ t('docker.confirmUpdate') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import {
  getDockerStatus, startContainer, stopContainer,
  restartContainer, deleteContainer, updateContainer, getContainerLogs
} from '../services'

const { t } = useI18n()

const loading = ref(false)
const dockerStatus = ref('')
const containers = ref([])

const logsVisible = ref(false)
const logsText = ref('')
const currentName = ref('')
const currentId = ref('')

const updateVisible = ref(false)
const updateTag = ref('')
const updating = ref(false)

function normalize(list) {
  return (list || []).map(c => ({
    id: c.Id || c.id,
    name: (Array.isArray(c.Names) ? c.Names[0] : (c.Name || c.name || '-')).replace(/^\//, ''),
    image: c.Image || c.image || '-',
    state: c.State || c.state || c.status || t('docker.unknown')
  }))
}

function statusType(state) {
  if (state === 'running') return 'success'
  if (state === 'paused') return 'warning'
  if (state === 'exited' || state === 'dead') return 'danger'
  return 'info'
}

async function load() {
  loading.value = true
  try {
    // 后端 /api/docker/status 返回的是数组（每容器一项；Docker 不可用时返回 [{ error: 'DOCKER_UNAVAILABLE', state: 'error', ... }]）
    const data = await getDockerStatus()
    const arr = Array.isArray(data) ? data : []
    const hasContainers = arr.length > 0
    const firstHasError = !!(arr[0] && arr[0].error)
    dockerStatus.value = hasContainers && !firstHasError ? 'running' : 'stopped'
    containers.value = normalize(arr.filter(c => !c.error))
  } catch (e) {
    dockerStatus.value = 'stopped'
    containers.value = []
    ElMessage.error(t('docker.loadListFailed') + (e.response?.data?.error || e.message))
  } finally {
    loading.value = false
  }
}

async function doAction(action, row) {
  const map = {
    start: () => startContainer(row.id),
    stop: () => stopContainer(row.id),
    restart: () => restartContainer(row.id),
    remove: () => deleteContainer(row.id)
  }
  try {
    const res = await map[action]()
    ElMessage.success(res.message || t('docker.operationSuccess'))
    await load()
  } catch (e) {
    ElMessage.error(t('docker.operationFailed') + (e.response?.data?.error || e.message))
  }
}

function openLogs(row) {
  currentId.value = row.id
  currentName.value = row.name
  logsText.value = ''
  logsVisible.value = true
  getContainerLogs(row.id)
    .then(t => { logsText.value = t })
    .catch(e => { logsText.value = t('docker.getLogsFailed') + (e.response?.data?.error || e.message) })
}

function openUpdate(row) {
  currentId.value = row.id
  currentName.value = row.name
  updateTag.value = ''
  updateVisible.value = true
}

async function submitUpdate() {
  updating.value = true
  try {
    const res = await updateContainer(currentId.value, updateTag.value)
    ElMessage.success(res.message || t('docker.updateSuccess'))
    updateVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(t('docker.updateFailed') + (e.response?.data?.error || e.message))
  } finally {
    updating.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { color: var(--fg); font-size: 20px; margin: 0; }
.page-sub { color: var(--muted); font-size: 13px; margin: 4px 0 0; }
.table-card { background: var(--bg-card); border: 1px solid var(--border); }
.table-card :deep(.el-table),
.table-card :deep(.el-table__inner-wrapper),
.table-card :deep(.el-table__expanded-cell) { background: var(--bg-card); }
.table-card :deep(.el-table tr),
.table-card :deep(.el-table th),
.table-card :deep(.el-table td) { background: var(--bg-card); color: var(--fg); border-bottom-color: var(--border); }
.table-card :deep(.el-table th.el-table__cell) { background: var(--bg-card-2); color: var(--fg-2); font-weight: 600; }
.table-card :deep(.el-table__row:hover > td) { background: var(--bg-hover) !important; }
.table-card :deep(.el-table--striped .el-table__body tr.el-table__row--striped td) { background: var(--bg-card-2); }
.mono { font-family: 'Fira Code', ui-monospace, monospace; color: var(--fg-2); }
.logs-box {
  background: var(--code-bg); color: var(--fg); padding: 14px;
  border-radius: 8px; max-height: 420px; overflow: auto;
  font-family: 'Fira Code', ui-monospace, monospace; font-size: 12px; white-space: pre-wrap;
  border: 1px solid var(--border);
}
</style>
