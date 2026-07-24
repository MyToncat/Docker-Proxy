<template>
  <!-- 形态 1：完整胶囊（顶栏用，文字 + 图标 + 箭头，自带浅底色边框） -->
  <el-dropdown v-if="variant === 'default'" trigger="click" @command="onCommand">
    <span
      class="lang-toggle lang-toggle--default"
      :title="t('app.language')"
      role="button"
      :aria-label="t('app.language')"
      tabindex="0"
    >
      <svg class="lang-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      <span class="lang-text">{{ currentLabel }}</span>
      <el-icon class="caret"><CaretBottom /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="opt in options"
          :key="opt.code"
          :command="opt.code"
          :class="{ 'is-active': opt.code === locale }"
        >
          {{ opt.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <!-- 形态 2：导航胶囊（Landing 等公开页用，与 .hd-pill 完全同款视觉语言；默认纯图标，文字仅在下拉项显示） -->
  <el-dropdown v-else-if="variant === 'nav'" trigger="click" @command="onCommand">
    <span
      class="lang-toggle lang-toggle--nav"
      :title="currentLabel"
      role="button"
      :aria-label="ariaLabel"
      tabindex="0"
    >
      <svg class="lang-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      <svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="opt in options"
          :key="opt.code"
          :command="opt.code"
          :class="{ 'is-active': opt.code === locale }"
        >
          {{ opt.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <!-- 形态 3：极简圆按钮（登录卡 / 极简场景用） -->
  <el-dropdown v-else trigger="click" @command="onCommand">
    <span
      class="lang-toggle lang-toggle--icon"
      :title="currentLabel"
      role="button"
      :aria-label="ariaLabel"
      tabindex="0"
    >
      <svg class="lang-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="opt in options"
          :key="opt.code"
          :command="opt.code"
          :class="{ 'is-active': opt.code === locale }"
        >
          {{ opt.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, persistLocale } from '../i18n'

const props = defineProps({
  // 'default' = 文字+图标+箭头胶囊，自带浅底色边框（默认，后台顶栏用）
  // 'nav'     = 跟 .hd-pill 完全同款胶囊（公开页 / Landing 等有 nav 胶囊的场景用）
  // 'icon'    = 极简圆按钮（登录卡等极简场景用）
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'nav', 'icon'].includes(v)
  }
})

// 兼容旧 prop `mode`（之前 Login 用了 mode="icon"），未传 variant 时回退到 mode
const variant = computed(() => props.variant)

const { t, locale } = useI18n()
const options = SUPPORTED_LOCALES

const currentLabel = computed(() => {
  const found = SUPPORTED_LOCALES.find((s) => s.code === locale.value)
  return found ? found.label : '中文'
})

// 无障碍：图标按钮要给屏幕阅读器讲明「语言：<当前>，点击切换」
const ariaLabel = computed(() => `${t('app.language')}：${currentLabel.value}`)

function onCommand(code) {
  locale.value = code
  persistLocale(code)
}
</script>

<style scoped>
/* ===== 通用：focus 圆环 + 过渡 ===== */
.lang-toggle {
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}
.lang-toggle:focus-visible {
  box-shadow: 0 0 0 2px rgba(61, 124, 244, 0.35);
}

/* ===== default：完整胶囊（后台顶栏用，自带浅底色边框） ===== */
.lang-toggle--default {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--bg-hover);
  color: var(--fg-2);
  font-size: 13px;
  border: 1px solid var(--border);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.lang-toggle--default:hover {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent);
}
.lang-toggle--default .lang-icon { font-size: 16px; }
.lang-toggle--default .lang-text { font-weight: 500; }
.lang-toggle--default .caret { font-size: 10px; opacity: 0.7; }

/* ===== nav：导航胶囊（公开页用，与 .hd-pill 完全同款视觉语言） ===== */
.lang-toggle--nav {
  /* 关键参数与 .hd-pill 完全一致：高度 36 / 圆角 999 / padding 0 12 / gap 6 / 字号 13.5 / 字重 600 */
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: #475569;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.1px;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  text-decoration: none;
  transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.lang-toggle--nav .lang-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lang-toggle--nav .caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  opacity: 0.85;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lang-toggle--nav .caret svg { width: 100%; height: 100%; display: block; }
.lang-toggle--nav:hover {
  color: #1e3a8a;
  background: #fff;
  border-color: rgba(61, 124, 244, 0.25);
  box-shadow: 0 2px 8px rgba(61, 124, 244, 0.12);
}

/* ===== icon：极简圆按钮（登录卡用） ===== */
.lang-toggle--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  color: var(--fg-2, #4b5563);
  border: 1px solid transparent;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.lang-toggle--icon:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  color: var(--accent, #3D7CF4);
  border-color: var(--border, rgba(0, 0, 0, 0.06));
}
.lang-toggle--icon .lang-icon { display: block; }
</style>

<style>
/* 主题色兼容：登录卡默认在白底上，没拿到 --bg-hover/--accent 时兜底 */
.login-card .lang-toggle--icon {
  color: #4b5563;
}
.login-card .lang-toggle--icon:hover {
  background: rgba(61, 124, 244, 0.08);
  color: #3D7CF4;
  border-color: rgba(61, 124, 244, 0.18);
}
/* 深色模式：icon 形态 */
:root.dark .lang-toggle--icon {
  color: #cbd5e1;
}
:root.dark .lang-toggle--icon:hover {
  background: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
  border-color: rgba(148, 163, 184, 0.18);
}
/* 下拉菜单激活项 */
.el-dropdown-menu .el-dropdown-item.is-active {
  color: #3D7CF4;
  font-weight: 600;
  background: rgba(61, 124, 244, 0.08);
}
</style>
