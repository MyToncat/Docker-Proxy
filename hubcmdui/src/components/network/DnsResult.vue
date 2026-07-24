<template>
  <div class="result result-anim">
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Timer /></el-icon></div>
        <div class="metric-label">解析耗时</div>
        <div class="metric-value">{{ data.resolveTime }} ms</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Files /></el-icon></div>
        <div class="metric-label">记录数</div>
        <div class="metric-value">{{ data.records?.length || 0 }}</div>
      </div>
    </div>

    <div v-if="data.error" class="error-card">
      <el-icon><Warning /></el-icon>
      <span>{{ data.error }}</span>
    </div>

    <div v-if="data.records?.length" class="ip-list">
      <div v-for="(ip, i) in data.records" :key="i" class="ip-item">
        <el-icon><CircleCheck /></el-icon>
        <span class="ip-text">{{ ip }}</span>
        <el-button size="small" text @click="copy(ip)">复制</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { Warning, CircleCheck, Timer, Files } from '@element-plus/icons-vue'

defineProps({ data: { type: Object, required: true } })

function copy(text) {
  navigator.clipboard.writeText(text).then(() => ElMessage.success('已复制'))
}
</script>

<style scoped>
.result { color: var(--fg); }
.metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.error-card { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: color-mix(in srgb, var(--danger) 10%, var(--bg-card-2)); border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border)); border-radius: 8px; color: var(--danger); margin-bottom: 16px; }
.ip-list { display: flex; flex-direction: column; gap: 8px; }
.ip-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-card-2); border: 1px solid var(--border); border-radius: 8px; transition: border-color .15s ease, background .15s ease; }
.ip-item:hover { border-color: var(--border-strong); background: var(--bg-hover); }
.ip-item .el-icon { color: var(--success); }
.ip-text { flex: 1; font-family: ui-monospace, monospace; font-size: 14px; color: var(--fg); }
</style>
