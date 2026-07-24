<template>
  <!-- 首次会话检查未完成时显示加载占位，避免刷新 /admin 时闪现登录页 -->
  <div v-if="!ready" class="auth-loading">
    <div class="auth-loading-inner">
      <div class="spinner"></div>
      <p class="auth-loading-text">{{ t('common.verifying') }}</p>
    </div>
  </div>
  <Login v-else-if="!authed" :redirect="intended" @logged-in="onLoggedIn" />
  <AdminLayout v-else>
    <router-view v-slot="{ Component }">
      <!-- 仅缓存系统看板：切到其他菜单再切回时，保留其实例与数据，避免重新拉取全部数据 -->
      <keep-alive include="Dashboard">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Login from '../views/Login.vue'
import AdminLayout from '../layout/AdminLayout.vue'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { authed, ready, refresh } = useAuth()

// 记录用户真正想访问的后台地址，登录成功后跳回（保持地址栏干净，不出现 ?redirect=）
const intended = ref('/admin')

// Login 完成登录后通知这里，统一处理跳转；避免 Login 内部重复 push 路由
function onLoggedIn() {
  // AdminShell 模板会因 authed 变为 true 自动从 Login 切到 AdminLayout（router-view 渲染默认子路由）
  // 若用户原本访问的是某个具体子路由，再 replace 一次即可
  const target = intended.value
  if (target && target !== route.fullPath) {
    router.replace(target)
  }
}

onMounted(() => {
  intended.value = route.fullPath || '/admin'
  refresh()
})
</script>

<style scoped>
.auth-loading {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base, #f5f7fb);
  z-index: 9999;
}
.auth-loading-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(61, 124, 244, 0.18);
  border-top-color: #3D7CF4;
  border-radius: 50%;
  animation: auth-spin 0.8s linear infinite;
}
.auth-loading-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #6e6e73);
  letter-spacing: 0.4px;
}
@keyframes auth-spin {
  to { transform: rotate(360deg); }
}
</style>
