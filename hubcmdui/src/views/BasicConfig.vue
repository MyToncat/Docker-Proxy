<template>
  <div class="page page-config">
    <div class="page-head">
      <div>
        <h2>{{ t('basic.title') }}</h2>
        <p class="muted">{{ t('basic.subtitle') }}</p>
      </div>
    </div>

    <!-- ============ Logo 设置 ============ -->
    <el-card shadow="never" class="section-card">
      <div class="section-head">
        <div class="section-icon icon-logo">
          <el-icon><Picture /></el-icon>
        </div>
        <div style="flex: 1;">
          <div class="section-title">{{ t('basic.logoSectionTitle') }}</div>
          <div class="muted">{{ t('basic.logoSectionDesc') }}</div>
        </div>
        <el-button type="primary" :loading="loadingLogo" @click="onSaveLogo">
          <el-icon><Check /></el-icon> {{ t('basic.saveLogo') }}
        </el-button>
      </div>

      <el-form label-width="100px" class="logo-form">
        <el-form-item label="Logo URL">
          <el-input
            v-model="logoForm.logoUrl"
            :placeholder="t('basic.logoUrlPlaceholder')"
            clearable
          />
        </el-form-item>
        <div class="muted small">{{ t('basic.logoFormatHint') }}</div>
        <div v-if="logoForm.logoUrl" class="logo-preview">
          <img :src="logoForm.logoUrl" alt="logo preview" @error="onLogoError" />
        </div>
      </el-form>
    </el-card>

    <!-- ============ Registry 平台配置 ============ -->
    <el-card shadow="never" class="section-card">
      <div class="section-head">
        <div class="section-icon icon-reg">
          <el-icon><Files /></el-icon>
        </div>
        <div style="flex: 1;">
          <div class="section-title">{{ t('basic.registrySectionTitle') }}</div>
          <div class="muted">{{ t('basic.registrySectionDesc') }}</div>
        </div>
      </div>

      <div v-loading="loadingReg" class="registry-grid">
        <div
          v-for="r in registries"
          :key="r.registryId"
          class="reg-card"
          :class="{ disabled: !r.enabled, 'no-proxy': !r.proxyUrl }"
        >
          <!-- 卡片头：图标 + 名称 + 状态 -->
          <div class="reg-head">
            <div class="reg-icon" :style="{ background: r.color || '#3b82f6' }">
              <i v-if="r.iconClass" :class="r.iconClass" />
              <el-icon v-else><Box /></el-icon>
            </div>
            <div class="reg-meta">
              <div class="reg-name">{{ r.name }}</div>
              <div class="reg-domain">{{ r.prefix || r.registryId }}</div>
            </div>
            <div class="reg-status" :class="r.enabled ? 'on' : 'off'">
              <span class="dot"></span>
              <span>{{ r.enabled ? t('basic.statusEnabled') : t('basic.statusDisabled') }}</span>
            </div>
          </div>

          <div class="reg-desc">{{ r.description || '—' }}</div>

          <!-- 启用开关 -->
          <div class="reg-row">
            <span class="row-label">{{ t('common.enabled') }}</span>
            <el-switch
              v-model="r.enabled"
              :active-color="r.color || '#22c55e'"
              :disabled="!r.proxyUrl && !r.enabled"
              @change="(v) => onToggle(r, v)"
            />
          </div>
          <div v-if="!r.enabled && !r.proxyUrl" class="row-hint warn">
            <i class="fas fa-exclamation-triangle"></i> {{ t('basic.fillProxyFirst') }}
          </div>

          <!-- 代理地址 -->
          <div class="reg-row">
            <span class="row-label">
              {{ t('basic.proxyAddress') }}
              <el-tag size="small" type="danger" effect="plain" class="req-tag">{{ t('common.required') }}</el-tag>
            </span>
          </div>
          <el-input
            v-model="r.proxyUrl"
            :placeholder="t('basic.proxyPlaceholder', { id: r.registryId })"
            clearable
            class="reg-input"
          />
          <div class="row-hint">{{ t('basic.proxyHint') }}</div>

          <!-- 卡片底部：独立保存按钮 -->
          <div class="reg-foot">
            <el-button
              type="primary"
              :loading="savingId === r.registryId"
              :disabled="!canSave(r)"
              @click="onSaveOne(r)"
              class="save-btn"
            >
              <el-icon><Check /></el-icon> {{ t('common.save') }}
            </el-button>
            <span v-if="!r.proxyUrl" class="empty-warn">
              <i class="fas fa-info-circle"></i> {{ t('basic.proxyEmpty') }}
            </span>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Check, Box, Files } from '@element-plus/icons-vue'
import {
  getConfig,
  saveConfig,
  getRegistryConfigs,
  updateRegistryConfig
} from '../services'

const { t } = useI18n()

const logoForm = ref({ logoUrl: '' })
const registries = ref([])
const loadingReg = ref(false)
const loadingLogo = ref(false)
const savingId = ref(null)

async function loadLogo() {
  try {
    const cfg = await getConfig()
    logoForm.value.logoUrl = (cfg && cfg.logo) || ''
  } catch (e) {
    // 静默失败（容错）
  }
}

async function loadRegistries() {
  loadingReg.value = true
  try {
    const list = await getRegistryConfigs()
    registries.value = (list || []).map((r) => ({
      ...r,
      registryId: r.registryId || r.registry_id,
      proxyUrl: r.proxyUrl || r.proxy_url || '',
      iconClass: r.iconClass || r.icon,
      enabled: !!r.enabled
    }))
  } catch (e) {
    ElMessage.warning(t('basic.loadRegistryFailed', { msg: e.response?.data?.error || e.message }))
  } finally {
    loadingReg.value = false
  }
}

function canSave(r) {
  // 不允许空地址保存（不论是否启用）
  if (!r.proxyUrl || !r.proxyUrl.trim()) return false
  return true
}

function onToggle(r, val) {
  // 启用时强制校验：地址为空时拒绝启用并弹窗
  if (val && (!r.proxyUrl || !r.proxyUrl.trim())) {
    r.enabled = false
    ElMessageBox.alert(
      t('basic.enableAlertMsg', { name: r.name }),
      t('basic.cannotEnable'),
      { type: 'warning', confirmButtonText: t('common.gotIt') }
    )
  }
}

function onLogoError(e) {
  e.target.style.display = 'none'
  ElMessage.warning(t('basic.logoLoadFailed'))
}

async function onSaveLogo() {
  loadingLogo.value = true
  try {
    const cfg = await getConfig().catch(() => ({}))
    const next = { ...(cfg || {}), logo: logoForm.value.logoUrl || '' }
    await saveConfig(next)
    ElMessage.success(t('basic.logoSaved'))
  } catch (e) {
    ElMessage.error(t('basic.saveFailed', { msg: e.response?.data?.error || e.message }))
  } finally {
    loadingLogo.value = false
  }
}

async function onSaveOne(r) {
  // 防御性校验：地址为空时弹窗拒绝
  if (!r.proxyUrl || !r.proxyUrl.trim()) {
    ElMessageBox.alert(
      t('basic.saveAlertMsg', { name: r.name }),
      t('basic.cannotSave'),
      { type: 'warning', confirmButtonText: t('common.gotIt') }
    )
    return
  }
  savingId.value = r.registryId
  try {
    await updateRegistryConfig(r.registryId, {
      enabled: !!r.enabled,
      proxyUrl: r.proxyUrl.trim()
    })
    ElMessage.success(t('basic.savedWithName', { name: r.name }))
  } catch (e) {
    ElMessage.error(t('basic.saveFailed', { msg: e.response?.data?.error || e.message }))
  } finally {
    savingId.value = null
  }
}

onMounted(() => {
  loadLogo()
  loadRegistries()
})
</script>

<style scoped>
.page-config { color: var(--fg); }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
.page-head h2 { margin: 0 0 4px; font-size: 20px; color: var(--fg); }
.muted { color: var(--muted); margin: 0; font-size: 13px; }
.muted.small { font-size: 12px; margin-top: -10px; margin-bottom: 12px; }

.section-card { background: var(--bg-card); border-color: var(--border); margin-bottom: 16px; }
.section-head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.section-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; flex-shrink: 0; }
.icon-logo { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.icon-reg { background: linear-gradient(135deg, #06b6d4, #3b82f6); }
.section-title { font-size: 16px; font-weight: 600; color: var(--fg); }

.logo-form { max-width: 720px; }
.logo-preview { margin-top: 12px; padding: 16px; background: var(--bg-card-2); border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); }
.logo-preview img { max-height: 64px; max-width: 200px; object-fit: contain; }

.registry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.reg-card {
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
}
.reg-card:hover { border-color: var(--border-strong); transform: translateY(-2px); box-shadow: var(--shadow-hover); }
.reg-card.disabled { opacity: 0.75; }
.reg-card.no-proxy { border-style: dashed; }

.reg-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
.reg-icon {
  width: 42px; height: 42px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 22px; flex-shrink: 0;
}
.reg-meta { flex: 1; min-width: 0; }
.reg-name {
  font-weight: 600; color: var(--fg); font-size: 14px; line-height: 1.2;
  /* 统一卡片头高度：所有名称统一占用 2 行空间，1 行名字用 min-height 顶到 2 行 */
  min-height: calc(14px * 1.2 * 2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.reg-domain { color: var(--muted); font-size: 12px; margin-top: 2px; font-family: ui-monospace, "SF Mono", Menlo, monospace; }

.reg-status {
  display: flex; align-items: center; gap: 4px; font-size: 12px;
  padding: 2px 8px; border-radius: 999px; flex-shrink: 0;
  /* 状态徽章与图标顶部对齐，不再随名称行数上下浮动 */
  margin-top: 2px;
}
.reg-status .dot { width: 6px; height: 6px; border-radius: 50%; }
.reg-status.on { background: rgba(34, 197, 94, .12); color: #4ade80; }
.reg-status.on .dot { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
.reg-status.off { background: rgba(239, 68, 68, .12); color: #f87171; }
.reg-status.off .dot { background: #f87171; }

.reg-desc { color: var(--muted); font-size: 12px; margin-bottom: 14px; line-height: 1.4; }

.reg-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.row-label { font-size: 13px; color: var(--fg-2); display: flex; align-items: center; gap: 6px; }
.req-tag { transform: scale(.85); }

.reg-input :deep(.el-input__wrapper) { background: var(--bg-input); }
.reg-input :deep(.el-input__inner) { color: var(--fg); }

.row-hint { color: var(--muted-2); font-size: 11px; margin-top: 4px; }
.row-hint.warn { color: #f59e0b; }

.reg-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.save-btn { flex: 1; }
.empty-warn {
  font-size: 12px;
  color: #f59e0b;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
