import { createRouter, createWebHistory } from 'vue-router'

import Landing from '../views/Landing.vue'
import Login from '../views/Login.vue'
import AdminShell from '../views/AdminShell.vue'

const routes = [
  // 公开落地页（镜像搜索 / 文档教程）
  { path: '/', name: 'landing', component: Landing },

  // 登录页（兼容旧链接 /admin/login）；已登录用户进入会自动跳转到 /admin
  { path: '/admin/login', name: 'admin-login', component: Login },

  // 后台管理：由 AdminShell 在「未登录」时原地展示登录页（URL 保持 /admin，不再跳转 /admin/login?redirect=...）
  {
    path: '/admin',
    component: AdminShell,
    children: [
      // 把 /admin 本身作为系统看板，避免额外跳到 /admin/dashboard 导致地址栏出现额外段
      { path: '', name: 'dashboard', component: () => import('../views/Dashboard.vue') },
      // 兼容旧链接：/admin/dashboard → /admin
      { path: 'dashboard', redirect: { name: 'dashboard' } },
      { path: 'basic', name: 'basic', component: () => import('../views/BasicConfig.vue') },
      { path: 'docker', name: 'docker', component: () => import('../views/Docker.vue') },
      { path: 'goproxy', name: 'goproxy', component: () => import('../views/GoProxy.vue') },
      { path: 'ipaccess', name: 'ipaccess', component: () => import('../views/IpAccess.vue') },
      { path: 'documents', name: 'documents', component: () => import('../views/Documents.vue') },
      { path: 'menu', name: 'menu', component: () => import('../views/Menu.vue') },
      { path: 'network', name: 'network', component: () => import('../views/NetworkTest.vue') },
      { path: 'traffic', name: 'traffic', component: () => import('../views/NetworkTraffic.vue') },
      { path: 'monitoring', name: 'monitoring', component: () => import('../views/Monitoring.vue') },
      { path: 'user', name: 'user', component: () => import('../views/UserCenter.vue') }
    ]
  },

  // 兜底
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
