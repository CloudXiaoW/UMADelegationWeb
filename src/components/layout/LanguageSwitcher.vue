<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

const { locale } = useI18n()
const current = computed(() => locale.value as 'en' | 'zh')

function pick(lang: 'en' | 'zh'): void {
  setLocale(lang)
}
</script>

<template>
  <div class="wrap" :aria-label="$t('nav.language')">
    <div class="lang-switch">
      <button type="button" :class="{ active: current === 'en' }" @click="pick('en')">EN</button>
      <button type="button" :class="{ active: current === 'zh' }" @click="pick('zh')">中文</button>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  align-items: center;
}
</style>
