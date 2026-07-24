<template>
  <div class="page nt-page">
    <div class="page-head nt-head">
      <div class="head-badge">
        <el-icon><Connection /></el-icon>
      </div>
      <div class="head-text">
        <h2>{{ t('network.title') }}</h2>
        <p class="muted">{{ t('network.subtitle') }}</p>
      </div>
    </div>

    <el-card shadow="never" class="panel-card">
      <div class="nt-inner">
        <el-tabs v-model="activeTab" class="nt-tabs">
          <!-- Ping -->
          <el-tab-pane name="ping">
            <template #label><span class="tab-label"><el-icon><Aim /></el-icon> Ping</span></template>
            <div class="console-wrap">
              <div class="nt-form console-bar">
                <el-input v-model="forms.ping.target" :placeholder="t('network.pingPlaceholder')" clearable class="grow" @keyup.enter="run('ping')">
                  <template #prefix><el-icon><Position /></el-icon></template>
                </el-input>
                <el-button type="primary" :loading="running.ping" @click="run('ping')">
                  <el-icon><Promotion /></el-icon> {{ t('network.startTest') }}
                </el-button>
              </div>
            </div>
            <PingResult v-if="results.ping" :data="results.ping" />
            <div v-else class="empty-hint"><el-icon><DataLine /></el-icon><span>{{ t('network.pingEmptyHint') }}</span></div>
          </el-tab-pane>

          <!-- Traceroute -->
          <el-tab-pane name="traceroute">
            <template #label><span class="tab-label"><el-icon><Share /></el-icon> Traceroute</span></template>
            <div class="console-wrap">
              <div class="nt-form console-bar">
                <el-input v-model="forms.traceroute.target" :placeholder="t('network.traceroutePlaceholder')" clearable class="grow" @keyup.enter="run('traceroute')">
                  <template #prefix><el-icon><Position /></el-icon></template>
                </el-input>
                <el-button type="primary" :loading="running.traceroute" @click="run('traceroute')">
                  <el-icon><Promotion /></el-icon> {{ t('network.startTest') }}
                </el-button>
              </div>
            </div>
            <TracerouteResult v-if="results.traceroute" :data="results.traceroute" />
            <div v-else class="empty-hint"><el-icon><Share /></el-icon><span>{{ t('network.tracerouteEmptyHint') }}</span></div>
          </el-tab-pane>

          <!-- HTTP -->
          <el-tab-pane name="http">
            <template #label><span class="tab-label"><el-icon><Link /></el-icon> HTTP</span></template>
            <div class="console-wrap">
              <div class="nt-form console-bar">
                <el-input v-model="forms.http.target" :placeholder="t('network.httpPlaceholder')" clearable class="grow" @keyup.enter="run('http')">
                  <template #prefix><el-icon><Link /></el-icon></template>
                </el-input>
                <el-button type="primary" :loading="running.http" @click="run('http')">
                  <el-icon><Promotion /></el-icon> {{ t('network.startTest') }}
                </el-button>
              </div>
            </div>
            <HttpResult v-if="results.http" :data="results.http" />
            <div v-else class="empty-hint"><el-icon><Link /></el-icon><span>{{ t('network.httpEmptyHint') }}</span></div>
          </el-tab-pane>

          <!-- DNS -->
          <el-tab-pane name="dns">
            <template #label><span class="tab-label"><el-icon><Coordinate /></el-icon> DNS</span></template>
            <div class="console-wrap">
              <div class="nt-form console-bar">
                <el-input v-model="forms.dns.target" :placeholder="t('network.dnsPlaceholder')" clearable class="grow" @keyup.enter="run('dns')">
                  <template #prefix><el-icon><Position /></el-icon></template>
                </el-input>
                <el-button type="primary" :loading="running.dns" @click="run('dns')">
                  <el-icon><Promotion /></el-icon> {{ t('network.startResolve') }}
                </el-button>
              </div>
            </div>
            <DnsResult v-if="results.dns" :data="results.dns" />
            <div v-else class="empty-hint"><el-icon><Coordinate /></el-icon><span>{{ t('network.dnsEmptyHint') }}</span></div>
          </el-tab-pane>

          <!-- TCP -->
          <el-tab-pane name="tcp">
            <template #label><span class="tab-label"><el-icon><Switch /></el-icon> TCP</span></template>
            <div class="console-wrap">
              <div class="nt-form console-bar">
                <el-input v-model="forms.tcp.target" :placeholder="t('network.tcpPlaceholder')" clearable class="grow" @keyup.enter="run('tcp')">
                  <template #prefix><el-icon><Position /></el-icon></template>
                </el-input>
                <el-input-number v-model="forms.tcp.port" :min="1" :max="65535" controls-position="right" :placeholder="t('network.portPlaceholder')" class="port" />
                <el-button type="primary" :loading="running.tcp" @click="run('tcp')">
                  <el-icon><Promotion /></el-icon> {{ t('network.testConnectivity') }}
                </el-button>
              </div>
            </div>
            <TcpResult v-if="results.tcp" :data="results.tcp" />
            <div v-else class="empty-hint"><el-icon><Switch /></el-icon><span>{{ t('network.tcpEmptyHint') }}</span></div>
          </el-tab-pane>

          <!-- Speed -->
          <el-tab-pane name="speed">
            <template #label><span class="tab-label"><el-icon><Odometer /></el-icon> {{ t('network.tabSpeed') }}</span></template>
            <div class="console-wrap">
              <div class="nt-form console-bar">
                <el-select v-model="forms.speed.url" class="grow" filterable allow-create default-first-option :placeholder="t('network.speedPlaceholder')">
                  <el-option v-for="u in speedPresets" :key="u.value" :label="u.label" :value="u.value" />
                </el-select>
                <el-button type="primary" :loading="running.speed" @click="run('speed')">
                  <el-icon><Promotion /></el-icon> {{ t('network.startSpeedTest') }}
                </el-button>
              </div>
            </div>
            <SpeedResult v-if="results.speed" :data="results.speed" />
            <div v-else class="empty-hint"><el-icon><Odometer /></el-icon><span>{{ t('network.speedEmptyHint') }}</span></div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  Promotion, Position, Link, Connection, Aim, Share, Coordinate, Switch, Odometer, DataLine
} from '@element-plus/icons-vue'
import { networkTest } from '../services'
import PingResult from '../components/network/PingResult.vue'
import TracerouteResult from '../components/network/TracerouteResult.vue'
import HttpResult from '../components/network/HttpResult.vue'
import DnsResult from '../components/network/DnsResult.vue'
import TcpResult from '../components/network/TcpResult.vue'
import SpeedResult from '../components/network/SpeedResult.vue'

const { t } = useI18n()
const activeTab = ref('ping')

const speedPresets = [
  { label: 'Cloudflare 10MB', value: 'https://speed.cloudflare.com/__down?bytes=10000000' },
  { label: 'Cloudflare 25MB', value: 'https://speed.cloudflare.com/__down?bytes=25000000' },
  { label: 'CacheFly 10MB', value: 'https://cachefly.cachefly.net/10mb.test' },
  { label: 'Speedtest 10MB', value: 'https://speedtest.tele2.net/10MB.zip' }
]

const forms = reactive({
  ping: { target: 'google.com' },
  traceroute: { target: 'ghcr.io' },
  http: { target: 'https://docker.io' },
  dns: { target: 'registry-1.docker.io' },
  tcp: { target: 'ghcr.io', port: 443 },
  speed: { url: speedPresets[0].value }
})

const running = reactive({
  ping: false, traceroute: false, http: false, dns: false, tcp: false, speed: false
})

const results = reactive({
  ping: null, traceroute: null, http: null, dns: null, tcp: null, speed: null
})

async function run(type) {
  const form = forms[type]
  const target = type === 'speed' ? form.url : (form.target || '').trim()
  if (!target) {
    ElMessage.warning(type === 'speed' ? t('network.pleaseSelectSpeedNode') : t('network.pleaseInputTarget'))
    return
  }

  running[type] = true
  try {
    const payload = type === 'tcp'
      ? { type, target, port: form.port }
      : type === 'speed'
        ? { type, target, url: form.url }
        : { type, target }
    const res = await networkTest(payload)
    results[type] = res
  } catch (e) {
    const msg = e.response?.data?.error || e.response?.data?.details || e.message || t('network.testFailed')
    ElMessage.error(msg)
  } finally {
    running[type] = false
  }
}
</script>

<style scoped>
.nt-page { color: var(--fg); }
.page-head.nt-head { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
.head-badge {
  width: 46px; height: 46px; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  border-radius: 13px;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 8px 20px var(--accent-soft);
  font-size: 22px;
}
.head-text h2 { margin: 0 0 3px; font-size: 20px; letter-spacing: -0.01em; }
.head-text .muted { color: var(--muted); margin: 0; font-size: 13px; }

.panel-card { background: var(--bg-card); border-color: var(--border); overflow: hidden; }
:deep(.el-card) { background: var(--bg-card); border-color: var(--border); }

/* 标签导航：通栏左对齐的胶囊分段控件 */
.nt-tabs :deep(.el-tabs__header) {
  border: none;
  margin: 0 0 18px;
  background: var(--bg-card-2);
  border-radius: 14px;
  padding: 6px;
}
.nt-tabs :deep(.el-tabs__nav) { border: none !important; display: flex; gap: 4px; }
.nt-tabs :deep(.el-tabs__item) {
  border: none !important;
  border-radius: 10px;
  height: 36px;
  line-height: 36px;
  padding: 0 18px !important;
  color: var(--fg-2);
  font-weight: 600;
  font-size: 13px;
  transition: background .18s ease, color .18s ease, box-shadow .18s ease, transform .18s ease;
}
.nt-tabs :deep(.el-tabs__item:hover) {
  color: var(--fg);
  background: rgba(255, 255, 255, 0.35);
}
.nt-tabs :deep(.el-tabs__item.is-active) {
  background: var(--bg-card);
  color: var(--accent);
  box-shadow: 0 2px 10px rgba(15, 23, 42, .10);
  transform: translateY(-1px);
}
.nt-tabs :deep(.el-tabs__active-bar) { display: none; }
.nt-tabs :deep(.el-tabs__content) { padding-top: 2px; }

.tab-label { display: inline-flex; align-items: center; gap: 6px; }
.tab-label .el-icon { font-size: 15px; }

/* 控制台表单条容器：左对齐，限制最大宽度 */
.console-wrap {
  max-width: 640px;
  margin-bottom: 18px;
}

/* 控制台风格表单条 */
.nt-form.console-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
}
.nt-form.console-bar .grow {
  flex: 1 1 auto;
  min-width: 220px;
  max-width: 100%;
}
.nt-form.console-bar .port { width: 120px; flex: 0 0 auto; }

/* 空状态提示 */
.empty-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 28px 20px;
  color: var(--muted);
  background: var(--bg-card-2);
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
  font-size: 13px;
}
.empty-hint .el-icon { font-size: 18px; color: var(--accent); }

@media (max-width: 640px) {
  .nt-tabs :deep(.el-tabs__item) { padding: 0 12px !important; font-size: 12px; }
  .console-wrap { max-width: 100%; }
  .nt-form.console-bar { flex-wrap: wrap; }
  .nt-form.console-bar .el-button { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .nt-tabs :deep(.el-tabs__item) { transition: none; }
}
</style>
