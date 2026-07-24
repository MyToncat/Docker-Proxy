<template>
  <div class="menu-page">
    <!-- 顶部标题栏 -->
    <div class="page-head">
      <div>
        <h2>{{ t('menu.title') }}</h2>
        <p class="muted">{{ t('menu.subtitle') }}</p>
      </div>
      <el-button type="primary" class="add-btn" @click="openAdd">
        <el-icon><Plus /></el-icon> {{ t('menu.addItem') }}
      </el-button>
    </div>

    <!-- ============ KPI 概览 ============ -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-ic stat-ic--blue"><el-icon><Menu /></el-icon></div>
        <div class="stat-meta"><span class="stat-val">{{ items.length }}</span><span class="stat-lbl">{{ t('menu.statTotal') }}</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-ic stat-ic--green"><el-icon><Promotion /></el-icon></div>
        <div class="stat-meta"><span class="stat-val">{{ newTabCount }}</span><span class="stat-lbl">{{ t('menu.statNewTab') }}</span></div>
      </div>
    </div>

    <!-- ============ 工具栏 ============ -->
    <div class="toolbar">
      <el-input v-model="search" class="toolbar__search" :placeholder="t('menu.searchPlaceholder')" clearable>
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <span class="toolbar__spacer" />
      <span class="toolbar__count" v-html="t('menu.countLabel', { count: '<b>' + filteredItems.length + '</b>' })" />
      <el-button :icon="Refresh" circle plain :title="t('common.refresh')" @click="load" />
    </div>

    <!-- ============ 菜单项表格 ============ -->
    <div class="table-card" v-loading="loading">
      <el-table
        v-if="filteredItems.length"
        :data="filteredItems"
        :row-key="rowKey"
        :empty-text="t('menu.emptyTable')"
        class="admin-table"
        stripe
      >
        <el-table-column type="index" label="#" width="64" align="center">
          <template #default="{ $index }">
            <span class="row-index">{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('menu.colIcon')" width="90" align="center">
          <template #default="{ row }">
            <span class="cell-icon" :class="{ 'cell-icon--empty': !row.icon }" v-html="getMenuIconSvg(row.icon)" />
          </template>
        </el-table-column>
        <el-table-column :label="t('menu.colText')" min-width="200">
          <template #default="{ row }">
            <!-- 菜单文本直接展示：左侧不再放头像占位（与独立的"图标"列重复） -->
            <span class="cell-title">{{ row.text || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('menu.colLink')" min-width="240">
          <template #default="{ row }">
            <code class="cell-code">{{ row.link || '-' }}</code>
          </template>
        </el-table-column>
        <el-table-column :label="t('menu.colNewTab')" width="120" align="center">
          <template #default="{ row }">
            <span class="badge" :class="row.newTab ? 'badge--yes' : 'badge--no'">
              {{ row.newTab ? t('common.yes') : t('common.no') }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button circle size="small" type="primary" plain @click="openEdit(row)" :title="t('common.edit')">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button circle size="small" type="danger" plain @click="onDelete(row)" :title="t('common.delete')">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-else class="empty-state">
        <div class="empty-ic"><el-icon><Menu /></el-icon></div>
        <div class="empty-title">{{ search ? t('menu.emptyMatch') : t('menu.emptyNone') }}</div>
        <p class="empty-desc">
          {{ search ? t('menu.emptyMatchDesc', { search }) : t('menu.emptyNoneDesc') }}
        </p>
        <div class="empty-actions">
          <el-button v-if="search" @click="search = ''">{{ t('menu.clearSearch') }}</el-button>
          <el-button v-else type="primary" class="add-btn" @click="openAdd"><el-icon><Plus /></el-icon> {{ t('menu.addItem') }}</el-button>
        </div>
      </div>
    </div>

    <!-- ============ 编辑/添加对话框（紧凑布局：banner 缩小、文本/链接两列、图标选择器紧凑） ============ -->
    <el-dialog
      v-model="dialogVisible"
      width="600px"
      :show-close="false"
      :close-on-click-modal="false"
      align-center
      class="menu-edit-dialog"
    >
      <template #header>
        <div class="dialog-banner">
          <div class="banner-icon">
            <el-icon><EditPen /></el-icon>
          </div>
          <div class="banner-text">
            <h3 class="banner-title">{{ isEdit ? t('menu.editItem') : t('menu.addItem') }}</h3>
            <p class="banner-subtitle">{{ t('menu.dialogSubtitle') }}</p>
          </div>
        </div>
      </template>

      <div class="dialog-body">
        <!-- Row 1: 菜单文本 + 链接地址 两列 -->
        <div class="form-row form-row--2col">
          <div class="form-group">
            <label class="form-label">
              <span class="label-icon">
                <el-icon><EditPen /></el-icon>
              </span>
              {{ t('menu.colText') }}
            </label>
            <el-input
              v-model="form.text"
              :placeholder="t('menu.textPlaceholder')"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">
              <span class="label-icon">
                <el-icon><Link /></el-icon>
              </span>
              {{ t('menu.colLink') }}
            </label>
            <el-input
              v-model="form.link"
              :placeholder="t('menu.linkPlaceholder')"
              class="form-input"
            />
          </div>
        </div>

        <!-- Row 2: 菜单图标（紧凑：preview 缩小 / cell 缩小 / 自定义 SVG 折叠） -->
        <div class="form-group">
          <label class="form-label">
            <span class="label-icon">
              <el-icon><Picture /></el-icon>
            </span>
            {{ t('menu.iconLabel') }}
          </label>
          <div class="icon-picker">
            <div class="icon-picker__preview" :class="{ 'icon-picker__preview--empty': !form.icon }">
              <!-- 关键：v-if 包裹。空时（"无"格）不渲染任何图标 SVG，避免 getMenuIconSvg 兜底导致显示链接图标 -->
              <span v-if="form.icon" class="icon-picker__preview-ic" v-html="getMenuIconSvg(form.icon)"></span>
              <span v-if="!form.icon" class="icon-picker__placeholder">{{ t('menu.none') }}</span>
            </div>
            <div class="icon-picker__grid">
              <!-- 「无」格：清空选择，使用通用链接图标作为兜底 -->
              <button
                type="button"
                class="icon-cell icon-cell--clear"
                :class="{ 'icon-cell--active': !form.icon }"
                :title="t('menu.clearIconTitle')"
                @click="clearIcon"
              >
                <span class="icon-cell__clear-mark">∅</span>
                <span class="icon-cell__label">{{ t('menu.none') }}</span>
              </button>
              <button
                v-for="it in menuIconList"
                :key="it.key"
                type="button"
                class="icon-cell"
                :class="{ 'icon-cell--active': form.icon === it.key }"
                :title="it.label"
                @click="form.icon = it.key"
              >
                <span v-html="getMenuIconSvg(it.key)"></span>
                <span class="icon-cell__label">{{ it.label }}</span>
              </button>
            </div>
          </div>
          <!-- 自定义 SVG 输入：默认折叠，留空则使用上方选中的预设图标 -->
          <details class="icon-custom">
            <summary class="icon-custom__summary">
              <span>{{ t('menu.customSvg') }}</span>
              <el-icon class="icon-custom__chevron"><ArrowDown /></el-icon>
            </summary>
            <el-input
              v-model="form.iconCustom"
              type="textarea"
              :rows="2"
              :placeholder="t('menu.svgPlaceholder')"
              class="icon-custom__textarea"
              @input="onCustomSvgInput"
            />
          </details>
        </div>

        <!-- Row 3: 新标签页 + 效果预览（左右两个 .preview-block 视觉对称：同 label 位置、同 body 高度） -->
        <div class="form-row form-row--2col form-row--bottom preview-row">
          <div class="preview-block">
            <label class="preview-block__label">
              <span class="label-icon"><el-icon><Promotion /></el-icon></span>
              {{ t('menu.statNewTab') }}
            </label>
            <div class="preview-block__body">
              <el-switch v-model="form.newTab" class="toggle-switch" />
            </div>
          </div>
          <div class="preview-block">
            <label class="preview-block__label">
              <span class="label-icon"><el-icon><View /></el-icon></span>
              {{ t('menu.preview') }}
            </label>
            <div class="preview-block__body preview-block__body--link">
              <a
                href="javascript:void(0)"
                class="preview-link"
                :class="{ 'has-external': form.newTab, 'preview-link--gh': isGithubIcon() }"
              >
                <!-- 同预览框：v-if 包裹，form.icon 为空时不渲染任何图标 SVG -->
                <span
                  v-if="form.icon || isGithubIcon()"
                  class="preview-link__ic"
                  v-html="getMenuIconSvg(form.icon || (isGithubIcon() ? 'github' : ''))"
                />
                <span>{{ form.text || t('menu.menuItemFallback') }}</span>
                <el-icon v-if="form.newTab" class="external-icon"><Promotion /></el-icon>
              </a>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button class="footer-btn" @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
          <el-button class="footer-btn primary" :loading="saving" @click="onSave">
            <el-icon><Check /></el-icon> {{ t('menu.saveChanges') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, EditPen, Link, Promotion, View, Check, Menu, Search, Refresh, Picture, ArrowDown } from '@element-plus/icons-vue'
import { getMenuItems, saveMenuItems } from '../services'
import { getMenuIconSvg, MENU_ICON_LIST, isCustomIconSvg } from '../lib/menuIcons'

const { t } = useI18n()

const menuIconList = MENU_ICON_LIST

const items = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editIndex = ref(-1)
const search = ref('')

const newTabCount = computed(() => items.value.filter(i => i.newTab).length)
const filteredItems = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return items.value
  return items.value.filter(i =>
    (i.text || '').toLowerCase().includes(kw) ||
    (i.link || '').toLowerCase().includes(kw) ||
    (i.icon || '').toLowerCase().includes(kw)
  )
})

const form = reactive({
  text: '',
  link: '',
  icon: '',
  // 自定义 SVG 临时编辑态：仅在用户输入时填充，保存时若非空则覆盖 form.icon
  iconCustom: '',
  newTab: false
})

function rowKey(row) {
  return row.text + '|' + row.link + '|' + (row.newTab ? 1 : 0) + '|' + (row.icon || '')
}

// GitHub 链接/文本/图标识别，用于预览与样式（与公开页 isGithubItem 逻辑一致）
function isGithubIcon() {
  if (!form) return false
  const text = String(form.text || '').trim().toLowerCase()
  const link = String(form.link || '').toLowerCase()
  const icon = String(form.icon || '').trim().toLowerCase()
  return text === 'github' || link.includes('github.com') || icon === 'github'
}

async function load() {
  loading.value = true
  try {
    const data = await getMenuItems()
    items.value = Array.isArray(data) ? data.map(it => ({
      text: it.text || '',
      link: it.link || '',
      icon: it.icon || '',
      newTab: !!it.newTab
    })) : []
  } catch (e) {
    ElMessage.warning(t('menu.readFailed', { msg: e.response?.data?.error || e.message }))
  } finally {
    loading.value = false
  }
}

function openAdd() {
  isEdit.value = false
  editIndex.value = -1
  form.text = ''
  form.link = ''
  form.icon = ''
  form.iconCustom = ''
  form.newTab = false
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  editIndex.value = items.value.findIndex(r =>
    r.text === row.text && r.link === row.link && (r.icon || '') === (row.icon || '')
  )
  form.text = row.text || ''
  form.link = row.link || ''
  form.icon = row.icon || ''
  // 如果已存的 icon 是原始 SVG，回填到自定义输入框；否则留空
  form.iconCustom = isCustomIconSvg(row.icon) ? row.icon : ''
  form.newTab = !!row.newTab
  dialogVisible.value = true
}

// 清空图标选择（点网格中"无"格触发）
function clearIcon() {
  form.icon = ''
  form.iconCustom = ''
}

// 自定义 SVG 输入：填充时同步到 form.icon 供预览；同时清掉预设选中态
function onCustomSvgInput(val) {
  const v = (val || '').trim()
  if (v) {
    form.icon = v
  } else {
    // 清空自定义输入时，如果原 icon 是原始 SVG 则重置，否则保留预设选择
    if (isCustomIconSvg(form.icon)) form.icon = ''
  }
}

// 链接格式校验：仅接受 http(s):// 开头的绝对 URL，或 / 开头的站内路径
// 拒绝危险协议（javascript: / data: / vbscript: / file:）防止 XSS
function isValidLink(link) {
  if (!link) return false
  const v = link.trim()
  if (!v) return false
  // 危险协议黑名单
  if (/^\s*(javascript|data|vbscript|file):/i.test(v)) return false
  // 站内路径：必须 / 开头（且不是 //xxx，那会被当作 protocol-relative）
  if (v.startsWith('/') && !v.startsWith('//')) return true
  // 完整 http/https URL
  if (/^https?:\/\//i.test(v)) return true
  return false
}

function validate() {
  const text = (form.text || '').trim()
  const link = (form.link || '').trim()
  if (!text) return t('menu.pleaseText')
  if (!link) return t('menu.pleaseLink')
  if (!isValidLink(link)) {
    return t('menu.invalidLink')
  }
  return null
}

async function onSave() {
  const err = validate()
  if (err) {
    ElMessage.warning(err)
    return
  }
  saving.value = true
  try {
    // 与后端 schema 对齐：text / link / icon / newTab
    // 写回时如果 icon 为空串则不传，由后端回退到 link 识别（保持兼容）
    const next = items.value.map(it => {
      const obj = {
        text: (it.text || '').trim(),
        link: (it.link || '').trim(),
        newTab: !!it.newTab
      }
      if (it.icon) obj.icon = it.icon
      return obj
    })
    const text = form.text.trim()
    const link = form.link.trim()
    const newTab = !!form.newTab
    const icon = (form.icon || '').trim()
    const patch = { text, link, newTab }
    if (icon) patch.icon = icon
    if (isEdit.value && editIndex.value >= 0) {
      next.splice(editIndex.value, 1, patch)
    } else {
      next.push(patch)
    }
    await saveMenuItems(next)
    ElMessage.success(isEdit.value ? t('menu.updated') : t('menu.added'))
    dialogVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(t('menu.saveFailed', { msg: e.response?.data?.error || e.message }))
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      t('menu.confirmDelete', { text: row.text }),
      t('menu.deleteConfirmTitle'),
      { type: 'warning', confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel') }
    )
  } catch { return }
  const i = items.value.findIndex(r =>
    r.text === row.text && r.link === row.link && (r.icon || '') === (row.icon || '')
  )
  if (i < 0) return
  items.value.splice(i, 1)
  try {
    const next = items.value.map(it => {
      const obj = {
        text: (it.text || '').trim(),
        link: (it.link || '').trim(),
        newTab: !!it.newTab
      }
      if (it.icon) obj.icon = it.icon
      return obj
    })
    await saveMenuItems(next)
    ElMessage.success(t('menu.deleted'))
  } catch (e) {
    ElMessage.error(t('menu.deleteFailed', { msg: e.response?.data?.error || e.message }))
    await load()
  }
}

onMounted(load)
</script>

<style scoped>
.menu-page { color: var(--fg); }

/* ============ 顶部 ============ */
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
}
.page-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
  color: var(--fg);
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-head h2::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 18px;
  background: linear-gradient(135deg, #3D7CFA, #6366f1);
  border-radius: 2px;
}
.muted { color: var(--muted); margin: 0; font-size: 13px; }
.add-btn {
  background: linear-gradient(135deg, #3D7CFA, #6366f1);
  border: none;
  box-shadow: 0 4px 14px rgba(61, 124, 250, .35);
}
.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(61, 124, 250, .45);
}

/* 表格样式已统一迁移至全局 theme.css 的 .admin-table 系统
   （含表头/行/hover/斑马纹，以及 .row-index / .cell-code / .badge-* / .row-actions 通用工具类） */

/* ============ 编辑对话框（紧凑布局：banner 缩小 + 两列 + 紧凑选择器） ============ */
:deep(.menu-edit-dialog) {
  border-radius: 16px;
  overflow: hidden;
  padding: 0;
  background: var(--bg-card) !important;
}
:deep(.menu-edit-dialog .el-dialog__header) {
  padding: 0;
  margin: 0;
  background: linear-gradient(135deg, #3d7cfa 0%, #6366f1 100%);
}
:deep(.menu-edit-dialog .el-dialog__body) {
  padding: 16px 22px 4px;
}
:deep(.menu-edit-dialog .el-dialog__footer) {
  padding: 8px 22px 16px;
}

/* Banner：横排布局（图标 + 文字），比之前"图标在上、标题副标题在下"更省垂直空间 */
.dialog-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  color: #fff;
}
.banner-icon {
  width: 38px;
  height: 38px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  font-size: 18px;
  color: #fff;
  flex-shrink: 0;
}
.banner-text { display: flex; flex-direction: column; gap: 1px; }
.banner-title {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  line-height: 1.3;
}
.banner-subtitle {
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  margin: 0;
  line-height: 1.3;
}

/* 表单行：单列 / 两列 */
.dialog-body { padding-top: 0; }
.form-row {
  display: grid;
  gap: 12px;
}
.form-row--2col {
  grid-template-columns: 1fr 1fr;
}
.form-row--bottom { margin-top: 4px; }

/* 表单组 */
.form-group { margin-bottom: 12px; }
.form-group--inline { margin-bottom: 0; }
.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  margin-bottom: 6px;
}
.form-label--inline { margin-bottom: 0; }
.label-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  background: rgba(61, 124, 250, .12);
  color: var(--accent);
  font-size: 11px;
  flex-shrink: 0;
}
.form-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--border) inset !important;
  background: var(--bg-input);
  padding: 1px 11px;
}
.form-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--accent) inset, 0 0 0 3px rgba(61, 124, 250, .12) !important;
}
.form-input :deep(.el-input__inner) {
  color: var(--fg);
  font-size: 13.5px;
  height: 32px;
}
.form-hint {
  font-size: 11.5px;
  color: var(--muted);
  margin: 5px 0 0 0;
}

/* Row 3 布局：新标签页 + 效果预览（左右两个 .preview-block 视觉对称） */
.preview-row { align-items: stretch; }
.preview-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.preview-block__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-2);
  margin: 0;
}
.preview-block__body {
  display: flex;
  align-items: center;
  /* 同 toggle-row 一致：浅灰底 + 1px 边框 + 圆角 8 + min-height 38，让两列视觉等高 */
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px 10px;
  min-height: 38px;
}
.preview-block__body--link { padding: 0 10px; }
.preview-block__body .toggle-switch { margin-left: 0; }
.preview-block__body .preview-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
  font-size: 13px;
  background: transparent;
  border: none;
  padding: 0;
  min-height: auto;
  width: 100%;
}
.preview-block__body .preview-link:hover { background: transparent; color: var(--accent); }

.dialog-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.footer-btn {
  min-width: 110px;
  height: 36px;
  border-radius: 8px;
  font-weight: 600;
}
.footer-btn.primary {
  background: linear-gradient(135deg, #3d7cfa, #6366f1);
  border: none;
  color: #fff;
  box-shadow: 0 4px 14px rgba(61, 124, 250, .35);
}
.footer-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(61, 124, 250, .45);
}
.footer-btn:not(.primary) {
  background: var(--bg-card-2);
  color: var(--fg-2);
  border: 1px solid var(--border);
}
.footer-btn:not(.primary):hover {
  background: var(--bg-hover);
  color: var(--fg);
}

/* ============ 列表中的图标列 ============ */
.cell-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  color: var(--fg-2);
}
.cell-icon :deep(svg) { width: 18px; height: 18px; display: block; }
.cell-icon--empty {
  background: transparent;
  color: var(--muted);
  font-size: 12px;
}

/* ============ 图标选择器（紧凑版：preview 缩小 + cell 缩小 + 网格自适应） ============ */
.icon-picker {
  display: flex;
  gap: 10px;
  align-items: stretch;
}
.icon-picker__preview {
  width: 50px;
  height: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card-2);
  border: 1.5px dashed var(--border);
  border-radius: 10px;
  color: var(--accent);
  position: relative;
}
.icon-picker__preview:not(.icon-picker__preview--empty) {
  border-style: solid;
  background: linear-gradient(135deg, rgba(61, 124, 250, .08), rgba(99, 102, 241, .08));
  border-color: rgba(61, 124, 250, .35);
  color: var(--accent);
}
.icon-picker__preview-ic {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
}
.icon-picker__preview-ic :deep(svg) { width: 100%; height: 100%; display: block; }
.icon-picker__placeholder {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}
.icon-picker__grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 4px;
  padding: 6px;
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 102px; /* 2 行：40 + 4 + 40 = 84 + 12 padding = 96，给一点缓冲 */
  overflow-y: auto;
}
.icon-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 3px 2px;
  height: 40px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--fg-2);
  cursor: pointer;
  transition: all .15s ease;
  font-family: inherit;
}
.icon-cell:hover {
  border-color: rgba(61, 124, 250, .45);
  color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(61, 124, 250, .12);
}
.icon-cell--active {
  background: linear-gradient(135deg, rgba(61, 124, 250, .12), rgba(99, 102, 241, .12));
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 0 2px rgba(61, 124, 250, .2);
}
.icon-cell :deep(svg) { width: 16px; height: 16px; display: block; }
.icon-cell__label {
  font-size: 9.5px;
  line-height: 1;
  color: var(--muted);
}
.icon-cell--active .icon-cell__label { color: var(--accent); font-weight: 600; }

/* 「无」清空格：与普通 icon-cell 保持同尺寸，用 ⌀ 符号表示无图标 */
.icon-cell--clear {
  background: repeating-linear-gradient(45deg, var(--bg-card) 0 4px, transparent 4px 8px);
}
.icon-cell__clear-mark {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  color: var(--muted);
}
.icon-cell--active .icon-cell__clear-mark { color: var(--accent); }

/* 自定义 SVG：折叠面板，默认收起节省空间 */
.icon-custom {
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card-2);
  overflow: hidden;
}
.icon-custom[open] {
  background: var(--bg-card);
}
.icon-custom__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-2);
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.icon-custom__summary::-webkit-details-marker { display: none; }
.icon-custom__chevron {
  font-size: 11px;
  color: var(--muted);
  transition: transform .2s ease;
}
.icon-custom[open] .icon-custom__chevron { transform: rotate(180deg); }
.icon-custom__textarea :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.5;
  resize: vertical;
  min-height: 50px;
  border-top: 1px solid var(--border);
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

/* 预览中的图标 + GitHub 风格 */
.preview-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  padding: 6px 14px;
  border-radius: 8px;
  transition: all .2s ease;
}
.preview-link__ic {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
}
.preview-link__ic :deep(svg) { width: 100%; height: 100%; display: block; }
.preview-link--gh {
  color: #1e293b;
  background: #fff;
  border: 1px solid rgba(226, 232, 240, .9);
}
.preview-link--gh:hover { background: #fff; border-color: #1e293b; }
.preview-link .external-icon { font-size: 11px; opacity: .75; }
</style>
