<template>
  <div class="result result-anim">
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Position /></el-icon></div>
        <div class="metric-label">目标 IP</div>
        <div class="metric-value">{{ data.ip || '—' }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Switch /></el-icon></div>
        <div class="metric-label">发送 / 接收</div>
        <div class="metric-value">{{ data.transmitted }} / {{ data.received }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Warning /></el-icon></div>
        <div class="metric-label">丢包率</div>
        <div class="metric-value" :class="data.loss > 0 ? 'bad' : 'good'">{{ data.loss }}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Timer /></el-icon></div>
        <div class="metric-label">平均延迟</div>
        <div class="metric-value">{{ data.avg != null ? data.avg + ' ms' : '—' }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><Sort /></el-icon></div>
        <div class="metric-label">最小 / 最大</div>
        <div class="metric-value">{{ minMax }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-ico"><el-icon><DataAnalysis /></el-icon></div>
        <div class="metric-label">标准差</div>
        <div class="metric-value">{{ data.stddev != null ? data.stddev + ' ms' : '—' }}</div>
      </div>
    </div>

    <div v-if="data.times?.length" class="chart-wrap">
      <div class="chart-title">每次往返延迟</div>
      <div class="bars">
        <div v-for="(t, i) in data.times" :key="i" class="bar-row">
          <span class="bar-idx">#{{ i + 1 }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: barWidth(t) }" :class="barClass(t)"></div>
          </div>
          <span class="bar-val">{{ t }} ms</span>
        </div>
      </div>
    </div>

    <el-collapse class="raw-collapse">
      <el-collapse-item title="原始输出">
        <pre class="raw-pre">{{ data.raw }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Position, Switch, Warning, Timer, Sort, DataAnalysis } from '@element-plus/icons-vue'

const props = defineProps({ data: { type: Object, required: true } })

const minMax = computed(() => {
  if (props.data.min == null && props.data.max == null) return '—'
  return `${props.data.min ?? '—'} / ${props.data.max ?? '—'} ms`
})

const maxTime = computed(() => Math.max(...(props.data.times || [0]), 1))

function barWidth(t) {
  return Math.min(100, (t / maxTime.value) * 100).toFixed(1) + '%'
}

function barClass(t) {
  if (t < 50) return 'good'
  if (t < 150) return 'warn'
  return 'bad'
}
</script>

<style scoped>
.result { color: var(--fg); }
.metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.chart-wrap { background: var(--bg-card-2); border-radius: 10px; padding: 14px; border: 1px solid var(--border); margin-bottom: 16px; }
.chart-title { font-size: 13px; font-weight: 600; color: var(--fg); margin-bottom: 10px; }
.bars { display: flex; flex-direction: column; gap: 6px; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-idx { width: 34px; font-size: 12px; color: var(--muted); font-family: ui-monospace, monospace; }
.bar-track { flex: 1; height: 10px; background: var(--border); border-radius: 5px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }
.bar-fill.good { background: var(--success); }
.bar-fill.warn { background: var(--warning); }
.bar-fill.bad { background: var(--danger); }
.bar-val { width: 64px; text-align: right; font-size: 12px; font-family: ui-monospace, monospace; color: var(--fg); }
.raw-collapse { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.raw-pre { margin: 0; padding: 12px; font-size: 12px; background: #0f172a; color: #e2e8f0; overflow-x: auto; border-radius: 0 0 8px 8px; white-space: pre-wrap; }
@media (prefers-reduced-motion: reduce) { .bar-fill { transition: none; } }
</style>
