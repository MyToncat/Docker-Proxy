<template>
  <div class="result result-anim">
    <div class="speed-hero">
      <div class="hero-ico"><el-icon><Odometer /></el-icon></div>
      <div class="hero-readout">
        <span class="speed-num">{{ data.speedMbps }}</span>
        <span class="speed-unit">Mbps</span>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Download /></el-icon></div>
        <div class="metric-label">下载速度</div>
        <div class="metric-value">{{ formatBytes(data.speedBps) }}/s</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Timer /></el-icon></div>
        <div class="metric-label">测试时长</div>
        <div class="metric-value">{{ data.duration }} s</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Files /></el-icon></div>
        <div class="metric-label">下载总量</div>
        <div class="metric-value">{{ formatBytes(data.bytes) }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Position /></el-icon></div>
        <div class="metric-label">测速节点</div>
        <div class="metric-value mini">{{ data.target }}</div>
      </div>
    </div>

    <el-progress :percentage="Math.min(100, data.speedMbps)" :color="speedColor" :stroke-width="16" :show-text="false" class="speed-bar" />

    <el-alert
      v-if="data.fallback && data.note"
      type="warning"
      :title="data.note"
      :closable="false"
      show-icon
      class="fallback-alert"
    />

    <div class="speed-hint">
      <el-icon><InfoFilled /></el-icon>
      <span>测速结果受服务器带宽、目标节点负载与当前网络环境影响，仅供参考。</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { InfoFilled, Odometer, Download, Timer, Files, Position } from '@element-plus/icons-vue'

const props = defineProps({ data: { type: Object, required: true } })

const speedColor = computed(() => {
  const m = props.data.speedMbps || 0
  if (m >= 100) return 'var(--success)'
  if (m >= 20) return 'var(--accent)'
  if (m >= 5) return 'var(--warning)'
  return 'var(--danger)'
})

function formatBytes(bps) {
  if (bps == null) return '—'
  if (bps < 1024) return bps + ' B'
  if (bps < 1024 * 1024) return (bps / 1024).toFixed(2) + ' KB'
  return (bps / 1024 / 1024).toFixed(2) + ' MB'
}
</script>

<style scoped>
.result { color: var(--fg); }
.speed-hero { display: flex; align-items: center; gap: 16px; padding: 22px 24px; background: linear-gradient(135deg, var(--accent-soft), color-mix(in srgb, var(--accent-2) 14%, var(--bg-card-2))); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 16px; }
.hero-ico { width: 48px; height: 48px; border-radius: 13px; display: flex; align-items: center; justify-content: center; background: var(--bg-card); color: var(--accent); font-size: 24px; box-shadow: 0 6px 16px rgba(15,23,42,.10); flex: 0 0 auto; }
.hero-readout { display: flex; align-items: baseline; gap: 8px; }
.speed-num { font-size: 52px; font-weight: 700; color: var(--accent); line-height: 1; font-variant-numeric: tabular-nums; }
.speed-unit { font-size: 18px; color: var(--accent-2); font-weight: 600; }
.metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.metric-value.mini { font-size: 13px; word-break: break-all; line-height: 1.4; }
.speed-bar { margin-bottom: 12px; }
.fallback-alert { margin-bottom: 12px; }
.speed-hint { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.speed-hint .el-icon { color: var(--muted-2); }
</style>
