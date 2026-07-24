<template>
  <div class="page traf-page">
    <header class="page-head">
      <div class="head-badge"><el-icon><DataLine /></el-icon></div>
      <div class="head-text">
        <h1>{{ t('traffic.title') }}</h1>
        <p>{{ t('traffic.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <el-select v-model="hours" size="default" style="width: 130px" @change="loadTraffic">
          <el-option v-for="o in rangeOpts" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button :icon="Refresh" :loading="loading" @click="refreshAll">{{ t('common.refresh') }}</el-button>
      </div>
    </header>

    <!-- 当前速率与概览 -->
    <section class="rate-grid">
      <div class="rate-card down">
        <div class="rate-ic"><el-icon><Download /></el-icon></div>
        <div class="rate-body">
          <div class="rate-main">
            <div class="rate-label">{{ t('traffic.curDownloadRate') }}</div>
            <div class="rate-val">{{ formatRate(current.rxSec) }}</div>
          </div>
          <div class="rate-sub">{{ t('traffic.sinceBootAccum', { bytes: formatBytes(current.rxBytes) }) }}</div>
        </div>
      </div>
      <div class="rate-card up">
        <div class="rate-ic"><el-icon><Upload /></el-icon></div>
        <div class="rate-body">
          <div class="rate-main">
            <div class="rate-label">{{ t('traffic.curUploadRate') }}</div>
            <div class="rate-val">{{ formatRate(current.txSec) }}</div>
          </div>
          <div class="rate-sub">{{ t('traffic.sinceBootAccum', { bytes: formatBytes(current.txBytes) }) }}</div>
        </div>
      </div>
      <div class="rate-card info">
        <div class="rate-ic"><el-icon><Connection /></el-icon></div>
        <div class="rate-body">
          <div class="rate-main">
            <div class="rate-label">{{ t('traffic.windowTotal') }}</div>
            <div class="rate-val sm">{{ formatBytes(window.rxTotal + window.txTotal) }}</div>
          </div>
          <div class="rate-sub">↓ {{ formatBytes(window.rxTotal) }} · ↑ {{ formatBytes(window.txTotal) }}</div>
        </div>
      </div>
      <div class="rate-card info">
        <div class="rate-ic"><el-icon><Cpu /></el-icon></div>
        <div class="rate-body">
          <div class="rate-main">
            <div class="rate-label">{{ t('traffic.activeIfaces') }}</div>
            <div class="rate-val sm">{{ activeIfaces.length }}</div>
          </div>
          <div class="rate-sub iface-list" :title="activeIfaces.join(', ')">
            {{ ifaceSummary }}
          </div>
        </div>
      </div>
    </section>

    <!-- 历史吞吐曲线 -->
    <el-card shadow="never" class="panel-card">
      <div class="card-head">
        <span class="card-title"><el-icon><DataLine /></el-icon> {{ t('traffic.historyCurve') }}</span>
        <span class="card-hint">{{ t('traffic.sampleHint', { sec: 30 }) }}</span>
      </div>
      <EChart :option="chartOption" height="340px" />
    </el-card>

    <!-- 客户端拉取流量 Top -->
    <el-card shadow="never" class="panel-card">
      <div class="card-head">
        <span class="card-title"><el-icon><User /></el-icon> {{ t('traffic.clientRank') }}</span>
        <div class="head-actions">
          <span v-if="proxyReachable === false" class="warn-tag">
            <el-icon><WarningFilled /></el-icon> {{ t('traffic.proxyUnreachableWarn') }}
          </span>
          <el-button size="small" :icon="Refresh" :loading="clientsLoading" @click="loadClients">{{ t('common.refresh') }}</el-button>
        </div>
      </div>
      <div v-if="clients.length" class="client-table">
        <div class="ct-head">
          <span class="ct-ip">{{ t('traffic.clientIp') }}</span>
          <span class="ct-bytes">{{ t('traffic.totalTraffic') }}</span>
          <span class="ct-req">{{ t('traffic.requests') }}</span>
          <span class="ct-time">{{ t('traffic.lastActive') }}</span>
          <span class="ct-regs">{{ t('traffic.registryDetail') }}</span>
        </div>
        <div v-for="c in clients" :key="c.ip" class="ct-row">
          <span class="ct-ip"><el-icon><Monitor /></el-icon> {{ c.ip }}</span>
          <span class="ct-bytes">{{ formatBytes(c.bytesTotal) }}</span>
          <span class="ct-req">{{ c.requests }}</span>
          <span class="ct-time">{{ fmtTime(c.lastSeen) }}</span>
          <span class="ct-regs">
            <span v-for="(b, reg) in c.byRegistry" :key="reg" class="reg-tag">{{ reg }} · {{ formatBytes(b) }}</span>
            <span v-if="!c.byRegistry || !Object.keys(c.byRegistry).length" class="muted">—</span>
          </span>
        </div>
      </div>
      <div v-else class="client-empty">
        <el-icon><DocumentDelete /></el-icon>
        <span>{{ proxyReachable === false ? t('traffic.proxyUnreachableMsg') : t('traffic.noTrafficRecord') }}</span>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { DataLine, Download, Upload, Refresh, Connection, Cpu, User, Monitor, WarningFilled, DocumentDelete } from '@element-plus/icons-vue'
import EChart from '../components/EChart.vue'
import { useThemeColors } from '../composables/useThemeColors'
import { getNetworkTraffic, getProxyStats } from '../services'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { palette: pal } = useThemeColors()

const loading = ref(false)
const clientsLoading = ref(false)
const hours = ref(24)
const rangeOpts = [
  { label: t('traffic.rangeHours', { n: 6 }), value: 6 },
  { label: t('traffic.rangeHours', { n: 12 }), value: 12 },
  { label: t('traffic.rangeHours', { n: 24 }), value: 24 },
  { label: t('traffic.rangeDays', { n: 3 }), value: 72 },
  { label: t('traffic.rangeDays', { n: 7 }), value: 168 }
]

const current = ref({ rxSec: 0, txSec: 0, rxBytes: 0, txBytes: 0, interfaces: [], activeInterfaces: [] })
const window = ref({ rxTotal: 0, txTotal: 0, since: 0, until: 0 })
const points = ref([])
const clients = ref([])
const proxyReachable = ref(null)

const activeIfaces = computed(() => current.value.activeInterfaces || [])
const ifaceSummary = computed(() => {
  const list = activeIfaces.value
  if (!list.length) return '—'
  const head = list.slice(0, 3).join(', ')
  return list.length > 3 ? `${head} ${t('traffic.ifaceEtc', { count: list.length })}` : head
})

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
}
function formatRate(bps) {
  return formatBytes(bps || 0) + '/s'
}
function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const chartOption = computed(() => {
  const p = pal.value
  const axis = p['--muted-2'] || '#94a3b8'
  const split = p['--border'] || '#e2e8f0'
  const rxColor = p['--success'] || '#10b981'
  const txColor = p['--danger'] || '#ef4444'

  // 计算合理的 Y 轴上限，让刻度均匀且不会出现乱序的格式化标签
  const allRates = points.value.flatMap(pt => [pt.rxRate, pt.txRate]).filter(v => typeof v === 'number' && v > 0)
  const rawMax = allRates.length ? Math.max(...allRates) : 0
  // 无数据时默认 100 B/s；有数据时上浮 15% 并向上取整到 nicer number
  const niceMax = rawMax > 0 ? rawMax * 1.15 : 100
  const yMax = niceMax

  const mk = (name, key, color) => ({
    name, type: 'line', smooth: true, showSymbol: false,
    sampling: 'lttb', large: true,
    data: points.value.map(pt => [pt.ts, pt[key]]),
    lineStyle: { width: 2.5, color },
    itemStyle: { color },
    areaStyle: {
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: color + '59' },
          { offset: 1, color: color + '03' }
        ]
      }
    }
  })
  return {
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: p['--bg-card'] || '#fff',
      borderColor: split,
      textStyle: { color: p['--fg'] || '#0f172a' },
      valueFormatter: v => (v == null ? '—' : formatBytes(v) + '/s')
    },
    legend: { data: [t('traffic.download'), t('traffic.upload')], top: 6, right: 8, textStyle: { color: p['--fg-2'] || '#334155' } },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: split } },
      axisLabel: { color: axis, hideOverlap: true },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yMax,
      interval: yMax / 5,
      axisLabel: { color: axis, formatter: v => formatBytes(v) + '/s' },
      splitLine: { lineStyle: { color: split, type: 'dashed' } }
    },
    series: [mk(t('traffic.download'), 'rxRate', rxColor), mk(t('traffic.upload'), 'txRate', txColor)]
  }
})

async function loadTraffic() {
  loading.value = true
  try {
    const d = await getNetworkTraffic(hours.value)
    current.value = d.current || current.value
    window.value = d.history?.window || window.value
    points.value = d.history?.points || []
  } catch (e) {
    ElMessage.error(t('traffic.loadFailed') + (e.response?.data?.error || e.message))
  } finally {
    loading.value = false
  }
}

async function loadClients() {
  clientsLoading.value = true
  try {
    const d = await getProxyStats()
    clients.value = Array.isArray(d.clients) ? d.clients : []
    proxyReachable.value = true
  } catch (e) {
    proxyReachable.value = false
    clients.value = []
  } finally {
    clientsLoading.value = false
  }
}

function refreshAll() {
  loadTraffic()
  loadClients()
}

let timer = null
onMounted(() => {
  refreshAll()
  timer = setInterval(() => { loadTraffic(); loadClients() }, 15000)
  if (timer && typeof timer.unref === 'function') timer.unref()
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.page { max-width: 100%; margin: 0 auto; }
.page-head {
  display: flex; align-items: center; gap: 14px; margin-bottom: 18px; flex-wrap: wrap;
}
.head-badge {
  width: 46px; height: 46px; border-radius: 12px; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center; font-size: 22px; color: #fff;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
}
.head-text { flex: 1 1 auto; }
.head-text h1 { margin: 0; font-size: 20px; font-weight: 700; color: var(--fg); }
.head-text p { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
.head-actions { display: flex; align-items: center; gap: 10px; }

/* 指标卡：图标在左、关键数字在右的水平卡片 */
.rate-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.rate-card {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px; min-height: 96px;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
  transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
}
.rate-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-hover); border-color: var(--border-strong); }
.rate-ic {
  width: 48px; height: 48px; border-radius: 12px; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.rate-card.down .rate-ic { background: color-mix(in srgb, var(--success) 16%, transparent); color: var(--success); }
.rate-card.up .rate-ic { background: color-mix(in srgb, var(--danger) 16%, transparent); color: var(--danger); }
.rate-card.info .rate-ic { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); }
.rate-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.rate-main { display: flex; flex-direction: column; gap: 1px; }
.rate-label { font-size: 12px; color: var(--muted); font-weight: 500; }
.rate-val { font-size: 24px; font-weight: 700; color: var(--fg); line-height: 1.15; font-variant-numeric: tabular-nums; }
.rate-val.sm { font-size: 20px; }
.rate-sub { font-size: 12px; color: var(--muted); }
.rate-sub.iface-list {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%;
}

.panel-card { background: var(--bg-card); border-color: var(--border); margin-bottom: 16px; }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
.card-title { display: inline-flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 600; color: var(--fg); }
.card-hint { font-size: 12px; color: var(--muted); }
.warn-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--warning); }

.client-table { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.ct-head, .ct-row {
  display: grid; grid-template-columns: 1.4fr 1fr 0.7fr 1.2fr 2fr;
  align-items: center; gap: 10px; padding: 11px 14px;
}
.ct-head { background: var(--bg-card-2); font-size: 12px; color: var(--muted); font-weight: 600; }
.ct-row { border-top: 1px solid var(--border); font-size: 13px; color: var(--fg); }
.ct-row:hover { background: var(--bg-card-2); }
.ct-ip { display: inline-flex; align-items: center; gap: 6px; font-family: 'SF Mono', 'JetBrains Mono', monospace; }
.ct-bytes { font-weight: 600; }
.ct-regs { display: flex; flex-wrap: wrap; gap: 6px; }
.reg-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: var(--bg-card-2); border: 1px solid var(--border); color: var(--fg-2);
}
.muted { color: var(--muted); }
.client-empty {
  display: flex; align-items: center; gap: 10px; padding: 28px 16px;
  color: var(--muted); font-size: 13px; justify-content: center;
  border: 1px dashed var(--border-strong); border-radius: 12px;
}
.client-empty .el-icon { font-size: 18px; color: var(--accent); }

@media (max-width: 980px) {
  .rate-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .rate-grid { grid-template-columns: 1fr; }
  .rate-card { min-height: 84px; }
  .ct-head { display: none; }
  .ct-row {
    grid-template-columns: 1fr 1fr;
    row-gap: 6px; padding: 12px 14px;
  }
  .ct-row .ct-ip { grid-column: 1 / -1; }
  .ct-row .ct-regs { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .rate-card { transition: none; }
}
</style>
