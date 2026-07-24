<template>
  <div class="result result-anim">
    <div class="status-line">
      <el-tag :type="data.connected ? 'success' : 'danger'" size="large" effect="dark" round>
        {{ data.connected ? '连通' : '不可达' }}
      </el-tag>
      <span class="status-target">{{ data.target }}:{{ data.port }}</span>
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Timer /></el-icon></div>
        <div class="metric-label">连接延迟</div>
        <div class="metric-value">{{ data.latency != null ? data.latency + ' ms' : '—' }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Switch /></el-icon></div>
        <div class="metric-label">端口</div>
        <div class="metric-value">{{ data.port }}</div>
      </div>
    </div>

    <div v-if="data.error" class="error-card">
      <el-icon><Warning /></el-icon>
      <span>{{ data.error }}</span>
    </div>
  </div>
</template>

<script setup>
import { Warning, Timer, Switch } from '@element-plus/icons-vue'

defineProps({ data: { type: Object, required: true } })
</script>

<style scoped>
.result { color: var(--fg); }
.status-line { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.status-target { font-size: 13px; color: var(--muted); word-break: break-all; }
.metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.error-card { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: color-mix(in srgb, var(--danger) 10%, var(--bg-card-2)); border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border)); border-radius: 8px; color: var(--danger); }
</style>
