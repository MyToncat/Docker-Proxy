<template>
  <el-config-provider :locale="elLocale">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getElLocale } from './i18n'

const { locale } = useI18n()
const elLocale = computed(() => getElLocale(locale.value))
</script>
