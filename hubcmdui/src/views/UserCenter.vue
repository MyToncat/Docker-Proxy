<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>{{ t('nav.user') }}</h2>
        <p class="muted">{{ t('user.pageSub') }}</p>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="never" class="profile">
          <div class="avatar"><el-icon><User /></el-icon></div>
          <h3>{{ info.username || '-' }}</h3>
          <p class="role">{{ info.role || 'admin' }}</p>
          <ul class="stats">
            <li><span>{{ t('user.loginCount') }}</span><b>{{ info.loginCount ?? '-' }}</b></li>
            <li><span>{{ t('user.lastLogin') }}</span><b>{{ info.lastLogin || t('user.unknown') }}</b></li>
            <li><span>{{ t('user.accountAge') }}</span><b>{{ info.accountAge || t('user.unknown') }}</b></li>
            <li><span>{{ t('user.createdAt') }}</span><b>{{ info.createdAt || t('user.unknown') }}</b></li>
          </ul>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="never">
          <template #header><span>{{ t('user.changePasswordTitle') }}</span></template>
          <el-form label-width="100px" :model="pw">
            <el-form-item :label="t('user.currentPassword')"><el-input v-model="pw.currentPassword" type="password" show-password /></el-form-item>
            <el-form-item :label="t('user.newPassword')"><el-input v-model="pw.newPassword" type="password" show-password :placeholder="t('user.newPasswordPlaceholder')" /></el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="pwSaving" @click="onChangePw"><el-icon><Key /></el-icon> {{ t('user.updatePassword') }}</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" class="uname">
          <template #header><span>{{ t('user.changeUsernameTitle') }}</span></template>
          <el-form label-width="100px" :model="un">
            <el-form-item :label="t('user.newUsername')"><el-input v-model="un.newUsername" :placeholder="t('user.newUsernamePlaceholder')" /></el-form-item>
            <el-form-item :label="t('user.confirmPassword')"><el-input v-model="un.password" type="password" show-password /></el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="unSaving" @click="onChangeUn"><el-icon><Edit /></el-icon> {{ t('user.updateUsername') }}</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <!-- 修改成功 → 5 秒后强制重新登录 -->
    <el-dialog
      v-model="relVisible"
      :title="t('user.relTitle')"
      width="440px"
      align-center
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="rel-body">
        <el-icon class="rel-icon"><Lock /></el-icon>
        <p class="rel-text">
          {{ relMessage }}<br />
          {{ t('user.relCountdownPrefix') }} <b class="rel-count">{{ relCountdown }}</b> {{ t('user.relCountdownSuffix') }}
        </p>
      </div>
      <template #footer>
        <el-button type="primary" @click="logoutNow">{{ t('user.reloginNow') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { User, Key, Edit, Lock } from '@element-plus/icons-vue'
import { getUserInfo, changePassword, changeUsername, logout } from '../services'
import { useAuth } from '../composables/useAuth'
import { isDefaultUsername, isDefaultPassword, isWeakPassword, isCommonUsername, isReservedUsername } from '../lib/security'

const info = ref({})
const pw = ref({ currentPassword: '', newPassword: '' })
const un = ref({ newUsername: '', password: '' })
const pwSaving = ref(false), unSaving = ref(false)

const router = useRouter()
const { authed } = useAuth()
const { t } = useI18n()

// ---- 修改成功 → 5 秒后强制重新登录 ----
const relVisible = ref(false)
const relMessage = ref('')
const relCountdown = ref(5)
let relTimer = null

function startReLogin(type) {
  relMessage.value = type === '密码' ? t('user.relPwSuccess') : t('user.relUnSuccess')
  relCountdown.value = 5
  relVisible.value = true
  if (relTimer) clearInterval(relTimer)
  relTimer = setInterval(() => {
    relCountdown.value -= 1
    if (relCountdown.value <= 0) {
      clearInterval(relTimer)
      relTimer = null
      doForceLogout()
    }
  }, 1000)
}

async function doForceLogout() {
  relVisible.value = false
  try { await logout() } catch (_) { /* 会话可能已被后端销毁，忽略 */ }
  // 关键：置为未登录，AdminShell 会立即从后台布局切回登录页
  authed.value = false
  if (router.currentRoute.value.fullPath !== '/admin') {
    router.replace('/admin')
  }
}

function logoutNow() {
  if (relTimer) { clearInterval(relTimer); relTimer = null }
  doForceLogout()
}

async function load() {
  try { info.value = await getUserInfo() } catch (e) { ElMessage.warning(t('user.loadFailed') + (e.response?.data?.error || e.message)) }
}
async function onChangePw() {
  if (!pw.value.currentPassword || !pw.value.newPassword) { ElMessage.warning(t('common.pleaseFill')); return }
  // 新密码与当前密码相同：直接拒绝，不发起请求
  if (pw.value.currentPassword === pw.value.newPassword) {
    ElMessage.error(t('user.samePwDenied'))
    return
  }
  // 系统默认密码：直接拒绝，不发起请求
  if (isDefaultPassword(pw.value.newPassword)) {
    ElMessage.error(t('user.defaultPwDenied'))
    return
  }
  // 弱口令：弹窗警告，用户确认后仍允许修改
  if (isWeakPassword(pw.value.newPassword)) {
    try {
      await ElMessageBox.confirm(
        t('user.weakPwWarn'),
        t('login.securityTitle'),
        {
          type: 'warning',
          confirmButtonText: t('user.keepUsing'),
          cancelButtonText: t('user.reEnter'),
          confirmButtonClass: 'el-button--danger',
          dangerouslyUseHTMLString: true
        }
      )
    } catch (_) { return }
  }
  pwSaving.value = true
  try {
    await changePassword(pw.value.currentPassword, pw.value.newPassword)
    pw.value = { currentPassword: '', newPassword: '' }
    startReLogin('密码')
  }
  catch (e) { ElMessage.error(e.response?.data?.error || e.message) }
  finally { pwSaving.value = false }
}
async function onChangeUn() {
  if (!un.value.newUsername || !un.value.password) { ElMessage.warning(t('common.pleaseFill')); return }
  // 系统默认用户名：直接拒绝，不发起请求
  if (isDefaultUsername(un.value.newUsername)) {
    ElMessage.error(t('user.defaultUnDenied'))
    return
  }
  // 系统保留用户名（如 admin）：直接拒绝，不发起请求
  if (isReservedUsername(un.value.newUsername)) {
    ElMessage.error(t('user.reservedUnDenied', { name: un.value.newUsername }))
    return
  }
  // 常见用户名：弹窗警告，用户确认后仍允许修改
  if (isCommonUsername(un.value.newUsername)) {
    try {
      await ElMessageBox.confirm(
        t('user.commonUnWarn'),
        t('login.securityTitle'),
        {
          type: 'warning',
          confirmButtonText: t('user.keepUsing'),
          cancelButtonText: t('user.reEnter'),
          confirmButtonClass: 'el-button--danger',
          dangerouslyUseHTMLString: true
        }
      )
    } catch (_) { return }
  }
  unSaving.value = true
  try {
    await changeUsername(un.value.newUsername, un.value.password)
    un.value = { newUsername: '', password: '' }
    startReLogin('用户名')
  }
  catch (e) { ElMessage.error(e.response?.data?.error || e.message) }
  finally { unSaving.value = false }
}
onMounted(load)
onBeforeUnmount(() => { if (relTimer) clearInterval(relTimer) })
</script>

<style scoped>
.page { color: var(--fg); }
.page-head { margin-bottom: 16px; }
.page-head h2 { margin: 0 0 4px; }
.muted { color: var(--muted); margin: 0; font-size: 13px; }
.profile { text-align: center; }
.avatar { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 30px; }
.profile h3 { margin: 0; }
.role { color: var(--muted); margin: 4px 0 16px; text-transform: capitalize; }
.stats { list-style: none; padding: 0; margin: 0; text-align: left; }
.stats li { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.stats span { color: var(--muted); }
.uname { margin-top: 16px; }
:deep(.el-card) { background: var(--bg-card); border-color: var(--border); }

/* ---- 重新登录提示弹窗 ---- */
.rel-body { display: flex; gap: 14px; align-items: flex-start; }
.rel-icon { font-size: 26px; color: var(--accent, #3D7CF4); margin-top: 2px; flex: 0 0 auto; }
.rel-text { margin: 0; font-size: 14px; line-height: 1.7; color: var(--fg); }
.rel-count { color: #f56c6c; font-size: 16px; padding: 0 2px; }
:deep(.el-dialog__title) { font-weight: 600; }
</style>
