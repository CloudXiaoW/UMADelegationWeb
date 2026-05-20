<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { LINK_AUDIT_REPORT_CN, LINK_AUDIT_REPORT_EN, LINK_CONTRACTS } from '@/config'

const { t } = useI18n()

const docsOpen = ref(false)
const docsRef = ref<HTMLElement | null>(null)

function toggleDocs(): void {
  docsOpen.value = !docsOpen.value
}

function closeDocs(): void {
  docsOpen.value = false
}

function onDocumentPointerDown(ev: PointerEvent): void {
  if (!docsOpen.value) return
  const root = docsRef.value
  if (!root) return
  const target = ev.target
  if (target instanceof Node && !root.contains(target)) {
    docsOpen.value = false
  }
}

function onDocumentKeydown(ev: KeyboardEvent): void {
  if (!docsOpen.value) return
  if (ev.key === 'Escape') {
    docsOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeydown, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
})
</script>

<template>
  <header class="nav card">
    <div class="inner">
      <div class="brand">
        <span class="logo">{{ t('nav.logo') }}</span>
        <!-- <span class="tag">{{ t('nav.tagline') }}</span> -->
      </div>
      <nav class="links muted" aria-label="primary">
        <span class="link-here">{{ t('nav.dashboard') }}</span>
        <div ref="docsRef" class="docs-menu">
          <button
            type="button"
            class="docs-trigger"
            :aria-expanded="docsOpen"
            aria-haspopup="menu"
            @click="toggleDocs"
          >
            {{ t('nav.docs') }}
          </button>
          <div v-if="docsOpen" class="dropdown docs-dropdown" role="menu">
            <a
              class="row-a"
              :href="LINK_AUDIT_REPORT_EN"
              target="_blank"
              rel="noreferrer"
              role="menuitem"
              @click="closeDocs"
            >
              {{ t('nav.auditReportEn') }}
            </a>
            <a
              class="row-a"
              :href="LINK_AUDIT_REPORT_CN"
              target="_blank"
              rel="noreferrer"
              role="menuitem"
              @click="closeDocs"
            >
              {{ t('nav.auditReportZh') }}
            </a>
          </div>
        </div>
        <a :href="LINK_CONTRACTS" target="_blank" rel="noreferrer">{{ t('nav.contracts') }}</a>
      </nav>
      <div class="right">
        <slot name="lang" />
        <slot name="wallet" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 30;
  border-radius: 0;
  border-left: 0;
  border-right: 0;
  border-top: 0;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
}
.inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 10px;
  border-left: 3px solid var(--accent);
}
.logo {
  font-weight: 800;
  font-size: 17px;
  letter-spacing: -0.02em;
  color: var(--text);
}
.tag {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}
.links {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
}
.links a {
  color: var(--muted);
}
.links a:hover {
  color: var(--accent-bright);
}
.link-here {
  color: var(--accent-bright);
}
.docs-menu {
  position: relative;
}
.docs-trigger {
  border: 0;
  background: transparent;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
}
.docs-trigger:hover,
.docs-trigger[aria-expanded='true'] {
  color: var(--accent-bright);
}
.docs-dropdown {
  left: 0;
  right: auto;
  min-width: 200px;
}
.docs-dropdown .row-a {
  display: block;
  padding: 10px 10px;
  border-radius: 8px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}
.docs-dropdown .row-a:hover {
  background: var(--surface-2);
  color: var(--accent-bright);
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}
</style>
