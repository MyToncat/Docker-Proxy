<template>
  <div class="result result-anim">
    <div class="status-line">
      <el-tag :type="statusType" size="large" effect="dark" round>{{ data.statusCode || '失败' }}</el-tag>
      <span class="status-url">{{ data.url }}</span>
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Timer /></el-icon></div>
        <div class="metric-label">总耗时</div>
        <div class="metric-value">{{ data.totalTime != null ? data.totalTime + ' ms' : '—' }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Download /></el-icon></div>
        <div class="metric-label">响应体大小</div>
        <div class="metric-value">{{ data.bodySize != null ? formatBytes(data.bodySize) : '—' }}</div>
      </div>
    </div>

    <div v-if="data.error" class="error-card">
      <el-icon><Warning /></el-icon>
      <span>{{ data.error }}</span>
    </div>

    <el-collapse v-if="data.headers && Object.keys(data.headers).length" class="raw-collapse">
      <el-collapse-item title="响应 Headers">
        <pre class="raw-pre">{{ headersText }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Warning, Timer, Download } from '@element-plus/icons-vue'

const props = defineProps({ data: { type: Object, required: true } })

const statusType = computed(() => {
  const c = props.data.statusCode
  if (!c) return 'danger'
  if (c >= 200 && c < 300) return 'success'
  if (c >= 300 && c < 400) return 'warning'
  return 'danger'
})

const headersText = computed(() => {
  const h = props.data.headers || {}
  return Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n')
})

function formatBytes(b) {
  if (b == null) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(2) + ' KB'
  return (b / 1024 / 1024).toFixed(2) + ' MB'
}
</script>

<style scoped>
.result { color: var(--fg); }
.status-line { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.status-url { font-size: 13px; color: var(--muted); word-break: break-all; }
.metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.error-card { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: color-mix(in srgb, var(--danger) 10%, var(--bg-card-2)); border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border)); border-radius: 8px; color: var(--danger); margin-bottom: 16px; }
.raw-collapse { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.raw-pre { margin: 0; padding: 12px; font-size: 12px; background: #0f172a; color: #e2e8f0; overflow-x: auto; white-space: pre-wrap; }
</style>
