<template>
  <div class="result result-anim">
    <div class="section-title">
      <el-icon><Share /></el-icon>
      <span>路径节点</span>
      <span class="hop-count" v-if="data.hops?.length">{{ data.hops.length }} 跳</span>
    </div>

    <el-table :data="data.hops" size="small" class="trace-table" style="width: 100%">
      <el-table-column label="跳数" width="70" align="center">
        <template #default="{ row }">
          <span class="hop-num">{{ row.hop }}</span>
        </template>
      </el-table-column>
      <el-table-column label="主机 / IP" min-width="220">
        <template #default="{ row }">
          <div v-if="row.ip" class="host-cell">
            <span class="host-name">{{ row.host }}</span>
            <span class="host-ip">{{ row.ip }}</span>
          </div>
          <span v-else class="host-timeout">请求超时</span>
        </template>
      </el-table-column>
      <el-table-column label="延迟" width="180">
        <template #default="{ row }">
          <div v-if="row.latencies?.length" class="latency-cell">
            <span v-for="(l, i) in row.latencies" :key="i" class="latency-dot" :class="latencyClass(l)"></span>
            <span class="latency-avg">{{ row.avg }} ms</span>
          </div>
          <span v-else class="host-timeout">—</span>
        </template>
      </el-table-column>
    </el-table>

    <el-collapse class="raw-collapse">
      <el-collapse-item title="原始输出">
        <pre class="raw-pre">{{ data.raw }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { Share } from '@element-plus/icons-vue'

defineProps({ data: { type: Object, required: true } })

function latencyClass(ms) {
  if (ms < 50) return 'good'
  if (ms < 150) return 'warn'
  return 'bad'
}
</script>

<style scoped>
.result { color: var(--fg); }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--fg); margin-bottom: 12px; }
.section-title .el-icon { color: var(--accent); }
.hop-count { margin-left: 4px; font-size: 12px; font-weight: 500; color: var(--muted); background: var(--bg-card-2); border: 1px solid var(--border); border-radius: 999px; padding: 1px 10px; }
.trace-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.hop-num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 600; }
.host-cell { display: flex; flex-direction: column; gap: 2px; }
.host-name { font-weight: 500; color: var(--fg); }
.host-ip { font-size: 12px; color: var(--muted); font-family: ui-monospace, monospace; }
.host-timeout { color: var(--muted-2); font-style: italic; }
.latency-cell { display: flex; align-items: center; gap: 8px; }
.latency-dot { width: 8px; height: 8px; border-radius: 50%; }
.latency-dot.good { background: var(--success); }
.latency-dot.warn { background: var(--warning); }
.latency-dot.bad { background: var(--danger); }
.latency-avg { font-family: ui-monospace, monospace; font-size: 13px; color: var(--fg); }
.raw-collapse { margin-top: 16px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.raw-pre { margin: 0; padding: 12px; font-size: 12px; background: #0f172a; color: #e2e8f0; overflow-x: auto; white-space: pre-wrap; }
</style>
